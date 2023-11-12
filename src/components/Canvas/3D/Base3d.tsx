import React, { useRef } from 'react';
import { useStore } from '../../../store/store.ts';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface Base3dProps {}

const Base3d: React.FC<Base3dProps> = () => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  useThree(({ camera }) => {
    camera.position.set(0, 20, 10);
    camera.rotation.set(THREE.MathUtils.degToRad(-45), 0, 0);
  });

  return (
    <mesh ref={meshRef} rotation={[0, 0, 0]}>
      <boxGeometry args={[width, 0.75, height]} />
      <meshStandardMaterial color={'white'} />
    </mesh>
  );
};

export default Base3d;
