import type { Artwork, ArtworkDetails } from './artwork.ts';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api/artworks' + path, options);
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.message || 'Could not load your artwork. Please try again.');
  return body;
}

export const artworks = {
  list: (signal?: AbortSignal) => request<Artwork[]>('', { signal }),
  update: (id: string, details: ArtworkDetails) =>
    request<Artwork>('/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    }),
  remove: (id: string) => request<{ deleted: boolean }>('/' + id, { method: 'DELETE' }),
  upload(
    id: string,
    file: File,
    onProgress: (percent: number) => void,
    signal?: AbortSignal,
  ): Promise<Artwork> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const cleanup = () => signal?.removeEventListener('abort', abort);
      xhr.open('PUT', `/api/artworks/${id}/content`);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('X-Artwork-Filename', encodeURIComponent(file.name));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        cleanup();
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(body);
          else reject(new Error(body.message || 'Upload failed. Please retry.'));
        } catch {
          reject(new Error('Upload failed. Please retry.'));
        }
      };
      xhr.onerror = () => {
        cleanup();
        reject(new Error('Connection lost. Retry this upload to continue.'));
      };
      xhr.onabort = () => {
        cleanup();
        reject(new Error('Upload cancelled.'));
      };
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) {
        cleanup();
        reject(new Error('Upload cancelled.'));
        return;
      }
      xhr.send(file);
    });
  },
};
