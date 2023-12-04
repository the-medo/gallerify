export type TextureUrlMap = Record<string, string | undefined>;

export const wallTextureMap: TextureUrlMap = {
  '1': '/src/assets/textures/wall/wall1.png',
  '2': '/src/assets/textures/wall/wall2.png',
  '3': '/src/assets/textures/wall/wall3.png',
  '4': '/src/assets/textures/wall/wall4.png',
  '5': '/src/assets/textures/wall/wall5.png',
  '6': '/src/assets/textures/wall/wall6.png',
  '7': '/src/assets/textures/wall/wall7.png',
  '8': '/src/assets/textures/wall/wall8.png',
};

export const floorTextureMap: TextureUrlMap = {
  '1': '/src/assets/textures/floor/floor1.png',
  '2': '/src/assets/textures/floor/floor2.png',
  '3': '/src/assets/textures/floor/floor3.png',
  '4': '/src/assets/textures/floor/floor4.png',
  '5': '/src/assets/textures/floor/floor5.png',
  '6': '/src/assets/textures/floor/floor6.png',
  '7': '/src/assets/textures/floor/floor7.png',
  '8': '/src/assets/textures/floor/floor8.png',
};

export const getTexture = (textureMap: TextureUrlMap, id: string): string =>
  textureMap[id] ?? textureMap['1']!;
