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
import { TRoomLayout } from '../utils/types.ts';
import { createRoomLayout, CreateRoomLayoutProps } from './createRoomLayout.ts';
import { getCommonWalls, removeWallAndMergeRooms } from '../utils/functions.ts';

export interface ComputeWallRemovalProps extends CreateRoomLayoutProps {
  seed?: number;
}

export function computeWallRemoval({
  stepSize,
  width,
  height,
  seed,
}: ComputeWallRemovalProps): [TRoomLayout, number] {
  if (!seed) seed = Math.ceil(Math.random() * 1000000);
  console.log('SEED: ' + seed);

  const roomLayout = createRoomLayout({ stepSize, width, height });

  let roomKeys = Object.keys(roomLayout.rooms);

  while (roomKeys.length > 1) {
    // select random room, based on seed
    const roomKey = roomKeys[seed % roomKeys.length];
    const room = roomLayout.rooms[roomKey];

    // select random neighbor, based on seed
    const neighbor = room.neighbors[seed % room.neighbors.length];

    // select random common wall, based on seed
    const commonWalls = getCommonWalls(room, neighbor);

    const wall = commonWalls[seed % commonWalls.length];
    removeWallAndMergeRooms(room, neighbor, wall, roomLayout.rooms);

    // remove neighbor from keys
    roomKeys = Object.keys(roomLayout.rooms);
  }

  return [roomLayout, seed];
}
