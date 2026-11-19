import type { ArtworkPlacement } from '../lib/artwork.ts';
import type { TWall, WallMap } from './types.ts';
import { WALL_THICKNESS } from './wallGeometry.ts';

// Existing walls are centered at y=1 with a height of 2.5; their visible top is 2.25m.
export const HANGING_TOP = 2.25;
const MARGIN = 0.04;
const EPSILON = 0.00001;

export function wallBasis(wall: TWall) {
  const { start, end } = wall.line;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return { x: (end.x - start.x) / length, z: (end.y - start.y) / length, length };
}

export function hangingSurface(wall: TWall, walls: WallMap) {
  const tangent = wallBasis(wall);
  const { start } = wall.line;
  const project = (point: { x: number; y: number }) =>
    (point.x - start.x) * tangent.x + (point.y - start.y) * tangent.z;
  const collinear = (point: { x: number; y: number }) =>
    Math.abs((point.x - start.x) * tangent.z - (point.y - start.y) * tangent.x) < EPSILON;
  const intervals = Object.values(walls)
    .filter((item) => collinear(item.line.start) && collinear(item.line.end))
    .map((item) => [
      Math.min(project(item.line.start), project(item.line.end)),
      Math.max(project(item.line.start), project(item.line.end)),
    ])
    .sort((a, b) => a[0] - b[0]);
  let min = 0;
  let max = tangent.length;
  // Repeated expansion also handles reversed segments and either sort direction.
  for (let pass = 0; pass < intervals.length; pass++) {
    for (const [a, b] of intervals) {
      if (a <= max + EPSILON && b >= min - EPSILON) {
        min = Math.min(min, a);
        max = Math.max(max, b);
      }
    }
  }
  return { min: min + MARGIN, max: max - MARGIN, ...tangent };
}

export function placementIssue(placement: ArtworkPlacement, walls: WallMap): string | null {
  const wall = walls[placement.wallId];
  if (!wall) return 'Choose a wall for this artwork.';
  if (
    ![placement.u, placement.elevation, placement.width, placement.height].every(Number.isFinite) ||
    placement.width < 0.05 ||
    placement.height < 0.05
  )
    return 'Artwork dimensions must be at least 5 cm.';
  const surface = hangingSurface(wall, walls);
  if (
    placement.u - placement.width / 2 < surface.min - EPSILON ||
    placement.u + placement.width / 2 > surface.max + EPSILON
  )
    return 'This artwork extends beyond the wall. Reduce its size or move it inward.';
  if (
    placement.elevation - placement.height / 2 < MARGIN - EPSILON ||
    placement.elevation + placement.height / 2 > HANGING_TOP - MARGIN + EPSILON
  )
    return 'Keep the artwork between the floor and the top of the wall.';
  const normal = { x: -surface.z * placement.side, z: surface.x * placement.side };
  for (const other of Object.values(walls)) {
    if (other.id === wall.id) continue;
    const points = [other.line.start, other.line.end].map((point) => ({
      u: (point.x - wall.line.start.x) * surface.x + (point.y - wall.line.start.y) * surface.z,
      depth: (point.x - wall.line.start.x) * normal.x + (point.y - wall.line.start.y) * normal.z,
    }));
    if (
      Math.abs(points[0].u - points[1].u) < EPSILON &&
      Math.min(points[0].depth, points[1].depth) <= WALL_THICKNESS / 2 &&
      Math.max(points[0].depth, points[1].depth) > WALL_THICKNESS / 2 &&
      Math.abs(points[0].u - placement.u) < placement.width / 2 + WALL_THICKNESS / 2
    )
      return 'A joining wall blocks this position. Move the artwork away from the corner.';
  }
  return null;
}

export function placementTransform(
  placement: ArtworkPlacement,
  wall: TWall,
  width: number,
  height: number,
) {
  const tangent = wallBasis(wall);
  const nx = -tangent.z * placement.side;
  const nz = tangent.x * placement.side;
  const offset = WALL_THICKNESS / 2 + 0.012;
  return {
    position: [
      wall.line.start.x + tangent.x * placement.u + nx * offset - width / 2,
      placement.elevation,
      wall.line.start.y + tangent.z * placement.u + nz * offset - height / 2,
    ] as [number, number, number],
    rotation: [0, Math.atan2(nx, nz), 0] as [number, number, number],
  };
}

export function placementAtPoint(
  wall: TWall,
  point: { x: number; y: number; z: number },
  normal: { x: number; z: number },
  width: number,
  height: number,
) {
  const tangent = wallBasis(wall);
  return {
    wallId: wall.id,
    side: (normal.x * -tangent.z + normal.z * tangent.x >= 0 ? 1 : -1) as 1 | -1,
    u:
      (point.x + width / 2 - wall.line.start.x) * tangent.x +
      (point.z + height / 2 - wall.line.start.y) * tangent.z,
    elevation: point.y,
  };
}
