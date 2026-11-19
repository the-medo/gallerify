import type { TRoom } from '../../utils/types.ts';
import Wall2d from './2D/Wall2d.tsx';

// The 3D editor and walking view share GalleryScene; this is the 2D floor plan.
export default function Room({ room }: { room: TRoom }) {
  return (
    <>
      {room.walls.map((wall) => (
        <Wall2d key={wall.id} wall={wall} />
      ))}
    </>
  );
}
