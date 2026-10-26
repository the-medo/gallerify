# Gallerify

A gallery layout builder with interactive 2D and 3D previews. Built with React,
TypeScript, Vite, Zustand, Pixi.js, and React Three Fiber. It currently has no
backend, database, authentication, or required API keys.

## Local development

Use Node.js 24 (`.node-version`) and Yarn Classic 1.22.22 (`packageManager` in
`package.json`). Activate Node with your version manager and ensure both `node`
and `yarn` are on `PATH`. If Yarn is missing, run `npm install --global yarn@1.22.22`.
The worktree scripts can also find an already-installed mise Node 24 when an
agent shell has no `node` on `PATH`.

On Linux/WSL, from a development worktree:

```bash
scripts/worktree-dev/bootstrap-worktree.sh
scripts/worktree-dev/gallerify-worktree-dev up
scripts/worktree-dev/gallerify-worktree-dev status
```

Bootstrap installs the locked dependencies, creates `.env.local` from
`.env.example` if missing, and assigns a local port. It does not start the app.
`up` starts Vite in the background and prints this worktree's URL.

```bash
yarn dev:logs    # Last 80 log lines
yarn dev:down    # Stop only this worktree's managed server
yarn dev:up      # Start again at the same URL
```

`yarn dev:setup` is an alias for bootstrap. `yarn dev:status` prints the managed
server status and URL. Read [the worktree guide](scripts/worktree-dev/README.md)
for isolation, env handling, troubleshooting, and cleanup, and
[AGENTS.md](AGENTS.md) for agent instructions.

For a simple foreground server on any platform, run `yarn install --frozen-lockfile`
then `yarn dev`. This uses Vite's default port and is stopped with Ctrl+C; it is
independent of the worktree launcher and does not load `.env.worktree`.

## Validation

```bash
yarn lint
yarn build
yarn test:worktree  # Linux/WSL lifecycle integration checks
```

For UI changes, also check layout generation, 2D/3D switching, wall selection,
texture changes, and responsive layouts in a browser. The 3D preview requires
WebGL. The app loads fonts from Google Fonts and wall/floor textures from the
public Cloudflare R2 bucket, so those assets require network access.

## Gallery presets

The canvas opens with **The Salon**, one of 20 hand-authored layouts. Browse Small,
Medium, Large, or Grand to choose plans from 6 × 6 m to 30 × 24 m. Each card shows
the actual floor plan, dimensions, area, and a short description. Selecting a plan
loads it immediately in either preview mode and resets wall selections and finishes.

The random generator remains available beside the canvas. Dimension sliders set up
the next generated layout; the current plan stays intact until **Generate a layout**
is clicked. Choose any preset again to restore its original walls and finishes.

Preset definitions live in `src/presets/galleryPresets.ts`. Their wall coordinates
use grid modules of `stepSize` meters. Thumbnails and previews share the same layout
builder, including the centered entrance. Run `yarn test:presets` to check all 20
plans for distinct geometry, bounds, entrances, reachability, and fresh copies.

## Project layout

| Area                             | Location                              |
| -------------------------------- | ------------------------------------- |
| App shell and styling            | `src/App.tsx`, `src/theme-config.css` |
| UI and renderers                 | `src/components/`                     |
| Gallery state and actions        | `src/store/store.ts`                  |
| Layout generation                | `src/compute/`                        |
| Geometry, textures, shared types | `src/utils/`                          |
| Artwork, branding, textures      | `src/assets/`                         |
| Local development tooling        | `scripts/worktree-dev/`               |

Original palette reference: [Realtime Colors](https://www.realtimecolors.com/?colors=081609-f8fcf8-302c77-d6f0d7-b64943&fonts=Poppins-Poppins).

## Asset storage

The app loads all 16 wall and floor textures from the `gallerify` Cloudflare R2
bucket. Texture images are excluded from Git; generation provenance remains in
`src/assets/textures/`. Set the optional `VITE_ASSET_BASE_URL` at build time to use
a custom asset domain. See [asset storage](docs/storage.md) for URLs, browser
access, upload conventions, and production delivery setup.
