import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGalleries } from './galleries.ts';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { createAuth } from './auth.ts';
import type { AuthConfig } from './config.ts';

export function createAuthMiddleware(config: AuthConfig) {
  const { auth, database } = createAuth(config);
  const handler = toNodeHandler(auth);
  return {
    close: () => {
      if (database.isOpen) database.close();
    },
    async handle(request: IncomingMessage, response: ServerResponse, next: () => void) {
      const pathname = request.url?.split('?')[0];
      const galleries = pathname === '/api/galleries' || pathname?.startsWith('/api/galleries/');
      if (!galleries && pathname !== '/api/auth' && !pathname?.startsWith('/api/auth/'))
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
        if (galleries && pathname) {
          const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
          if (!session) {
            response.writeHead(401, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ message: 'Sign in to access your galleries.' }));
            return;
          }
          await handleGalleries(
            request,
            response,
            database,
            session.user.id,
            pathname,
            config.baseURL,
          );
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
