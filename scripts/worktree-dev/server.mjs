import { createServer } from 'vite';

const [, , token, port] = process.argv;
if (!token || !port) throw new Error('Start the server with gallerify-worktree-dev up.');

const server = await createServer({
  root: process.cwd(),
  mode: 'worktree',
  clearScreen: false,
  server: { host: '127.0.0.1', port: Number(port), strictPort: true, open: false },
  plugins: [
    {
      name: 'gallerify-worktree-health',
      configureServer(vite) {
        vite.middlewares.use('/__gallerify_worktree_health', (_request, response) => {
          response.setHeader('Content-Type', 'text/plain');
          response.setHeader('Cache-Control', 'no-store');
          response.end(token);
        });
      },
    },
  ],
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await server.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
await server.listen();
server.printUrls();
