import React, { useEffect, useMemo, useRef } from 'react';
import { TWall } from '../../../compute/types.ts';
import { useStore } from '../../../store/store.ts';
import * as THREE from 'three';
import { calculateAngle } from '../../../compute/functions.ts';
import { useLoader } from '@react-three/fiber';

interface Wall3dProps {
  wall: TWall;
}

interface WallData {
  rotation: THREE.Euler;
  position: THREE.Vector3;
  length: number;
}

const Wall3d: React.FC<Wall3dProps> = ({ wall }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const stepSize = useStore((state) => state.stepSize);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  const texture = useLoader(THREE.TextureLoader, '/src/assets/textures/wall/wall8.png');

  const wallData: WallData = useMemo(() => {
    const { start, end } = wall.line;

    const angle = calculateAngle(start, end);
    const xWidthOffset = -width / 2;
    const yHeightOffset = -height / 2;

    const xRotationOffset = angle === 0 ? 0 : stepSize / 2;
    const yRotationOffset = angle === 0 ? stepSize / 2 : 0;

    const xOffset = xWidthOffset + xRotationOffset;
    const yOffset = yHeightOffset + yRotationOffset;

    const rotation: THREE.Euler = new THREE.Euler(0, angle, 0);
    const position: THREE.Vector3 = new THREE.Vector3(start.x + xOffset, 1, start.y + yOffset);
    const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

    console.log('Length: ', length, start, end, calculateAngle(start, end));

    return {
      rotation,
      position,
      length,
    };
  }, [height, stepSize, wall.line, width]);

  useEffect(() => {
    const geometry = new THREE.BoxGeometry(0.25, 2.5, wallData.length);

    if (meshRef.current) {
      meshRef.current.geometry = geometry;
    }
  }, [wallData]);

  return (
    <mesh
      castShadow
      receiveShadow
      ref={meshRef}
      // offset-x={wall.line.start.x}
      rotation={wallData.rotation}
      position={wallData.position}
    >
      <meshStandardMaterial color={'white'} roughness={1} metalness={0} map={texture} />
    </mesh>
  );
};

export default Wall3d;
