import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import sharp from 'sharp';
import { migrateAuth } from './auth.ts';
import { readAuthConfig } from './config.ts';
import { createAuthMiddleware } from './middleware.ts';
import { MAX_ACCOUNT_BYTES, MAX_UPLOAD_BYTES, processArtworkImage } from './artworks.ts';
import { artworkMediaUrl } from '../src/lib/artwork.ts';
import { defaultGallerySetup } from '../src/lib/gallery.ts';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'gallerify-artworks-'));
  let middleware: ReturnType<typeof createAuthMiddleware>;
  const server = createServer(
    (req, res) =>
      void middleware.handle(req, res, () => {
        res.writeHead(404);
        res.end();
      }),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const config = readAuthConfig({}, { root, developmentURL: origin });
  await migrateAuth(config);
  middleware = createAuthMiddleware(config);
  const request = (path: string, method = 'GET', body?: unknown, cookie = '', extraHeaders = {}) =>
    fetch(origin + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body instanceof Buffer ? new Uint8Array(body) : body ? JSON.stringify(body) : undefined,
    });
  async function signup(email: string) {
    const response = await request('/api/auth/sign-up/email', 'POST', {
      email,
      name: 'Artist',
      password: 'A safe test-only password',
    });
    assert.equal(response.status, 200);
    return response.headers
      .getSetCookie()
      .map((item) => item.split(';')[0])
      .join('; ');
  }
  const owner = await signup('owner@example.test');
  const other = await signup('other@example.test');
  const image = await sharp({
    create: {
      width: 300,
      height: 200,
      channels: 4,
      background: { r: 230, g: 85, b: 30, alpha: 0.6 },
    },
  })
    .png()
    .toBuffer();
  return {
    root,
    config,
    owner,
    other,
    request,
    image,
    upload: (id = crypto.randomUUID(), input = image, session = owner) =>
      request(`/api/artworks/${id}/content`, 'PUT', input, session, {
        'Content-Type': 'image/png',
        'X-Artwork-Filename': encodeURIComponent('My painting.png'),
      }),
    restart() {
      middleware.close();
      middleware = createAuthMiddleware(config);
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      middleware.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

test('uploads are private, idempotent, persistent and expose only processed media', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const id = crypto.randomUUID();
  assert.equal((await app.upload(id, app.image, '')).status, 401);
  const first = await app.upload(id);
  assert.equal(first.status, 201);
  const artwork = await first.json();
  assert.equal(artwork.title, 'My painting');
  assert.equal(artwork.pixelWidth, 300);
  assert.equal(artwork.pixelHeight, 200);
  assert.equal(artwork.ownerId, undefined);
  assert.equal(artwork.contentHash, undefined);
  assert.deepEqual(await (await app.upload(id)).json(), artwork);
  assert.equal((await app.upload(id, app.image, app.other)).status, 409);
  assert.deepEqual(
    await (await app.request('/api/artworks', 'GET', undefined, app.other)).json(),
    [],
  );
  const path = artworkMediaUrl(artwork, 'inspection');
  assert.equal((await app.request(path)).status, 401);
  assert.equal((await app.request(path, 'GET', undefined, app.other)).status, 404);
  const media = await app.request(path, 'GET', undefined, app.owner);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('cache-control'), 'private, no-store');
  const processed = await sharp(Buffer.from(await media.arrayBuffer())).metadata();
  assert.equal(processed.format, 'webp');
  assert.equal(processed.hasAlpha, true);
  assert.equal(
    (await app.request(path.replace('/inspection', '/original'), 'GET', undefined, app.owner))
      .status,
    404,
  );
  assert.equal(
    (
      await app.request(
        path.replace(artwork.mediaVersion, crypto.randomUUID()),
        'GET',
        undefined,
        app.owner,
      )
    ).status,
    404,
  );
  await migrateAuth(app.config);
  app.restart();
  assert.deepEqual(await (await app.request('/api/artworks', 'GET', undefined, app.owner)).json(), [
    artwork,
  ]);
  assert.equal((await app.request(path, 'GET', undefined, app.owner)).status, 200);
});

