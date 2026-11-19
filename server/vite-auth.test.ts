import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createServer } from 'vite';
import { authPlugin } from './vite-auth.ts';

function statusWithHost(url: string, host: string) {
  return new Promise<number | undefined>((resolve, reject) => {
    const request = get(url, { headers: { Host: host } }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
      response.once('error', reject);
    });
    request.once('error', reject);
  });
}

test('Vite cannot expose the auth secret, database or environment through raw/URL imports', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gallerify-vite-auth-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Auth fixture</title>');
  mkdirSync(join(root, '.gallerify/artworks'), { recursive: true });
  writeFileSync(join(root, '.gallerify/artworks/private-image'), 'private-artwork-canary');
  writeFileSync(
    join(root, '.env.local'),
    'PRIVATE_FIXTURE_VALUE=must-stay-private\nBETTER_AUTH_URL=https://gallery.example.test:5281\n',
  );
  const server = await createServer({
    root,
    configFile: false,
    plugins: [authPlugin()],
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(url)).status, 200);
    assert.equal(await statusWithHost(url, 'gallery.example.test:5281'), 200);
    assert.equal(await statusWithHost(url, 'untrusted.example.test:5281'), 403);
    for (const file of [
      '.env.local',
      '.gallerify/auth-secret',
      '.gallerify/auth.sqlite',
      '.gallerify/artworks/private-image',
    ]) {
      for (const prefix of ['/', `/@fs${root}/`]) {
        for (const suffix of ['', '?raw', '?url', '?raw&import', '?raw??']) {
          const response = await fetch(`${url}${prefix}${file}${suffix}`);
          assert.equal(response.status, 403, `${prefix}${file}${suffix}`);
          assert.ok(!(await response.text()).includes('must-stay-private'));
        }
      }
    }
  } finally {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('a custom media directory stays private even when inside Vite filesystem allow roots', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'gallerify-private-media-'));
  const root = join(parent, 'app');
  const media = join(parent, 'private-media');
  mkdirSync(root);
  mkdirSync(media);
  writeFileSync(join(root, 'index.html'), '<title>Media privacy fixture</title>');
  writeFileSync(join(root, '.env.local'), `ARTWORK_STORAGE_PATH=${media}\n`);
  writeFileSync(join(media, 'image.webp'), 'private-artwork-canary');
  const server = await createServer({
    root,
    configFile: false,
    plugins: [authPlugin()],
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, fs: { allow: [parent] } },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    assert.ok(address && typeof address === 'object');
    for (const suffix of ['', '?raw', '?url', '?raw&import']) {
      const response: Response = await fetch(
        `http://127.0.0.1:${address.port}/@fs${media}/image.webp${suffix}`,
      );
      assert.equal(response.status, 403);
      assert.ok(!(await response.text()).includes('private-artwork-canary'));
    }
  } finally {
    await server.close();
    rmSync(parent, { recursive: true, force: true });
  }
});
