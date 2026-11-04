import { loadEnv, type Plugin } from 'vite';
import { basename, resolve } from 'node:path';
import { migrateAuth } from './auth.ts';
import { readAuthConfig } from './config.ts';
import { createAuthMiddleware } from './middleware.ts';

export function authPlugin(): Plugin {
  return {
    name: 'gallerify-auth',
    config(config, { mode }) {
      const root = config.root || process.cwd();
      const env = { ...loadEnv(mode, root, ''), ...process.env };
      const database = resolve(root, env.DATABASE_PATH || '.gallerify/auth.sqlite');
      const allowedHosts = env.BETTER_AUTH_URL ? [new URL(env.BETTER_AUTH_URL).hostname] : [];
      return {
        preview: { allowedHosts },
        server: {
          allowedHosts,
          fs: {
            deny: [
              '.env',
              '.env.*',
              '*.{crt,pem}',
              '**/.git/**',
              '**/.gallerify/**',
              '**/server/**',
              '*.sqlite*',
              '*.db*',
              'auth-secret',
              basename(database),
              `${basename(database)}-*`,
            ],
          },
        },
      };
    },
    async configureServer(server) {
      const { root, mode } = server.config;
      const env = { ...loadEnv(mode, root, ''), ...process.env };
      const host = server.config.server.host === '127.0.0.1' ? '127.0.0.1' : 'localhost';
      const config = readAuthConfig(env, {
        root,
        developmentURL: `http://${host}:${server.config.server.port || 5173}`,
      });
      await migrateAuth(config);
      const middleware = createAuthMiddleware(config);
      server.middlewares.use((req, res, next) => {
        void middleware.handle(req, res, next);
      });
      server.httpServer?.once('close', middleware.close);
    },
    configurePreviewServer(server) {
      // Preview uses the same persisted accounts, but never applies migrations.
      const { root, mode } = server.config;
      const config = readAuthConfig(
        { ...loadEnv(mode, root, ''), ...process.env },
        {
          root,
          developmentURL: `http://localhost:${server.config.preview.port || 4173}`,
        },
      );
      const middleware = createAuthMiddleware(config);
      server.middlewares.use((req, res, next) => {
        void middleware.handle(req, res, next);
      });
      server.httpServer.once('close', middleware.close);
    },
  };
}