test('image processing applies EXIF orientation and rejects unsupported or corrupt bytes', async () => {
  const original = await sharp({
    create: { width: 100, height: 200, channels: 3, background: 'red' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const image = await processArtworkImage(original);
  assert.equal(image.width, 200);
  assert.equal(image.height, 100);
  const metadata = await sharp(image.derivatives.inspection).metadata();
  assert.equal(metadata.width, 200);
  assert.equal(metadata.height, 100);
  assert.equal(metadata.orientation, undefined);
  await assert.rejects(processArtworkImage(Buffer.from('not an image')));
  await assert.rejects(
    processArtworkImage(
      Buffer.from('<svg width="20" height="20"><rect width="20" height="20"/></svg>'),
    ),
  );
});

test('upload validation, quota, origin checks and metadata ownership are enforced', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const invalid = await app.upload(crypto.randomUUID(), Buffer.from('invalid'));
  assert.equal(invalid.status, 400);
  const tooLarge = await app.upload(crypto.randomUUID(), Buffer.alloc(MAX_UPLOAD_BYTES + 1));
  assert.equal(tooLarge.status, 413);
  assert.equal(
    (
      await app.request(
        `/api/artworks/${crypto.randomUUID()}/content`,
        'PUT',
        app.image,
        app.owner,
        { 'Content-Type': 'image/png', Origin: 'https://other.example' },
      )
    ).status,
    403,
  );
  const artwork = await (await app.upload()).json();
  const details = {
    title: 'Changed title',
    description: 'An artist statement',
    medium: 'Oil',
    year: 2026,
    physicalWidth: 0.9,
    physicalHeight: 0.6,
  };
  assert.equal(
    (await app.request('/api/artworks/' + artwork.id, 'PATCH', details, app.other)).status,
    404,
  );
  assert.equal(
    (
      await app.request(
        '/api/artworks/' + artwork.id,
        'PATCH',
        { ...details, physicalHeight: 1.5 },
        app.owner,
      )
    ).status,
    400,
  );
  const updated = await app.request('/api/artworks/' + artwork.id, 'PATCH', details, app.owner);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).description, details.description);
  const db = new DatabaseSync(app.config.databasePath);
  db.prepare('UPDATE artwork SET bytes = ? WHERE id = ?').run(MAX_ACCOUNT_BYTES, artwork.id);
  db.close();
  assert.equal((await app.upload()).status, 413);
});

