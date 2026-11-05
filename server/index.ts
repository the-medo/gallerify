import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sirv from 'sirv';
import { readAuthConfig } from './config.ts';
import { createAuthMiddleware } from './middleware.ts';

const config = readAuthConfig(process.env);
const dist = resolve('dist');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Run yarn build before yarn start.');
const middleware = createAuthMiddleware(config);
const assets = sirv(dist, { etag: true, single: true });
const server = createServer((request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  void middleware.handle(request, response, () => {
    if (request.url?.startsWith('/api/')) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: 'Not found' }));
    } else assets(request, response);
  });
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
  console.log(`Gallerify listening on ${JSON.stringify(server.address())}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () =>
    server.close(() => {
      middleware.close();
      process.exit(0);
    }),
  );
}
