import {
  createPresetLayout,
  DEFAULT_PRESET_ID,
  galleryPresets,
} from '../presets/galleryPresets.ts';
import type { CreateBaseProps } from '../compute/createBase.ts';
import type { TWall } from '../utils/types.ts';

export type GallerySetup = {
  dimensions: CreateBaseProps;
  generatorSettings: CreateBaseProps;
  activePresetId: string | null;
  previewMode: '2d' | '3d';
  walls: TWall[];
  floorTextureId: string;
};

export type GallerySummary = { id: string; name: string; updatedAt: number };
export type SavedGallery = GallerySummary & { revision: number; setup: GallerySetup };

export function defaultGallerySetup(): GallerySetup {
  const preset = galleryPresets.find((item) => item.id === DEFAULT_PRESET_ID)!;
  const { width, height, stepSize } = preset;
  return {
    dimensions: { width, height, stepSize },
    generatorSettings: { width, height, stepSize },
    activePresetId: preset.id,
    previewMode: '3d',
    walls: Object.values(createPresetLayout(preset).rooms).flatMap((room) => room.walls),
    floorTextureId: '1',
  };
}
