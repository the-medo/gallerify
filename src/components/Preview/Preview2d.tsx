import React from 'react';
import { useStore } from '../../store/store.ts';
import { Stage } from '@pixi/react';
import Base from '../Canvas/2D/Base.tsx';
import RoomLayout from '../Canvas/RoomLayout.tsx';

interface Preview2dProps {}

const Preview2d: React.FC<Preview2dProps> = () => {
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const squareSize = useStore((state) => state.squareSize);
  const roomLayout = useStore((state) => state.roomLayout);

  return (
    <Stage
      width={width * squareSize}
      height={height * squareSize}
      options={{ backgroundColor: 0xffffff }}
    >
      <Base />
      {roomLayout && <RoomLayout roomLayout={roomLayout} />}
    </Stage>
  );
};

export default Preview2d;
