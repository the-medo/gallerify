import * as THREE from 'three';
import { RoomMap, TPoint, TRoom, TWall, wallKey } from './types.ts';

export function calculateAngle(start: TPoint, end: TPoint): number {
  const startVec = new THREE.Vector2(start.x, start.y);
  const endVec = new THREE.Vector2(end.x, end.y);
  const directionVec = endVec.sub(startVec);

  let angleRad = directionVec.angle(); // Returns the angle in radians
  angleRad -= Math.PI / 2;

  return angleRad;
  // return (angleRad * 180) / Math.PI;
}

export const getCommonWalls = (r1: TRoom, r2: TRoom): TWall[] => {
  const commonWalls: TWall[] = [];

  console.log('wall', r1.walls, r2.walls);

  r1.walls.forEach((wall) => {
    if (r2.walls.some((otherWall) => wallKey(wall) === wallKey(otherWall))) {
      commonWalls.push(wall);
    }
  });

  return commonWalls;
};

export const getRoomNeighbors = (room: TRoom, rooms: RoomMap): TRoom[] => {
  const neighbors: TRoom[] = [];

  Object.values(rooms).forEach((otherRoom) => {
    if (room.id === otherRoom.id) return;

    if (getCommonWalls(room, otherRoom).length > 0) {
      neighbors.push(otherRoom);
    }
  });

  return neighbors;
};

export const mergeRooms = (r1: TRoom, r2: TRoom, rooms: RoomMap) => {
  //add r2 walls to r1
  r2.walls.forEach((wall) => {
    if (!r1.walls.some((otherWall) => wallKey(wall) === wallKey(otherWall))) {
      r1.walls.push(wall);
    }
  });

  r2.neighbors = r2.neighbors.filter((neighbor) => neighbor.id !== r1.id);

  r2.neighbors.forEach((r2Neighbor) => {
    if (!r1.neighbors.some((r1Neighbor) => r2Neighbor.id === r1Neighbor.id)) {
      r1.neighbors.push(r2Neighbor);
    }
    r2Neighbor.neighbors = r2Neighbor.neighbors.filter(
      (otherNeighbor) => otherNeighbor.id !== r2.id,
    );
    if (!r2Neighbor.neighbors.some((otherNeighbor) => r1.id === otherNeighbor.id)) {
      r2Neighbor.neighbors.push(r1);
    }
  });

  //remove r2 from r1 neighbors
  r1.neighbors = r1.neighbors.filter((neighbor) => neighbor.id !== r2.id);

  //remove r2 from rooms
  delete rooms[r2.id];
};

export const removeWallAndMergeRooms = (r1: TRoom, r2: TRoom, wall: TWall, rooms: RoomMap) => {
  console.log('removeWallAndMergeRooms', r1, r2, wall, rooms);
  rooms[r1.id].walls = r1.walls.filter((otherWall) => wallKey(wall) !== wallKey(otherWall));
  rooms[r2.id].walls = r2.walls.filter((otherWall) => wallKey(wall) !== wallKey(otherWall));
  mergeRooms(r1, r2, rooms);
};
