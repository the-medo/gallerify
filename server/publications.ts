import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { z } from 'zod';
import {
  displayedArtwork,
  exhibitionScene,
  type Exhibition,
  type PublicationStatus,
} from '../src/lib/publication.ts';
import { migrateGallerySetup } from '../src/lib/gallery.ts';
import { artworkFrom, mediaKey } from './artworks.ts';
import type { ArtworkStorage } from './artwork-storage.ts';
import { gallerySetupSchema, json, readBody } from './galleries.ts';

export const publicationMigration = `
  CREATE TABLE IF NOT EXISTS publication (
    galleryId TEXT PRIMARY KEY REFERENCES gallery(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    generation INTEGER NOT NULL,
    details TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exhibitionVersion (
    galleryId TEXT NOT NULL REFERENCES publication(galleryId) ON DELETE CASCADE,
    generation INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    cover BLOB NOT NULL,
    PRIMARY KEY (galleryId, generation)
  );`;

const detailsSchema = z.object({
  title: z.string().trim().min(1).max(160),
  introduction: z.string().trim().max(2000),
  visibility: z.enum(['unlisted', 'public']),
  artist: z.string().trim().max(120),
  bio: z.string().trim().max(1000),
  contact: z.union([z.literal(''), z.url({ protocol: /^https?$/ }).max(500)]),
});
const generationBody = z.object({ generation: z.int().nonnegative() });
const publishBody = generationBody.extend({ revision: z.int().positive(), details: detailsSchema });
export const ownerPublicationPath = /^\/api\/galleries\/([^/]+)\/publication$/;
const versionJoin =
  'FROM publication p LEFT JOIN exhibitionVersion v ON v.galleryId = p.galleryId AND v.generation = p.generation';

function status(database: DatabaseSync, galleryId: string): PublicationStatus {
  const row = database
    .prepare(
      'SELECT p.slug, p.generation, p.details, v.snapshot ' +
        versionJoin +
        ' WHERE p.galleryId = ?',
    )
    .get(galleryId);
  return {
    slug: row ? String(row.slug) : null,
    generation: row ? Number(row.generation) : 0,
    details: row ? JSON.parse(String(row.details)) : null,
    live: row?.snapshot ? JSON.parse(String(row.snapshot)) : null,
  };
}

function prepareSnapshot(
  database: DatabaseSync,
  owner: string,
  galleryId: string,
  input: z.infer<typeof publishBody>,
) {
  const gallery = database
    .prepare('SELECT revision, setup FROM gallery WHERE id = ? AND ownerId = ?')
    .get(galleryId, owner);
  if (gallery?.revision !== input.revision)
    return { error: 'The saved gallery changed. Reload the workshop before publishing.' } as const;
  const parsed = gallerySetupSchema.safeParse(
    migrateGallerySetup(JSON.parse(String(gallery.setup))),
  );
  if (!parsed.success || !parsed.data.placements.length)
    return { error: 'Save a valid gallery with at least one artwork on a wall.' } as const;
  const scene = exhibitionScene(parsed.data);
  const artworks = [];
  const find = database.prepare('SELECT * FROM artwork WHERE ownerId = ? AND id = ?');
  for (const id of new Set(scene.placements.map((p) => p.artworkId))) {
    const row = find.get(owner, id);
    if (!row)
      return {
        error: 'A placed artwork is unavailable. Check your gallery and try again.',
      } as const;
    artworks.push(displayedArtwork(artworkFrom(row)));
  }
  const snapshot: Exhibition = { details: input.details, scene, artworks };
  return { snapshot, serialized: JSON.stringify(snapshot) } as const;
}

