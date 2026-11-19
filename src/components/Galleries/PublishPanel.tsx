import { useEffect, useRef, useState } from 'react';
import { galleries, galleryError } from '../../lib/gallery-client.ts';
import {
  displayedArtwork,
  exhibitionScene,
  type ExhibitionDetails,
  type PublicationStatus,
} from '../../lib/publication.ts';
import { gallerySetupFrom, useStore } from '../../store/store.ts';
import './publication.css';

const initialDetails: ExhibitionDetails = {
  title: '',
  introduction: '',
  visibility: 'unlisted',
  artist: '',
  bio: '',
  contact: '',
};

// Database validation and the editor may create identical objects in different key orders.
function comparable(value: unknown): string {
  return JSON.stringify(value, (_, entry) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.keys(entry)
            .sort()
            .map((key) => [key, entry[key]]),
        )
      : entry,
  );
}

export default function PublishPanel({
  id,
  name,
  visible,
  prepare,
}: {
  id: string;
  name: string;
  visible: boolean;
  prepare: () => Promise<number | null>;
}) {
  const [status, setStatus] = useState<PublicationStatus | null>(null);
  const [details, setDetails] = useState(initialDetails);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const editedDetails = useRef(false);
  const link = useRef<HTMLInputElement>(null);
  const setup = useStore(gallerySetupFrom);
  const library = useStore((state) => state.artworks);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    galleries
      .publication(id, controller.signal)
      .then((record) => {
        if (controller.signal.aborted) return;
        setStatus(record);
        if (!editedDetails.current) setDetails(record.details ?? initialDetails);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(galleryError(err));
      });
    return () => controller.abort();
  }, [id, attempt]);
  const visitorUrl = status?.live ? window.location.origin + '/g/' + status.slug : '';
  const settings = { ...details, title: details.title.trim() || name.trim() || 'Untitled gallery' };
  const ids = [...new Set(setup.placements.map((p) => p.artworkId))];
  const changed =
    visible &&
    status?.live &&
    comparable(status.live) !==
      comparable({
        details: settings,
        scene: exhibitionScene(setup),
        artworks: ids.map((id) => library[id] && displayedArtwork(library[id])),
      });
  function update(key: keyof ExhibitionDetails, value: string) {
    editedDetails.current = true;
    setDetails((old) => ({ ...old, [key]: value }));
    setFeedback('');
  }
  async function changePublication(remove: boolean) {
    if (!status) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      let record: PublicationStatus;
      if (remove) record = await galleries.unpublish(id, status.generation);
      else {
        const revision = await prepare();
        if (revision === null) {
          setError(
            'The draft could not be saved for publication. Check your changes and try again.',
          );
          return;
        }
        record = await galleries.publish(id, revision, status.generation, settings);
      }
      setStatus(record);
      if (!remove && record.details) {
        setDetails(record.details);
        editedDetails.current = false;
      }
    } catch (err) {
      setError(galleryError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="publish-panel" aria-label="Exhibition sharing">
      <h2>Share exhibition</h2>
      <p role="status">
        {busy
          ? 'Updating publication…'
          : !status
          ? 'Loading publication…'
          : status.live
          ? changed
            ? 'Unpublished changes'
            : 'Published'
          : status.slug
          ? 'Unpublished'
          : 'Never published'}
      </p>
      {error && (
        <div role="alert">
          {error}{' '}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Refresh status
          </button>
        </div>
      )}
      {status && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void changePublication(false);
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Exhibition title
              <input
                maxLength={160}
                value={details.title}
                placeholder={settings.title}
                onChange={(e) => update('title', e.target.value)}
              />
            </label>
            <label>
              Introduction
              <textarea
                maxLength={2000}
                rows={3}
                value={details.introduction}
                onChange={(e) => update('introduction', e.target.value)}
              />
            </label>
            <label>
              Visibility
              <select
                value={details.visibility}
                onChange={(e) => update('visibility', e.target.value)}
              >
                <option value="unlisted">Unlisted · anyone with the link</option>
                <option value="public">Public · allow search indexing</option>
              </select>
            </label>
            <details>
              <summary>Artist information</summary>
              <label>
                Display name
                <input
                  maxLength={120}
                  value={details.artist}
                  onChange={(e) => update('artist', e.target.value)}
                />
              </label>
              <label>
                Artist bio
                <textarea
                  maxLength={1000}
                  value={details.bio}
                  onChange={(e) => update('bio', e.target.value)}
                />
              </label>
              <label>
                Website
                <input
                  type="url"
                  maxLength={500}
                  value={details.contact}
                  onChange={(e) => update('contact', e.target.value)}
                />
              </label>
            </details>
            {!ids.length && <p>Hang an artwork to publish your exhibition.</p>}
            <button
              className="library-create"
              type="submit"
              disabled={!ids.length || (!!status.live && !changed)}
            >
              {status.live ? 'Publish changes' : 'Publish exhibition'}
            </button>
          </fieldset>
        </form>
      )}
      {visitorUrl && (
        <div className="published-link">
          <label>
            Visitor link
            <input readOnly ref={link} value={visitorUrl} onFocus={(e) => e.target.select()} />
          </label>
          <div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(visitorUrl);
                  setFeedback('Link copied.');
                } catch {
                  link.current?.focus();
                  link.current?.select();
                  setFeedback('Link selected. Use your device’s Copy command.');
                }
              }}
            >
              Copy link
            </button>{' '}
            <a href={visitorUrl} target="_blank" rel="noreferrer">
              Open visitor view ↗
            </a>
          </div>
          <span role="status">{feedback}</span>
          <button type="button" disabled={busy} onClick={() => void changePublication(true)}>
            Unpublish
          </button>
        </div>
      )}
    </section>
  );
}
