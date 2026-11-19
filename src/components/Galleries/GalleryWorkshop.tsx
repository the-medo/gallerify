import { useEffect, useState } from 'react';
import { ArrowLeftIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { galleries, galleryError } from '../../lib/gallery-client.ts';
import type { SavedGallery } from '../../lib/gallery.ts';
import { galleryPresets } from '../../presets/galleryPresets.ts';
import { useStore } from '../../store/store.ts';
import { useGallerySave } from './useGallerySave.ts';
import GenerateBox from '../GenerateBox/GenerateBox.tsx';
import Turn3dBox from '../GenerateBox/Turn3dBox.tsx';
import Preview from '../Preview/Preview.tsx';
import FloorTextureSelector from '../TextureSelector/FloorTextureSelector.tsx';
import TextureSelector from '../TextureSelector/TextureSelector.tsx';
import Account from '../Account/Account.tsx';
import './galleries.css';
import ArtworkPanel from '../Artwork/ArtworkPanel.tsx';

function Editor({ gallery }: { gallery: SavedGallery }) {
  const { name, rename, dirty, saving, error, save, hasChanges } = useGallerySave(gallery);
  const [panel, setPanel] = useState<'Layout' | 'Art' | 'Finishes'>('Art');
  const selectedPlacementId = useStore((state) => state.selectedPlacementId);
  useEffect(() => {
    if (selectedPlacementId) setPanel('Art');
  }, [selectedPlacementId]);
  const activePresetId = useStore((state) => state.activePresetId);
  const loadPreset = useStore((state) => state.loadPreset);
  return (
    <main className="app-shell workshop">
      <header className="workshop-header">
        <a
          href="/"
          className="workshop-back"
          onClick={async (event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              (!dirty && !saving)
            )
              return;
            event.preventDefault();
            if ((await save()) && !hasChanges()) window.location.assign('/');
          }}
        >
          <ArrowLeftIcon /> My galleries
        </a>
        <div className="workshop-title">
          <h1>Gallery workshop</h1>
          <label>
            <input
              aria-label="Gallery name"
              maxLength={100}
              value={name}
              placeholder="Untitled gallery"
              onChange={(event) => rename(event.target.value)}
              onBlur={() => rename(name.trim() || 'Untitled gallery')}
            />
            <Pencil1Icon />
          </label>
        </div>
        <div className="workshop-save">
          <span role="status">
            {saving
              ? 'Saving…'
              : error && dirty
              ? 'Save failed'
              : dirty
              ? 'Unsaved changes'
              : 'All changes saved'}
          </span>
          <button
            type="button"
            className="library-create"
            disabled={saving || !dirty}
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      </header>
      {error && dirty && (
        <div className="workshop-error" role="alert">
          {error}
        </div>
      )}
      <div className="workshop-body">
        <Preview showMaterials={false} galleryName={name} />
        <aside className="workshop-inspector" aria-label="Gallery controls">
          <div className="inspector-switch" role="group" aria-label="Workshop controls">
            {(['Layout', 'Art', 'Finishes'] as const).map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={panel === item}
                onClick={() => setPanel(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div hidden={panel !== 'Art'}>
            <ArtworkPanel />
          </div>
          {panel === 'Layout' && (
            <div className="workshop-layout">
              <label className="workshop-preset">
                Starting plan
                <select
                  value={activePresetId ?? ''}
                  onChange={(event) => loadPreset(event.target.value)}
                >
                  {!activePresetId && <option value="">Generated layout</option>}
                  {galleryPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <GenerateBox />
              <Turn3dBox />
            </div>
          )}
          {panel === 'Finishes' && (
            <>
              <TextureSelector />
              <FloorTextureSelector />
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function OpenGallery({ id }: { id: string }) {
  const [gallery, setGallery] = useState<SavedGallery | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    galleries
      .get(id, controller.signal)
      .then((record) => {
        if (controller.signal.aborted) return;
        useStore.getState().restoreSetup(record.setup);
        setGallery(record);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(galleryError(err));
      });
    return () => controller.abort();
  }, [id, attempt]);

  if (gallery) return <Editor gallery={gallery} />;
  return (
    <main className="app-shell workshop-message">
      <a href="/">← My galleries</a>
      <h1>Gallery workshop</h1>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button className="account-link" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </>
      ) : (
        <p role="status">Opening gallery…</p>
      )}
    </main>
  );
}

export default function GalleryWorkshop({
  id,
  ownerId,
  pending,
}: {
  id: string;
  ownerId?: string;
  pending: boolean;
}) {
  if (ownerId) return <OpenGallery key={ownerId + id} id={id} />;
  return (
    <main className="app-shell workshop-message">
      <a href="/">← Gallerify</a>
      <h1>Gallery workshop</h1>
      <p>{pending ? 'Opening workshop…' : 'Sign in to open your gallery.'}</p>
      <Account />
    </main>
  );
}
