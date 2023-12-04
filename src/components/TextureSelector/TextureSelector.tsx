import React, { useCallback } from 'react';
import { wallTextureMap } from '../../utils/textures.ts';
import TextureSelectorCard from './TextureSelectorCard.tsx';
import { useStore } from '../../store/store.ts';

interface TextureSelectorProps {}

const TextureSelector: React.FC<TextureSelectorProps> = () => {
  const textureMap = wallTextureMap;
  const setWallTexture = useStore((state) => state.setWallTexture);

  const onTextureSelect = useCallback(
    (textureId: string) => {
      console.log('texture 2 - ', textureId);
      setWallTexture(textureId);
    },
    [setWallTexture],
  );

  return (
    <>
      {Object.keys(textureMap).map((k) => (
        <TextureSelectorCard
          key={k}
          textureId={k}
          textureMap={textureMap}
          onTextureSelect={onTextureSelect}
        />
      ))}
    </>
  );
};

export default TextureSelector;
