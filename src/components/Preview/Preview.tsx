import React, { useMemo } from 'react';
import { Box } from '@radix-ui/themes';
import { useStore } from '../../store/store.ts';
import { BoxPosition } from '../GenerateBox/GenerateBox.tsx';
import { Sprite, Stage } from '@pixi/react';
import { createBase } from '../../compute/createBase.ts';
import { DEFAULT_POINT_SIZE } from '../../compute/types.ts';
import Line from '../Canvas/Line.tsx';
import Point from '../Canvas/Point.tsx';

interface PreviewProps {}

const Preview: React.FC<PreviewProps> = () => {
  const generated = useStore((state) => state.generated);
  const stepSize = useStore((state) => state.stepSize);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  const grid = useMemo(() => createBase({ width, height, stepSize }), [width, height, stepSize]);

  const boxPosition: BoxPosition = useMemo(() => {
    if (generated) {
      return {
        left: '50%',
        top: '50%',
        css: {
          translate: '-50% -50%',
          scale: '1.5',
        },
      };
    } else {
      return {
        left: '50%',
        top: '50%',
        css: {
          translate: '-50% 100px',
          scale: '1',
        },
      };
    }
  }, [generated]);

  return (
    <Box
      p="1"
      position={'fixed'}
      left={boxPosition.left}
      top={boxPosition.top}
      style={{
        width: width * DEFAULT_POINT_SIZE + DEFAULT_POINT_SIZE * 2 + 'px',
        height: height * DEFAULT_POINT_SIZE + DEFAULT_POINT_SIZE * 2 + 'px',
        border: '2px solid var(--accent-5)',
        transition: '0.2s ease-in',
        ...boxPosition.css,
      }}
    >
      <Box
        style={{
          width: '100%',
          height: '100%',
          border: '2px solid var(--accent-6)',
          // ...boxPosition.css,
        }}
      >
        <Stage
          width={width * DEFAULT_POINT_SIZE}
          height={height * DEFAULT_POINT_SIZE}
          options={{ backgroundColor: 'white' }}
        >
          <Sprite
            image="https://pixijs.io/pixi-react/img/bunny.png"
            x={0}
            y={0}
            anchor={{ x: 0.5, y: 0.5 }}
          />
          {Object.keys(grid.lines).map((lineKey) => (
            <Line line={grid.lines[lineKey]} />
          ))}
          {Object.keys(grid.points).map((pointKey) => (
            <Point point={grid.points[pointKey]} />
          ))}
        </Stage>
      </Box>
    </Box>
  );
};

export default Preview;
