import type { IncomingMessage, ServerResponse } from 'node:http';
import { toNodeHandler } from 'better-auth/node';
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
      if (pathname !== '/api/auth' && !pathname?.startsWith('/api/auth/')) return next();
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
        await handler(request, response);
      } catch {
        console.error('Authentication request failed.');
        if (!response.headersSent) {
          response.writeHead(500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ message: 'Unable to complete the account request.' }));
        } else response.end();
      }
    },
  };
}
