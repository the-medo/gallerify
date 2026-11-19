import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const firstPort = 5281;
const lastPort = 5290;
const worktreeId = (root) => createHash('sha256').update(root).digest('hex').slice(0, 12);

function readEnv(root) {
  try {
    return readFileSync(join(root, '.env.worktree'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const portFrom = (text) => Number(text?.match(/^GALLERIFY_DEV_PORT=(\d+)$/m)?.[1]);

export function configuredPort(root) {
  const text = readEnv(root);
  if (text === null) return null;
  const port = portFrom(text);
  // Status must still identify checkouts created with the original wider pool.
  if (
    text.match(/^GALLERIFY_WORKTREE_ID=([a-f0-9]{12})$/m)?.[1] !== worktreeId(root) ||
    !Number.isInteger(port) ||
    port < 5200 ||
    port > 5999
  ) {
    throw new Error(
      'Invalid or copied .env.worktree. Run down, remove .env.worktree, then run setup.',
    );
  }
  return port;
}

export function portAvailable(port, host) {
  const server = createServer();
  return new Promise((resolveAvailability, reject) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolveAvailability(false);
      else reject(error);
    });
    server.listen({ host, port }, () => server.close(() => resolveAvailability(true)));
  });
}

// Caller holds gallerify-worktree-dev.lock in the common Git directory.
export async function reservePort(root) {
  const current = configuredPort(root);
  if (current !== null) {
    if (current >= firstPort && current <= lastPort) return current;
    throw new Error(
      `Port ${current} is outside ${firstPort}–${lastPort}. Run down, remove .env.worktree, then reserve a new port and update the auth origin and Serve route.`,
    );
  }
  const entries = execFileSync('git', ['-C', root, 'worktree', 'list', '--porcelain', '-z'], {
    encoding: 'utf8',
  });
  const reserved = new Set(
    entries
      .split('\0')
      .filter((item) => item.startsWith('worktree '))
      .map((item) => portFrom(readEnv(item.slice(9)))),
  );
  for (let port = firstPort; port <= lastPort; port++) {
    // Also skip listeners on the Tailscale address when assigning a fresh slot.
    if (reserved.has(port) || !(await portAvailable(port, '0.0.0.0'))) continue;
    const path = join(root, '.env.worktree');
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(
      temporary,
      `# Generated for this worktree; do not copy or commit.\nGALLERIFY_WORKTREE_ID=${worktreeId(
        root,
      )}\nGALLERIFY_DEV_PORT=${port}\n`,
      { mode: 0o600 },
    );
    renameSync(temporary, path);
    return port;
  }
  throw new Error(
    `All Gallerify ports ${firstPort}–${lastPort} are reserved or in use. Reuse a configured worktree or release an unused reservation.`,
  );
}

// Standalone entry point for the skill to reserve a slot on older branches.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = realpathSync(
    execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(),
  );
  try {
    console.log(await reservePort(root));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
