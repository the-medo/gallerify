import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
    for (const file of ['.env.local', '.gallerify/auth-secret', '.gallerify/auth.sqlite']) {
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
