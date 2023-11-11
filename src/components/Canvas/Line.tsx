import React, { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from '@pixi/graphics';
import { DEFAULT_POINT_SIZE, TLine } from '../../compute/types.ts';

interface LineProps {
  line: TLine;
}

const Line: React.FC<LineProps> = ({ line }) => {
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0xff3300);
      g.lineStyle(2, 0xeeeeee, 1);
      g.moveTo(line.start.x * DEFAULT_POINT_SIZE, line.start.y * DEFAULT_POINT_SIZE);
      g.lineTo(line.end.x * DEFAULT_POINT_SIZE, line.end.y * DEFAULT_POINT_SIZE);
      g.endFill();
    },
    [line],
  );

  return <Graphics draw={draw} />;
};

export default Line;
