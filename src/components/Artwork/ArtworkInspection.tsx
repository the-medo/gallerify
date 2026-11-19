import { useEffect, useRef, useState } from 'react';
import { artworkMediaUrl, type Artwork } from '../../lib/artwork.ts';
import './artwork.css';

export default function ArtworkInspection({
  artwork,
  onClose,
}: {
  artwork: Artwork;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = dialog.current!;
    if (document.pointerLockElement) document.exitPointerLock();
    modal.showModal();
    return () => {
      modal.close();
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="art-inspection"
      aria-labelledby="art-inspection-title"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <header>
        <h2 id="art-inspection-title">{artwork.title}</h2>
        <button type="button" onClick={onClose} autoFocus>
          Close artwork
        </button>
      </header>
      <div className="art-inspection-image">
        {failed ? (
          <p role="alert">
            This image could not load.{' '}
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              Retry image
            </button>
          </p>
        ) : (
          <img
            key={attempt}
            src={artworkMediaUrl(artwork, 'inspection') + `?retry=${attempt}`}
            alt={artwork.title}
            style={{
              width: `${zoom * 100}%`,
              maxWidth: 'none',
              maxHeight: zoom === 1 ? '60dvh' : 'none',
              objectFit: 'contain',
            }}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <label className="art-zoom">
        Zoom{' '}
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        />
        {Math.round(zoom * 100)}%
      </label>
      <div className="art-inspection-copy">
        <p>
          {[
            artwork.medium,
            artwork.year,
            artwork.physicalWidth && artwork.physicalHeight
              ? `${artwork.physicalWidth.toFixed(2)} × ${artwork.physicalHeight.toFixed(2)} m`
              : null,
          ]
            .filter((value) => value !== null && value !== '')
            .join(' · ')}
        </p>
        <p>{artwork.description}</p>
      </div>
    </dialog>
  );
}
