import React from 'react';
import { TRoomLayout, TRoom } from '../../compute/types.ts';
import Room from './Room.tsx';

interface RoomLayoutProps {
  roomLayout: TRoomLayout;
}

const RoomLayout: React.FC<RoomLayoutProps> = ({ roomLayout }) => {
  const rooms = Object.keys(roomLayout.rooms).map((key) => roomLayout.rooms[key]);

  return (
    <>
      {rooms.map((room: TRoom) => (
        <Room key={room.id} room={room} />
      ))}
    </>
  );
};

export default RoomLayout;
