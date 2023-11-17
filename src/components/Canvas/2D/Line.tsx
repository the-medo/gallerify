import React, { useCallback } from 'react';
import { Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from '@pixi/graphics';
import { TLine } from '../../../utils/types.ts';
import { useStore } from '../../../store/store.ts';

interface LineProps {
  line: TLine;
}

const Line: React.FC<LineProps> = ({ line }) => {
  const squareSize = useStore((state) => state.squareSize);

  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0xff3300);
      g.lineStyle(Math.max(2, squareSize / 5), 0xeeeeee, 1);
      g.moveTo(line.start.x * squareSize, line.start.y * squareSize);
      g.lineTo(line.end.x * squareSize, line.end.y * squareSize);
      g.endFill();
    },
    [line, squareSize],
  );

  return <Graphics draw={draw} />;
};

export default Line;
