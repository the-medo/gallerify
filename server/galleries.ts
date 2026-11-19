import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { defaultGallerySetup, migrateGallerySetup } from '../src/lib/gallery.ts';
import { wallKeyFromLine } from '../src/utils/types.ts';
import { placementIssue } from '../src/utils/artworkGeometry.ts';

export const galleryMigration = `
  CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY,
    ownerId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    setup TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updatedAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS gallery_owner_updated ON gallery(ownerId, updatedAt DESC);`;

const dimensions = z
  .object({
    width: z.int().min(4).max(30),
    height: z.int().min(4).max(30),
    stepSize: z.int().min(2).max(10),
  })
  .refine(({ width, height, stepSize }) =>
    [width, height].every((side) => side >= 2 * stepSize && side % stepSize === 0),
  );
const coordinate = z.int().min(0).max(30);
const point = z.object({ x: coordinate, y: coordinate });
const textureId = z.string().regex(/^[1-8]$/);
const wall = z.object({
  id: z.string().max(40),
  line: z.object({ start: point, end: point }),
  doors: z.boolean(),
  textureId,
});
const update = z.object({
  name: z.string().trim().min(1).max(100),
  revision: z.int().positive(),
  setup: z
    .object({
      schemaVersion: z.literal(2).default(2),
      placements: z
        .array(
          z.object({
            id: z.uuid(),
            artworkId: z.uuid(),
            wallId: z.string().max(40),
            side: z.union([z.literal(1), z.literal(-1)]),
            u: z.number().min(-30).max(30),
            elevation: z.number().min(0).max(3),
            width: z.number().min(0.05).max(30),
            height: z.number().min(0.05).max(3),
          }),
        )
        .max(200)
        .default([]),
      dimensions,
      generatorSettings: dimensions,
      activePresetId: z.string().max(80).nullable(),
      previewMode: z.enum(['2d', '3d']),
      walls: z.array(wall).min(1).max(480),
      floorTextureId: textureId,
    })
    .refine(
      ({ walls, placements, dimensions: { width, height, stepSize } }) =>
        new Set(placements.map((item) => item.id)).size === placements.length &&
        placements.every(
          (item) => !placementIssue(item, Object.fromEntries(walls.map((wall) => [wall.id, wall]))),
        ) &&
        new Set(walls.map((item) => item.id)).size === walls.length &&
        walls.every(({ id, line }) => {
          const { start, end } = line;
          return (
            id === wallKeyFromLine(line) &&
            [start, end].every(
              ({ x, y }) => x <= width && y <= height && x % stepSize === 0 && y % stepSize === 0,
            ) &&
            Math.hypot(end.x - start.x, end.y - start.y) === stepSize
          );
        }),
    ),
});

export const gallerySetupSchema = update.shape.setup;

export function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
}

export async function readBody(request: IncomingMessage, response: ServerResponse) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    json(response, 415, { message: 'Expected a JSON request.' });
    return;
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 128 * 1024) {
      json(response, 413, { message: 'Gallery setup is too large.' });
      return;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    json(response, 400, { message: 'Invalid JSON.' });
  }
}

export async function handleGalleries(
  request: IncomingMessage,
  response: ServerResponse,
  database: DatabaseSync,
  ownerId: string,
  pathname: string,
  origin: string,
) {
  const collection = pathname === '/api/galleries';
  const id = pathname.slice('/api/galleries/'.length);
  const missing = () => json(response, 404, { message: 'Gallery not found.' });
  if (!collection && !z.uuid().safeParse(id).success) return missing();

  if (request.method === 'GET') {
    if (collection) {
      const rows = database
        .prepare(
          'SELECT id, name, updatedAt FROM gallery WHERE ownerId = ? ORDER BY updatedAt DESC, id',
        )
        .all(ownerId);
      return json(response, 200, rows);
    }
    const row = database
      .prepare(
        'SELECT id, name, setup, revision, updatedAt FROM gallery WHERE ownerId = ? AND id = ?',
      )
      .get(ownerId, id);
    if (!row) return missing();
    return json(response, 200, {
      ...row,
      setup: migrateGallerySetup(JSON.parse(String(row.setup))),
    });
  }

  if (request.method !== (collection ? 'POST' : 'PUT')) {
    response.setHeader('Allow', collection ? 'GET, POST' : 'GET, PUT');
    return json(response, 405, { message: 'Method not allowed.' });
  }
  if (request.headers.origin !== origin) return json(response, 403, { message: 'Invalid origin.' });
  const body = await readBody(request, response);
  if (response.writableEnded) return;
  if (collection) {
    // Reusing the same ID after a lost response must reopen the original gallery.
    const parsed = z.object({ id: z.uuid() }).safeParse(body);
    if (!parsed.success) return json(response, 400, { message: 'Invalid gallery ID.' });
    const result = database
      .prepare(
        'INSERT INTO gallery (id, ownerId, name, setup, updatedAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
      )
      .run(
        parsed.data.id,
        ownerId,
        'Untitled gallery',
        JSON.stringify(defaultGallerySetup()),
        Date.now(),
      );
    if (
      !result.changes &&
      !database
        .prepare('SELECT id FROM gallery WHERE id = ? AND ownerId = ?')
        .get(parsed.data.id, ownerId)
    ) {
      return json(response, 409, { message: 'Gallery ID unavailable.' });
    }
    return json(response, result.changes ? 201 : 200, { id: parsed.data.id });
  }

  const parsed = update.safeParse(body);
  if (!parsed.success) return json(response, 400, { message: 'Check the gallery name and setup.' });
  const { name, setup, revision } = parsed.data;
  // Keep reference checks and the write in one lock, including across processes.
  database.exec('BEGIN IMMEDIATE');
  let result: { status: number; body: unknown };
  try {
    result = save();
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return json(response, result.status, result.body);

  function save(): { status: number; body: unknown } {
    if (!database.prepare('SELECT id FROM gallery WHERE ownerId = ? AND id = ?').get(ownerId, id))
      return { status: 404, body: { message: 'Gallery not found.' } };
    for (const placement of setup.placements) {
      const artwork = database
        .prepare('SELECT pixelWidth, pixelHeight FROM artwork WHERE id = ? AND ownerId = ?')
        .get(placement.artworkId, ownerId);
      if (
        !artwork ||
        Math.abs(
          placement.width /
            placement.height /
            (Number(artwork.pixelWidth) / Number(artwork.pixelHeight)) -
            1,
        ) > 0.02
      )
        return {
          status: 400,
          body: {
            message:
              'An artwork is unavailable or its proportions changed. Reload your library and try again.',
          },
        };
    }
    const serialized = JSON.stringify(setup);
    const saved = database
      .prepare(
        'UPDATE gallery SET name = ?, setup = ?, revision = revision + 1, updatedAt = ? WHERE ownerId = ? AND id = ? AND revision = ? RETURNING revision, updatedAt',
      )
      .get(name, serialized, Date.now(), ownerId, id, revision);
    if (saved) return { status: 200, body: saved };
    const current = database
      .prepare('SELECT name, setup, revision, updatedAt FROM gallery WHERE ownerId = ? AND id = ?')
      .get(ownerId, id);
    if (!current) return { status: 404, body: { message: 'Gallery not found.' } };
    // An interrupted save can be retried after the first write already succeeded.
    if (current.name === name && current.setup === serialized) {
      return { status: 200, body: { revision: current.revision, updatedAt: current.updatedAt } };
    }
    return {
      status: 409,
      body: {
        message: 'This gallery changed in another tab. Reload to open the saved version.',
      },
    };
  }
}
