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

export type TGridLayout = {
  points: TPointMap;
  lines: TLineMap;
};

export type TRoomLayout = {
  rooms: RoomMap;
};
