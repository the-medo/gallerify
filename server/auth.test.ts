import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { migrateAuth } from './auth.ts';
import { readAuthConfig } from './config.ts';
import { createAuthMiddleware } from './middleware.ts';

async function fixture(google = false, browserOrigin?: string) {
  const root = mkdtempSync(join(tmpdir(), 'gallerify-auth-'));
  let middleware: ReturnType<typeof createAuthMiddleware>;
  const server = createServer((req, res) => {
    void middleware.handle(req, res, () => {
      res.writeHead(404);
      res.end();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}`;
  const config = readAuthConfig(
    {
      ...(google
        ? {
            GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
            GOOGLE_CLIENT_SECRET: 'test-only-google-secret',
          }
        : {}),
      BETTER_AUTH_URL: browserOrigin,
    },
    { root, developmentURL: url },
  );
  await migrateAuth(config);
  middleware = createAuthMiddleware(config);
  return {
    config,
    url,
    async request(path: string, body?: object, headers: Record<string, string> = {}) {
      return fetch(`${url}/api/auth${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Origin: url, ...headers },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
      });
    },
    restart() {
      middleware.close();
      middleware = createAuthMiddleware(config);
    },
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      middleware.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((item) => item.split(';')[0])
    .join('; ');
}

const user = {
  name: 'Gallery Owner',
  email: 'artist@example.com',
  password: 'A long gallery passphrase',
};

test('accounts persist, passwords are hashed, cookies survive restart and sign-out revokes them', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  assert.equal(await (await app.request('/get-session')).json(), null);
  const signup = await app.request('/sign-up/email', user);
  assert.equal(signup.status, 200);
  const signupCookie = cookie(signup);
  assert.match(signup.headers.get('set-cookie') || '', /HttpOnly/i);
  assert.match(signup.headers.get('set-cookie') || '', /SameSite=Lax/i);
  const data = await signup.json();
  assert.equal(data.user.email, user.email);
  assert.equal(data.user.emailVerified, false);
  assert.equal(data.user.password, undefined);

  const db = new DatabaseSync(app.config.databasePath);
  const credential = db
    .prepare('SELECT password FROM account WHERE providerId = ?')
    .get('credential');
  assert.ok(credential?.password);
  assert.notEqual(credential.password, user.password);
  db.close();

  // Migrating an existing database must preserve its accounts and sessions.
  await migrateAuth(app.config);
  app.restart();
  const session = await (
    await app.request('/get-session', undefined, { Cookie: signupCookie })
  ).json();
  assert.equal(session.user.id, data.user.id);
  assert.equal((await app.request('/sign-up/email', user)).status, 422);
  assert.equal(
    (await app.request('/sign-in/email', { email: user.email, password: 'incorrect-password' }))
      .status,
    401,
  );
  const signin = await app.request('/sign-in/email', {
    email: user.email,
    password: user.password,
  });
  assert.equal(signin.status, 200);
  const signedInCookie = cookie(signin);
  assert.equal((await app.request('/sign-out', {}, { Cookie: signedInCookie })).status, 200);
  assert.equal(
    await (await app.request('/get-session', undefined, { Cookie: signedInCookie })).json(),
    null,
  );
});

test('invalid registration and cross-origin requests cannot create accounts', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  assert.equal((await app.request('/sign-up/email', { ...user, password: 'short' })).status, 400);
  assert.equal((await app.request('/sign-up/email', { ...user, email: 'invalid' })).status, 400);
  assert.equal(
    (await app.request('/sign-up/email', user, { Origin: 'https://attacker.example' })).status,
    403,
  );
  const redirect = await app.request('/sign-in/social', {
    provider: 'google',
    callbackURL: 'https://attacker.example',
  });
  assert.equal(redirect.status, 403);
});

test('Google begins an OAuth flow with state, PKCE and the exact callback; secrets stay private', async (t) => {
  const app = await fixture(true);
  t.after(() => app.close());
  const providers = await app.request('/providers');
  assert.equal(providers.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await providers.json(), { google: true });
  const response = await app.request('/sign-in/social', {
    provider: 'google',
    callbackURL: '/',
    errorCallbackURL: '/?authError=google',
    disableRedirect: true,
  });
  assert.equal(response.status, 200);
  const { url } = await response.json();
  const authorization = new URL(url);
  assert.equal(authorization.origin, 'https://accounts.google.com');
  assert.equal(
    authorization.searchParams.get('redirect_uri'),
    `${app.url}/api/auth/callback/google`,
  );
  assert.equal(authorization.searchParams.get('client_id'), app.config.google?.clientId);
  assert.ok(authorization.searchParams.get('state'));
  assert.ok(authorization.searchParams.get('code_challenge'));
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorization.searchParams.get('access_type'), 'online');
  assert.ok(!url.includes('test-only-google-secret'));
  const callback = await app.request('/callback/google?code=forged&state=forged');
  assert.equal(callback.status, 302);
  assert.equal(await (await app.request('/get-session')).json(), null);
});

