import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector2 } from 'three';
import { useStore } from '../../../store/store.ts';
import { placementAtPoint } from '../../../utils/artworkGeometry.ts';

export default function ArtworkDropTarget() {
  const { gl, scene, raycaster, camera } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const dragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('application/x-gallerify-artwork')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    };
    const drop = (event: DragEvent) => {
      const id = event.dataTransfer?.getData('application/x-gallerify-artwork');
      if (!id) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(
        new Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster
        .intersectObjects(scene.children, true)
        .find((item) => item.object.userData.wallId);
      const state = useStore.getState();
      if (!hit?.face) {
        state.setArtworkMessage('Drop the artwork on a wall face.');
        return;
      }
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (Math.abs(normal.y) > 0.5) {
        state.setArtworkMessage('Choose the side of a wall, rather than its top.');
        return;
      }
      state.placeArtwork(
        id,
        placementAtPoint(
          state.walls[hit.object.userData.wallId],
          hit.point,
          normal,
          state.width,
          state.height,
        ),
      );
    };
    canvas.addEventListener('dragover', dragOver);
    canvas.addEventListener('drop', drop);
    return () => {
      canvas.removeEventListener('dragover', dragOver);
      canvas.removeEventListener('drop', drop);
    };
  }, [gl, scene, camera, raycaster]);
  return null;
}
