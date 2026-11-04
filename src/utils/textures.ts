// Public asset origin only; uploads use authenticated server-side tooling.
const assetBaseUrl = (
  import.meta.env.VITE_ASSET_BASE_URL?.trim() ||
  'https://pub-9fcd2b179c0a4d9ea04195aed388d9b6.r2.dev'
).replace(/\/+$/, '');

const textureUrl = (surface: 'wall' | 'floor', name: string) =>
  `${assetBaseUrl}/textures/${surface}/${name}.webp`;

export type TextureUrlMap = Record<string, string | undefined>;

export const wallMaterials: Record<string, { name: string; url: string }> = {
  '1': { name: 'Chalk plaster', url: textureUrl('wall', 'chalk-plaster') },
  '2': { name: 'Ivory limewash', url: textureUrl('wall', 'ivory-limewash') },
  '3': { name: 'Sand plaster', url: textureUrl('wall', 'sand-plaster') },
  '4': { name: 'Warm concrete', url: textureUrl('wall', 'warm-concrete') },
  '5': { name: 'Honed limestone', url: textureUrl('wall', 'honed-limestone') },
  '6': { name: 'Terracotta clay', url: textureUrl('wall', 'terracotta-clay') },
  '7': { name: 'Sage plaster', url: textureUrl('wall', 'sage-plaster') },
  '8': { name: 'Charcoal plaster', url: textureUrl('wall', 'charcoal-plaster') },
};

// Each texture covers a two-meter square, independent of wall dimensions.
export const WALL_TEXTURE_SIZE = 2;

export const wallTextureMap: TextureUrlMap = Object.fromEntries(
  Object.entries(wallMaterials).map(([id, material]) => [id, material.url]),
);

export const floorMaterials: Record<string, { name: string; url: string; roughness: number }> = {
  '1': { name: 'Natural oak', url: textureUrl('floor', 'natural-oak'), roughness: 0.75 },
  '2': { name: 'Walnut boards', url: textureUrl('floor', 'walnut-boards'), roughness: 0.7 },
  '3': { name: 'Pale ash', url: textureUrl('floor', 'pale-ash'), roughness: 0.78 },
  '4': { name: 'Soft concrete', url: textureUrl('floor', 'soft-concrete'), roughness: 0.85 },
  '5': { name: 'Ivory terrazzo', url: textureUrl('floor', 'ivory-terrazzo'), roughness: 0.65 },
  '6': { name: 'Limestone tiles', url: textureUrl('floor', 'limestone-tiles'), roughness: 0.82 },
  '7': { name: 'Terracotta tiles', url: textureUrl('floor', 'terracotta-tiles'), roughness: 0.92 },
  '8': { name: 'Charcoal slate', url: textureUrl('floor', 'charcoal-slate'), roughness: 0.9 },
};

export const FLOOR_TEXTURE_SIZE = 2;

export const floorTextureMap: TextureUrlMap = Object.fromEntries(
  Object.entries(floorMaterials).map(([id, material]) => [id, material.url]),
);

export const getTexture = (textureMap: TextureUrlMap, id: string): string =>
  textureMap[id] ?? textureMap['1']!;
