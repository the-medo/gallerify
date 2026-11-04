import type { WallMap } from './types.ts';
import { getWallDimensions, WALL_THICKNESS } from './wallGeometry.ts';

export const EYE_HEIGHT = 1.6;
export const WALK_SPEED = 2.4;
export const WALKER_RADIUS = 0.22;

export type WalkPosition = { x: number; z: number };
export type WalkBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type WalkSpace = { width: number; height: number; obstacles: WalkBounds[] };

// Use the rendered wall extents, including junctions and end caps.
export function createWalkSpace(walls: WallMap, width: number, height: number): WalkSpace {
  const obstacles = Object.values(walls).map((wall) => {
    const { length, center } = getWallDimensions(wall, walls);
    const horizontal = wall.line.start.y === wall.line.end.y;
    const halfX = (horizontal ? length : WALL_THICKNESS) / 2;
    const halfZ = (horizontal ? WALL_THICKNESS : length) / 2;
    return {
      minX: center.x - width / 2 - halfX,
      maxX: center.x - width / 2 + halfX,
      minZ: center.y - height / 2 - halfZ,
      maxZ: center.y - height / 2 + halfZ,
    };
  });
  return { width, height, obstacles };
}

export function canWalkAt({ x, z }: WalkPosition, space: WalkSpace) {
  if (
    Math.abs(x) > space.width / 2 - WALKER_RADIUS ||
    Math.abs(z) > space.height / 2 - WALKER_RADIUS
  ) {
    return false;
  }
  return space.obstacles.every((wall) => {
    const nearestX = Math.max(wall.minX, Math.min(x, wall.maxX));
    const nearestZ = Math.max(wall.minZ, Math.min(z, wall.maxZ));
    return Math.hypot(x - nearestX, z - nearestZ) >= WALKER_RADIUS;
  });
}

export function getWalkEntrance(space: WalkSpace, stepSize: number): WalkPosition {
  const z = space.height / 2 - Math.min(0.75, stepSize / 2);
  const candidates = [{ x: 0, z }];
  // Generated plans may have a partition at the center of the front row.
  // Choose the closest clear cell in that row, facing into the gallery.
  for (let x = stepSize / 2; x < space.width; x += stepSize) {
    candidates.push({ x: x - space.width / 2, z });
  }
  candidates.sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
  return candidates.find((position) => canWalkAt(position, space))!;
}

export function moveWalker(
  position: WalkPosition,
  movement: WalkPosition,
  space: WalkSpace,
): WalkPosition {
  // Small steps prevent crossing thin walls even after a slow frame. Resolve
  // axes independently so walking diagonally into a wall slides along it.
  const steps = Math.max(1, Math.ceil(Math.hypot(movement.x, movement.z) / (WALKER_RADIUS / 2)));
  let { x, z } = position;
  for (let step = 0; step < steps; step++) {
    const nextX = x + movement.x / steps;
    if (canWalkAt({ x: nextX, z }, space)) x = nextX;
    const nextZ = z + movement.z / steps;
    if (canWalkAt({ x, z: nextZ }, space)) z = nextZ;
  }
  return { x, z };
}
