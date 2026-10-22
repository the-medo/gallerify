import type { TPoint, TWall, WallMap } from './types.ts';

export const WALL_THICKNESS = 0.25;

const samePoint = (a: TPoint, b: TPoint) => a.x === b.x && a.y === b.y;

// The generated layout contains axis-aligned wall segments. Give horizontal
// walls the junction square and stop vertical walls at its edge, so corners
// and T-junctions stay closed without overlapping any visible faces.
export function getWallDimensions(wall: TWall, walls: WallMap) {
  const { start, end } = wall.line;
  const horizontal = start.y === end.y;
  const halfThickness = WALL_THICKNESS / 2;

  const extensionAt = (point: TPoint) => {
    const neighbors = Object.values(walls).filter(
      (other) =>
        other.id !== wall.id &&
        (samePoint(other.line.start, point) || samePoint(other.line.end, point)),
    );
    const hasHorizontalNeighbor = neighbors.some(
      (other) => other.line.start.y === other.line.end.y,
    );

    if (horizontal) return hasHorizontalNeighbor ? 0 : halfThickness;
    if (hasHorizontalNeighbor) return -halfThickness;
    return neighbors.length > 0 ? 0 : halfThickness;
  };

  const startExtension = extensionAt(start);
  const endExtension = extensionAt(end);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const centerOffset = (endExtension - startExtension) / 2;

  return {
    length: length + startExtension + endExtension,
    center: {
      x: (start.x + end.x) / 2 + ((end.x - start.x) / length) * centerOffset,
      y: (start.y + end.y) / 2 + ((end.y - start.y) / length) * centerOffset,
    },
  };
}
