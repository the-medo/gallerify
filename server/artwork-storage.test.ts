import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { S3Client } from '@aws-sdk/client-s3';
import { createArtworkStorage, readArtworkStorageConfig } from './artwork-storage.ts';

test('private local storage writes restricted files and rejects path traversal', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'gallerify-media-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = readArtworkStorageConfig({}, root, join(root, '.gallerify/auth.sqlite'));
  const storage = createArtworkStorage(config);
  const key = `artist/${crypto.randomUUID()}/${crypto.randomUUID()}/scene`;
  await storage.put(key, Buffer.from('image-bytes'), 'image/webp');
  assert.equal((await storage.get(key)).toString(), 'image-bytes');
  assert.equal((await stat(join(config.directory, key))).mode & 0o777, 0o600);
  assert.throws(() => storage.get('../auth.sqlite'), /Invalid/);
  await storage.remove(key);
  await assert.rejects(storage.get(key));
  for (const path of ['public/art', 'src/assets/art', '..cache/art'])
    assert.throws(
      () =>
        readArtworkStorageConfig(
          { ARTWORK_STORAGE_PATH: path },
          root,
          join(root, '.gallerify/auth.sqlite'),
        ),
      /outside/,
    );
  assert.throws(
    () =>
      readArtworkStorageConfig(
        { ARTWORK_S3_BUCKET: 'private' },
        root,
        join(root, '.gallerify/auth.sqlite'),
      ),
    /credentials/,
  );
});

test('S3 adapter uses private keys and implements write, read, and cleanup without public ACLs', async (t) => {
  const commands: { name: string; input: Record<string, unknown> }[] = [];
  t.mock.method(
    S3Client.prototype,
    'send',
    async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      commands.push({ name: command.constructor.name, input: command.input });
      return { Body: { transformToByteArray: async () => Buffer.from('private-image') } };
    },
  );
  const storage = createArtworkStorage({
    directory: '/unused',
    s3: {
      bucket: 'private-test-bucket',
      endpoint: 'https://storage.example.test',
      region: 'auto',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    },
  });
  t.after(() => storage.close());
  const key = `artist/${crypto.randomUUID()}/${crypto.randomUUID()}/scene`;
  await storage.put(key, Buffer.from('private-image'), 'image/webp');
  assert.equal((await storage.get(key)).toString(), 'private-image');
  await storage.remove(key);
  assert.deepEqual(
    commands.map((item) => item.name),
    ['PutObjectCommand', 'GetObjectCommand', 'DeleteObjectCommand'],
  );
  for (const { input } of commands) {
    assert.equal(input.Bucket, 'private-test-bucket');
    assert.equal(input.Key, key);
    assert.equal(input.ACL, undefined);
  }
});
