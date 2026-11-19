# Artwork uploads and placement

Artwork is reusable account-owned media. A gallery stores placements referencing
artwork IDs, with its own display dimensions and wall coordinates. Uploaded
originals and all derivatives are private. Public exhibitions are a later task.

## Storage

By default, private media lives in `artworks/` beside the authentication database
(`.gallerify/artworks/` in development). Set `ARTWORK_STORAGE_PATH` to a persistent
directory outside the checkout for production. Within a checkout, only locations
under `.gallerify/` are accepted; Vite denies access to that directory, including
raw imports. Back up the database and media together. Never put uploads in `public/`,
`src/assets/`, `dist/`, or the existing public texture bucket.

To use a **private** S3-compatible bucket instead, set `ARTWORK_S3_BUCKET`,
`ARTWORK_S3_ACCESS_KEY_ID`, and `ARTWORK_S3_SECRET_ACCESS_KEY`. Set
`ARTWORK_S3_ENDPOINT` to the HTTPS service endpoint for R2 or another compatible
provider, and set `ARTWORK_S3_REGION` as needed (`auto` for R2). Credentials stay on
the server. Bucket configuration must deny anonymous reads; the application does
not change bucket permissions. Changing storage configuration does not migrate
existing objects: move the stored keys before switching a populated installation.

Object keys use `ownerId/artworkId/mediaVersion/variant`, never upload filenames.
Each upload gets an immutable media version. Variants are the original and
thumbnail/scene/inspection WebP derivatives with maximum dimensions of 320, 1600,
and 3200 pixels respectively. Processing applies EXIF orientation, converts display
images to sRGB, preserves transparency and aspect ratio, and strips incidental
metadata. Only the three derivatives can be read through the API.

Limits are 20 MiB per input, 40 million decoded pixels, 500 MiB stored per account,
and 200 placements per gallery. Animated and unsupported images are rejected. Each
server processes one upload at a time to bound image-processing memory; callers
receiving a busy response can retry. Quota checks and final record insertion are
transactional. Failed uploads attempt to remove incomplete objects; unexpected
process termination can leave unreferenced objects for operational cleanup.

## API and ownership

All routes below require the owner's session. Mutations also require the configured
application Origin. Responses and media use no-store caching.

| Route                                           | Purpose                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /api/artworks`                             | List the owner's reusable artwork                                               |
| `PUT /api/artworks/:id/content`                 | Upload image bytes with an image MIME type and URL-encoded `X-Artwork-Filename` |
| `PATCH /api/artworks/:id`                       | Save title, description, medium, year, and optional physical dimensions         |
| `DELETE /api/artworks/:id`                      | Delete an artwork only when no saved gallery references it                      |
| `GET /api/artworks/:id/media/:version/:variant` | Read an owned thumbnail, scene image, or inspection image                       |

The client generates the upload UUID once and reuses it for retries. Replaying
identical bytes returns the existing artwork, including when the first response
was lost. Another owner or different bytes cannot overwrite that ID. A record is
visible only after all media has been written. Deleting an unsaved placement does
not remove the reference in the saved gallery; save that gallery before deleting
the library image.

## Gallery document version 2

Legacy gallery documents without a version migrate to `schemaVersion: 2` with an
empty `placements` array. The existing gallery revision remains the optimistic
save counter and is independent of the document version.

A placement contains `id`, `artworkId`, `wallId`, `side`, `u`, `elevation`, `width`,
and `height`. Positions and sizes use meters. `u` follows the anchor wall from its
line start toward its line end; it may extend onto contiguous collinear segments.
For tangent `(tx, tz)`, side `1` faces normal `(-tz, tx)` and side `-1` faces the
opposite direction. Artwork image orientation follows its face and is not mirrored.
`elevation` measures the artwork's center above the floor.

Placement validation accounts for wall ends, visible wall height, and perpendicular
walls projecting into the chosen face. Editor and server use the same geometry
utilities. The API additionally verifies artwork ownership and image proportions.
The editor and Play render the same explicit gallery document through `GalleryScene`.
Changing layouts clears placements as one store update after confirmation, while
retaining every artwork in the library. Future stable wall IDs must migrate these
references alongside geometry; clients do not parse the current wall IDs.

## Verification

Run `yarn lint`, `yarn build`, `yarn test:auth`, `yarn test:presets`, and
`yarn test:walking`. Artwork tests are included in `test:auth`: processing and
orientation, upload limits, private reads, idempotent retries, metadata validation,
reference protection, legacy document migration, and placement geometry.

Run `yarn playwright install chromium` once, then `yarn test:artwork:browser`.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing compatible Chromium binary.
The browser check starts its own temporary Vite listener, database, and media store;
it does not use the preview's accounts. Screenshots are saved under ignored `logs/`.
It uses real WebGL rendering and public texture downloads, so network access is
needed for the existing gallery textures.

The private local storage path is exercised by the integration tests. A deployment
using S3 must additionally verify credentials, private bucket access, and persistence
against that actual service before relying on it.
