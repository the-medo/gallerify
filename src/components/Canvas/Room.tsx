import React from 'react';
import { TRoom, TWall } from '../../compute/types.ts';
import Wall from './Wall.tsx';

interface RoomProps {
  room: TRoom;
}

const Room: React.FC<RoomProps> = ({ room }) => {
  return (
    <>
      {room.walls.map((wall: TWall) => (
        <Wall key={wall.id} wall={wall} />
      ))}
    </>
  );
};

export default Room;
