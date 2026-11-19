import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { GallerySetup } from '../../../lib/gallery.ts';
import type { Artwork } from '../../../lib/artwork.ts';
import Base3d from './Base3d.tsx';
import Wall3d from './Wall3d.tsx';
import ArtworkMesh from './ArtworkMesh.tsx';

export default function GalleryScene({
  setup,
  artworks,
  selectedWallIds = {},
  selectedPlacementId,
  onWallClick,
  onArtworkClick,
}: {
  setup: GallerySetup;
  artworks: Record<string, Artwork>;
  selectedWallIds?: Record<string, true | undefined>;
  selectedPlacementId?: string | null;
  onWallClick?: (id: string, event: ThreeEvent<MouseEvent>) => void;
  onArtworkClick?: (placementId: string) => void;
}) {
  const walls = useMemo(
    () => Object.fromEntries(setup.walls.map((wall) => [wall.id, wall])),
    [setup.walls],
  );
  const { width, height } = setup.dimensions;
  return (
    <>
      <Base3d width={width} height={height} floorTextureId={setup.floorTextureId} />
      {setup.walls.map((wall) => (
        <Wall3d
          key={wall.id}
          wall={wall}
          walls={walls}
          width={width}
          height={height}
          selected={Boolean(selectedWallIds[wall.id])}
          onClick={onWallClick ? (event) => onWallClick(wall.id, event) : undefined}
        />
      ))}
      {setup.placements.map(
        (placement) =>
          walls[placement.wallId] && (
            <ArtworkMesh
              key={placement.id}
              artwork={artworks[placement.artworkId]}
              placement={placement}
              wall={walls[placement.wallId]}
              width={width}
              height={height}
              selected={selectedPlacementId === placement.id}
              onSelect={onArtworkClick ? () => onArtworkClick(placement.id) : undefined}
            />
          ),
      )}
    </>
  );
}
