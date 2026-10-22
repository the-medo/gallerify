import { CubeIcon, ViewGridIcon } from '@radix-ui/react-icons';
import { useStore } from '../../store/store.ts';

export default function Turn3dBox() {
  const generated = useStore((state) => state.generated);
  const previewMode = useStore((state) => state.previewMode);
  const setPreviewMode = useStore((state) => state.setPreviewMode);
  return (
    <section className="view-section" aria-label="Perspective">
      <div className="section-kicker">
        <span>02</span> The perspective
      </div>
      <div className="view-options" role="group" aria-label="Preview mode">
        <button
          type="button"
          onClick={() => setPreviewMode('2d')}
          disabled={!generated}
          aria-pressed={previewMode === '2d'}
        >
          <ViewGridIcon /> 2D plan
        </button>
        <button
          type="button"
          onClick={() => setPreviewMode('3d')}
          disabled={!generated}
          aria-pressed={previewMode === '3d'}
        >
          <CubeIcon /> 3D view
        </button>
      </div>
      <p className="view-caption">See your gallery from a new perspective.</p>
    </section>
  );
}
