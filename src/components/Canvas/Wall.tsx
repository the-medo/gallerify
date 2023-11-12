import React, { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from '@pixi/graphics';
import { DEFAULT_POINT_SIZE, TWall } from '../../compute/types.ts';

interface WallProps {
  wall: TWall;
}

const Wall: React.FC<WallProps> = ({ wall }) => {
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0xff3300);
      g.lineStyle(4, 0x334455, 1);
      g.moveTo(wall.line.start.x * DEFAULT_POINT_SIZE, wall.line.start.y * DEFAULT_POINT_SIZE);
      g.lineTo(wall.line.end.x * DEFAULT_POINT_SIZE, wall.line.end.y * DEFAULT_POINT_SIZE);
      g.endFill();
    },
    [wall],
  );

  return <Graphics draw={draw} />;
};

export default Wall;
