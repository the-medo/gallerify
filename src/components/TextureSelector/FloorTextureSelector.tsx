import { floorMaterials, floorTextureMap } from '../../utils/textures.ts';
import TextureSelectorCard from './TextureSelectorCard.tsx';
import { useStore } from '../../store/store.ts';

export default function FloorTextureSelector() {
  const previewMode = useStore((state) => state.previewMode);
  const floorTextureId = useStore((state) => state.floorTextureId);
  const setFloorTexture = useStore((state) => state.setFloorTexture);

  return (
    <section className="materials-section" aria-label="Floor textures">
      <div className="materials-heading">
        <div className="section-kicker">
          <span>04</span> The gallery floor
        </div>
        <span className="selection-count" aria-live="polite">
          {previewMode === '2d'
            ? 'Available in 3D'
            : (floorMaterials[floorTextureId] ?? floorMaterials['1']).name}
        </span>
      </div>
      <div className="texture-options">
        {Object.entries(floorMaterials).map(([id, material]) => (
          <TextureSelectorCard
            key={id}
            textureId={id}
            name={material.name}
            textureMap={floorTextureMap}
            onTextureSelect={setFloorTexture}
            selected={floorTextureId === id}
            disabled={previewMode !== '3d'}
          />
        ))}
      </div>
      <p className="materials-caption">Choose a finish for the whole gallery floor.</p>
    </section>
  );
}
