/*
1. create room layout
2. generate seed number

3. Repeat this until all rooms are merged:
  a. select random room, based on seed
  b. select random neighbor, based on seed
  c. select random common wall, based on seed
  d. remove wall
  e. merge rooms

 */
import { getCommonWalls, removeWallAndMergeRooms, TRoomLayout, wallKey } from './types.ts';
import { createRoomLayout, CreateRoomLayoutProps } from './createRoomLayout.ts';

export interface ComputeWallRemovalProps extends CreateRoomLayoutProps {
  seed?: number;
}

export function computeWallRemoval({
  stepSize,
  width,
  height,
  seed = 366796,
}: ComputeWallRemovalProps): [TRoomLayout, number] {
  if (!seed) seed = Math.ceil(Math.random() * 1000000);
  console.log('SEED: ' + seed);

  const roomLayout = createRoomLayout({ stepSize, width, height });

  let roomKeys = Object.keys(roomLayout.rooms);

  let i = 0;
  try {
    while (roomKeys.length > 1) {
      i++;

      // select random room, based on seed
      const roomKey = roomKeys[seed % roomKeys.length];
      const room = roomLayout.rooms[roomKey];

      // select random neighbor, based on seed
      const neighbor = room.neighbors[seed % room.neighbors.length];

      // console.log('Iteration: ' + i, 'Room: ' + roomKey, room, 'Neighbor: ', neighbor);

      // select random common wall, based on seed
      const commonWalls = getCommonWalls(room, neighbor);
      // console.log('Common walls: ', commonWalls);

      const wall = commonWalls[seed % commonWalls.length];
      if (i === 1) {
        console.log('Room key: ', roomKey, 'Neighbor', neighbor.id);
        console.log('Common walls: ', commonWalls);
        console.log('BREAK ROOM LAYOUT: ', roomLayout);
        // break;
      }

      if (wall) {
        // remove wall + merge rooms
        removeWallAndMergeRooms(room, neighbor, wall, roomLayout.rooms);
      } else {
        console.log('NO WALL FOUND');
      }

      // remove neighbor from keys
      roomKeys = Object.keys(roomLayout.rooms);
      // roomKeys.splice(roomKeys.indexOf(neighbor.id), 1);
    }
  } catch (e) {
    console.log('ERROR ROOM LAYOUT: ', roomLayout);
  }

  return [roomLayout, seed];
}
