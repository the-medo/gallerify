import React, { useCallback } from 'react';
import { getTexture, TextureUrlMap } from '../../utils/textures.ts';
import { Avatar } from '@radix-ui/themes';

interface TextureSelectorCardProps {
  textureMap: TextureUrlMap;
  textureId: string;
  onTextureSelect: (textureId: string) => void;
}

const TextureSelectorCard: React.FC<TextureSelectorCardProps> = ({
  textureMap,
  textureId,
  onTextureSelect,
}) => {
  const url = getTexture(textureMap, textureId);

  const onPointerDownHandler = useCallback(() => {
    console.log('texture 1 - ', textureId);
    onTextureSelect(textureId);
  }, [onTextureSelect, textureId]);

  return (
    <Avatar
      src={url}
      alt={`Texture ${textureId}`}
      onPointerDown={onPointerDownHandler}
      fallback={<></>}
    />
  );
};

export default TextureSelectorCard;
