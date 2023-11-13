import React, { useEffect, useRef } from 'react';
import { useStore } from '../../../store/store.ts';
import * as THREE from 'three';
import { useLoader, useThree } from '@react-three/fiber';

interface Base3dProps {}

const Base3d: React.FC<Base3dProps> = () => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const texture = useLoader(THREE.TextureLoader, '/src/assets/textures/wall/wall7.png');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const geometry = mesh.geometry as THREE.BufferGeometry;
    const uvAttribute = geometry.attributes.uv;

    for (let i = 0; i < uvAttribute.count; i++) {
      // Calculate the new UVs based on the number of tiles
      const u = (i % 2) * height;
      const v = (Math.floor(i / 2) * width) / 2;
      uvAttribute.setXY(i, u, v);
    }

    uvAttribute.needsUpdate = true;
  }, [width, height, meshRef]);

  useThree(({ camera }) => {
    camera.position.set(0, 4, 0);
    // camera.rotation.set(THREE.MathUtils.degToRad(-45), 0, 0);
    camera.rotation.set(0, 0, 0);
  });

  return (
    <mesh receiveShadow ref={meshRef} rotation={[Math.PI * 1.5, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial roughness={0.5} metalness={0} map={texture} />
    </mesh>
  );
};

export default Base3d;
