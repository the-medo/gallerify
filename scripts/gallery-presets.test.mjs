import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPresetLayout,
  DEFAULT_PRESET_ID,
  galleryPresets,
  PRESET_SIZES,
} from '../src/presets/galleryPresets.ts';
import { getWallDimensions } from '../src/utils/wallGeometry.ts';

const wallsFor = (preset) =>
  Object.values(createPresetLayout(preset).rooms).flatMap((room) => room.walls);
const edgeKey = (x1, y1, x2, y2) => [`${x1},${y1}`, `${x2},${y2}`].sort().join(':');

test('the collection has 20 distinct plans, five of each size, and a valid default', () => {
  assert.equal(galleryPresets.length, 20);
  assert.equal(new Set(galleryPresets.map((preset) => preset.id)).size, 20);
  assert.equal(new Set(galleryPresets.map((preset) => preset.name)).size, 20);
  assert.ok(galleryPresets.some((preset) => preset.id === DEFAULT_PRESET_ID));
  for (const size of PRESET_SIZES) {
    assert.equal(galleryPresets.filter((preset) => preset.size === size).length, 5);
  }
  // Compare normalized geometry too: scaling the same plan does not make a new preset.
  assert.equal(
    new Set(
      galleryPresets.map((preset) =>
        JSON.stringify(
          wallsFor(preset).map(({ line }) => [
            line.start.x / preset.width,
            line.start.y / preset.height,
            line.end.x / preset.width,
            line.end.y / preset.height,
          ]),
        ),
      ),
    ).size,
    20,
  );
});

for (const preset of galleryPresets) {
  test(`${preset.name}: bounded geometry, usable entrance, and every space reachable`, () => {
    const walls = wallsFor(preset);
    const wallMap = Object.fromEntries(walls.map((wall) => [wall.id, wall]));
    assert.equal(Object.keys(wallMap).length, walls.length, 'No duplicate wall segments');
    assert.equal(preset.width % preset.stepSize, 0);
    assert.equal(preset.height % preset.stepSize, 0);
    assert.ok(preset.width <= 30 && preset.height <= 30);
    assert.ok(preset.width >= preset.stepSize * 2 && preset.height >= preset.stepSize * 2);

    const edges = new Set();
    for (const wall of walls) {
      const { start, end } = wall.line;
      assert.notEqual(start.x === end.x, start.y === end.y, 'Nonzero axis-aligned wall');
      assert.equal(Math.hypot(end.x - start.x, end.y - start.y), preset.stepSize);
      for (const point of [start, end]) {
        assert.ok(point.x >= 0 && point.x <= preset.width);
        assert.ok(point.y >= 0 && point.y <= preset.height);
      }
      assert.ok(getWallDimensions(wall, wallMap).length > 0, 'Valid rendered wall length');
      edges.add(
        edgeKey(
          start.x / preset.stepSize,
          start.y / preset.stepSize,
          end.x / preset.stepSize,
          end.y / preset.stepSize,
        ),
      );
    }

    const columns = preset.width / preset.stepSize;
    const rows = preset.height / preset.stepSize;
    const openings = [];
    for (let x = 0; x < columns; x++) {
      assert.ok(edges.has(edgeKey(x, 0, x + 1, 0)), 'Closed rear wall');
      if (!edges.has(edgeKey(x, rows, x + 1, rows))) openings.push(x);
    }
    for (let y = 0; y < rows; y++) {
      assert.ok(edges.has(edgeKey(0, y, 0, y + 1)), 'Closed left wall');
      assert.ok(edges.has(edgeKey(columns, y, columns, y + 1)), 'Closed right wall');
    }
    assert.ok(openings.length > 0, 'An entrance exists');
    assert.equal(openings.at(-1) - openings[0] + 1, openings.length, 'One continuous entrance');
    assert.equal(openings[0] + openings.at(-1) + 1, columns, 'Centered entrance');

    const queue = [[openings[0], rows - 1]];
    const visited = new Set();
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      if (visited.has(`${x},${y}`)) continue;
      visited.add(`${x},${y}`);
      const neighbors = [
        [x - 1, y, edgeKey(x, y, x, y + 1)],
        [x + 1, y, edgeKey(x + 1, y, x + 1, y + 1)],
        [x, y - 1, edgeKey(x, y, x + 1, y)],
        [x, y + 1, edgeKey(x, y + 1, x + 1, y + 1)],
      ];
      for (const [nx, ny, edge] of neighbors) {
        if (nx >= 0 && ny >= 0 && nx < columns && ny < rows && !edges.has(edge))
          queue.push([nx, ny]);
      }
    }
    assert.equal(visited.size, columns * rows, 'Every floor cell is reachable from the entrance');
  });
}

test('loading a preset restores its original geometry and finishes', () => {
  const preset = galleryPresets[0];
  const original = createPresetLayout(preset);
  const edited = createPresetLayout(preset);
  assert.deepEqual(edited, original);
  const room = Object.values(edited.rooms)[0];
  room.walls[0].textureId = '8';
  room.walls[0].line.start.x = 999;
  room.walls.pop();
  assert.deepEqual(createPresetLayout(preset), original);
});
