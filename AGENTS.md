# Gallerify agent guide

## Repository overview

Gallerify is a gallery layout builder: React 18, TypeScript, Vite, Zustand,
Pixi.js for 2D, and React Three Fiber/Three.js for 3D. Better Auth runs on Node 24
with SQLite, supporting email/password accounts and optional Google sign-in.
Read `docs/accounts.md` for environment, migrations, and deployment details.

| Area                               | Location                                         |
| ---------------------------------- | ------------------------------------------------ |
| App shell and styles               | `src/App.tsx`, `src/theme-config.css`            |
| Controls and previews              | `src/components/`                                |
| Shared gallery state               | `src/store/store.ts`                             |
| Layout generation and wall removal | `src/compute/`                                   |
| Geometry, textures, types          | `src/utils/`                                     |
| Artwork and textures               | `src/assets/` (retain adjacent provenance files) |
| Local worktree lifecycle           | `scripts/worktree-dev/`                          |
| Authentication backend            | `server/`                                        |
| Account UI and client              | `src/components/Account/`, `src/lib/auth-client.ts` |

## Worktree development

- Repository: <https://github.com/the-medo/gallerify>.
- Main checkout: `/home/medo/dev/gallerify/main`. Keep it as the base; develop in
  Git worktrees under `/home/medo/dev/gallerify/<task-name>`.
- Reuse a suitable existing worktree when continuing a task. If managed worktree
  tooling cannot use this location, use `git -C /home/medo/dev/gallerify/main
worktree add` with an explicit path under this workspace.
- Use Node.js 24 and Yarn Classic 1.22.22. Activate the runtime in the current
  shell; `.node-version` and `package.json` record the versions.
  The scripts also find an already-installed mise Node 24 if `node` is missing
  from `PATH`; other version managers must be activated explicitly.
- Preserve `yarn.lock`. Do not introduce npm, pnpm, or Bun lockfiles.

For each new Linux/WSL worktree, run the agent-neutral bootstrap:

```bash
scripts/worktree-dev/bootstrap-worktree.sh
```

Then use the supported lifecycle:

```bash
scripts/worktree-dev/gallerify-worktree-dev up
scripts/worktree-dev/gallerify-worktree-dev status
scripts/worktree-dev/gallerify-worktree-dev logs
scripts/worktree-dev/gallerify-worktree-dev down
```

Read [the worktree guide](scripts/worktree-dev/README.md) before changing lifecycle
tooling. Bootstrap installs dependencies and performs idempotent setup; it does
not start the application. `up` binds Vite to loopback with a worktree-specific
port. `status` reports the internal listener. For remote access, use the configured
Tailscale HTTPS origin and set `BETTER_AUTH_URL` to that browser-facing origin.

`.env.local`, `.env.worktree`, and `.gallerify/` are local state. Do not commit or
copy whole files between worktrees. Setup creates `.env.local` from `.env.example`
only when missing and preserves developer edits. As explicitly requested by the
user, setup inherits only `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the
main checkout when both local values are empty. Preserve a custom/partial pair;
never copy auth secrets, databases, ports, or other settings. Add any future env contract to the
example and docs; never put secrets in browser-visible `VITE_*` variables.

Use `down` before removing or relocating a worktree. Stop only processes owned by
the current worktree; avoid broad process kills or cleanup of another worktree.

## Validation and delivery

- For source, configuration, or tooling changes, run `yarn lint` and `yarn build`.
- For authentication changes, run `yarn test:auth`. Keep the SQLite database and
  secrets out of Git and browser-served files. Never copy `.gallerify/` across
  worktrees. Google credentials are server-only; live Google tests need a client.
- For worktree lifecycle, env, port, or process-ownership changes, also run Bash
  syntax checks and `yarn test:worktree` as described in the worktree guide.
- For UI/rendering changes, verify generation, 2D/3D switching, wall selection,
  texture changes, and desktop/mobile layouts in a browser. The 3D view needs
  WebGL. Put screenshots and temporary debugging output in ignored `logs/`.
- Keep changes focused, follow the existing TypeScript and Prettier conventions,
  and preserve unrelated work. Add focused tests when behavior warrants them.
- At handoff, report the branch/worktree, changed behavior, checks actually run,
  and any unresolved limitations. Do not claim browser validation from a build
  alone. Commit, push, and open a PR when requested by the user.
