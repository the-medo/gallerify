import { create } from 'zustand';
import type { TRoomLayout, TWall } from '../utils/types.ts';
import { computeWallRemoval } from '../compute/computeWallRemoval.ts';
import { createPresetLayout, galleryPresets } from '../presets/galleryPresets.ts';
import { defaultGallerySetup, migrateGallerySetup, type GallerySetup } from '../lib/gallery.ts';
import type { CreateBaseProps } from '../compute/createBase.ts';
import { artworkDisplaySize, type Artwork, type ArtworkPlacement } from '../lib/artwork.ts';
import { placementIssue } from '../utils/artworkGeometry.ts';

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
  placements: ArtworkPlacement[];
  artworks: Record<string, Artwork>;
  activeArtworkId: string | null;
  selectedPlacementId: string | null;
  artworkMessage: string;
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
  setArtworks: (items: Artwork[]) => void;
  upsertArtwork: (item: Artwork) => void;
  forgetArtwork: (id: string) => void;
  chooseArtwork: (id: string | null) => void;
  selectPlacement: (id: string | null) => void;
  placeArtwork: (
    artworkId: string,
    anchor: Pick<ArtworkPlacement, 'wallId' | 'side' | 'u' | 'elevation'>,
  ) => void;
  updatePlacement: (id: string, changes: Partial<ArtworkPlacement>) => void;
  removePlacement: (id: string) => void;
  setArtworkMessage: (message: string) => void;
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
  setup = migrateGallerySetup(setup);
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
    placements: setup.placements,
    selectedPlacementId: null,
    activeArtworkId: null,
    artworkMessage: '',
    roomLayout,
    walls: layoutWalls(roomLayout),
  };
}

export function gallerySetupFrom(state: State): GallerySetup {
  return {
    schemaVersion: 2,
    placements: state.placements,
    dimensions: { width: state.width, height: state.height, stepSize: state.stepSize },
    generatorSettings: state.generatorSettings,
    activePresetId: state.activePresetId,
    previewMode: state.previewMode,
    walls: Object.values(state.walls),
    floorTextureId: state.floorTextureId,
  };
}

export const useStore = create<State & Actions>((set, get) => ({
  windowWidth: 1920,
  artworks: {},
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

  handleGenerate: () => {
    if (
      get().placements.length &&
      !window.confirm(
        'Generate a new layout? Placed artwork will return to your library. Your image files will be kept.',
      )
    )
      return;
    set((state) => {
      const roomLayout = computeWallRemoval(state.generatorSettings)[0];

      return {
        placements: [],
        selectedPlacementId: null,
        activeArtworkId: null,
        artworkMessage: state.placements.length
          ? 'Your artwork is back in the library, ready to hang.'
          : '',
        generated: true,
        activePresetId: null,
        ...state.generatorSettings,
        squareSize: computeSquareSize(state.generatorSettings.width, state.windowWidth),
        selectedWallIds: {},
        roomLayout,
        walls: layoutWalls(roomLayout),
      };
    });
  },

  loadPreset: (presetId: string) => {
    if (
      get().placements.length &&
      !window.confirm(
        'Change the layout? Placed artwork will return to your library. Your image files will be kept.',
      )
    )
      return;
    set((state) => {
      const preset = galleryPresets.find((candidate) => candidate.id === presetId);
      if (!preset) return state;
      const roomLayout = createPresetLayout(preset);
      const dimensions = { width: preset.width, height: preset.height, stepSize: preset.stepSize };
      return {
        placements: [],
        selectedPlacementId: null,
        activeArtworkId: null,
        artworkMessage: state.placements.length
          ? 'Your artwork is back in the library, ready to hang.'
          : '',
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
    });
  },
  setArtworks: (items) =>
    set({ artworks: Object.fromEntries(items.map((item) => [item.id, item])) }),
  upsertArtwork: (item) => set((state) => ({ artworks: { ...state.artworks, [item.id]: item } })),
  forgetArtwork: (id) =>
    set((state) => ({
      artworks: Object.fromEntries(Object.entries(state.artworks).filter(([key]) => key !== id)),
      activeArtworkId: state.activeArtworkId === id ? null : state.activeArtworkId,
    })),
  chooseArtwork: (id) =>
    set({
      activeArtworkId: id,
      selectedPlacementId: null,
      artworkMessage: '',
      ...(id ? { previewMode: '3d' as const } : {}),
    }),
  selectPlacement: (id) =>
    set({ selectedPlacementId: id, activeArtworkId: null, artworkMessage: '' }),
  setArtworkMessage: (message) => set({ artworkMessage: message }),
  placeArtwork: (artworkId, anchor) =>
    set((state) => {
      const artwork = state.artworks[artworkId];
      if (!artwork) return { artworkMessage: 'This artwork is unavailable. Refresh your library.' };
      if (state.placements.length >= 200)
        return { artworkMessage: 'This gallery can hold up to 200 artwork placements.' };
      const placement: ArtworkPlacement = {
        id: crypto.randomUUID(),
        artworkId,
        ...anchor,
        ...artworkDisplaySize(artwork),
      };
      const issue = placementIssue(placement, state.walls);
      if (issue) return { artworkMessage: issue };
      return {
        placements: [...state.placements, placement],
        selectedPlacementId: placement.id,
        activeArtworkId: null,
        artworkMessage: 'Artwork hung. Select it to adjust its position or size.',
      };
    }),
  updatePlacement: (id, changes) =>
    set((state) => {
      const current = state.placements.find((item) => item.id === id);
      if (!current) return state;
      const placement = { ...current, ...changes, id: current.id, artworkId: current.artworkId };
      const issue = placementIssue(placement, state.walls);
      if (issue) return { artworkMessage: issue };
      return {
        placements: state.placements.map((item) => (item.id === id ? placement : item)),
        artworkMessage: '',
      };
    }),
  removePlacement: (id) =>
    set((state) => ({
      placements: state.placements.filter((item) => item.id !== id),
      selectedPlacementId: null,
      artworkMessage: 'Removed from this wall. The artwork is still in your library.',
    })),
}));
