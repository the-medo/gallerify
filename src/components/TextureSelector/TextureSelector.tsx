import { wallMaterials, wallTextureMap } from '../../utils/textures.ts';
import TextureSelectorCard from './TextureSelectorCard.tsx';
import { useStore } from '../../store/store.ts';

export default function TextureSelector() {
  const previewMode = useStore((state) => state.previewMode);
  const setWallTexture = useStore((state) => state.setWallTexture);
  const selectedCount = useStore(
    (state) => Object.keys(state.selectedWallIds).filter((id) => state.walls[id]).length,
  );
  const selectedTexture = useStore((state) => {
    const selected = Object.keys(state.selectedWallIds)
      .map((id) => state.walls[id])
      .filter(Boolean);
    return selected.length && selected.every((wall) => wall.textureId === selected[0].textureId)
      ? selected[0].textureId
      : undefined;
  });
  return (
    <section className="materials-section" aria-label="Wall textures">
      <div className="materials-heading">
        <div className="section-kicker">
          <span>03</span> The backdrop for your art
        </div>
        <span className="selection-count" aria-live="polite">
          {previewMode === '2d'
            ? 'Available in 3D'
            : selectedCount
            ? `${selectedCount} wall${selectedCount === 1 ? '' : 's'} selected`
            : 'Select a wall to begin'}
        </span>
      </div>
      <div className="texture-options">
        {Object.keys(wallTextureMap).map((id) => (
          <TextureSelectorCard
            key={id}
            textureId={id}
            name={wallMaterials[id].name}
            textureMap={wallTextureMap}
            onTextureSelect={setWallTexture}
            selected={selectedTexture === id}
            disabled={previewMode !== '3d' || !selectedCount}
          />
        ))}
      </div>
      <p className="materials-caption">
        Click a wall to select it. <kbd>Ctrl</kbd> + click to select more.
      </p>
    </section>
  );
}
