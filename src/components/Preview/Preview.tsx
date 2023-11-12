import React from 'react';
import { Box } from '@radix-ui/themes';
import { useStore } from '../../store/store.ts';
import { Stage } from '@pixi/react';
import Base from '../Canvas/Base.tsx';
import RoomLayout from '../Canvas/RoomLayout.tsx';

interface PreviewProps {}

const Preview: React.FC<PreviewProps> = () => {
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const squareSize = useStore((state) => state.squareSize);
  const roomLayout = useStore((state) => state.roomLayout);

  return (
    <Box p="3">
      <Box
        style={{
          width: width * squareSize + 10 + 'px',
          height: height * squareSize + 10 + 'px',
          border: '5px solid var(--accent-11)',
        }}
      >
        <Stage
          width={width * squareSize}
          height={height * squareSize}
          options={{ backgroundColor: 0xffffff }}
        >
          <Base />
          {roomLayout && <RoomLayout roomLayout={roomLayout} />}
        </Stage>
      </Box>
    </Box>
  );
};

export default Preview;
