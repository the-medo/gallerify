# Worktree development

This agent-neutral workflow follows the bootstrap and lifecycle pattern from
[SWUBASE](https://github.com/the-medo/swu-collection/blob/main/AGENTS.md), adapted
to Gallerify. It needs Linux/WSL, Git, Bash, `flock` (util-linux), Node.js 24,
and Yarn 1.22.22. Auth uses Node's built-in SQLite; no Docker or separate database
service is needed. See [accounts](../../docs/accounts.md) for Google setup.
Use your version manager to activate Node before calling these scripts, including
in non-interactive agent shells. If `node` is missing from `PATH`, the scripts
try an already-installed Node 24 via `mise` on `PATH` or `~/.local/bin/mise`.
They do not install runtimes or change version-manager defaults. An incompatible
Node already on `PATH` produces an error instead of silently switching versions.

## Create and bootstrap a worktree

Keep the main checkout at `/home/medo/dev/gallerify/main` as the base and all
development worktrees under `/home/medo/dev/gallerify/`. Reuse the existing
worktree when continuing a branch. For a new task, for example:

```bash
git -C /home/medo/dev/gallerify/main fetch origin
git -C /home/medo/dev/gallerify/main worktree add --no-track \
  -b feature/my-task /home/medo/dev/gallerify/my-task origin/main
cd /home/medo/dev/gallerify/my-task
scripts/worktree-dev/bootstrap-worktree.sh
scripts/worktree-dev/gallerify-worktree-dev up
```

The bootstrap runs `yarn install --frozen-lockfile --non-interactive` and then
`setup`. Each worktree gets its own `node_modules`; whole env files are never
copied. Setup inherits just the Google client ID/secret from the main checkout
when both local Google settings are empty. Repeated setup preserves existing
configuration. Email/password accounts work without external credentials;
Google sign-in requires a web OAuth client ID and secret in `.env.local`.

## Commands

Run `scripts/worktree-dev/gallerify-worktree-dev <command>` from any directory:

| Command  | Behavior                                                                      |
| -------- | ----------------------------------------------------------------------------- |
| `setup`  | Create missing env files and reserve a port; no install or server start       |
| `up`     | Run setup, start Vite, wait for its identity endpoint; reuse a healthy server |
| `status` | Print worktree, health, URL, and log location; do not provision anything      |
| `logs`   | Print the last 80 lines of this worktree's Vite log                           |
| `down`   | Stop this worktree's owned server; keep env files, dependencies, and logs     |

`up` reports a ready server only after its identity endpoint responds. Application
modules compile on demand, so also run the build and check the browser before
declaring a UI change working. To follow logs continuously, use
`tail -f .gallerify/vite.log`.

## Environment and local state

| Path                     | Owner and purpose                                          |
| ------------------------ | ---------------------------------------------------------- |
| `.env.example`           | Tracked, non-secret template; currently no required values |
| `.env.local`             | Developer-owned settings, created once from the template   |
| `.env.worktree`          | Generated identity and stable port for this checkout       |
| `.gallerify/server.json` | Managed PID and process identity                           |
| `.gallerify/vite.log`    | Appended Vite output                                       |
| `.gallerify/auth.sqlite*` | Local accounts, sessions, and SQLite sidecars             |
| `.gallerify/auth-secret` | Generated local auth secret, reused across restarts       |

Local env files and `.gallerify/` are ignored by Git. The user-authorized exception
to environment isolation is `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: setup
reads this pair from the main checkout's `.env.local` and fills an empty local
pair. All other settings remain independent. Add future development configuration
deliberately to `.env.local`. Vite exposes `VITE_*` values to the browser, so they
must never contain secrets. Auth settings are documented in `.env.example` and
`docs/accounts.md`. Startup creates the local auth secret and migrates SQLite.
Neither auth data nor secrets should be copied from another worktree.

The managed server runs Vite with `mode: 'worktree'` and `NODE_ENV=development`.
Vite loads `.env`, `.env.local`, `.env.worktree`, and `.env.worktree.local`; the
generated keys do not use the `VITE_` prefix. The launcher reads its port and
identity strictly from `.env.worktree` and fixes the host to `127.0.0.1`.
Restart with `down` then `up` after changing env settings. `yarn build` continues
to use Vite's production mode.

## Ports and process ownership

Each checkout path selects a stable starting point in ports 5200–5999. Setup
skips live listeners and ports reserved in other registered worktrees, including
stopped ones. A lock inside the shared Git directory serializes managed
lifecycle commands across worktrees. Vite uses `strictPort`, so a port collision
never silently changes the printed URL. Separate Git clones do not share this
reservation lock; a collision at startup fails explicitly.

Servers bind only to `127.0.0.1`. For remote browsers, the user prefers a private
Tailscale Serve HTTPS URL with the same stable worktree port. Inspect existing
Serve routes first, then map the unused HTTPS port to this worktree's loopback
listener. Set `BETTER_AUTH_URL` to the browser-facing HTTPS origin and register
its Google callback. See [remote browsers](../../docs/accounts.md#remote-browsers-and-forwarded-ports).
`status` reports the internal listener; share the configured Tailscale URL with
the user. The `user-accounts` checkout uses `https://steamdeck.tail73a93e.ts.net:5281/`.

Before stopping anything, the launcher checks Linux `/proc` for the exact server
script, per-launch token, and working directory. A stale/reused PID or another
worktree's process is never stopped. `down` clears stale metadata and preserves
all local configuration. Avoid stopping servers using broad `pkill` commands.

## Troubleshooting and cleanup

- **Node/Yarn missing:** activate Node 24 in the current shell and install Yarn
  1.22.22. Non-interactive shells may not inherit your interactive version manager.
- **Dependencies missing:** run the bootstrap in this worktree.
- **Port occupied after setup:** inspect its owner. To allocate another port,
  run `down`, remove only this worktree's `.env.worktree`, then run `up`.
- **Startup failure:** inspect `logs`; `up` retains the log and cleans up its
  failed server process. Fix the problem before retrying.
- **Copied or moved worktree config:** stop the server before moving a worktree.
  Remove the generated `.env.worktree` at its new location and rerun setup.
- **Removing a worktree:** run `down` in it first, then use `git worktree remove`
  from the base checkout after preserving any work you need. Do not force removal
  to discard uncommitted files. Removing a worktree also removes its local SQLite
  accounts; preserve needed account data first. No containers are created.

## Validate tooling changes

```bash
for script in scripts/worktree-dev/*.sh scripts/worktree-dev/gallerify-worktree-dev; do
  bash -n "$script"
done
yarn test:worktree
yarn lint
yarn build
```

The integration test creates a temporary fixture repository and two Git worktrees
under the workspace directory. It uses the installed Vite dependency, serves a
minimal page, and checks concurrent setup/start, env preservation, occupied ports,
server identity, stale PIDs, and isolated shutdown. It removes its own servers and
fixtures on exit. It neither reads personal env files nor fetches external data.
