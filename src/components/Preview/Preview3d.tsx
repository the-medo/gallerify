import { useEffect, useRef } from 'react';
import { useStore } from '../../store/store.ts';
import { Canvas, useThree } from '@react-three/fiber';
import Base3d from '../Canvas/3D/Base3d.tsx';
import RoomLayout from '../Canvas/RoomLayout.tsx';
import { CameraControls } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';

function RoomCamera() {
  const controls = useRef<CameraControlsImpl>(null);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const size = useThree((state) => state.size);
  useEffect(() => {
    const verticalFov = (42 * Math.PI) / 180;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (size.width / size.height));
    const radius = Math.hypot(width / 2, height / 2, 1.25);
    const distance = radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2);
    const component = distance / Math.sqrt(3);
    void controls.current?.setLookAt(component, component + 1, component, 0, 1, 0, false);
  }, [width, height, size.width, size.height]);
  return <CameraControls ref={controls} makeDefault minDistance={2} maxDistance={150} />;
}

export default function Preview3d() {
  const roomLayout = useStore((state) => state.roomLayout);
  return (
    <Canvas shadows camera={{ fov: 42, position: [15, 16, 15], near: 0.1, far: 250 }} dpr={[1, 2]}>
      <ambientLight intensity={Math.PI * 0.4} />
      <pointLight castShadow position={[1, 4, 1]} decay={0} intensity={Math.PI * 0.3} />
      <Base3d />
      {roomLayout && <RoomLayout roomLayout={roomLayout} />}
      <RoomCamera />
    </Canvas>
  );
}
