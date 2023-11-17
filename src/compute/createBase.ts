import { TGridLayout, TLineMap, TPoint, pointKey, TPointMap } from '../utils/types.ts';

export interface CreateBaseProps {
  stepSize: number;
  width: number;
  height: number;
}

export function createBase({ stepSize, width, height }: CreateBaseProps): TGridLayout {
  const pointMap: TPointMap = {};
  const lineMap: TLineMap = {};

  for (let x = 0; x <= width; x += stepSize) {
    for (let y = 0; y <= height; y += stepSize) {
      const point: TPoint = { x, y };
      const key = pointKey(point);

      pointMap[key] = point;
      if (x > 0) {
        const leftPoint = pointMap[pointKey({ x: x - stepSize, y })];
        const leftLineKey = `${pointKey(leftPoint)}-${key}`;
        lineMap[leftLineKey] = { start: leftPoint, end: point };
      }

      if (y > 0) {
        const topPoint = pointMap[pointKey({ x, y: y - stepSize })];
        const topLineKey = `${pointKey(topPoint)}-${key}`;
        lineMap[topLineKey] = { start: topPoint, end: point };
      }
    }
  }

  return {
    points: pointMap,
    lines: lineMap,
  };
}
