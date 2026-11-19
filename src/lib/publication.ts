import type { DisplayArtwork } from './artwork.ts';
import type { GallerySetup } from './gallery.ts';

export type ExhibitionScene = Pick<
  GallerySetup,
  'schemaVersion' | 'dimensions' | 'walls' | 'floorTextureId' | 'placements'
>;
export type ExhibitionDetails = {
  title: string;
  introduction: string;
  visibility: 'public' | 'unlisted';
  artist: string;
  bio: string;
  contact: string;
};
export type Exhibition = {
  details: ExhibitionDetails;
  scene: ExhibitionScene;
  artworks: DisplayArtwork[];
};
export type PublicationStatus = {
  slug: string | null;
  generation: number;
  details: ExhibitionDetails | null;
  live: Exhibition | null;
};

export function exhibitionScene({
  schemaVersion,
  dimensions,
  walls,
  floorTextureId,
  placements,
}: GallerySetup): ExhibitionScene {
  return { schemaVersion, dimensions, walls, floorTextureId, placements };
}

export function displayedArtwork({
  id,
  title,
  description,
  medium,
  year,
  physicalWidth,
  physicalHeight,
  pixelWidth,
  pixelHeight,
  mediaVersion,
}: DisplayArtwork): DisplayArtwork {
  return {
    id,
    title,
    description,
    medium,
    year,
    physicalWidth,
    physicalHeight,
    pixelWidth,
    pixelHeight,
    mediaVersion,
  };
}
