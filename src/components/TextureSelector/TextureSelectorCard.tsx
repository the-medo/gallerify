import { getTexture, TextureUrlMap } from '../../utils/textures.ts';
import { CheckIcon } from '@radix-ui/react-icons';

interface TextureSelectorCardProps {
  textureMap: TextureUrlMap;
  textureId: string;
  onTextureSelect: (textureId: string) => void;
  selected: boolean;
  disabled: boolean;
}

export default function TextureSelectorCard({
  textureMap,
  textureId,
  onTextureSelect,
  selected,
  disabled,
}: TextureSelectorCardProps) {
  return (
    <button
      className="texture-option"
      type="button"
      aria-label={`Texture ${textureId}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onTextureSelect(textureId)}
      title={`Apply texture ${textureId}`}
    >
      <span className="texture-image">
        <img src={getTexture(textureMap, textureId)} alt={`Texture ${textureId}`} />
        {selected && (
          <span className="texture-check">
            <CheckIcon />
          </span>
        )}
      </span>
      <span className="texture-number">0{textureId}</span>
    </button>
  );
}