for (const browserOrigin of ['http://localhost:60718', 'https://gallery.example.test:5281']) {
  test(`forwarded origin ${browserOrigin} accepts cookies and determines the Google callback`, async (t) => {
    const app = await fixture(true, browserOrigin);
    t.after(() => app.close());
    const signup = await app.request('/sign-up/email', user, { Origin: browserOrigin });
    assert.equal(signup.status, 200);
    if (browserOrigin.startsWith('https:'))
      assert.match(signup.headers.get('set-cookie') || '', /; Secure/i);
    const headers = { Origin: browserOrigin, Cookie: cookie(signup) };
    const session = await (await app.request('/get-session', undefined, headers)).json();
    assert.equal(session.user.email, user.email);
    const response = await app.request(
      '/sign-in/social',
      {
        provider: 'google',
        callbackURL: '/',
        disableRedirect: true,
      },
      headers,
    );
    assert.equal(response.status, 200);
    const { url } = await response.json();
    assert.equal(
      new URL(url).searchParams.get('redirect_uri'),
      `${browserOrigin}/api/auth/callback/google`,
    );
    const wrongOrigin = await app.request(
      '/sign-in/social',
      {
        provider: 'google',
        callbackURL: '/',
        disableRedirect: true,
      },
      { ...headers, Origin: app.url },
    );
    assert.equal(wrongOrigin.status, 403);
    assert.equal((await wrongOrigin.json()).code, 'INVALID_ORIGIN');
  });
}

test('unconfigured Google is unavailable and repeated signup attempts are limited', async (t) => {
  const app = await fixture();
  t.after(() => app.close());
  assert.deepEqual(await (await app.request('/providers')).json(), { google: false });
  assert.equal(
    (await app.request('/sign-in/social', { provider: 'google', callbackURL: '/' })).status,
    404,
  );
  for (let index = 0; index < 5; index++) {
    assert.equal((await app.request('/sign-up/email', { ...user, password: 'short' })).status, 400);
  }
  // A caller cannot bypass the limit with forged IP headers or a server restart.
  app.restart();
  const response = await app.request('/sign-up/email', user, {
    'X-Forwarded-For': '1.2.3.4',
    'X-Gallerify-Client-IP': '5.6.7.8',
  });
  assert.equal(response.status, 429);
  assert.ok(response.headers.get('x-retry-after'));
});

test('configuration isolates local cookies/secrets and requires secure production settings', () => {
  const root = mkdtempSync(join(tmpdir(), 'gallerify-config-'));
  try {
    const first = readAuthConfig({}, { root, developmentURL: 'http://localhost:5173' });
    const second = readAuthConfig(
      {},
      { root: join(root, 'second'), developmentURL: 'http://localhost:5174' },
    );
    assert.notEqual(first.cookiePrefix, second.cookiePrefix);
    assert.notEqual(first.secret, second.secret);
    assert.equal(readAuthConfig({}, { root, developmentURL: first.baseURL }).secret, first.secret);
    assert.equal(readFileSync(join(root, '.gallerify/auth-secret'), 'utf8'), first.secret);
    assert.throws(() => readAuthConfig({}), /BETTER_AUTH_URL/);
    assert.throws(() => readAuthConfig({ BETTER_AUTH_URL: 'http://example.com' }), /HTTPS/);
    assert.throws(
      () => readAuthConfig({ BETTER_AUTH_URL: 'https://example.com' }),
      /DATABASE_PATH/,
    );
    assert.throws(
      () =>
        readAuthConfig({
          BETTER_AUTH_URL: 'https://example.com',
          DATABASE_PATH: 'data/auth.sqlite',
        }),
      /BETTER_AUTH_SECRET/,
    );
    assert.throws(
      () =>
        readAuthConfig({ GOOGLE_CLIENT_ID: 'only-id' }, { root, developmentURL: first.baseURL }),
      /both GOOGLE/,
    );
    assert.throws(
      () => readAuthConfig({ BETTER_AUTH_URL: 'https://example.com/nested' }),
      /without a path/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
