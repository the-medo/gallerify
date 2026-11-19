import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { handleExhibition, handlePublication, ownerPublicationPath } from './publications.ts';
import { handleGalleries } from './galleries.ts';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { createAuth } from './auth.ts';
import type { AuthConfig } from './config.ts';
import { createArtworkStorage } from './artwork-storage.ts';
import { createArtworkHandler } from './artworks.ts';

export function createAuthMiddleware(
  config: AuthConfig,
  indexHtml: (url: string) => Promise<string> = () => readFile('dist/index.html', 'utf8'),
) {
  const { auth, database } = createAuth(config);
  const handler = toNodeHandler(auth);
  const artworkStorage = createArtworkStorage(config.artworkStorage);
  const handleArtworks = createArtworkHandler(database, artworkStorage);
  return {
    close: () => {
      artworkStorage.close();
      if (database.isOpen) database.close();
    },
    async handle(request: IncomingMessage, response: ServerResponse, next: () => void) {
      const pathname = request.url?.split('?')[0];
      const galleries = pathname === '/api/galleries' || pathname?.startsWith('/api/galleries/');
      const artworks = pathname === '/api/artworks' || pathname?.startsWith('/api/artworks/');
      const exhibition = pathname?.startsWith('/g/') || pathname?.startsWith('/api/exhibitions/');
      if (
        !exhibition &&
        !galleries &&
        !artworks &&
        pathname !== '/api/auth' &&
        !pathname?.startsWith('/api/auth/')
      )
        return next();
      response.setHeader('Cache-Control', 'no-store');
      if (pathname === '/api/auth/providers' && request.method === 'GET') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ google: Boolean(config.google) }));
        return;
      }
      // Ignore spoofable forwarding headers; deployment may add trusted proxy
      // handling once its network topology is known.
      request.headers['x-gallerify-client-ip'] = request.socket.remoteAddress || '';
      try {
        if (exhibition && pathname) {
          await handleExhibition(
            request,
            response,
            database,
            artworkStorage,
            pathname,
            config.baseURL,
            indexHtml,
          );
          return;
        }
        if ((galleries || artworks) && pathname) {
          const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
          if (!session) {
            response.writeHead(401, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ message: 'Sign in to access your galleries.' }));
            return;
          }
          const publication = ownerPublicationPath.exec(pathname);
          if (publication) {
            await handlePublication(
              request,
              response,
              database,
              artworkStorage,
              session.user.id,
              publication[1],
              config.baseURL,
            );
            return;
          }
          await (artworks
            ? handleArtworks(request, response, session.user.id, pathname, config.baseURL)
            : handleGalleries(
                request,
                response,
                database,
                session.user.id,
                pathname,
                config.baseURL,
              ));
        } else await handler(request, response);
      } catch {
        console.error('Account or gallery request failed.');
        if (!response.headersSent) {
          response.writeHead(500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ message: 'Unable to complete the request.' }));
        } else response.end();
      }
    },
  };
}
