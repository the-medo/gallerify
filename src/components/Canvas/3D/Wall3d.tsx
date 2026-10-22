import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from '../../../store/store.ts';
import * as THREE from 'three';
import { calculateAngle } from '../../../utils/functions.ts';
import { ThreeEvent, useLoader } from '@react-three/fiber';
import { getTexture, wallTextureMap } from '../../../utils/textures.ts';
import { getWallDimensions, WALL_THICKNESS } from '../../../utils/wallGeometry.ts';

interface Wall3dProps {
  wallId: string;
}

const Wall3d: React.FC<Wall3dProps> = ({ wallId }) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null!);

  const wallTextureId = useStore((state) => state.walls[wallId].textureId);
  const walls = useStore((state) => state.walls);
  const wall = walls[wallId];
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const isSelected = useStore((state) => state.selectedWallIds[wallId]);
  const toggleSelectedWall = useStore((state) => state.toggleSelectedWall);
  const setSelectedWall = useStore((state) => state.setSelectedWall);

  const wallTexture = getTexture(wallTextureMap, wallTextureId);
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
        if (event.ctrlKey) {
          toggleSelectedWall(wallId);
        } else {
          setSelectedWall(wallId);
        }
      }
    },
    [setSelectedWall, toggleSelectedWall, wallId],
  );

  const wallData = useMemo(() => {
    const { start, end } = wall.line;
    const { length, center } = getWallDimensions(wall, walls);

    return {
      rotation: new THREE.Euler(0, calculateAngle(start, end), 0),
      position: new THREE.Vector3(center.x - width / 2, 1, center.y - height / 2),
      length,
    };
  }, [height, wall, walls, width]);

  // Shade the texture directly instead of blending a transparent wall over
  // an identical black mesh, which makes their coplanar faces fight for depth.
  const highlightColor = useMemo(
    () => new THREE.Color().setScalar(1 - (isSelected ? 0.25 : 0) - (hovered ? 0.25 : 0)),
    [hovered, isSelected],
  );

  return (
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
      <boxGeometry args={[WALL_THICKNESS, 2.5, wallData.length]} />
      <meshStandardMaterial roughness={1} metalness={0} map={texture} color={highlightColor} />
    </mesh>
  );
};

export default Wall3d;
