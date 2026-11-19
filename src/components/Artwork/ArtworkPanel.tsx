import { useEffect, useRef, useState } from 'react';
import { artworks as api } from '../../lib/artwork-client.ts';
import {
  artworkMediaUrl,
  type Artwork,
  type ArtworkDetails,
  type ArtworkPlacement,
} from '../../lib/artwork.ts';
import { useStore } from '../../store/store.ts';
import { hangingSurface } from '../../utils/artworkGeometry.ts';
import './artwork.css';

type Upload = {
  id: string;
  file: File;
  status: 'waiting' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function ArtworkDetailsForm({ artwork }: { artwork: Artwork }) {
  const [details, setDetails] = useState<ArtworkDetails>({
    title: artwork.title,
    description: artwork.description,
    medium: artwork.medium,
    year: artwork.year,
    physicalWidth: artwork.physicalWidth,
    physicalHeight: artwork.physicalHeight,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <form
      className="art-details"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setMessage('');
        try {
          const saved = await api.update(artwork.id, details);
          if (mounted.current) {
            useStore.getState().upsertArtwork(saved);
            setMessage('Artwork details saved.');
          }
        } catch (error) {
          if (mounted.current) setMessage(errorText(error));
        } finally {
          if (mounted.current) setSaving(false);
        }
      }}
    >
      <h3>Artwork details</h3>
      <label>
        Title
        <input
          required
          maxLength={160}
          value={details.title}
          onChange={(event) => setDetails({ ...details, title: event.target.value })}
        />
      </label>
      <label>
        Description
        <textarea
          rows={3}
          maxLength={5000}
          value={details.description}
          onChange={(event) => setDetails({ ...details, description: event.target.value })}
        />
      </label>
      <div className="art-fields">
        <label>
          Medium
          <input
            maxLength={160}
            value={details.medium}
            onChange={(event) => setDetails({ ...details, medium: event.target.value })}
          />
        </label>
        <label>
          Year
          <input
            type="number"
            min={0}
            max={9999}
            value={details.year ?? ''}
            onChange={(event) =>
              setDetails({
                ...details,
                year: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </label>
      </div>
      <label>
        Original width (m, optional)
        <input
          type="number"
          min={0.05}
          max={30}
          step="any"
          value={details.physicalWidth ?? ''}
          onChange={(event) => {
            const width = event.target.value ? Number(event.target.value) : null;
            setDetails({
              ...details,
              physicalWidth: width,
              physicalHeight: width ? (width * artwork.pixelHeight) / artwork.pixelWidth : null,
            });
          }}
        />
      </label>
      <p className="art-hint">
        {details.physicalHeight ? `Height: ${details.physicalHeight.toFixed(2)} m. ` : ''}
        Proportions are preserved. These dimensions apply the next time you hang this artwork.
      </p>
      <button type="submit" disabled={saving}>
        {saving ? 'Saving details…' : 'Save artwork details'}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

function PlacementEditor({ placement }: { placement: ArtworkPlacement }) {
  const state = useStore();
  const artwork = state.artworks[placement.artworkId];
  const [draft, setDraft] = useState(placement);
  const surface = hangingSurface(state.walls[placement.wallId], state.walls);
  const ratio = artwork
    ? artwork.pixelWidth / artwork.pixelHeight
    : placement.width / placement.height;
  return (
    <form
      className="art-details"
      onSubmit={(event) => {
        event.preventDefault();
        state.updatePlacement(placement.id, draft);
      }}
    >
      <h3>On this wall</h3>
      <div className="art-fields">
        <label>
          Width (m)
          <input
            type="number"
            required
            min={0.05}
            max={30}
            step="any"
            value={draft.width}
            onChange={(event) =>
              setDraft({
                ...draft,
                width: Number(event.target.value),
                height: Number(event.target.value) / ratio,
              })
            }
          />
        </label>
        <label>
          Height (m)
          <input
            type="number"
            required
            min={0.05}
            max={2.17}
            step="any"
            value={draft.height}
            onChange={(event) =>
              setDraft({
                ...draft,
                height: Number(event.target.value),
                width: Number(event.target.value) * ratio,
              })
            }
          />
        </label>
        <label>
          Along wall (m)
          <input
            type="number"
            required
            step="any"
            value={draft.u}
            onChange={(event) => setDraft({ ...draft, u: Number(event.target.value) })}
          />
        </label>
        <label>
          Center height (m)
          <input
            type="number"
            required
            min={0}
            max={2.25}
            step="any"
            value={draft.elevation}
            onChange={(event) => setDraft({ ...draft, elevation: Number(event.target.value) })}
          />
        </label>
      </div>
      <label>
        Wall face
        <select
          value={draft.side}
          onChange={(event) => setDraft({ ...draft, side: Number(event.target.value) as 1 | -1 })}
        >
          <option value={1}>Front</option>
          <option value={-1}>Back</option>
        </select>
      </label>
      <p className="art-hint">
        Available wall: {surface.min.toFixed(2)} to {surface.max.toFixed(2)} m from the selected
        segment’s start. Center height is measured from the floor.
      </p>
      <div className="art-actions">
        <button type="submit">Apply placement</button>
        <button type="button" onClick={() => state.removePlacement(placement.id)}>
          Remove from wall
        </button>
      </div>
    </form>
  );
}

function HangControls({ artworkId }: { artworkId: string }) {
  const state = useStore();
  const walls = Object.values(state.walls);
  const [wallId, setWallId] = useState(Object.keys(state.selectedWallIds)[0] ?? walls[0]?.id ?? '');
  const [side, setSide] = useState<1 | -1>(1);
  return (
    <div className="art-details">
      <p>Click a wall to hang this piece, or choose a wall below.</p>
      <label>
        Wall
        <select value={wallId} onChange={(event) => setWallId(event.target.value)}>
          {walls.map((wall, index) => (
            <option value={wall.id} key={wall.id}>
              Wall {index + 1} · ({wall.line.start.x}, {wall.line.start.y}) → ({wall.line.end.x},{' '}
              {wall.line.end.y})
            </option>
          ))}
        </select>
      </label>
      <label>
        Wall face
        <select value={side} onChange={(event) => setSide(Number(event.target.value) as 1 | -1)}>
          <option value={1}>Front</option>
          <option value={-1}>Back</option>
        </select>
      </label>
      <div className="art-actions">
        <button
          type="button"
          onClick={() => {
            const wall = state.walls[wallId];
            if (!wall) return;
            const surface = hangingSurface(wall, state.walls);
            state.placeArtwork(artworkId, {
              wallId,
              side,
              u: (surface.min + surface.max) / 2,
              elevation: 1.35,
            });
          }}
        >
          Hang on this wall
        </button>
        <button type="button" onClick={() => state.chooseArtwork(null)}>
          Cancel hanging
        </button>
      </div>
    </div>
  );
}

export default function ArtworkPanel() {
  const state = useStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => {
      current.abort();
      useStore.getState().setArtworks([]);
    };
  }, []);
  useEffect(() => {
    const current = new AbortController();
    setLoading(true);
    setLoadError('');
    api
      .list(current.signal)
      .then((items) => {
        if (!current.signal.aborted) useStore.getState().setArtworks(items);
      })
      .catch((error) => {
        if (!current.signal.aborted) setLoadError(errorText(error));
      })
      .finally(() => {
        if (!current.signal.aborted) setLoading(false);
      });
    return () => current.abort();
  }, [attempt]);

  async function upload(items: Upload[]) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const signal = controller.current!.signal;
    const patch = (id: string, changes: Partial<Upload>) => {
      if (!signal.aborted)
        setUploads((values) =>
          values.map((item) => (item.id === id ? { ...item, ...changes } : item)),
        );
    };
    for (const item of items) {
      if (signal.aborted) break;
      patch(item.id, { status: 'uploading', progress: 0, error: undefined });
      try {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(item.file.type))
          throw new Error('Choose a JPEG, PNG, or WebP image.');
        if (item.file.size > 20 * 1024 * 1024) throw new Error('Images can be up to 20 MB.');
        const artwork = await api.upload(
          item.id,
          item.file,
          (progress) => patch(item.id, { progress }),
          signal,
        );
        if (!signal.aborted) {
          useStore.getState().upsertArtwork(artwork);
          patch(item.id, { status: 'done' });
        }
      } catch (error) {
        patch(item.id, { status: 'error', error: errorText(error) });
      }
    }
    busyRef.current = false;
    if (!signal.aborted) setBusy(false);
  }
  const selectedPlacement = state.placements.find((item) => item.id === state.selectedPlacementId);
  const selectedArtworkId = state.activeArtworkId ?? selectedPlacement?.artworkId ?? detailsId;
  const selectedArtwork = selectedArtworkId ? state.artworks[selectedArtworkId] : undefined;
  return (
    <section className="art-panel" aria-label="Artwork library">
      <div className="art-panel-heading">
        <h2>Your art</h2>
        <span>{Object.keys(state.artworks).length} works</span>
      </div>
      <p className="art-hint">
        Upload your work, then click a thumbnail and a wall. You can also drag a thumbnail onto a
        wall.
      </p>
      <label className="art-upload">
        {busy ? 'Uploading your artwork…' : 'Add artwork'}
        <input
          aria-label="Upload artwork"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy || loading}
          onChange={(event) => {
            const items: Upload[] = Array.from(event.target.files ?? []).map((file) => ({
              id: crypto.randomUUID(),
              file,
              status: 'waiting',
              progress: 0,
            }));
            setUploads((current) => [
              ...current.filter((item) => item.status !== 'done'),
              ...items,
            ]);
            event.target.value = '';
            void upload(items);
          }}
        />
      </label>
      <p className="art-hint">JPEG, PNG, WebP · up to 20 MB each · private to your account</p>
      {uploads.length > 0 && (
        <ul className="art-upload-list" aria-label="Upload progress">
          {uploads.map((item) => (
            <li key={item.id}>
              <span>{item.file.name}</span>
              <small role="status">
                {item.status === 'done'
                  ? 'Ready to hang'
                  : item.status === 'error'
                  ? item.error
                  : item.status === 'uploading'
                  ? item.progress === 100
                    ? 'Preparing images…'
                    : `${item.progress}%`
                  : 'Waiting…'}
              </small>
              {item.status === 'error' && (
                <button type="button" disabled={busy} onClick={() => void upload([item])}>
                  Retry {item.file.name}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {loading && <p role="status">Loading your artwork…</p>}
      {loadError && (
        <p role="alert">
          {loadError}{' '}
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Retry library
          </button>
        </p>
      )}
      <div className="art-library-grid">
        {Object.values(state.artworks).map((artwork) => {
          const count = state.placements.filter((item) => item.artworkId === artwork.id).length;
          return (
            <div className="art-library-card" key={artwork.id}>
              <button
                type="button"
                className="art-thumbnail"
                aria-label={`Hang ${artwork.title}`}
                aria-pressed={state.activeArtworkId === artwork.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/x-gallerify-artwork', artwork.id);
                  event.dataTransfer.effectAllowed = 'copy';
                  state.chooseArtwork(artwork.id);
                }}
                onClick={() => {
                  setDetailsId(artwork.id);
                  state.chooseArtwork(artwork.id);
                }}
              >
                <img
                  src={artworkMediaUrl(artwork, 'thumbnail')}
                  alt={artwork.title}
                  draggable={false}
                />
                <strong>{artwork.title}</strong>
                <small>{count ? `${count} on walls` : 'Unplaced'}</small>
              </button>
              <button
                type="button"
                className="art-text-button"
                onClick={() => {
                  state.chooseArtwork(null);
                  state.selectPlacement(null);
                  setDetailsId(artwork.id);
                }}
              >
                Details<span className="sr-only"> for {artwork.title}</span>
              </button>
            </div>
          );
        })}
      </div>
      {!loading && !loadError && !Object.keys(state.artworks).length && (
        <p className="art-empty">
          Your collection starts here. Add an image to make this gallery yours.
        </p>
      )}
      {state.artworkMessage && (
        <p role="status" className="art-message">
          {state.artworkMessage}
        </p>
      )}
      {state.activeArtworkId && (
        <HangControls key={state.activeArtworkId} artworkId={state.activeArtworkId} />
      )}
      {selectedPlacement && (
        <PlacementEditor key={JSON.stringify(selectedPlacement)} placement={selectedPlacement} />
      )}
      {selectedArtwork && (
        <>
          <ArtworkDetailsForm key={selectedArtwork.id} artwork={selectedArtwork} />
          <button
            type="button"
            className="art-delete"
            disabled={
              deleting || state.placements.some((item) => item.artworkId === selectedArtwork.id)
            }
            onClick={async () => {
              if (
                !window.confirm(
                  `Delete “${selectedArtwork.title}” from your artwork library? This removes its uploaded images.`,
                )
              )
                return;
              setDeleting(true);
              try {
                await api.remove(selectedArtwork.id);
                if (!controller.current?.signal.aborted) {
                  state.forgetArtwork(selectedArtwork.id);
                  setDetailsId(null);
                }
              } catch (error) {
                if (!controller.current?.signal.aborted) state.setArtworkMessage(errorText(error));
              } finally {
                if (!controller.current?.signal.aborted) setDeleting(false);
              }
            }}
          >
            {deleting ? 'Deleting…' : 'Delete from library'}
          </button>
          <p className="art-hint">
            To delete an image, first remove its placements and save every gallery that uses it.
          </p>
        </>
      )}
    </section>
  );
}