test('ten artwork placements round trip; foreign references and unsafe deletions are blocked', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const galleryId = crypto.randomUUID();
  await app.request('/api/galleries', 'POST', { id: galleryId }, app.owner);
  const setup = defaultGallerySetup();
  const wall = setup.walls.find((wall) => wall.line.start.y === 0 && wall.line.end.y === 0)!;
  assert.ok(wall);
  const artworks = [];
  for (let index = 0; index < 10; index++) {
    const bytes = await sharp(app.image)
      .resize(index % 2 ? 200 : 300, index % 2 ? 300 : 200)
      .png()
      .toBuffer();
    const artwork = await (await app.upload(crypto.randomUUID(), bytes)).json();
    artworks.push(artwork);
    setup.placements.push({
      id: crypto.randomUUID(),
      artworkId: artwork.id,
      wallId: wall.id,
      side: index % 2 ? -1 : 1,
      u: 0.3 + index * 0.5,
      elevation: 1.2,
      width: 0.25,
      height: (0.25 * artwork.pixelHeight) / artwork.pixelWidth,
    });
  }
  const save = await app.request(
    '/api/galleries/' + galleryId,
    'PUT',
    { name: 'Ten works', revision: 1, setup },
    app.owner,
  );
  assert.equal(save.status, 200, await save.text());
  const reopened = await (
    await app.request('/api/galleries/' + galleryId, 'GET', undefined, app.owner)
  ).json();
  assert.deepEqual(reopened.setup, setup);
  assert.equal(
    (await app.request('/api/artworks/' + artworks[0].id, 'DELETE', undefined, app.owner)).status,
    409,
  );
  const foreign = await (await app.upload(crypto.randomUUID(), app.image, app.other)).json();
  setup.placements[0].artworkId = foreign.id;
  assert.equal(
    (
      await app.request(
        '/api/galleries/' + galleryId,
        'PUT',
        { name: 'Bad reference', revision: 2, setup },
        app.owner,
      )
    ).status,
    400,
  );
  setup.placements = [];
  assert.equal(
    (
      await app.request(
        '/api/galleries/' + galleryId,
        'PUT',
        { name: 'Empty', revision: 2, setup },
        app.owner,
      )
    ).status,
    200,
  );
  assert.equal(
    (await app.request('/api/artworks/' + artworks[0].id, 'DELETE', undefined, app.other)).status,
    404,
  );
  assert.equal(
    (await app.request('/api/artworks/' + artworks[0].id, 'DELETE', undefined, app.owner)).status,
    200,
  );
  assert.equal(
    (await app.request(artworkMediaUrl(artworks[0], 'scene'), 'GET', undefined, app.owner)).status,
    404,
  );
  const identity = await (
    await app.request('/api/auth/get-session', 'GET', undefined, app.owner)
  ).json();
  const files = await readdir(
    join(
      app.config.artworkStorage.directory,
      identity.user.id,
      artworks[0].id,
      artworks[0].mediaVersion,
    ),
  );
  assert.equal(files.length, 0);
});

test('old gallery documents gain an empty placements collection without losing finishes', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const id = crypto.randomUUID();
  await app.request('/api/galleries', 'POST', { id }, app.owner);
  const setup = { ...defaultGallerySetup(), floorTextureId: '3' } as Record<string, unknown>;
  delete setup.schemaVersion;
  delete setup.placements;
  const db = new DatabaseSync(app.config.databasePath);
  db.prepare('UPDATE gallery SET setup = ? WHERE id = ?').run(JSON.stringify(setup), id);
  db.close();
  const result = await (
    await app.request('/api/galleries/' + id, 'GET', undefined, app.owner)
  ).json();
  assert.equal(result.setup.schemaVersion, 2);
  assert.deepEqual(result.setup.placements, []);
  assert.equal(result.setup.floorTextureId, '3');
});

