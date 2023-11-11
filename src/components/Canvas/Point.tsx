import React, { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from '@pixi/graphics';
import { DEFAULT_POINT_SIZE, TPoint } from '../../compute/types.ts';

interface PointProps {
  point: TPoint;
  pointSize?: number;
}

const Point: React.FC<PointProps> = ({ point, pointSize = 4 }) => {
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.lineStyle(1, 0xdddddd, 1);
      g.drawPolygon(
        { x: point.x * DEFAULT_POINT_SIZE - pointSize, y: point.y * DEFAULT_POINT_SIZE },
        { x: point.x * DEFAULT_POINT_SIZE, y: point.y * DEFAULT_POINT_SIZE - pointSize },
        { x: point.x * DEFAULT_POINT_SIZE + pointSize, y: point.y * DEFAULT_POINT_SIZE },
        { x: point.x * DEFAULT_POINT_SIZE, y: point.y * DEFAULT_POINT_SIZE + pointSize },
      );
    },
    [point.x, point.y, pointSize],
  );

  return <Graphics draw={draw} />;
};

export default Point;
