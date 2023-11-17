import React, { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from '@pixi/graphics';
import { TWall } from '../../../utils/types.ts';
import { useStore } from '../../../store/store.ts';

interface Wall2dProps {
  wall: TWall;
}

const Wall2d: React.FC<Wall2dProps> = ({ wall }) => {
  const squareSize = useStore((state) => state.squareSize);

  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0xff3300);
      g.lineStyle(Math.max(2, squareSize / 2.5), 0x334455, 1);
      g.moveTo(wall.line.start.x * squareSize, wall.line.start.y * squareSize);
      g.lineTo(wall.line.end.x * squareSize, wall.line.end.y * squareSize);
      g.endFill();
    },
    [wall, squareSize],
  );

  return <Graphics draw={draw} />;
};

export default Wall2d;
