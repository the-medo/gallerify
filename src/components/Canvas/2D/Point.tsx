import React, { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from '@pixi/graphics';
import { TPoint } from '../../../utils/types.ts';
import { useStore } from '../../../store/store.ts';

interface PointProps {
  point: TPoint;
  pointSize?: number;
}

const Point: React.FC<PointProps> = ({ point, pointSize = 4 }) => {
  const squareSize = useStore((state) => state.squareSize);
  pointSize = squareSize / 4;

  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.lineStyle(3, 0xdddddd, 1);
      g.drawPolygon(
        { x: point.x * squareSize - pointSize, y: point.y * squareSize },
        { x: point.x * squareSize, y: point.y * squareSize - pointSize },
        { x: point.x * squareSize + pointSize, y: point.y * squareSize },
        { x: point.x * squareSize, y: point.y * squareSize + pointSize },
      );
    },
    [point.x, point.y, pointSize, squareSize],
  );

  return <Graphics draw={draw} />;
};

export default Point;
