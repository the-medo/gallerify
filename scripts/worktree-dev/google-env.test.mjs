import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
import test from 'node:test';
import { syncGoogleEnv } from './google-env.mjs';

test('worktrees inherit only the Google pair and preserve local overrides', () => {
  const root = mkdtempSync(join(tmpdir(), 'gallerify-google-env-'));
  const source = join(root, 'main');
  const target = join(root, 'feature');
  mkdirSync(source);
  mkdirSync(target);
  const path = join(target, '.env.local');
  const original =
    '# Local settings\nVITE_ASSET_BASE_URL=https://assets.example\nBETTER_AUTH_SECRET=local-only\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n';
  try {
    writeFileSync(
      join(source, '.env.local'),
      'GOOGLE_CLIENT_ID="shared-client"\nGOOGLE_CLIENT_SECRET="shared-secret"\nBETTER_AUTH_SECRET=never-copy\nDATABASE_PATH=never-copy\nVITE_ASSET_BASE_URL=never-copy\n',
    );
    writeFileSync(path, original);
    assert.equal(syncGoogleEnv(source, target), true);
    const inherited = readFileSync(path, 'utf8');
    assert.ok(inherited.startsWith('# Local settings\n'));
    assert.deepEqual(parseEnv(inherited), {
      VITE_ASSET_BASE_URL: 'https://assets.example',
      BETTER_AUTH_SECRET: 'local-only',
      GOOGLE_CLIENT_ID: 'shared-client',
      GOOGLE_CLIENT_SECRET: 'shared-secret',
    });
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(syncGoogleEnv(source, target), false);
    assert.equal(readFileSync(path, 'utf8'), inherited);
    writeFileSync(path, `${original}\nGOOGLE_CLIENT_ID=custom-client\n`);
    assert.equal(syncGoogleEnv(source, target), false);
    assert.equal(parseEnv(readFileSync(path, 'utf8')).GOOGLE_CLIENT_ID, 'custom-client');
    assert.equal(syncGoogleEnv(source, target, { overwrite: true }), true);
    assert.equal(parseEnv(readFileSync(path, 'utf8')).GOOGLE_CLIENT_ID, 'shared-client');
    writeFileSync(join(source, '.env.local'), 'GOOGLE_CLIENT_ID=partial\n');
    assert.equal(syncGoogleEnv(source, target, { overwrite: true }), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
