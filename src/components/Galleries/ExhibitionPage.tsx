import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { Exhibition } from '../../lib/publication.ts';
import { artworkMediaUrl, type DisplayArtwork } from '../../lib/artwork.ts';
import ArtworkInspection from '../Artwork/ArtworkInspection.tsx';
import './galleries.css';
import './publication.css';

const GalleryWalk = lazy(() => import('../Walking/GalleryWalk.tsx'));

// Keep the collection and its artwork dialogs usable if the renderer fails.
class WalkBoundary extends Component<{ children: ReactNode; onFailure: () => void }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function ExhibitionPage({ slug }: { slug: string }) {
  const [exhibit, setExhibit] = useState<Exhibition | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [walking, setWalking] = useState(false);
  const [walkFailed, setWalkFailed] = useState(false);
  const [selected, setSelected] = useState<DisplayArtwork | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    async function open() {
      try {
        const response = await fetch('/api/exhibitions/' + encodeURIComponent(slug), {
          signal: controller.signal,
          credentials: 'omit',
        });
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? 'This exhibition is unavailable.'
              : 'The exhibition could not be loaded.',
          );
        const data: Exhibition = await response.json();
        if (!controller.signal.aborted) setExhibit(data);
      } catch (err) {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'The exhibition could not be loaded.');
      }
    }
    void open();
    return () => controller.abort();
  }, [slug, attempt]);
  if (!exhibit)
    return (
      <main className="app-shell exhibition">
        <h1>{error || 'Opening exhibition…'}</h1>
        {error && <button onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
      </main>
    );
  const { details, artworks, scene } = exhibit;
  return (
    <main className="app-shell exhibition">
      <header className="exhibition-intro">
        <div>
          {details.artist && <p className="exhibition-artist">{details.artist}</p>}
          <h1>{details.title}</h1>
          {details.introduction && <p>{details.introduction}</p>}
          {details.bio && <p>{details.bio}</p>}
          {details.contact && (
            <p>
              <a href={details.contact} rel="noreferrer">
                Artist website ↗
              </a>
            </p>
          )}
          <button
            className="library-create"
            onClick={() => {
              const probe = document.createElement('canvas');
              const gl = probe.getContext('webgl2') || probe.getContext('webgl');
              if (!gl) {
                setWalkFailed(true);
                return;
              }
              gl.getExtension('WEBGL_lose_context')?.loseContext();
              setWalkFailed(false);
              setWalking(true);
            }}
          >
            Enter gallery
          </button>
          {walkFailed && (
            <p role="status">The 3D view is unavailable. Select an artwork below to inspect it.</p>
          )}
        </div>
        <img className="exhibition-cover" src={'/api/exhibitions/' + slug + '/cover'} alt="" />
      </header>
      <section aria-labelledby="collection-title">
        <h2 id="collection-title">Artworks</h2>
        <div className="exhibition-grid">
          {artworks.map((art) => (
            <button
              key={art.id}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setSelected(art)}
            >
              <img loading="lazy" alt="" src={artworkMediaUrl(art, 'thumbnail', slug)} />
              <strong>{art.title}</strong>
              {art.medium && <span>{art.medium}</span>}
            </button>
          ))}
        </div>
      </section>
      {walking && (
        <WalkBoundary
          onFailure={() => {
            setWalkFailed(true);
            setWalking(false);
          }}
        >
          <Suspense fallback={<p role="status">Loading 3D view…</p>}>
            <GalleryWalk
              name={details.title}
              setup={scene}
              slug={slug}
              artworks={Object.fromEntries(artworks.map((a) => [a.id, a]))}
              onExit={() => setWalking(false)}
            />
          </Suspense>
        </WalkBoundary>
      )}
      {selected && (
        <ArtworkInspection artwork={selected} slug={slug} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
