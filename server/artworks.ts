import { createHash, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import sharp from 'sharp';
import { z } from 'zod';
import type { Artwork, ArtworkDetails } from '../src/lib/artwork.ts';
import type { ArtworkStorage } from './artwork-storage.ts';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_ACCOUNT_BYTES = 500 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const artworkMigration = `
  CREATE TABLE IF NOT EXISTS artwork (
    id TEXT PRIMARY KEY,
    ownerId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    details TEXT NOT NULL,
    pixelWidth INTEGER NOT NULL,
    pixelHeight INTEGER NOT NULL,
    mediaVersion TEXT NOT NULL,
    contentHash TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    createdAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS artwork_owner_created ON artwork(ownerId, createdAt DESC);`;

const detailsSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(5000),
  medium: z.string().max(160),
  year: z.int().min(0).max(9999).nullable(),
  physicalWidth: z.number().min(0.05).max(30).nullable(),
  physicalHeight: z.number().min(0.05).max(30).nullable(),
});
const variants = ['original', 'thumbnail', 'scene', 'inspection'] as const;
type Row = Record<string, SQLOutputValue>;
const artworkFrom = (row: Row): Artwork => ({
  id: String(row.id),
  ...JSON.parse(String(row.details)),
  pixelWidth: Number(row.pixelWidth),
  pixelHeight: Number(row.pixelHeight),
  mediaVersion: String(row.mediaVersion),
  bytes: Number(row.bytes),
  createdAt: Number(row.createdAt),
});
const mediaKey = (owner: string, id: string, version: string, variant: string) =>
  `${owner}/${id}/${version}/${variant}`;
const json = (res: ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};

async function readBytes(request: IncomingMessage, response: ServerResponse, limit: number) {
  if (Number(request.headers['content-length']) > limit) {
    json(response, 413, { message: 'File is too large. Images can be up to 20 MB.' });
    request.resume();
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      json(response, 413, { message: 'File is too large.' });
      return;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function processArtworkImage(input: Buffer) {
  const source = sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' });
  const metadata = await source.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) > 1)
    throw new Error('Use a still JPEG, PNG, or WebP image.');
  const oriented = metadata.orientation && metadata.orientation >= 5;
  const width = oriented ? metadata.height : metadata.width;
  const height = oriented ? metadata.width : metadata.height;
  const derivatives: Record<string, Buffer> = {};
  for (const [variant, size] of [
    ['thumbnail', 320],
    ['scene', 1600],
    ['inspection', 3200],
  ] as const) {
    derivatives[variant] = await source
      .clone()
      .rotate()
      .toColourspace('srgb')
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: variant === 'inspection' ? 95 : 88 })
      .toBuffer();
  }
  return { width, height, derivatives, contentType: `image/${metadata.format}` };
}

