import { create } from 'zustand';
import { DEFAULT_POINT_SIZE, TRoomLayout } from '../compute/types.ts';
import { computeWallRemoval } from '../compute/computeWallRemoval.ts';

const DEFAULT_STEP = 3;
const DEFAULT_WIDTH = 12;
const DEFAULT_HEIGHT = 9;

type PreviewMode = '2d' | '3d';

type State = {
  generated: boolean;
  previewMode: PreviewMode;
  stepSize: number;
  width: number;
  height: number;
  maxSize: number;
  windowWidth: number;
  squareSize: number;
  roomLayout: TRoomLayout | undefined;
  selectedWallIds: Record<string, true | undefined>;
};

type Actions = {
  setPreviewMode: (mode: PreviewMode) => void;
  setStepSize: (sliderInput: number[]) => void;
  setWidth: (sliderInput: number[]) => void;
  setHeight: (sliderInput: number[]) => void;
  setWindowWidth: (width: number) => void;
  toggleSelectedWall: (wallId: string) => void;
  setSelectedWall: (wallId: string) => void;
  handleGenerate: () => void;
};

const computeSquareSize = (width: number, windowWidth: number) =>
  Math.round((windowWidth - (windowWidth > 1024 ? windowWidth / 1.5 : windowWidth / 2)) / width);

const computeDimension = (dimension: number, stepSize: number) =>
  Math.round(dimension / stepSize) * stepSize;

export const useStore = create<State & Actions>((set) => ({
  generated: false,
  previewMode: '3d',
  stepSize: DEFAULT_STEP,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  maxSize: 30,
  roomLayout: undefined,
  windowWidth: 1920,
  squareSize: DEFAULT_POINT_SIZE,
  selectedWallIds: {},

  setPreviewMode: (mode: PreviewMode) => set(() => ({ previewMode: mode })),

  setStepSize: (sliderInput: number[]) =>
    set((state) => {
      const width = computeDimension(state.width, sliderInput[0]);
      const height = computeDimension(state.height, sliderInput[0]);
      const maxSize = computeDimension(state.maxSize, sliderInput[0]);

      return {
        stepSize: sliderInput[0],
        width,
        height,
        maxSize,
        squareSize: computeSquareSize(width, state.windowWidth),
      };
    }),

  setWidth: (sliderInput: number[]) =>
    set((state) => ({
      width: sliderInput[0],
      squareSize: computeSquareSize(sliderInput[0], state.windowWidth),
    })),
  setHeight: (sliderInput: number[]) => set(() => ({ height: sliderInput[0] })),

  setWindowWidth: (width: number) =>
    set((state) => ({
      windowWidth: width,
      squareSize: computeSquareSize(state.width, width),
    })),

  toggleSelectedWall: (wallId: string) =>
    set((state) => {
      const newWalls = state.selectedWallIds;

      if (newWalls[wallId]) {
        delete newWalls[wallId];
      } else {
        newWalls[wallId] = true;
      }

      return {
        selectedWallIds: newWalls,
      };
    }),

  setSelectedWall: (wallId: string) =>
    set(() => ({
      selectedWallIds: {
        [wallId]: true,
      },
    })),

  handleGenerate: () =>
    set((state) => ({
      generated: true,
      roomLayout: computeWallRemoval({
        stepSize: state.stepSize,
        width: state.width,
        height: state.height,
      })[0],
    })),
}));
