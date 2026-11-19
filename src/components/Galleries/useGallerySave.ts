import { useCallback, useEffect, useRef, useState } from 'react';
import type { GallerySetup, SavedGallery } from '../../lib/gallery.ts';
import { galleries, galleryError, GalleryRequestError } from '../../lib/gallery-client.ts';
import { gallerySetupFrom, useStore } from '../../store/store.ts';

// Transient editor state (wall selection, window size) is excluded from the snapshot.
const setupSnapshot = (state: ReturnType<typeof useStore.getState>) =>
  JSON.stringify(gallerySetupFrom(state));
const title = (value: string) => value.trim() || 'Untitled gallery';

type GalleryDraft = { name: string; setup: GallerySetup };

export function useGallerySave(gallery: SavedGallery) {
  const [name, setName] = useState(gallery.name);
  const currentName = useRef(name);
  const snapshot = useStore(setupSnapshot);
  const saved = useRef({ name: gallery.name, setup: snapshot, revision: gallery.revision });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<Promise<boolean> | null>(null);
  // A dropped response can leave a committed write unacknowledged.
  const unconfirmed = useRef<GalleryDraft | null>(null);
  const dirty =
    Boolean(unconfirmed.current) ||
    title(name) !== saved.current.name ||
    snapshot !== saved.current.setup;
  const hasChanges = useCallback(
    () =>
      Boolean(unconfirmed.current) ||
      title(currentName.current) !== saved.current.name ||
      setupSnapshot(useStore.getState()) !== saved.current.setup,
    [],
  );

  const save = useCallback((): Promise<boolean> => {
    if (pending.current) return pending.current;
    if (!hasChanges()) return Promise.resolve(true);
    const draft = {
      name: title(currentName.current),
      setup: gallerySetupFrom(useStore.getState()),
    };
    async function write(data: GalleryDraft) {
      unconfirmed.current = data;
      const { revision } = await galleries.save(
        gallery.id,
        saved.current.revision,
        data.name,
        data.setup,
      );
      saved.current = { name: data.name, setup: JSON.stringify(data.setup), revision };
      unconfirmed.current = null;
    }
    async function persist() {
      // Replay the exact write first so a retry can recover its revision even
      // when the user has already made more edits.
      if (unconfirmed.current) await write(unconfirmed.current);
      if (
        draft.name !== saved.current.name ||
        JSON.stringify(draft.setup) !== saved.current.setup
      ) {
        await write(draft);
      }
      return true;
    }
    setSaving(true);
    setError('');
    pending.current = persist()
      .catch((err) => {
        if (err instanceof GalleryRequestError && err.status < 500) unconfirmed.current = null;
        setError(galleryError(err));
        return false;
      })
      .finally(() => {
        pending.current = null;
        setSaving(false);
      });
    return pending.current;
  }, [gallery.id, hasChanges]);

  useEffect(() => {
    const timer = window.setInterval(() => void save(), 60_000);
    return () => window.clearInterval(timer);
  }, [save]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (hasChanges() || pending.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving, hasChanges]);

  return {
    name,
    dirty,
    saving,
    error,
    save,
    hasChanges,
    rename(value: string) {
      currentName.current = value;
      setName(value);
    },
  };
}
