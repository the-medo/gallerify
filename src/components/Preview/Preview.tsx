import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store.ts';
import Preview2d from './Preview2d.tsx';
import Preview3d from './Preview3d.tsx';
import TextureSelector from '../TextureSelector/TextureSelector.tsx';
import { galleryPresets } from '../../presets/galleryPresets.ts';
import FloorTextureSelector from '../TextureSelector/FloorTextureSelector.tsx';
import { PlayIcon } from '@radix-ui/react-icons';
import GalleryWalk from '../Walking/GalleryWalk.tsx';

export default function Preview() {
  const previewMode = useStore((state) => state.previewMode);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const activePresetId = useStore((state) => state.activePresetId);
  const activePreset = galleryPresets.find((preset) => preset.id === activePresetId);
  const viewport = useRef<HTMLDivElement>(null);
  const [walking, setWalking] = useState(false);
  const [size, setSize] = useState({ width: 640, height: 440 });
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="preview-panel" aria-label="Gallery preview">
      <div className="preview-heading">
        <div>
          <span className="status-dot" />
          <h2 aria-live="polite">{activePreset?.name ?? 'Your generated gallery'}</h2>
        </div>
        <div>
          <span className="preview-mode-label">
            {previewMode === '3d' ? 'Perspective / 3D' : 'Floor plan / 2D'}
          </span>
          <button
            type="button"
            className="play-gallery-button"
            onClick={() => setWalking(true)}
            aria-haspopup="dialog"
          >
            <PlayIcon /> Play
          </button>
        </div>
      </div>
      <div className="canvas-stage">
        <div className="stage-label">
          <span className="stage-cross" aria-hidden="true">
            +
          </span>{' '}
          {width} × {height} m <span className="stage-area">/ {width * height} m²</span>
        </div>
        <div ref={viewport} className="canvas-viewport">
          {previewMode === '2d' ? (
            <Preview2d viewportWidth={size.width} viewportHeight={size.height} />
          ) : (
            <Preview3d paused={walking} />
          )}
        </div>
        <div className="stage-caption">
          <span>
            {previewMode === '3d' ? 'Drag to orbit · Scroll to zoom' : 'Your gallery, from above'}
          </span>
          <span className="orientation-marker" aria-hidden="true">
            N ↑
          </span>
        </div>
      </div>
      <TextureSelector />
      <FloorTextureSelector />
      {walking && (
        <GalleryWalk
          name={activePreset?.name ?? 'Your generated gallery'}
          onExit={() => setWalking(false)}
        />
      )}
    </section>
  );
}
