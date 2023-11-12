import React from 'react';
import { TRoom, TWall } from '../../compute/types.ts';
import Wall2d from './2D/Wall2d.tsx';
import Wall3d from './3D/Wall3d.tsx';
import { useStore } from '../../store/store.ts';

interface RoomProps {
  room: TRoom;
}

const Room: React.FC<RoomProps> = ({ room }) => {
  const previewMode = useStore((state) => state.previewMode);

  return (
    <>
      {room.walls.map((wall: TWall) => {
        if (previewMode === '2d') {
          return <Wall2d key={wall.id} wall={wall} />;
        } else {
          return <Wall3d key={wall.id} wall={wall} />;
        }
      })}
    </>
  );
};

export default Room;
