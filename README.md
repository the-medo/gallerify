# Gallerify

A gallery layout builder with interactive 2D and 3D previews. Built with React,
TypeScript, Vite, Zustand, Pixi.js, and React Three Fiber. Better Auth provides
Google and email/password accounts through a Node.js backend and SQLite.
See [user accounts](docs/accounts.md) for Google setup and production hosting.

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
`up` starts Vite and the auth backend in one process and prints this worktree's
URL. Accounts persist locally; Google sign-in needs OAuth client credentials.

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
yarn test:auth      # Accounts, sessions, OAuth setup, and security checks
yarn test:worktree  # Linux/WSL lifecycle integration checks
```

For UI changes, also check layout generation, 2D/3D switching, wall selection,
texture changes, and responsive layouts in a browser. The 3D preview requires
WebGL. The app loads fonts from Google Fonts and wall/floor textures from the
public Cloudflare R2 bucket, so those assets require network access.

## Your artwork

Open a saved gallery and choose **Art** to upload JPEG, PNG, or WebP images.
Uploads are private to your account and can be reused across your galleries.
Each image can be up to 20 MB and 40 megapixels; the library allows 500 MB,
including the original and generated display images. A gallery can contain
up to 200 placements.

Click an artwork thumbnail, then click a wall face to hang it. On desktop you
can also drag the thumbnail onto a wall. The **Wall** and **Wall face** selectors
provide an alternative to aiming in 3D. Select a placed artwork to adjust its
physical size, position along the wall, and center height. Proportions stay fixed;
adjacent wall segments form one hanging surface, and joining walls block positions
that would clip through them.

Use **Save artwork details** for the library title, description, medium, year,
and optional original dimensions. These library details are saved separately
from the gallery arrangement. The gallery's **Save** button and minute autosave
preserve its placements. Removing a placement keeps its image in the library;
deleting an image requires removing and saving every gallery that uses it first.
Changing presets or generating a new layout asks before returning placed works
to the library.

In **Play**, click a painting or choose it from **Inspect artwork** to open a
neutral, zoomable image with its details. Walking pauses during inspection.
Escape closes the artwork and leaves the walk open.

See [artwork storage and API](docs/artwork.md) for private storage setup,
document coordinates, media versions, and tests.

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

## Walk through your gallery

Click **Play** beside the preview title in either 2D or 3D. The gallery opens in a
full-window view at eye level, starting just inside the entrance and facing inward.
The current layout and wall/floor finishes carry into the walk.

- **WASD / arrow keys** move; **Q / E** turn. Drag the view to look around, or choose
  **Enable mouse look** for free mouse movement. **Esc** releases the captured mouse;
  outside mouse capture, **Esc** or **Exit** returns to the editor.
- On touch screens, hold the direction buttons to move and drag the scene to look.
- Walls block movement, and the floor boundary keeps you inside the gallery.
- **Back to entrance** resets your position and view. Each new Play starts there too.

Generated layouts start at the front of the gallery, using a clear spot beside any
central partition. Walking does not edit the layout or change wall selections.
Run `yarn test:walking` for entrance and collision checks.

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
| Authentication backend           | `server/`                             |
| Account UI and auth client       | `src/components/Account/`, `src/lib/auth-client.ts` |

Original palette reference: [Realtime Colors](https://www.realtimecolors.com/?colors=081609-f8fcf8-302c77-d6f0d7-b64943&fonts=Poppins-Poppins).

## Asset storage

The app loads all 16 wall and floor textures from the `gallerify` Cloudflare R2
bucket. Texture images are excluded from Git; generation provenance remains in
`src/assets/textures/`. Set the optional `VITE_ASSET_BASE_URL` at build time to use
a custom asset domain. See [asset storage](docs/storage.md) for URLs, browser
access, upload conventions, and production delivery setup.
