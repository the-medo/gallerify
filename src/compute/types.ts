export const DEFAULT_POINT_SIZE = 8;

export type TPoint = {
  x: number;
  y: number;
};

export type TLine = {
  start: TPoint;
  end: TPoint;
};

export type TWall = {
  id: string;
  line: TLine;
  doors: boolean;
};

export type TSquare = {
  id: string;
  points: TPoint[];
  walls: TWall[];
  neighbors: TSquare[];
};

export type TRoom = {
  id: string;
  walls: TWall[];
  neighbors: TRoom[];
};

export type TPointMap = Record<string, TPoint>;
export type TLineMap = Record<string, TLine>;
export type WallMap = Record<string, TWall>;
export type RoomMap = Record<string, TRoom>;

export const pointKey = (point: TPoint) => `${point.x};${point.y}`;
export const lineKey = (line: TLine) => `${pointKey(line.start)}-${pointKey(line.end)}`;
export const wallKeyFromLine = (line: TLine) => `wall-${lineKey(line)}`;
export const wallKey = (wall: TWall) => `wall-${lineKey(wall.line)}`;
export const roomKey = (point: TPoint) => `room-${point.x};${point.y}`;

let squareCounter = 0;
// let roomCounter = 0;

export const newSquareKey = () => `square-${squareCounter++}`;
// export const newRoomKey = () => `room-${roomCounter++}`;

export type TGridLayout = {
  points: TPointMap;
  lines: TLineMap;
};

export type TRoomLayout = {
  rooms: RoomMap;
};

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

  r2.neighbors.forEach((r2Neighbor) => {
    // if (n.id !== r1.id) {
    if (
      r2Neighbor.id !== r1.id &&
      !r1.neighbors.some((r1Neighbor) => r2Neighbor.id === r1Neighbor.id)
    ) {
      r1.neighbors.push(r2Neighbor);
      r2Neighbor.neighbors = r2Neighbor.neighbors.filter(
        (otherNeighbor) => otherNeighbor.id !== r2.id,
      );
      if (!r2Neighbor.neighbors.some((otherNeighbor) => r1.id === otherNeighbor.id)) {
        r2Neighbor.neighbors.push(r1);
      }
    }
    // }
  });

  //remove r2 from r1 neighbors
  r1.neighbors = r1.neighbors.filter((neighbor) => neighbor.id !== r2.id);

  //remove r2 from rooms
  delete rooms[r2.id];
};

export const removeWallAndMergeRooms = (r1: TRoom, r2: TRoom, wall: TWall, rooms: RoomMap) => {
  rooms[r1.id].walls = r1.walls.filter((otherWall) => wallKey(wall) !== wallKey(otherWall));
  rooms[r2.id].walls = r2.walls.filter((otherWall) => wallKey(wall) !== wallKey(otherWall));
  mergeRooms(r1, r2, rooms);
};
