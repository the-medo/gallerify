# User accounts

Gallerify uses Better Auth 1.7.17 with React, a Node.js 24 HTTP backend, and Node's
built-in SQLite driver. The frontend and `/api/auth/*` share one origin in both
development and production. Accounts and sessions persist in SQLite. Passwords
are hashed by Better Auth; session cookies are HttpOnly and use SameSite=Lax.
HTTPS deployments use Secure cookies. OAuth tokens are encrypted at rest.

Visitors can continue using the gallery builder without an account. The header
offers account creation, sign-in, the signed-in user's name, and sign-out.
Google sign-in creates an account on first use. Email/password registration
requires a name, email, and a 12–128 character password, and signs the user in.
This feature does not yet save gallery layouts to accounts.

## Local development

Run the regular bootstrap and `yarn dev:up`. Vite mounts the backend in the same
process and port; no second server, Docker container, or external database is
needed. Startup applies the Better Auth schema idempotently. `yarn dev` also
works, at `http://localhost:5173`. Ports are strict because OAuth callbacks must
match exactly. When browsing on the same machine, use the origin printed by the
server; `localhost` and `127.0.0.1` are different origins. For remote browsers,
use the configured browser-facing origin described below.

Each checkout defaults to these ignored local files:

- `.gallerify/auth.sqlite` and its WAL/SHM sidecars: account and session data.
- `.gallerify/auth-secret`: a generated secret, reused across server restarts.
- `.env.local`: optional overrides and Google OAuth credentials.

Cookie names are also isolated between worktrees because cookies do not isolate
ports. Vite denies HTTP access to the secret and database files. Do not copy
auth secrets, databases, or whole env files between worktrees. `dev:down` preserves
accounts and configuration. At the user's request, bootstrap inherits only
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the main checkout's `.env.local`
if both local values are empty. Existing Google settings and other values are
preserved. Each worktree's callback still needs registration on that shared client.

`yarn auth:plan` prints schema changes; `yarn auth:migrate` applies them. Both use
the installed Better Auth version and load `.env.local`. `yarn preview` serves
the built UI with auth at `http://localhost:4173`, using the same local database;
run the migration first and register that callback separately when using Google.

## Google sign-in

The dedicated Google Cloud project is **Gallerify**, project ID
`gallerify-the-medo` (project number `255425610509`). It was created with gcloud;
no billing account or hosting service was provisioned.

