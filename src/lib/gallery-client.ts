import type { GallerySetup, GallerySummary, SavedGallery } from './gallery.ts';

export class GalleryRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api/galleries' + path, options);
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new GalleryRequestError(
      response.status,
      error?.message || 'The gallery service is unavailable.',
    );
  }
  return response.json();
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const galleries = {
  list: (signal: AbortSignal) => request<GallerySummary[]>('', { signal }),
  create: (id: string) => request<{ id: string }>('', json('POST', { id })),
  get: (id: string, signal: AbortSignal) => request<SavedGallery>('/' + id, { signal }),
  save: (id: string, revision: number, name: string, setup: GallerySetup) =>
    request<Pick<SavedGallery, 'revision' | 'updatedAt'>>(
      '/' + id,
      json('PUT', { revision, name, setup }),
    ),
};

export const galleryError = (error: unknown) =>
  error instanceof GalleryRequestError
    ? error.message
    : 'Could not reach your galleries. Please try again.';
