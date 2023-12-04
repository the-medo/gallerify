import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TLine } from '../../../utils/types.ts';
import { useStore } from '../../../store/store.ts';
import * as THREE from 'three';
import { calculateAngle } from '../../../utils/functions.ts';
import { ThreeEvent, useFrame, useLoader } from '@react-three/fiber';
import { getTexture, wallTextureMap } from '../../../utils/textures.ts';

interface Wall3dProps {
  wallId: string;
  wallTexture: string;
  wallLine: TLine;
}

interface WallData {
  rotation: THREE.Euler;
  position: THREE.Vector3;
  length: number;
}

const Wall3d: React.FC<Wall3dProps> = ({ wallId, wallTexture, wallLine }) => {
  const [hovered, setHovered] = useState(false);

  const meshRef = useRef<THREE.Mesh>(null!);
  const wireframeMeshRef = useRef<THREE.Mesh>(null!);
  const stepSize = useStore((state) => state.stepSize);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const isSelected = useStore((state) => state.selectedWallIds[wallId]);
  const toggleSelectedWall = useStore((state) => state.toggleSelectedWall);
  const setSelectedWall = useStore((state) => state.setSelectedWall);

  const texture = useLoader(THREE.TextureLoader, wallTexture);

  const onPointerOverHandler = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.intersections.length > 0 && event.intersections[0].object === meshRef.current) {
      setHovered(true);
    }
  }, []);

  const onClickHandler = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (event.intersections.length > 0 && event.intersections[0].object === meshRef.current) {
        console.log('Clicking!');
        if (event.ctrlKey) {
          toggleSelectedWall(wallId);
          console.log('Toggling!');
        } else {
          console.log('Selecting!');
          setSelectedWall(wallId);
        }
      }
    },
    [setSelectedWall, toggleSelectedWall, wallId],
  );

  const wallData: WallData = useMemo(() => {
    const { start, end } = wallLine;

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
  }, [height, stepSize, wallLine, width]);

  useEffect(() => {
    const geometry = new THREE.BoxGeometry(0.25, 2.5, wallData.length + 0.25);

    if (meshRef.current) {
      meshRef.current.geometry = geometry;
    }
    if (wireframeMeshRef.current) {
      wireframeMeshRef.current.geometry = geometry;
    }
  }, [wallData]);

  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.map = texture;
      material.needsUpdate = true;
    }
  }, [texture, wallTexture]);

  useFrame(() => {
    if (meshRef.current && wireframeMeshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 1 - (isSelected ? 0.25 : 0) - (hovered ? 0.25 : 0);
    }
  });

  return (
    <>
      <mesh
        ref={wireframeMeshRef}
        receiveShadow
        rotation={wallData.rotation}
        position={wallData.position}
      >
        <meshBasicMaterial color="black" />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        ref={meshRef}
        rotation={wallData.rotation}
        position={wallData.position}
        onPointerOver={onPointerOverHandler}
        onPointerOut={() => setHovered(false)}
        onClick={onClickHandler}
      >
        <meshStandardMaterial roughness={1} metalness={0} map={texture} transparent />
      </mesh>
    </>
  );
};

export default Wall3d;
