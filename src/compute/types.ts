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
  topLeft: TPoint;
  bottomRight: TPoint;
  walls: TWall[];
  neighbors: TSquare[];
};

export type Room = {
  id: string;
  squares: TSquare[];
};

export type PointMap = Record<string, TPoint>;
export type LineMap = Record<string, TLine>;
export type WallMap = Record<string, TWall>;
export type RoomMap = Record<string, Room>;

export const pointKey = (point: TPoint) => `${point.x};${point.y}`;
export const lineKey = (line: TLine) => `${pointKey(line.start)}-${pointKey(line.end)}`;
export const wallKey = (wall: TWall) => lineKey(wall.line);

export type GridLayout = {
  points: PointMap;
  lines: LineMap;
};
