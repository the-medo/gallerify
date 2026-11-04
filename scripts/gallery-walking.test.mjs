import assert from 'node:assert/strict';
import test from 'node:test';
import { createPresetLayout, galleryPresets } from '../src/presets/galleryPresets.ts';
import {
  canWalkAt,
  createWalkSpace,
  getWalkEntrance,
  moveWalker,
  WALKER_RADIUS,
} from '../src/utils/walking.ts';

const wall = (id, x1, y1, x2, y2) => ({
  id,
  line: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
  doors: false,
  textureId: '1',
});

for (const preset of galleryPresets) {
  test(`${preset.name}: enter facing into a walkable gallery`, () => {
    const walls = Object.fromEntries(
      Object.values(createPresetLayout(preset).rooms).flatMap((room) =>
        room.walls.map((wall) => [wall.id, wall]),
      ),
    );
    const space = createWalkSpace(walls, preset.width, preset.height);
    const entrance = getWalkEntrance(space, preset.stepSize);
    assert.ok(canWalkAt(entrance, space));
    assert.equal(entrance.z, preset.height / 2 - 0.75);
    const walked = moveWalker(entrance, { x: 0, z: -0.5 }, space);
    assert.ok(walked.z < entrance.z - 0.49, 'Can step into the gallery');
  });
}

test('a closed generated front row chooses a clear spawn beside its central partition', () => {
  const walls = {
    front: wall('front', 0, 6, 6, 6),
    partition: wall('partition', 3, 3, 3, 6),
  };
  const space = createWalkSpace(walls, 6, 6);
  const entrance = getWalkEntrance(space, 3);
  assert.ok(canWalkAt(entrance, space));
  assert.equal(Math.abs(entrance.x), 1.5);
});

test('movement stops at both wall faces, even with a long frame', () => {
  const space = createWalkSpace({ middle: wall('middle', 5, 0, 5, 10) }, 10, 10);
  for (const sign of [-1, 1]) {
    const walked = moveWalker({ x: sign * 2, z: 0 }, { x: -sign * 8, z: 0 }, space);
    assert.ok(canWalkAt(walked, space));
    assert.equal(Math.sign(walked.x), sign);
    assert.ok(Math.abs(walked.x) >= 0.125 + WALKER_RADIUS);
    assert.ok(Math.abs(walked.x) < 0.5);
  }
});

test('diagonal movement slides along a wall without clipping its corner', () => {
  const space = createWalkSpace({ middle: wall('middle', 5, 0, 5, 10) }, 10, 10);
  const walked = moveWalker({ x: -1, z: 0 }, { x: 2, z: -2 }, space);
  assert.ok(canWalkAt(walked, space));
  assert.ok(walked.x < -0.34);
  assert.ok(Math.abs(walked.z + 2) < 0.00001);
});

test('doorways are passable and wall end caps block the walker', () => {
  const space = createWalkSpace(
    { left: wall('left', 0, 5, 4, 5), right: wall('right', 6, 5, 10, 5) },
    10,
    10,
  );
  const walked = moveWalker({ x: 0, z: 2 }, { x: 0, z: -4 }, space);
  assert.ok(Math.abs(walked.z + 2) < 0.00001);
  assert.ok(!canWalkAt({ x: -0.8, z: 0 }, space), 'Rendered end cap has clearance');
  assert.ok(canWalkAt({ x: -0.6, z: 0 }, space));
});

test('the walker cannot leave the floor through an open entrance', () => {
  const space = createWalkSpace({}, 6, 8);
  for (const movement of [
    { x: 20, z: 0 },
    { x: -20, z: 0 },
    { x: 0, z: 20 },
    { x: 0, z: -20 },
  ]) {
    const walked = moveWalker({ x: 0, z: 0 }, movement, space);
    assert.ok(canWalkAt(walked, space));
    assert.ok(Math.abs(walked.x) <= 3 - WALKER_RADIUS);
    assert.ok(Math.abs(walked.z) <= 4 - WALKER_RADIUS);
  }
});