export function createArtworkHandler(database: DatabaseSync, storage: ArtworkStorage) {
  let uploading = false;
  const find = (id: string, owner: string) =>
    database.prepare('SELECT * FROM artwork WHERE id = ? AND ownerId = ?').get(id, owner);
  return async function handle(
    request: IncomingMessage,
    response: ServerResponse,
    owner: string,
    pathname: string,
    origin: string,
  ) {
    const parts = pathname.split('/').slice(3);
    const [id, operation, version, variant] = parts;
    const missing = () => json(response, 404, { message: 'Artwork not found.' });
    if (request.method === 'GET' && pathname === '/api/artworks') {
      return json(
        response,
        200,
        database
          .prepare('SELECT * FROM artwork WHERE ownerId = ? ORDER BY createdAt DESC, id')
          .all(owner)
          .map(artworkFrom),
      );
    }
    if (!z.uuid().safeParse(id).success) return missing();
    if (request.method === 'GET' && operation === 'media' && parts.length === 4) {
      const row = find(id, owner);
      if (
        !row ||
        version !== row.mediaVersion ||
        !['thumbnail', 'scene', 'inspection'].includes(variant)
      )
        return missing();
      try {
        const bytes = await storage.get(mediaKey(owner, id, version, variant));
        response.writeHead(200, {
          'Content-Type': 'image/webp',
          'Content-Length': bytes.length,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(bytes);
      } catch {
        json(response, 503, {
          message: 'This image is temporarily unavailable. Please try again.',
        });
      }
      return;
    }
    if (!['PUT', 'PATCH', 'DELETE'].includes(request.method ?? ''))
      return json(response, 405, { message: 'Method not allowed.' });
    if (request.headers.origin !== origin)
      return json(response, 403, { message: 'Invalid origin.' });

    if (request.method === 'PUT' && operation === 'content' && parts.length === 2) {
      if (uploading)
        return json(response, 429, {
          message: 'Another upload is processing. Please retry in a moment.',
        });
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(request.headers['content-type'] ?? '')
      )
        return json(response, 415, { message: 'Choose a JPEG, PNG, or WebP image.' });
      uploading = true;
      const version = randomUUID();
      let keepMedia = false;
      let wroteMedia = false;
      try {
        const input = await readBytes(request, response, MAX_UPLOAD_BYTES);
        if (!input) return;
        const contentHash = createHash('sha256').update(input).digest('hex');
        const existing = database.prepare('SELECT * FROM artwork WHERE id = ?').get(id);
        if (existing) {
          if (existing.ownerId === owner && existing.contentHash === contentHash)
            return json(response, 200, artworkFrom(existing));
          return json(response, 409, {
            message: 'This upload ID is already in use. Add the image again.',
          });
        }
        const used = () =>
          Number(
            database
              .prepare('SELECT COALESCE(SUM(bytes), 0) AS total FROM artwork WHERE ownerId = ?')
              .get(owner)!.total,
          );
        if (used() + input.length > MAX_ACCOUNT_BYTES)
          return json(response, 413, {
            message: 'Your artwork library has reached its 500 MB limit.',
          });
        let image: Awaited<ReturnType<typeof processArtworkImage>>;
        try {
          image = await processArtworkImage(input);
        } catch {
          return json(response, 400, {
            message:
              'Could not read this image. Use a still JPEG, PNG, or WebP up to 40 megapixels.',
          });
        }
        const bytes =
          input.length +
          Object.values(image.derivatives).reduce((sum, buffer) => sum + buffer.length, 0);
        if (used() + bytes > MAX_ACCOUNT_BYTES)
          return json(response, 413, {
            message: 'Your artwork library has reached its 500 MB limit.',
          });
        let filename = 'Untitled artwork';
        try {
          filename = decodeURIComponent(String(request.headers['x-artwork-filename'] ?? filename));
        } catch {
          /* Use a safe fallback title. */
        }
        const details: ArtworkDetails = {
          title:
            filename
              .replace(/\.[^.]+$/, '')
              .slice(0, 160)
              .trim() || 'Untitled artwork',
          description: '',
          medium: '',
          year: null,
          physicalWidth: null,
          physicalHeight: null,
        };
        wroteMedia = true;
        await storage.put(mediaKey(owner, id, version, 'original'), input, image.contentType);
        for (const [name, buffer] of Object.entries(image.derivatives))
          await storage.put(mediaKey(owner, id, version, name), buffer, 'image/webp');
        database.exec('BEGIN IMMEDIATE');
        try {
          if (used() + bytes > MAX_ACCOUNT_BYTES) throw new Error('quota');
          database
            .prepare(
              'INSERT INTO artwork (id, ownerId, details, pixelWidth, pixelHeight, mediaVersion, contentHash, bytes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .run(
              id,
              owner,
              JSON.stringify(details),
              image.width,
              image.height,
              version,
              contentHash,
              bytes,
              Date.now(),
            );
          database.exec('COMMIT');
          keepMedia = true;
        } catch {
          database.exec('ROLLBACK');
          const concurrent = find(id, owner);
          if (concurrent?.contentHash === contentHash)
            return json(response, 200, artworkFrom(concurrent));
          return json(response, 409, {
            message: 'The library changed during upload or reached its limit. Please retry.',
          });
        }
        return json(response, 201, artworkFrom(find(id, owner)!));
      } finally {
        if (wroteMedia && !keepMedia) {
          const removed = await Promise.allSettled(
            variants.map((name) => storage.remove(mediaKey(owner, id, version, name))),
          );
          if (removed.some((result) => result.status === 'rejected'))
            console.error('Incomplete artwork media cleanup failed.');
        }
        uploading = false;
      }
    }
    if (parts.length !== 1) return missing();
    const row = find(id, owner);
    if (!row) return missing();
    if (request.method === 'PATCH') {
      if (request.headers['content-type']?.split(';')[0] !== 'application/json')
        return json(response, 415, { message: 'Expected artwork details.' });
      const bytes = await readBytes(request, response, 32 * 1024);
      if (!bytes) return;
      let body: unknown;
      try {
        body = JSON.parse(bytes.toString('utf8'));
      } catch {
        return json(response, 400, { message: 'Invalid artwork details.' });
      }
      const parsed = detailsSchema.safeParse(body);
      if (!parsed.success)
        return json(response, 400, { message: 'Check the title, year, and physical dimensions.' });
      const { physicalWidth: width, physicalHeight: height } = parsed.data;
      if (
        width &&
        height &&
        Math.abs(width / height / (Number(row.pixelWidth) / Number(row.pixelHeight)) - 1) > 0.02
      )
        return json(response, 400, {
          message: 'Physical dimensions must preserve the image proportions.',
        });
      database
        .prepare('UPDATE artwork SET details = ? WHERE id = ? AND ownerId = ?')
        .run(JSON.stringify(parsed.data), id, owner);
      return json(response, 200, artworkFrom(find(id, owner)!));
    }
    if (request.method === 'DELETE') {
      // No await between reference checking and deletion: another save on this
      // connection cannot introduce a reference in between. Lock other writers too.
      database.exec('BEGIN IMMEDIATE');
      try {
        const inUse = database
          .prepare(
            "SELECT gallery.id FROM gallery, json_each(gallery.setup, '$.placements') AS placement WHERE gallery.ownerId = ? AND json_extract(placement.value, '$.artworkId') = ? LIMIT 1",
          )
          .get(owner, id);
        if (inUse) {
          database.exec('ROLLBACK');
          return json(response, 409, {
            message:
              'This artwork is used in a saved gallery. Remove its placements and save that gallery first.',
          });
        }
        database.prepare('DELETE FROM artwork WHERE id = ? AND ownerId = ?').run(id, owner);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      const removed = await Promise.allSettled(
        variants.map((name) => storage.remove(mediaKey(owner, id, String(row.mediaVersion), name))),
      );
      if (removed.some((result) => result.status === 'rejected'))
        console.error('Deleted artwork media cleanup failed.');
      return json(response, 200, { deleted: true });
    }
    json(response, 405, { message: 'Method not allowed.' });
  };
}
