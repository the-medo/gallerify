import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export type ArtworkStorageConfig = {
  directory: string;
  s3?: {
    bucket: string;
    endpoint?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
};

export function readArtworkStorageConfig(
  env: Record<string, string | undefined>,
  root: string,
  databasePath: string,
): ArtworkStorageConfig {
  const directory = resolve(
    root,
    env.ARTWORK_STORAGE_PATH || resolve(dirname(databasePath), 'artworks'),
  );
  const inside = relative(root, directory);
  if (
    !isAbsolute(inside) &&
    inside !== '..' &&
    !inside.startsWith(`..${sep}`) &&
    !inside.startsWith(`.gallerify${sep}`)
  )
    throw new Error('ARTWORK_STORAGE_PATH must be outside the checkout or inside .gallerify.');
  const bucket = env.ARTWORK_S3_BUCKET?.trim();
  const accessKeyId = env.ARTWORK_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.ARTWORK_S3_SECRET_ACCESS_KEY?.trim();
  const endpoint = env.ARTWORK_S3_ENDPOINT?.trim();
  if (
    [bucket, accessKeyId, secretAccessKey, endpoint].some(Boolean) &&
    !(bucket && accessKeyId && secretAccessKey)
  )
    throw new Error('Set ARTWORK_S3_BUCKET and both private S3 credentials together.');
  if (endpoint && new URL(endpoint).protocol !== 'https:')
    throw new Error('ARTWORK_S3_ENDPOINT must use HTTPS.');
  return {
    directory,
    s3:
      bucket && accessKeyId && secretAccessKey
        ? {
            bucket,
            accessKeyId,
            secretAccessKey,
            endpoint,
            region: env.ARTWORK_S3_REGION || 'auto',
          }
        : undefined,
  };
}

export interface ArtworkStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  close(): void;
}

export function createArtworkStorage(config: ArtworkStorageConfig): ArtworkStorage {
  // All keys are generated internally, never derived from upload filenames.
  const checkedKey = (key: string) => {
    if (
      !/^[a-zA-Z0-9_-]+\/[a-f0-9-]+\/[a-f0-9-]+\/(original|thumbnail|scene|inspection)$/.test(key)
    )
      throw new Error('Invalid artwork storage key.');
    return key;
  };
  if (config.s3) {
    const { bucket, region, endpoint, accessKeyId, secretAccessKey } = config.s3;
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
    return {
      async put(key, bytes, contentType) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: checkedKey(key),
            Body: bytes,
            ContentType: contentType,
          }),
        );
      },
      async get(key) {
        const object = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: checkedKey(key) }),
        );
        if (!object.Body) throw new Error('Artwork media unavailable.');
        return Buffer.from(await object.Body.transformToByteArray());
      },
      async remove(key) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: checkedKey(key) }));
      },
      close() {
        client.destroy();
      },
    };
  }
  const path = (key: string) => resolve(config.directory, checkedKey(key));
  return {
    async put(key, bytes) {
      const file = path(key);
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file, bytes, { mode: 0o600 });
    },
    get(key) {
      return readFile(path(key));
    },
    async remove(key) {
      await rm(path(key), { force: true });
    },
    close() {},
  };
}