export async function handlePublication(
  request: IncomingMessage,
  response: ServerResponse,
  database: DatabaseSync,
  storage: ArtworkStorage,
  owner: string,
  galleryId: string,
  origin: string,
) {
  if (
    !database.prepare('SELECT id FROM gallery WHERE id = ? AND ownerId = ?').get(galleryId, owner)
  )
    return json(response, 404, { message: 'Gallery not found.' });
  const current = () => status(database, galleryId);
  if (request.method === 'GET') return json(response, 200, current());
  if (!['PUT', 'DELETE'].includes(request.method ?? ''))
    return json(response, 405, { message: 'Method not allowed.' });
  if (request.headers.origin !== origin) return json(response, 403, { message: 'Invalid origin.' });
  const body = await readBody(request, response);
  if (response.writableEnded) return;
  const conflict = () =>
    json(response, 409, { message: 'Publication changed. Refresh its status and try again.' });
  if (request.method === 'DELETE') {
    const parsed = generationBody.safeParse(body);
    if (!parsed.success) return json(response, 400, { message: 'Invalid publication version.' });
    database.exec('BEGIN IMMEDIATE');
    try {
      const before = current();
      if (before.live && before.generation !== parsed.data.generation) {
        database.exec('ROLLBACK');
        return conflict();
      }
      if (before.live) {
        database
          .prepare(
            'UPDATE publication SET generation = generation + 1, updatedAt = ? WHERE galleryId = ?',
          )
          .run(Date.now(), galleryId);
        database.prepare('DELETE FROM exhibitionVersion WHERE galleryId = ?').run(galleryId);
      }
      const after = current();
      database.exec('COMMIT');
      return json(response, 200, after);
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  const input = publishBody.safeParse(body);
  if (!input.success)
    return json(response, 400, {
      message: 'Check the exhibition title, website, and publication settings.',
    });
  const prepared = prepareSnapshot(database, owner, galleryId, input.data);
  if (!prepared.snapshot) return json(response, 409, { message: prepared.error });
  const before = current();
  if (JSON.stringify(before.live) === prepared.serialized) return json(response, 200, before);
  if (before.generation !== input.data.generation) return conflict();
  let cover: Buffer;
  try {
    for (const artwork of prepared.snapshot.artworks) {
      await Promise.all(
        ['thumbnail', 'scene', 'inspection'].map((variant) =>
          storage.check(mediaKey(owner, artwork.id, artwork.mediaVersion, variant)),
        ),
      );
    }
    const first = prepared.snapshot.artworks[0];
    const media = await storage.get(mediaKey(owner, first.id, first.mediaVersion, 'scene'));
    cover = await sharp(media)
      .resize(1200, 630, { fit: 'contain', background: '#f4f0e7' })
      .flatten({ background: '#f4f0e7' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return json(response, 503, {
      message: 'Some artwork images are unavailable. Try publishing again when they are ready.',
    });
  }

  database.exec('BEGIN IMMEDIATE');
  try {
    const latest = prepareSnapshot(database, owner, galleryId, input.data);
    const previous = current();
    if (latest.serialized !== prepared.serialized) {
      database.exec('ROLLBACK');
      return json(response, 409, {
        message:
          'The gallery or artwork changed during publication. Check the draft and try again.',
      });
    }
    if (JSON.stringify(previous.live) === prepared.serialized) {
      database.exec('COMMIT');
      return json(response, 200, previous);
    }
    if (previous.generation !== input.data.generation) {
      database.exec('ROLLBACK');
      return conflict();
    }
    const generation = previous.generation + 1;
    database
      .prepare(
        `INSERT INTO publication (galleryId,slug,generation,details,updatedAt) VALUES (?,?,?,?,?)
      ON CONFLICT(galleryId) DO UPDATE SET generation=excluded.generation, details=excluded.details, updatedAt=excluded.updatedAt`,
      )
      .run(
        galleryId,
        previous.slug ?? randomUUID(),
        generation,
        JSON.stringify(input.data.details),
        Date.now(),
      );
    database
      .prepare(
        'INSERT INTO exhibitionVersion (galleryId,generation,snapshot,cover) VALUES (?,?,?,?)',
      )
      .run(galleryId, generation, prepared.serialized, cover);
    database
      .prepare('DELETE FROM exhibitionVersion WHERE galleryId = ? AND generation <> ?')
      .run(galleryId, generation);
    const after = current();
    database.exec('COMMIT');
    return json(response, 200, after);
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function escaped(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export async function handleExhibition(
  request: IncomingMessage,
  response: ServerResponse,
  database: DatabaseSync,
  storage: ArtworkStorage,
  path: string,
  origin: string,
  indexHtml: (url: string) => Promise<string>,
) {
  const page = path.startsWith('/g/');
  const parts = path
    .slice(page ? 3 : '/api/exhibitions/'.length)
    .replace(/\/$/, '')
    .split('/');
  const [slug, resource, id, version, variant] = parts;
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return json(response, 405, { message: 'Method not allowed.' });
  const row = database
    .prepare(
      'SELECT g.ownerId, v.snapshot, p.galleryId, p.generation ' +
        versionJoin +
        ' JOIN gallery g ON g.id = p.galleryId WHERE p.slug = ? AND v.snapshot IS NOT NULL',
    )
    .get(slug);
  const exhibit: Exhibition | null = row ? JSON.parse(String(row.snapshot)) : null;
  const noindex = !exhibit || exhibit.details.visibility === 'unlisted';
  if (noindex) response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  if (page && parts.length === 1) {
    const url = escaped(origin + '/g/' + slug);
    const title = escaped(
      exhibit ? exhibit.details.title + ' · Gallerify' : 'Exhibition unavailable · Gallerify',
    );
    const description = exhibit
      ? escaped(exhibit.details.introduction || `Explore ${exhibit.details.title} on Gallerify.`)
      : '';
    const metadata = [
      `<title>${title}</title>`,
      noindex ? '<meta name="robots" content="noindex, nofollow">' : '',
      exhibit
        ? `<link rel="canonical" href="${url}"><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${escaped(
            origin,
          )}/api/exhibitions/${slug}/cover"><meta name="twitter:card" content="summary_large_image">`
        : '',
    ].join('\n');
    const html = (await indexHtml(path)).replace(/<title>.*?<\/title>/s, () => metadata);
    response.writeHead(exhibit ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
    return response.end(html);
  }
  const missing = () => json(response, 404, { message: 'This exhibition is unavailable.' });
  if (!exhibit || !row || page) return missing();
  if (parts.length === 1) return json(response, 200, exhibit);
  if (parts.length === 2 && resource === 'cover') {
    const cover = database
      .prepare('SELECT cover FROM exhibitionVersion WHERE galleryId = ? AND generation = ?')
      .get(row.galleryId, row.generation);
    if (!cover) return missing();
    response.writeHead(200, { 'Content-Type': 'image/jpeg' });
    return response.end(cover.cover);
  }
  if (
    parts.length !== 5 ||
    resource !== 'media' ||
    !['thumbnail', 'inspection', 'scene'].includes(variant) ||
    !exhibit.artworks.some((a) => a.id === id && a.mediaVersion === version)
  )
    return missing();
  let bytes: Buffer;
  try {
    bytes = await storage.get(mediaKey(String(row.ownerId), id, version, variant));
  } catch {
    return missing();
  }
  response.writeHead(200, { 'Content-Type': 'image/webp' });
  response.end(bytes);
}
