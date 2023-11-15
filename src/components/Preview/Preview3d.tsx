import React from 'react';
import { useStore } from '../../store/store.ts';
import { Canvas } from '@react-three/fiber';
import Base3d from '../Canvas/3D/Base3d.tsx';
import RoomLayout from '../Canvas/RoomLayout.tsx';
import { Stats, CameraControls } from '@react-three/drei';

interface Preview3dProps {}

const Preview3d: React.FC<Preview3dProps> = () => {
  const roomLayout = useStore((state) => state.roomLayout);

  return (
    <Canvas shadows>
      <ambientLight intensity={Math.PI * 0.4} position={[0, 3, 0]} />
      {/*<spotLight
        castShadow
        position={[0, 10, 0]}
        angle={0.7}
        penumbra={1}
        decay={0}
        intensity={Math.PI}
      />*/}
      <pointLight castShadow position={[1, 4, 1]} decay={0} intensity={Math.PI * 0.3} />

      <Base3d />
      {roomLayout && <RoomLayout roomLayout={roomLayout} />}
      {/*<OrbitControls />*/}
      <CameraControls />
      {/*<PointerLockControls />*/}
      <Stats />
    </Canvas>
  );
};

export default Preview3d;