Google Auth Platform web client creation is a Console operation. The gcloud IAP
commands are not a generic OAuth client management API, and their former API
has been shut down. See [Google's client setup guide](https://support.google.com/cloud/answer/15549257)
and [IAP API deprecation](https://docs.cloud.google.com/iap/docs/programmatic-oauth-clients).

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview?project=gallerify-the-medo).
   Register **Gallerify**, choose **External** audience, and supply your support
   and developer email addresses. Configure the audience/test users as needed.
2. In [Clients](https://console.cloud.google.com/auth/clients?project=gallerify-the-medo),
   create a **Web application** client. Add the exact app origin followed by
   `/api/auth/callback/google` to **Authorized redirect URIs**. For this worktree:

   ```text
   https://steamdeck.tail73a93e.ts.net:5281/api/auth/callback/google
   ```

   For a foreground dev server, also register
   `http://localhost:5173/api/auth/callback/google`. In production, register
   `https://YOUR_APP_DOMAIN/api/auth/callback/google`. This is a server redirect
   flow; Google Identity Services JavaScript origins are not required.
3. Put the client ID and secret in this worktree's `.env.local`:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

4. Restart with `yarn dev:down && yarn dev:up`. The Google button becomes available
   when both settings are present. No secret is sent to the browser. Only basic
   profile/email identity is requested, with no offline access.
5. Complete sign-in in a real browser, reload to check the session, then sign out.
   Configure the production audience/branding in Google Auth Platform before
   offering Google sign-in publicly.

If `BETTER_AUTH_URL` is set, it must match the browser origin and registered
callback. Leave it blank only when the browser uses the server's printed origin. OAuth
cancellation and callback errors return to the account dialog with a retry.
If Google reports `redirect_uri_mismatch` despite an exact saved URI, verify that
the client ID matches this worktree's setting. Google documents that client
setting changes can take [5 minutes to a few hours](https://support.google.com/cloud/answer/15549257)
to take effect; wait for propagation before changing the app's callback.

### Remote browsers and forwarded ports

The preferred browser address for this worktree is now
**[https://steamdeck.tail73a93e.ts.net:5281/](https://steamdeck.tail73a93e.ts.net:5281/)**,
available within the tailnet. Tailscale Serve forwards its HTTPS traffic to the
loopback listener at `http://127.0.0.1:5281`. This worktree's `.env.local` sets
`BETTER_AUTH_URL=https://steamdeck.tail73a93e.ts.net:5281`. Register this callback:

```text
https://steamdeck.tail73a93e.ts.net:5281/api/auth/callback/google
```

Vite permits the configured auth hostname explicitly. No public Funnel is
enabled. `dev:down` stops the app but preserves the Serve mapping so `dev:up`
keeps the same HTTPS URL. Before removing this worktree, inspect the mapping's
target and remove only its route with `tailscale serve --https=5281 off`.

The URL printed by `dev:status` is the listener on the development machine. A
browser on another computer may reach it through a different forwarded URL.
For example, `http://localhost:60718` on the browser's computer can forward to
`http://127.0.0.1:5281` on the Steam machine. In that case configure this worktree:

```dotenv
BETTER_AUTH_URL=http://localhost:60718
```

If using this alternative tunnel, register `http://localhost:60718/api/auth/callback/google` on the Google web
client, then restart this worktree's server. For a Tailscale HTTPS proxy, use its
actual HTTPS origin instead. Keep the entire OAuth flow on the browser-facing
origin so the state and session cookies return to the same browser host.

If the forwarding tool changes the browser's port, update both settings or use a
stable forwarded port. Do not copy this origin setting to other worktrees. A
local `INVALID_ORIGIN` error means the app rejected the browser origin; Google's
`redirect_uri_mismatch` means the callback sent to Google is not accepted for the
selected Google client. Inspect both addresses before attributing a failure to
Google configuration propagation.

## Production

Static hosting alone cannot run authentication. Use the Node server behind an
HTTPS reverse proxy and mount persistent storage for the SQLite database. This
setup is intended for one application instance, not ephemeral/serverless disks
or multiple replicas sharing a network filesystem.

Set server environment variables (or a protected `.env.local`):

```dotenv
BETTER_AUTH_URL=https://YOUR_APP_DOMAIN
BETTER_AUTH_SECRET=GENERATE_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
DATABASE_PATH=/var/lib/gallerify/auth.sqlite
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
HOST=127.0.0.1
PORT=3000
```

Generate the secret with `openssl rand -base64 48`. Keep it stable and backed up
securely. Set `HOST=0.0.0.0` only when the deployment requires listening beyond
loopback. `VITE_*` variables are public; never use them for secrets.

```bash
yarn install --frozen-lockfile
yarn lint
yarn test:auth
yarn build
NODE_ENV=production yarn auth:plan
NODE_ENV=production yarn auth:migrate
yarn start
```

Review schema plans and back up the database before migrations or Better Auth
upgrades. Production startup does not auto-migrate. Preserve the database,
including pending WAL data, using SQLite's backup facility or after a clean
server shutdown. Do not put private account data in the public R2 asset bucket.

Better Auth enforces trusted origins and database-backed request limits. The
HTTP adapter replaces its IP header with the socket peer address to prevent
spoofing. Behind a reverse proxy all clients currently share its rate limits;
configure a trusted-proxy IP policy for the actual deployment before scaling.

Email delivery is not configured: email/password accounts are unverified and
password reset is not offered. Google verifies Google identities. Automatic
account linking is disabled to avoid merging an unverified email/password
account with a Google identity; use the same sign-in method used to register.

## Checks

`yarn test:auth` exercises real HTTP handlers and temporary SQLite databases:
registration, validation, duplicate emails, wrong passwords, session persistence,
logout revocation, origin checks, OAuth state/PKCE, forged callbacks, rate limits,
and secret/cookie isolation. Google redirect tests use test credentials and do
not contact Google; a live consent/callback test requires a real OAuth client.

Implementation references: [Better Auth Google](https://better-auth.com/docs/authentication/google),
[SQLite](https://better-auth.com/docs/adapters/sqlite), and
[email/password](https://better-auth.com/docs/authentication/email-password).
