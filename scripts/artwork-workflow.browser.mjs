import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createServer as netServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import { createServer } from 'vite';

// Use an isolated database/media store and a temporary listener, never a preview's accounts.
const temporary = await mkdtemp(join(tmpdir(), 'gallerify-browser-'));
const reservation = netServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((done) => reservation.close(done));
const origin = `http://127.0.0.1:${port}`;
process.env.BETTER_AUTH_URL = origin;
process.env.DATABASE_PATH = join(temporary, 'auth.sqlite');
process.env.ARTWORK_STORAGE_PATH = join(temporary, 'artworks');
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ARTWORK_S3_BUCKET = '';
process.env.ARTWORK_S3_ENDPOINT = '';
process.env.ARTWORK_S3_ACCESS_KEY_ID = '';
process.env.ARTWORK_S3_SECRET_ACCESS_KEY = '';
const cacheDir = resolve('node_modules/.cache/gallery-browser-' + port);
const server = await createServer({
  cacheDir,
  server: { port, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
});
let browser;
await mkdir(resolve('logs'), { recursive: true });
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((cachePath) => {
    window.galleryTestFiber = () => import(cachePath + '/deps/@react-three_fiber.js');
  }, '/node_modules/.cache/gallery-browser-' + port);
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Browser Artist',
      email: 'browser@example.test',
      password: 'Browser-only long password',
    },
  });
  assert.equal(signup.status(), 200);
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(origin);
  await page.getByRole('button', { name: 'New gallery', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gallery workshop' })).toBeVisible();
  await expect(page.getByLabel('Upload artwork')).toBeEnabled();
  const files = [];
  for (let i = 0; i < 10; i++) {
    const width = i % 2 ? 400 : 600,
      height = i % 2 ? 600 : 400;
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="hsl(${
      i * 33
    },45%,65%)"/><rect x="20" y="20" width="140" height="140" fill="#263652"/><circle cx="${
      width - 100
    }" cy="${height - 100}" r="70" fill="#c47042"/><text x="30" y="${
      height / 2
    }" font-size="40" fill="#202020">STUDY ${i + 1}</text></svg>`;
    files.push({
      name: `Study ${i + 1}.png`,
      mimeType: 'image/png',
      buffer: await sharp(Buffer.from(svg)).png().toBuffer(),
    });
  }
  let droppedUpload = false;
  await page.route('**/api/artworks/*/content', async (route) => {
    if (!droppedUpload) {
      droppedUpload = true;
      await route.fetch(); // Commit the upload, then simulate losing its response.
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByLabel('Upload artwork').setInputFiles(files);
  await expect(page.getByRole('button', { name: 'Retry Study 1.png', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Retry Study 1.png', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Hang Study \d+$/ })).toHaveCount(10, {
    timeout: 30000,
  });
  assert.equal((await (await context.request.get(origin + '/api/artworks')).json()).length, 10);
  console.log(
    'Uploaded ten portrait/landscape images; a lost upload response retries without duplicates.',
  );
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: `Hang Study ${i + 1}`, exact: true }).click();
    await page.getByRole('button', { name: 'Hang on this wall', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'On this wall' })).toBeVisible();
    await page.getByLabel('Width (m)', { exact: true }).fill('0.4');
    await page
      .getByLabel('Along wall (m)', { exact: true })
      .fill(String(i < 5 ? 0.5 + i * 0.5 : 3.5 + (i - 5) * 0.5));
    await page.getByRole('button', { name: 'Apply placement', exact: true }).click();
  }
  await page.getByLabel('Gallery name').fill('Ten studies');
  let failedSave = false;
  await page.route('**/api/galleries/*', async (route) => {
    if (!failedSave && route.request().method() === 'PUT') {
      failedSave = true;
      await route.fulfill({ status: 503, json: { message: 'Temporary save failure' } });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const galleryId = new URL(page.url()).pathname.split('/').pop();
  const saved = await (await context.request.get(origin + '/api/galleries/' + galleryId)).json();
  assert.equal(saved.setup.placements.length, 10);
  assert.ok(saved.setup.placements.every((item) => item.width === 0.4));
  await page.reload();
  await expect(page.getByText('1 on walls', { exact: true })).toHaveCount(10);
  await page.waitForFunction(async () => {
    const { _roots } = await window.galleryTestFiber();
    const root = _roots.get(document.querySelector('canvas'))?.store.getState();
    const scene = root?.scene;
    let count = 0;
    scene?.traverse((object) => {
      if (object.material?.map?.image?.src?.includes('/api/artworks/')) count++;
    });
    return count === 10 && root.gl.info.render.frame > 30;
  });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  console.log('Placed ten works, saved, and restored them after reload.');
  if (process.argv.includes('--publication')) {
    const { verifyPublication } = await import('./publication.browser.mjs');
    await verifyPublication({ browser, page, context, origin });
  }
  const wallTarget = async () => {
    return page.evaluate(async () => {
      const { _roots } = await window.galleryTestFiber();
      const { useStore } = await import('/src/store/store.ts');
      const { placementAtPoint, placementIssue } = await import('/src/utils/artworkGeometry.ts');
      const { artworkDisplaySize } = await import('/src/lib/artwork.ts');
      const canvas = document.querySelector('canvas');
      const root = _roots.get(canvas).store.getState();
      const state = useStore.getState();
      const rect = canvas.getBoundingClientRect();
      const dimensions = artworkDisplaySize(state.artworks[state.activeArtworkId]);
      for (let y = 40; y < rect.height - 40; y += 12)
        for (let x = 40; x < rect.width - 40; x += 12) {
          root.raycaster.setFromCamera(
            root.pointer.clone().set((x / rect.width) * 2 - 1, (-y / rect.height) * 2 + 1),
            root.camera,
          );
          const hit = root.raycaster.intersectObjects(root.scene.children, true)[0];
          if (!hit?.face || !hit.object.userData.wallId) continue;
          const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
          if (Math.abs(normal.y) > 0.5) continue;
          const anchor = placementAtPoint(
            state.walls[hit.object.userData.wallId],
            hit.point,
            normal,
            state.width,
            state.height,
          );
          if (
            !placementIssue(
              { id: 'test', artworkId: state.activeArtworkId, ...anchor, ...dimensions },
              state.walls,
            )
          )
            return { x, y };
        }
      throw new Error('No visible valid wall position found');
    });
  };
  await page.getByRole('button', { name: 'Hang Study 1', exact: true }).click();
  await page.locator('canvas').click({ position: await wallTarget() });
  await expect(page.getByRole('heading', { name: 'On this wall' })).toBeVisible();
  await expect(page.getByText('2 on walls', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove from wall', exact: true }).click();
  await page.getByRole('button', { name: 'Hang Study 1', exact: true }).click();
  await page
    .getByRole('button', { name: 'Hang Study 1', exact: true })
    .dragTo(page.locator('canvas'), { targetPosition: await wallTarget() });
  await expect(page.getByRole('heading', { name: 'On this wall' })).toBeVisible();
  await expect(page.getByText('2 on walls', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove from wall', exact: true }).click();
  await page.mouse.move(40, 40);
  await page.waitForFunction(async () => {
    const { _roots } = await window.galleryTestFiber();
    return _roots.get(document.querySelector('canvas'))?.store.getState().gl.info.render.calls > 20;
  });
  await page.screenshot({ path: resolve('logs/artwork-editor.png') });
  console.log('Actual canvas click and native desktop drag placement verified.');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to entrance' })).toBeEnabled({
    timeout: 20000,
  });
  await page.waitForFunction(async () => {
    const { _roots } = await window.galleryTestFiber();
    const root = _roots.get(document.querySelector('.walk-scene canvas'))?.store.getState();
    let loaded = 0;
    root?.scene.traverse((object) => {
      if (object.material?.map?.image?.src?.includes('/api/artworks/')) loaded++;
    });
    return loaded === 10;
  });
  const walkTarget = await page.evaluate(async () => {
    const { _roots } = await window.galleryTestFiber();
    const canvas = document.querySelector('.walk-scene canvas');
    const root = _roots.get(canvas).store.getState();
    const rect = canvas.getBoundingClientRect();
    const candidates = [];
    root.scene.traverse((object) => {
      if (object.material?.map?.image?.src?.includes('/api/artworks/')) candidates.push(object);
    });
    for (const object of candidates) {
      const point = object.getWorldPosition(root.camera.position.clone()).project(root.camera);
      if (Math.abs(point.x) > 0.9 || Math.abs(point.y) > 0.7 || point.z > 1) continue;
      root.raycaster.setFromCamera(root.pointer.clone().set(point.x, point.y), root.camera);
      if (root.raycaster.intersectObjects(root.scene.children, true)[0]?.object === object)
        return { x: ((point.x + 1) * rect.width) / 2, y: ((1 - point.y) * rect.height) / 2 };
    }
    throw new Error('No artwork visible from the entrance');
  });
  await page.locator('.walk-scene canvas').click({ position: walkTarget });
  await expect(page.getByRole('button', { name: 'Close artwork', exact: true })).toBeVisible();
  const cameraBefore = await page.evaluate(async () => {
    const { _roots } = await window.galleryTestFiber();
    return _roots
      .get(document.querySelector('.walk-scene canvas'))
      .store.getState()
      .camera.position.toArray();
  });
  await page.keyboard.down('w');
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await page.keyboard.up('w');
  const cameraDuring = await page.evaluate(async () => {
    const { _roots } = await window.galleryTestFiber();
    return _roots
      .get(document.querySelector('.walk-scene canvas'))
      .store.getState()
      .camera.position.toArray();
  });
  assert.deepEqual(cameraDuring, cameraBefore, 'Inspection must suspend walking');
  await page.getByRole('button', { name: 'Close artwork', exact: true }).click();
  const firstArtwork = saved.setup.placements[0].artworkId;
  await page.getByLabel('Inspect artwork', { exact: true }).selectOption(firstArtwork);
  await expect(page.getByRole('heading', { name: 'Study 1', exact: true })).toBeVisible();
  await page.getByRole('slider', { name: /Zoom/ }).fill('2');
  await expect(page.locator('.art-inspection img')).toBeVisible();
  await page.screenshot({ path: resolve('logs/artwork-inspection.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close artwork' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exit', exact: true })).toBeVisible();
  await page.screenshot({ path: resolve('logs/artwork-walk.png') });
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  console.log(
    'Play, clicking artwork, inspection pauses walking, zoom, Escape, and return to editor work.',
  );
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  const pendingDialog = page.waitForEvent('dialog');
  const change = page.getByLabel('Starting plan').selectOption('corner-studio');
  const dialog = await pendingDialog;
  await dialog.dismiss();
  await change;
  await page.getByRole('button', { name: '2D plan', exact: true }).click();
  await expect(page.getByText('Floor plan / 2D', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '3D view', exact: true }).click();
  await expect(page.getByText('Perspective / 3D', { exact: true })).toBeVisible();
  assert.equal(
    (await (await context.request.get(origin + '/api/galleries/' + galleryId)).json()).setup
      .placements.length,
    10,
  );
  await page.getByRole('button', { name: 'Art', exact: true }).click();
  await page.getByRole('button', { name: 'Hang Study 1', exact: true }).click();
  const finishTarget = await wallTarget();
  await page.getByRole('button', { name: 'Cancel hanging', exact: true }).click();
  await page.locator('canvas').click({ position: finishTarget });
  await page.getByRole('button', { name: 'Finishes', exact: true }).click();
  await page.getByRole('button', { name: 'Sage plaster', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sage plaster', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Walnut boards', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Walnut boards', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  console.log('2D/3D switching, wall selection, wall texture, and floor texture verified.');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    storageState: await context.storageState(),
  });
  const mobile = await mobileContext.newPage();
  mobile.on('pageerror', (error) => failures.push(error.message));
  await mobile.goto(origin + '/workshop/' + galleryId);
  await expect(mobile.getByRole('button', { name: 'Hang Study 1', exact: true })).toBeVisible();
  await mobile.getByRole('button', { name: 'Hang Study 1', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Hang on this wall', exact: true }).tap();
  await expect(mobile.getByRole('heading', { name: 'On this wall' })).toBeVisible();
  await mobile.getByRole('button', { name: 'Remove from wall', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Play', exact: true }).tap();
  await expect(mobile.getByRole('button', { name: 'Walk forward', exact: true })).toBeEnabled();
  await mobile.getByRole('button', { name: 'Walk forward', exact: true }).tap();
  await mobile.getByLabel('Inspect artwork', { exact: true }).selectOption(firstArtwork);
  await expect(mobile.getByRole('heading', { name: 'Study 1', exact: true })).toBeVisible();
  await mobile.getByRole('button', { name: 'Close artwork', exact: true }).tap();
  await mobile.screenshot({ path: resolve('logs/artwork-mobile-walk.png') });
  await mobile.getByRole('button', { name: 'Exit', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Art', exact: true }).tap();
  await mobile.screenshot({ path: resolve('logs/artwork-mobile.png') });
  assert.equal(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'Mobile layout must not overflow horizontally',
  );
  assert.deepEqual(failures, [], 'No uncaught browser errors');
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
  const regenerationDialog = page.waitForEvent('dialog');
  const regenerate = page.getByRole('button', { name: /Generate a layout/ }).click();
  await (await regenerationDialog).accept();
  await regenerate;
  await page.getByRole('button', { name: 'Art', exact: true }).click();
  await expect(page.getByText('Unplaced', { exact: true })).toHaveCount(10);
  await expect(page.getByText('Your generated gallery', { exact: true })).toBeVisible();
  console.log(
    'Layout replacement confirmation, touch placement, walking, inspection, and narrow-screen layout verified.',
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
  await rm(temporary, { recursive: true, force: true });
}
