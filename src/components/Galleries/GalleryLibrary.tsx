import { useEffect, useRef, useState } from 'react';
import { ArrowTopRightIcon, PlusIcon } from '@radix-ui/react-icons';
import { galleries, galleryError } from '../../lib/gallery-client.ts';
import type { GallerySummary } from '../../lib/gallery.ts';
import './galleries.css';

export default function GalleryLibrary() {
  const [items, setItems] = useState<GallerySummary[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const createId = useRef('');
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    galleries
      .list(controller.signal)
      .then(setItems)
      .catch((err) => {
        if (!controller.signal.aborted) setError(galleryError(err));
      });
    const refresh = (event: PageTransitionEvent) => {
      if (event.persisted) setAttempt((n) => n + 1);
    };
    window.addEventListener('pageshow', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('pageshow', refresh);
    };
  }, [attempt]);

  async function create() {
    setCreating(true);
    setError('');
    try {
      createId.current ||= crypto.randomUUID();
      const gallery = await galleries.create(createId.current);
      createId.current = '';
      window.location.assign('/workshop/' + gallery.id);
    } catch (err) {
      setError(galleryError(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="gallery-library" aria-labelledby="library-title">
      <div className="library-heading">
        <h2 id="library-title">My galleries</h2>
        <button className="library-create" type="button" onClick={create} disabled={creating}>
          <PlusIcon /> {creating ? 'Creating…' : 'New gallery'}
        </button>
      </div>
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" className="account-link" onClick={() => setAttempt((n) => n + 1)}>
            Refresh galleries
          </button>
        </p>
      )}
      {!items && !error && <p role="status">Loading galleries…</p>}
      {items?.length === 0 && <p>Create your first gallery to open the workshop.</p>}
      {items && items.length > 0 && (
        <ul className="library-list">
          {items.map((gallery) => (
            <li key={gallery.id}>
              <a href={'/workshop/' + gallery.id}>
                <strong>{gallery.name}</strong>
                <ArrowTopRightIcon />
                <small>
                  Edited{' '}
                  {new Date(gallery.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </small>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
