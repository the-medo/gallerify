import { getTexture, TextureUrlMap } from '../../utils/textures.ts';
import { CheckIcon } from '@radix-ui/react-icons';

interface TextureSelectorCardProps {
  textureMap: TextureUrlMap;
  textureId: string;
  name: string;
  onTextureSelect: (textureId: string) => void;
  selected: boolean;
  disabled: boolean;
}

export default function TextureSelectorCard({
  textureMap,
  textureId,
  name,
  onTextureSelect,
  selected,
  disabled,
}: TextureSelectorCardProps) {
  return (
    <button
      className="texture-option"
      type="button"
      aria-label={name}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onTextureSelect(textureId)}
      title={`Apply ${name.toLowerCase()}`}
    >
      <span className="texture-image">
        <img src={getTexture(textureMap, textureId)} crossOrigin="anonymous" alt="" />
        {selected && (
          <span className="texture-check">
            <CheckIcon />
          </span>
        )}
      </span>
      <span className="texture-name">{name}</span>
    </button>
  );
}
