import { useEffect, useRef } from 'react';
import { gallerySetupFrom, useStore } from '../../store/store.ts';
import { Canvas, useThree } from '@react-three/fiber';
import GalleryScene from '../Canvas/3D/GalleryScene.tsx';
import ArtworkDropTarget from '../Canvas/3D/ArtworkDropTarget.tsx';
import { placementAtPoint } from '../../utils/artworkGeometry.ts';
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

export default function Preview3d({ paused = false }: { paused?: boolean }) {
  const setup = useStore(gallerySetupFrom);
  const artworks = useStore((state) => state.artworks);
  const selectedWallIds = useStore((state) => state.selectedWallIds);
  const selectedPlacementId = useStore((state) => state.selectedPlacementId);
  return (
    <Canvas
      shadows
      camera={{ fov: 42, position: [15, 16, 15], near: 0.1, far: 250 }}
      dpr={[1, 2]}
      frameloop={paused ? 'never' : 'always'}
    >
      <ambientLight intensity={Math.PI * 0.4} />
      <pointLight castShadow position={[1, 4, 1]} decay={0} intensity={Math.PI * 0.3} />
      <GalleryScene
        setup={setup}
        artworks={artworks}
        selectedWallIds={selectedWallIds}
        selectedPlacementId={selectedPlacementId}
        onArtworkClick={(id) => useStore.getState().selectPlacement(id)}
        onWallClick={(id, event) => {
          const state = useStore.getState();
          if (state.activeArtworkId && event.face) {
            const normal = event.face.normal.clone().transformDirection(event.object.matrixWorld);
            if (Math.abs(normal.y) > 0.5) {
              state.setArtworkMessage('Choose a wall face to hang your artwork.');
              return;
            }
            state.placeArtwork(
              state.activeArtworkId,
              placementAtPoint(state.walls[id], event.point, normal, state.width, state.height),
            );
          } else if (event.ctrlKey || event.metaKey) state.toggleSelectedWall(id);
          else state.setSelectedWall(id);
        }}
      />
      <ArtworkDropTarget />
      <RoomCamera />
    </Canvas>
  );
}
