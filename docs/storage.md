# Gallerify asset storage

The Cloudflare R2 bucket `gallerify` stores public Gallerify assets. It was created
on 2026-10-26 with Standard storage in Western Europe (`WEUR`, default
jurisdiction).

- [Manage the bucket](https://dash.cloudflare.com/7346c29bdff3ef7f6a8b205bbc613227/r2/default/buckets/gallerify)
- Public development base URL: `https://pub-9fcd2b179c0a4d9ea04195aed388d9b6.r2.dev`
- [Texture manifest](https://pub-9fcd2b179c0a4d9ea04195aed388d9b6.r2.dev/textures/manifest.json)
- [Example wall texture](https://pub-9fcd2b179c0a4d9ea04195aed388d9b6.r2.dev/textures/wall/chalk-plaster.webp)
- [Example floor texture](https://pub-9fcd2b179c0a4d9ea04195aed388d9b6.r2.dev/textures/floor/natural-oak.webp)

## Contents

The bucket contains all 16 generated WebP textures from this branch: eight under
`textures/wall/` and eight under `textures/floor/`, totaling 6,734,190 bytes.
`textures/manifest.json` records their keys, sizes, SHA-256 hashes, and two-meter
physical repeat size. Each uploaded image has `Content-Type: image/webp`.

The frontend loads these images directly from R2 through `src/utils/textures.ts`.
Texture binaries, including the retired PNG/JPEG textures, are removed from Git.
Generation provenance remains under `src/assets/textures/`, including object
keys and SHA-256 hashes for the hosted images.

The public base URL defaults to the development endpoint above. Set
`VITE_ASSET_BASE_URL` in the build environment (or `.env.local` for local work)
to use another public asset domain; `/textures/wall/<name>.webp` and
`/textures/floor/<name>.webp` are appended automatically. Restart Vite after
changing local env settings and rebuild for deployed changes. No R2 credentials
are needed by the frontend.

## Browser access

Objects are publicly readable at their full URLs. The bucket root does not list
objects; use the manifest to discover the textures. Uploads and deletion require
Cloudflare authentication. Keep private files and credentials out of this bucket.

The configured CORS rule supports local worktree ports and other app origins:

```json
{
  "rules": [
    {
      "id": "Public texture reads",
      "allowed": {
        "origins": ["*"],
        "methods": ["GET", "HEAD"]
      },
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

This allows anonymous image loading for WebGL. Use `crossOrigin = 'anonymous'`
when loading an image directly; Three.js texture loaders already use this mode.

## Updating assets

Upload files using the Cloudflare R2 dashboard, an authenticated Cloudflare API
client, or R2's S3-compatible API. Preserve the `textures/wall/` and
`textures/floor/` prefixes and image MIME type. Update the manifest when adding or
replacing textures, and retain source provenance in the repository.

Use new object keys for revised textures when consumers cache URLs. Keep upload
credentials in server-side tooling, never in browser-visible `VITE_*` variables.

## Production delivery

The default `r2.dev` endpoint is for development and is rate limited. Before a
production deployment, connect a custom asset domain in the bucket settings and
set `VITE_ASSET_BASE_URL` to that origin at build time. Configure caching there;
no custom domain is currently attached. Texture previews and 3D rendering require
the public asset endpoint to be reachable.

See Cloudflare's [public bucket documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/)
and [R2 limits](https://developers.cloudflare.com/r2/platform/limits/).
