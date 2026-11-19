import { create } from 'zustand';
import type { TRoomLayout, TWall } from '../utils/types.ts';
import { computeWallRemoval } from '../compute/computeWallRemoval.ts';
import { createPresetLayout, galleryPresets } from '../presets/galleryPresets.ts';
import { defaultGallerySetup, type GallerySetup } from '../lib/gallery.ts';
import type { CreateBaseProps } from '../compute/createBase.ts';

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
  roomLayout: TRoomLayout;
  walls: Record<string, TWall>;
  selectedWallIds: Record<string, true | undefined>;
  floorTextureId: string;
};

type Actions = {
  restoreSetup: (setup: GallerySetup) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setStepSize: (sliderInput: number[]) => void;
  setWidth: (sliderInput: number[]) => void;
  setHeight: (sliderInput: number[]) => void;
  setWindowWidth: (width: number) => void;
  toggleSelectedWall: (wallId: string) => void;
  setWall: (wallId: string, wallData: TWall) => void;
  setSelectedWall: (wallId: string) => void;
  setWallTexture: (textureId: string) => void;
  setFloorTexture: (textureId: string) => void;
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

function replaceWalls(state: State, replacements: Record<string, TWall>) {
  const rooms = Object.fromEntries(
    Object.entries(state.roomLayout.rooms).map(([id, room]) => [
      id,
      { ...room, walls: room.walls.map((wall) => replacements[wall.id] ?? wall) },
    ]),
  );
  return { roomLayout: { rooms }, walls: { ...state.walls, ...replacements } };
}

// Generation merges the grid into one room. Only its finished walls are editable.
function restoredState(setup: GallerySetup, windowWidth: number) {
  const room = { id: 'gallery', walls: setup.walls, neighbors: [] };
  const roomLayout = { rooms: { gallery: room } };
  return {
    ...setup.dimensions,
    generated: true,
    activePresetId: setup.activePresetId,
    generatorSettings: setup.generatorSettings,
    previewMode: setup.previewMode,
    maxSize: Math.floor(30 / setup.generatorSettings.stepSize) * setup.generatorSettings.stepSize,
    squareSize: computeSquareSize(setup.dimensions.width, windowWidth),
    selectedWallIds: {},
    floorTextureId: setup.floorTextureId,
    roomLayout,
    walls: layoutWalls(roomLayout),
  };
}

export function gallerySetupFrom(state: State): GallerySetup {
  return {
    dimensions: { width: state.width, height: state.height, stepSize: state.stepSize },
    generatorSettings: state.generatorSettings,
    activePresetId: state.activePresetId,
    previewMode: state.previewMode,
    walls: Object.values(state.walls),
    floorTextureId: state.floorTextureId,
  };
}

export const useStore = create<State & Actions>((set) => ({
  windowWidth: 1920,
  ...restoredState(defaultGallerySetup(), 1920),
  restoreSetup: (setup) => set((state) => restoredState(setup, state.windowWidth)),

  setPreviewMode: (mode: PreviewMode) => set(() => ({ previewMode: mode })),

  setFloorTexture: (textureId: string) => set(() => ({ floorTextureId: textureId })),

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
    set((state) => replaceWalls(state, { [wallId]: wallData })),

  setSelectedWall: (wallId: string) =>
    set(() => ({
      selectedWallIds: {
        [wallId]: true,
      },
    })),

  setWallTexture: (textureId: string) =>
    set((state) => {
      const replacements: Record<string, TWall> = {};
      for (const id of Object.keys(state.selectedWallIds)) {
        const wall = state.walls[id];
        if (wall && wall.textureId !== textureId) replacements[id] = { ...wall, textureId };
      }
      return Object.keys(replacements).length ? replaceWalls(state, replacements) : state;
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
