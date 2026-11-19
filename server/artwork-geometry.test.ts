import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hangingSurface,
  placementAtPoint,
  placementIssue,
  placementTransform,
} from '../src/utils/artworkGeometry.ts';
import type { TWall } from '../src/utils/types.ts';
import type { ArtworkPlacement } from '../src/lib/artwork.ts';
import { defaultGallerySetup, migrateGallerySetup } from '../src/lib/gallery.ts';

const wall = (id: string, x: number, y: number, ex: number, ey: number): TWall => ({
  id,
  line: { start: { x, y }, end: { x: ex, y: ey } },
  doors: false,
  textureId: '1',
});
const a = wall('a', 0, 0, 2, 0);
const b = wall('b', 4, 0, 2, 0);
const c = wall('c', 6, 0, 8, 0);
const placement: ArtworkPlacement = {
  id: 'p',
  artworkId: 'art',
  wallId: 'a',
  side: 1,
  u: 2,
  elevation: 1.2,
  width: 3,
  height: 1,
};

test('document migration preserves placements and refuses future versions', () => {
  const setup = { ...defaultGallerySetup(), placements: [placement] };
  assert.deepEqual(migrateGallerySetup(setup), setup);
  assert.throws(() => migrateGallerySetup({ ...setup, schemaVersion: 99 }), /unsupported/);
});

test('contiguous walls support artwork across seams, but gaps and wall bounds do not', () => {
  const surface = hangingSurface(a, { a, b, c });
  assert.equal(surface.min, 0.04);
  assert.equal(surface.max, 3.96);
  assert.equal(placementIssue(placement, { a, b, c }), null);
  assert.match(placementIssue({ ...placement, width: 5 }, { a, b, c })!, /beyond/);
  assert.match(placementIssue({ ...placement, elevation: 2 }, { a, b })!, /top/);
  assert.match(placementIssue({ ...placement, u: NaN }, { a, b })!, /dimensions/);
});

test('joining walls block only the face that projects into their geometry', () => {
  const join = wall('join', 2, 0, 2, 2);
  assert.match(placementIssue(placement, { a, b, join })!, /joining wall/);
  assert.equal(placementIssue({ ...placement, side: -1 }, { a, b, join }), null);
});

test('both faces of horizontal, vertical and reversed walls preserve image orientation and point round trips', () => {
  for (const support of [a, b, wall('vertical', 2, 0, 2, 4), wall('reversed', 2, 4, 2, 0)]) {
    for (const side of [1, -1] as const) {
      const placed = { ...placement, wallId: support.id, side, u: 1, width: 0.6 };
      const transform = placementTransform(placed, support, 10, 8);
      const yaw = transform.rotation[1];
      const normal = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const hit = placementAtPoint(
        support,
        { x: transform.position[0], y: transform.position[1], z: transform.position[2] },
        normal,
        10,
        8,
      );
      assert.equal(hit.side, side);
      assert.ok(Math.abs(hit.u - placed.u) < 1e-8);
      assert.equal(hit.elevation, placed.elevation);
      const length = Math.hypot(
        support.line.end.x - support.line.start.x,
        support.line.end.y - support.line.start.y,
      );
      assert.ok(
        Math.abs(Math.cos(yaw) - ((support.line.end.x - support.line.start.x) / length) * side) <
          1e-8,
      );
      assert.ok(
        Math.abs(-Math.sin(yaw) - ((support.line.end.y - support.line.start.y) / length) * side) <
          1e-8,
      );
    }
  }
});
