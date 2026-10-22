import { useStore } from '../../store/store.ts';
import { Container, Stage } from '@pixi/react';
import Base from '../Canvas/2D/Base.tsx';
import RoomLayout from '../Canvas/RoomLayout.tsx';

interface Preview2dProps {
  viewportWidth: number;
  viewportHeight: number;
}

export default function Preview2d({ viewportWidth, viewportHeight }: Preview2dProps) {
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const squareSize = useStore((state) => state.squareSize);
  const roomLayout = useStore((state) => state.roomLayout);
  const scale = Math.max(
    0.01,
    Math.min(
      (viewportWidth - 64) / (width * squareSize),
      (viewportHeight - 64) / (height * squareSize),
    ),
  );
  return (
    <Stage
      width={viewportWidth}
      height={viewportHeight}
      options={{
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      }}
    >
      <Container
        x={(viewportWidth - width * squareSize * scale) / 2}
        y={(viewportHeight - height * squareSize * scale) / 2}
        scale={scale}
      >
        <Base />
        {roomLayout && <RoomLayout roomLayout={roomLayout} />}
      </Container>
    </Stage>
  );
}
