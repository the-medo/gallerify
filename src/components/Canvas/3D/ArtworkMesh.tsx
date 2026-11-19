import { useEffect, useState } from 'react';
import { SRGBColorSpace, Texture, TextureLoader } from 'three';
import { artworkMediaUrl, type Artwork, type ArtworkPlacement } from '../../../lib/artwork.ts';
import type { TWall } from '../../../utils/types.ts';
import { placementTransform } from '../../../utils/artworkGeometry.ts';

export default function ArtworkMesh({
  artwork,
  placement,
  wall,
  width,
  height,
  selected,
  onSelect,
}: {
  artwork?: Artwork;
  placement: ArtworkPlacement;
  wall: TWall;
  width: number;
  height: number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const url = artwork ? artworkMediaUrl(artwork, 'scene') : '';
  useEffect(() => {
    setTexture(null);
    if (!url) return;
    let cancelled = false;
    let loaded: Texture | undefined;
    new TextureLoader().load(
      url,
      (value) => {
        if (cancelled) {
          value.dispose();
          return;
        }
        loaded = value;
        value.colorSpace = SRGBColorSpace;
        setTexture(value);
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null);
      },
    );
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [url]);
  const transform = placementTransform(placement, wall, width, height);
  return (
    <group position={transform.position} rotation={transform.rotation}>
      <mesh
        onClick={
          onSelect
            ? (event) => {
                event.stopPropagation();
                if (event.delta <= 5) onSelect();
              }
            : undefined
        }
      >
        <planeGeometry args={[placement.width, placement.height]} />
        <meshStandardMaterial
          key={texture?.uuid ?? 'missing'}
          map={texture}
          color={texture ? '#ffffff' : '#a29d94'}
          roughness={1}
          transparent={Boolean(texture)}
        />
      </mesh>
      {selected && (
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[placement.width + 0.025, placement.height + 0.025]} />
          <meshBasicMaterial color="#3154a3" />
        </mesh>
      )}
    </group>
  );
}
