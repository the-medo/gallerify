import React from 'react';
import { useStore } from '../../store/store.ts';
import { Canvas } from '@react-three/fiber';
import Base3d from '../Canvas/3D/Base3d.tsx';
import RoomLayout from '../Canvas/RoomLayout.tsx';
import { Stats, OrbitControls } from '@react-three/drei';

interface Preview3dProps {}

const Preview3d: React.FC<Preview3dProps> = () => {
  const roomLayout = useStore((state) => state.roomLayout);

  return (
    <Canvas>
      <ambientLight intensity={Math.PI / 2} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

      <Base3d />
      {roomLayout && <RoomLayout roomLayout={roomLayout} />}
      <OrbitControls />
      <Stats />
    </Canvas>
  );
};

export default Preview3d;
