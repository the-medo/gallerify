import { create } from 'zustand';
import { DEFAULT_POINT_SIZE, TRoomLayout, TWall } from '../utils/types.ts';
import { computeWallRemoval } from '../compute/computeWallRemoval.ts';
import {
  createPresetLayout,
  DEFAULT_PRESET_ID,
  galleryPresets,
} from '../presets/galleryPresets.ts';
import type { CreateBaseProps } from '../compute/createBase.ts';

const defaultPreset = galleryPresets.find((preset) => preset.id === DEFAULT_PRESET_ID)!;
const initialLayout = createPresetLayout(defaultPreset);
const layoutWalls = (layout: TRoomLayout): Record<string, TWall> =>
  Object.fromEntries(
    Object.values(layout.rooms).flatMap((room) => room.walls.map((wall) => [wall.id, wall])),
  );

type PreviewMode = '2d' | '3d';

type State = {
  generated: boolean;
  activePresetId: string | null;
  generatorSettings: CreateBaseProps;
  previewMode: PreviewMode;
  stepSize: number;
  width: number;
  height: number;
  maxSize: number;
  windowWidth: number;
  squareSize: number;
  roomLayout: TRoomLayout | undefined;
  walls: Record<string, TWall>;
  selectedWallIds: Record<string, true | undefined>;
};

type Actions = {
  setPreviewMode: (mode: PreviewMode) => void;
  setStepSize: (sliderInput: number[]) => void;
  setWidth: (sliderInput: number[]) => void;
  setHeight: (sliderInput: number[]) => void;
  setWindowWidth: (width: number) => void;
  toggleSelectedWall: (wallId: string) => void;
  setWall: (wallId: string, wallData: TWall) => void;
  setSelectedWall: (wallId: string) => void;
  setWallTexture: (textureId: string) => void;
  handleGenerate: () => void;
  loadPreset: (presetId: string) => void;
};

const computeSquareSize = (width: number, windowWidth: number) =>
  Math.round((windowWidth - (windowWidth > 1024 ? windowWidth / 2 : windowWidth / 1.5)) / width);

const computeDimension = (dimension: number, stepSize: number) =>
  Math.min(
    Math.floor(30 / stepSize) * stepSize,
    Math.max(stepSize * 2, Math.round(dimension / stepSize) * stepSize),
  );

export const useStore = create<State & Actions>((set) => ({
  generated: true,
  activePresetId: defaultPreset.id,
  generatorSettings: {
    stepSize: defaultPreset.stepSize,
    width: defaultPreset.width,
    height: defaultPreset.height,
  },
  previewMode: '3d',
  stepSize: defaultPreset.stepSize,
  width: defaultPreset.width,
  height: defaultPreset.height,
  maxSize: 30,
  roomLayout: initialLayout,
  walls: layoutWalls(initialLayout),
  windowWidth: 1920,
  squareSize: DEFAULT_POINT_SIZE,
  selectedWallIds: {},

  setPreviewMode: (mode: PreviewMode) => set(() => ({ previewMode: mode })),

  setStepSize: (sliderInput: number[]) =>
    set((state) => {
      const width = computeDimension(state.generatorSettings.width, sliderInput[0]);
      const height = computeDimension(state.generatorSettings.height, sliderInput[0]);
      const maxSize = Math.floor(30 / sliderInput[0]) * sliderInput[0];

      return {
        generatorSettings: { stepSize: sliderInput[0], width, height },
        maxSize,
      };
    }),

  setWidth: (sliderInput: number[]) =>
    set((state) => ({
      generatorSettings: { ...state.generatorSettings, width: sliderInput[0] },
    })),
  setHeight: (sliderInput: number[]) =>
    set((state) => ({ generatorSettings: { ...state.generatorSettings, height: sliderInput[0] } })),

  setWindowWidth: (width: number) =>
    set((state) => ({
      windowWidth: width,
      squareSize: computeSquareSize(state.width, width),
    })),

  toggleSelectedWall: (wallId: string) =>
    set((state) => {
      const newWalls = { ...state.selectedWallIds };

      if (newWalls[wallId]) {
        delete newWalls[wallId];
      } else {
        newWalls[wallId] = true;
      }

      return {
        selectedWallIds: newWalls,
      };
    }),

  setWall: (wallId: string, wallData: TWall) =>
    set((state) => ({
      walls: {
        ...state.walls,
        [wallId]: wallData,
      },
    })),

  setSelectedWall: (wallId: string) =>
    set(() => ({
      selectedWallIds: {
        [wallId]: true,
      },
    })),

  setWallTexture: (textureId: string) =>
    set((state) => {
      const layout = state.roomLayout;

      for (const roomsKey in layout?.rooms) {
        layout.rooms[roomsKey].walls.forEach((w) => {
          if (state.selectedWallIds[w.id]) {
            w.textureId = textureId;
            console.log('Found selected wall!');
          }
        });
      }

      const walls = state.walls;
      Object.keys(state.selectedWallIds).forEach((swid) => (walls[swid].textureId = textureId));

      console.log('texture 3 - ', textureId);

      return {
        roomLayout: layout,
        walls,
      };
    }),

  handleGenerate: () =>
    set((state) => {
      const roomLayout = computeWallRemoval(state.generatorSettings)[0];

      return {
        generated: true,
        activePresetId: null,
        ...state.generatorSettings,
        squareSize: computeSquareSize(state.generatorSettings.width, state.windowWidth),
        selectedWallIds: {},
        roomLayout,
        walls: layoutWalls(roomLayout),
      };
    }),

  loadPreset: (presetId: string) =>
    set((state) => {
      const preset = galleryPresets.find((candidate) => candidate.id === presetId);
      if (!preset) return state;
      const roomLayout = createPresetLayout(preset);
      const dimensions = { width: preset.width, height: preset.height, stepSize: preset.stepSize };
      return {
        ...dimensions,
        generatorSettings: dimensions,
        maxSize: Math.floor(30 / preset.stepSize) * preset.stepSize,
        generated: true,
        activePresetId: preset.id,
        roomLayout,
        walls: layoutWalls(roomLayout),
        selectedWallIds: {},
        squareSize: computeSquareSize(preset.width, state.windowWidth),
      };
    }),
}));
