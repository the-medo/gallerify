import {
  lineKey,
  TLineMap,
  pointKey,
  TPointMap,
  roomKey,
  TRoomLayout,
  RoomMap,
  TLine,
  TPoint,
  TWall,
  wallKeyFromLine,
  WallMap,
} from '../utils/types.ts';
import { CreateBaseProps } from './createBase.ts';

const checkPoint = (x: number, y: number, pointMap: TPointMap): TPoint => {
  const key = pointKey({ x, y });
  if (!pointMap[key]) pointMap[key] = { x, y };
  return pointMap[key];
};

const checkLine = (start: TPoint, end: TPoint, lineMap: TLineMap): TLine => {
  const key = lineKey({ start, end });
  if (!lineMap[key]) lineMap[key] = { start, end };
  return lineMap[key];
};

const checkWall = (line: TLine, wallMap: WallMap): TWall => {
  const key = wallKeyFromLine(line);
  if (!wallMap[key]) wallMap[key] = { id: key, line, doors: false, textureId: '1' };
  return wallMap[key];
};

export interface CreateRoomLayoutProps extends CreateBaseProps {}

export function createRoomLayout({ stepSize, width, height }: CreateRoomLayoutProps): TRoomLayout {
  const pointMap: TPointMap = {};
  const lineMap: TLineMap = {};
  const wallMap: WallMap = {};
  const roomMap: RoomMap = {};

  for (let x = 0; x < width; x += stepSize) {
    for (let y = 0; y < height; y += stepSize) {
      const topLeft = checkPoint(x, y, pointMap);
      const topRight = checkPoint(x + stepSize, y, pointMap);
      const bottomRight = checkPoint(x + stepSize, y + stepSize, pointMap);
      const bottomLeft = checkPoint(x, y + stepSize, pointMap);

      const topLine = checkLine(topLeft, topRight, lineMap);
      const rightLine = checkLine(topRight, bottomRight, lineMap);
      const bottomLine = checkLine(bottomLeft, bottomRight, lineMap);
      const leftLine = checkLine(topLeft, bottomLeft, lineMap);

      const topWall = checkWall(topLine, wallMap);
      const rightWall = checkWall(rightLine, wallMap);
      const bottomWall = checkWall(bottomLine, wallMap);
      const leftWall = checkWall(leftLine, wallMap);

      const thisRoomKey = roomKey(topLeft);

      roomMap[thisRoomKey] = {
        id: thisRoomKey,
        walls: [topWall, rightWall, bottomWall, leftWall],
        neighbors: [],
      };

      // add top neighbor
      if (y > 0) {
        const topNeighbor = roomMap[roomKey({ x: topLeft.x, y: topLeft.y - stepSize })];
        if (topNeighbor) {
          topNeighbor.neighbors.push(roomMap[thisRoomKey]);
          roomMap[thisRoomKey].neighbors.push(topNeighbor);
        }
      }

      // add left neighbor
      if (x > 0) {
        const leftNeighbor = roomMap[roomKey({ x: topLeft.x - stepSize, y: topLeft.y })];
        if (leftNeighbor) {
          leftNeighbor.neighbors.push(roomMap[thisRoomKey]);
          roomMap[thisRoomKey].neighbors.push(leftNeighbor);
        }
      }
    }
  }

  console.log({ roomMap });

  return {
    rooms: roomMap,
  };
}
