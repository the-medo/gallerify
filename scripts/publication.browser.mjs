import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { expect } from '@playwright/test';

async function verifyProductionPage(slug) {
  // Use the browser fixture's database with the real production server and built HTML.
  const canonical = 'https://exhibition.example.test';
  const child = spawn(process.execPath, ['server/index.ts'], {
    env: {
      ...process.env,
      PORT: '0',
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      BETTER_AUTH_URL: canonical,
      BETTER_AUTH_SECRET: randomBytes(48).toString('hex'),
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const closed = once(child, 'exit');
  const lines = createInterface({ input: child.stdout });
  try {
    for await (const line of lines) {
      if (!line.startsWith('Gallerify listening on ')) continue;
      const port = JSON.parse(line.slice('Gallerify listening on '.length)).port;
      const local = 'http://127.0.0.1:' + port;
      const response = await fetch(local + '/g/' + slug);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      const html = await response.text();
      assert.ok(html.includes('Light &amp; Paper · Gallerify'));
      assert.ok(html.includes(canonical + '/g/' + slug));
      assert.ok(html.includes('property="og:image"'));
      const script = /src="(\/assets\/[^"]+\.js)"/.exec(html);
      assert.ok(script);
      assert.equal((await fetch(local + script[1])).status, 200);
      assert.equal((await fetch(local + '/g/unknown-exhibition')).status, 404);
      return;
    }
    throw new Error('Production listener did not start.');
  } finally {
    lines.close();
    child.kill('SIGTERM');
    await closed;
  }
}

export async function verifyPublication({ browser, page, context, origin }) {
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByLabel('Exhibition title').fill('Light & Paper');
  await page.getByLabel('Introduction').fill('Ten works on paper.');
  await page.getByRole('button', { name: 'Publish exhibition', exact: true }).click();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();
  const link = await page.getByLabel('Visitor link').inputValue();
  const slug = new URL(link).pathname.split('/').pop();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByText('Link copied.')).toBeVisible();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link);
  await verifyProductionPage(slug);
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const visitor = await guest.newPage();
    const privateRequests = [];
    visitor.on('request', (req) => {
      if (/\/api\/(auth|artworks|galleries)(\/|$)/.test(new URL(req.url()).pathname))
        privateRequests.push(req.url());
    });
    await visitor.goto(link);
    await expect(visitor.getByRole('heading', { name: 'Light & Paper' })).toBeVisible();
    await visitor.getByRole('button', { name: 'Enter gallery' }).tap();
    await expect(visitor.getByRole('button', { name: 'Walk forward' })).toBeEnabled({
      timeout: 30000,
    });
    await visitor.getByRole('button', { name: 'Walk forward' }).tap();
    await visitor.getByLabel('Inspect artwork', { exact: true }).selectOption({ label: 'Study 1' });
    await expect(visitor.locator('.art-inspection img')).toBeVisible();
    await visitor.getByRole('button', { name: 'Close artwork' }).tap();
    await visitor.getByRole('button', { name: 'Exit', exact: true }).tap();
    await page.getByRole('button', { name: 'Layout', exact: true }).click();
    await page.getByRole('button', { name: '2D plan', exact: true }).click();
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();
    await page.getByLabel('Exhibition title').fill('Paper after dark');
    await expect(page.getByText('Unpublished changes', { exact: true })).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByRole('heading', { name: 'Light & Paper' })).toBeVisible();
    await page.getByRole('button', { name: 'Publish changes' }).click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();
    assert.equal(await page.getByLabel('Visitor link').inputValue(), link);
    // This browser has no WebGL. The normal page and keyboard inspection still work.
    await visitor.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind.includes('webgl') ? null : original.call(this, kind, ...args);
      };
    });
    await visitor.reload();
    await expect(visitor.getByRole('heading', { name: 'Paper after dark' })).toBeVisible();
    await visitor.getByRole('button', { name: 'Enter gallery' }).tap();
    await expect(visitor.getByText(/The 3D view is unavailable/)).toBeVisible();
    await visitor.route('**/inspection?retry=0', (route) => route.abort('failed'));
    const first = visitor.getByRole('button', { name: 'Study 1', exact: true });
    await first.focus();
    await visitor.keyboard.press('Enter');
    await visitor.getByRole('button', { name: 'Retry image' }).tap();
    await expect
      .poll(() => visitor.locator('.art-inspection img').evaluate((img) => img.naturalWidth))
      .toBeGreaterThan(0);
    await visitor.keyboard.press('Escape');
    await expect(first).toBeFocused();
    assert.deepEqual(privateRequests, []);
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(page.getByText('Unpublished', { exact: true })).toBeVisible();
    assert.equal((await visitor.reload()).status(), 404);
    await expect(
      visitor.getByRole('heading', { name: 'This exhibition is unavailable.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Layout', exact: true }).click();
    await page.getByRole('button', { name: '3D view', exact: true }).click();
    await page.getByRole('button', { name: 'Art', exact: true }).click();
    console.log(
      'Published and copied a stable link, visited as a guest, walked and inspected on touch, verified production metadata, republished, exercised image retry without WebGL, and unpublished.',
    );
  } finally {
    await guest.close();
  }
}
