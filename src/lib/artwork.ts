export type DisplayArtwork = {
  id: string;
  title: string;
  description: string;
  medium: string;
  year: number | null;
  physicalWidth: number | null;
  physicalHeight: number | null;
  pixelWidth: number;
  pixelHeight: number;
  mediaVersion: string;
};

export type Artwork = DisplayArtwork & {
  bytes: number;
  createdAt: number;
};

export type ArtworkDetails = Pick<
  Artwork,
  'title' | 'description' | 'medium' | 'year' | 'physicalWidth' | 'physicalHeight'
>;

// u is measured from the anchor wall's start, in meters along its line. It may
// extend onto a contiguous segment. Side determines the outward face, not u.
export type ArtworkPlacement = {
  id: string;
  artworkId: string;
  wallId: string;
  side: 1 | -1;
  u: number;
  elevation: number;
  width: number;
  height: number;
};

export type MediaVariant = 'thumbnail' | 'scene' | 'inspection';
export const artworkMediaUrl = (artwork: DisplayArtwork, variant: MediaVariant, slug?: string) =>
  slug
    ? `/api/exhibitions/${slug}/media/${artwork.id}/${artwork.mediaVersion}/${variant}`
    : `/api/artworks/${artwork.id}/media/${artwork.mediaVersion}/${variant}`;

export function artworkDisplaySize(artwork: Artwork) {
  const ratio = artwork.pixelWidth / artwork.pixelHeight;
  const width =
    artwork.physicalWidth ??
    (artwork.physicalHeight ? artwork.physicalHeight * ratio : Math.min(1, ratio));
  return { width, height: width / ratio };
}
