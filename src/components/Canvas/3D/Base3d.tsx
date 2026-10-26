import { useLayoutEffect, useRef } from 'react';
import { useStore } from '../../../store/store.ts';
import * as THREE from 'three';
import { useLoader, useThree } from '@react-three/fiber';
import { floorMaterials, FLOOR_TEXTURE_SIZE } from '../../../utils/textures.ts';

export default function Base3d() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const floorTextureId = useStore((state) => state.floorTextureId);
  const material = floorMaterials[floorTextureId] ?? floorMaterials['1'];
  const texture = useLoader(THREE.TextureLoader, material.url);
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
  }, [gl, texture]);

  useLayoutEffect(() => {
    const { position, uv } = meshRef.current.geometry.attributes;
    // Measure both axes in meters so boards and tiles stay square when
    // resizing a rectangular gallery. Anchor the pattern at the center.
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, position.getX(i) / FLOOR_TEXTURE_SIZE, position.getY(i) / FLOOR_TEXTURE_SIZE);
    }
    uv.needsUpdate = true;
  }, [width, height]);

  return (
    <mesh receiveShadow ref={meshRef} rotation={[Math.PI * 1.5, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial roughness={material.roughness} metalness={0} map={texture} />
    </mesh>
  );
}