test('publication switches a complete snapshot, scopes visitor media and revokes the stable link', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  const galleryId = crypto.randomUUID();
  const path = '/api/galleries/' + galleryId;
  const ownerPath = path + '/publication';
  const details = {
    title: 'Studies in light',
    introduction: 'An evening exhibition.',
    artist: 'Artist',
    bio: '',
    contact: '',
    visibility: 'unlisted',
  };
  const publish = (revision: number, generation: number, settings = details) =>
    app.request(ownerPath, 'PUT', { revision, generation, details: settings }, app.owner);
  await app.request('/api/galleries', 'POST', { id: galleryId }, app.owner);
  assert.equal((await app.request(ownerPath)).status, 401);
  assert.equal((await app.request(ownerPath, 'GET', undefined, app.other)).status, 404);
  assert.equal((await publish(1, 0)).status, 409);
  const art = await (await app.upload()).json();
  const privateArt = await (await app.upload()).json();
  const setup = defaultGallerySetup();
  const wall = setup.walls.find((w) => w.line.start.y === 0 && w.line.end.y === 0)!;
  setup.placements.push({
    id: crypto.randomUUID(),
    artworkId: art.id,
    wallId: wall.id,
    side: 1,
    u: 1,
    elevation: 1.3,
    width: 0.6,
    height: 0.4,
  });
  const save = (revision: number) =>
    app.request(path, 'PUT', { revision, name: 'Private draft', setup }, app.owner);
  assert.equal((await save(1)).status, 200);
  assert.equal(
    (await app.request(ownerPath, 'PUT', { revision: 2, generation: 0, details }, app.other))
      .status,
    404,
  );
  assert.equal(
    (
      await app.request(ownerPath, 'PUT', { revision: 2, generation: 0, details }, app.owner, {
        Origin: 'https://other.example',
      })
    ).status,
    403,
  );
  assert.equal((await publish(1, 0)).status, 409);
  assert.equal((await publish(2, 0, { ...details, contact: 'data:text/html,hello' })).status, 400);
  const attempts = await Promise.all([publish(2, 0), publish(2, 0)]);
  assert.deepEqual(
    attempts.map((r) => r.status),
    [200, 200],
  );
  const [first, retry] = await Promise.all(attempts.map((r) => r.json()));
  assert.deepEqual(first, retry);
  const publicPath = '/api/exhibitions/' + first.slug;
  const visitor = async () => (await app.request(publicPath)).json();
  const live = await visitor();
  assert.deepEqual(live, first.live);
  assert.equal(live.artworks.length, 1);
  assert.equal(live.artworks[0].id, art.id);
  for (const key of [
    'bytes',
    'createdAt',
    'ownerId',
    'email',
    'previewMode',
    'generatorSettings',
    'activePresetId',
    'Private draft',
    privateArt.id,
  ])
    assert.ok(!JSON.stringify(live).includes(key), key);
  const media = publicPath + '/media/' + art.id + '/' + art.mediaVersion + '/inspection';
  for (const probe of [
    media.replace('inspection', 'original'),
    media.replace(art.id, privateArt.id),
    media.replace(art.mediaVersion, crypto.randomUUID()),
  ])
    assert.equal((await app.request(probe)).status, 404);
  const response = await app.request(media);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const cover = await app.request(publicPath + '/cover');
  const dimensions = await sharp(Buffer.from(await cover.arrayBuffer())).metadata();
  assert.deepEqual([dimensions.width, dimensions.height], [1200, 630]);
  const changedArt = { ...art, title: 'New private title' };
  assert.equal(
    (await app.request('/api/artworks/' + art.id, 'PATCH', changedArt, app.owner)).status,
    200,
  );
  assert.deepEqual(await visitor(), live);

  const directory = app.config.artworkStorage.directory;
  const [ownerDir] = await readdir(directory);
  const imagePath = join(directory, ownerDir, art.id, art.mediaVersion, 'inspection');
  await rename(imagePath, imagePath + '.missing');
  assert.equal((await publish(2, first.generation)).status, 503);
  assert.deepEqual(await visitor(), live);
  await rename(imagePath + '.missing', imagePath);
  const second = await (
    await publish(2, first.generation, { ...details, visibility: 'public' })
  ).json();
  assert.equal(second.slug, first.slug);
  assert.equal(second.generation, first.generation + 1);
  assert.equal((await visitor()).artworks[0].title, changedArt.title);
  assert.equal((await app.request(publicPath)).headers.get('x-robots-tag'), null);
  const hide = (generation: number) => app.request(ownerPath, 'DELETE', { generation }, app.owner);
  assert.equal((await hide(first.generation)).status, 409);
  assert.equal((await publish(2, first.generation)).status, 409);
  const originalPlacements = setup.placements;
  setup.placements = [];
  assert.equal((await save(2)).status, 200);
  assert.equal(
    (await app.request('/api/artworks/' + art.id, 'DELETE', undefined, app.owner)).status,
    409,
  );
  const hidden = await (await hide(second.generation)).json();
  assert.deepEqual(await (await hide(second.generation)).json(), hidden);
  assert.equal(hidden.live, null);
  for (const probe of [publicPath, media, publicPath + '/cover'])
    assert.equal((await app.request(probe)).status, 404);
  setup.placements = originalPlacements;
  assert.equal((await save(3)).status, 200);
  assert.equal((await publish(4, second.generation)).status, 409);
  const restored = await (await publish(4, hidden.generation)).json();
  assert.equal(restored.slug, first.slug);
  assert.equal((await app.request(media)).status, 200);
  app.restart();
  assert.deepEqual(await visitor(), restored.live);
});
