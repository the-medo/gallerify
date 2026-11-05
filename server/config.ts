import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function readAuthConfig(
  env: Record<string, string | undefined>,
  { root = process.cwd(), developmentURL }: { root?: string; developmentURL?: string } = {},
) {
  const production = !developmentURL;
  const rawURL = env.BETTER_AUTH_URL || developmentURL;
  if (!rawURL) throw new Error('Set BETTER_AUTH_URL to the public app origin.');
  const url = new URL(rawURL);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('BETTER_AUTH_URL must be an HTTP(S) origin without a path.');
  if (production && url.protocol !== 'https:') {
    throw new Error('Production BETTER_AUTH_URL must use HTTPS.');
  }
  if (production && !env.DATABASE_PATH) throw new Error('Set DATABASE_PATH to persistent storage.');
  const databasePath = resolve(root, env.DATABASE_PATH || '.gallerify/auth.sqlite');
  let secret = env.BETTER_AUTH_SECRET;
  if (!secret && !production) {
    const secretPath = resolve(root, '.gallerify/auth-secret');
    mkdirSync(dirname(secretPath), { recursive: true, mode: 0o700 });
    try {
      writeFileSync(secretPath, randomBytes(48).toString('base64url'), { mode: 0o600, flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    secret = readFileSync(secretPath, 'utf8').trim();
  }
  if (!secret || secret.length < 32)
    throw new Error('BETTER_AUTH_SECRET must have at least 32 characters.');
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error('Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in.');
  }
  return {
    baseURL: url.origin,
    secret,
    databasePath,
    // Cookies are shared across ports. Each local checkout needs its own names.
    cookiePrefix: production
      ? 'gallerify'
      : `gallerify-${createHash('sha256').update(databasePath).digest('hex').slice(0, 12)}`,
    google: clientId && clientSecret ? { clientId, clientSecret } : undefined,
  };
}

export type AuthConfig = ReturnType<typeof readAuthConfig>;
