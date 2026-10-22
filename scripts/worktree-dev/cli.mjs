import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
const id = createHash('sha256').update(root).digest('hex').slice(0, 12);
const stateDir = join(root, '.gallerify');
const envPath = join(root, '.env.worktree');
const processPath = join(stateDir, 'server.json');
const logPath = join(stateDir, 'vite.log');
const serverPath = join(root, 'scripts/worktree-dev/server.mjs');
const host = '127.0.0.1';
const url = (port) => `http://${host}:${port}`;

function readOptional(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function atomicWrite(path, content) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content, { mode: 0o600 });
  renameSync(temporary, path);
}

function config() {
  const text = readOptional(envPath);
  if (text === null) return null;
  const worktreeId = text.match(/^GALLERIFY_WORKTREE_ID=([a-f0-9]{12})$/m)?.[1];
  const port = Number(text.match(/^GALLERIFY_DEV_PORT=(\d+)$/m)?.[1]);
  if (worktreeId !== id || !Number.isInteger(port) || port < 5200 || port > 5999) {
    throw new Error(
      'Invalid or copied .env.worktree. Run down, remove .env.worktree, then run setup.',
    );
  }
  return { port };
}

function processState() {
  const text = readOptional(processPath);
  if (text === null) return null;
  const state = JSON.parse(text);
  if (
    !Number.isInteger(state.pid) ||
    state.pid < 1 ||
    typeof state.token !== 'string' ||
    !state.token
  ) {
    throw new Error(
      'Invalid .gallerify/server.json; inspect the process before removing this file.',
    );
  }
  return state;
}

// A PID alone is insufficient: it can be reused by an unrelated process.
function ownsProcess(state) {
  if (!state) return false;
  try {
    const args = readFileSync(`/proc/${state.pid}/cmdline`, 'utf8').split('\0');
    return (
      args[1] === serverPath &&
      args[2] === state.token &&
      realpathSync(`/proc/${state.pid}/cwd`) === root
    );
  } catch (error) {
    if (['ENOENT', 'ESRCH'].includes(error.code)) return false;
    throw error;
  }
}

async function portAvailable(port) {
  const server = createServer();
  return new Promise((resolveAvailability, reject) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolveAvailability(false);
      else reject(error);
    });
    server.listen({ host, port }, () => server.close(() => resolveAvailability(true)));
  });
}

async function setup() {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  try {
    copyFileSync(join(root, '.env.example'), join(root, '.env.local'), constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  let settings = config();
  if (!settings) {
    const worktrees = execFileSync('git', ['-C', root, 'worktree', 'list', '--porcelain', '-z'], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter((entry) => entry.startsWith('worktree '))
      .map((entry) => entry.slice(9));
    const reserved = new Set(
      worktrees.map((path) =>
        Number(
          readOptional(join(path, '.env.worktree'))?.match(/^GALLERIFY_DEV_PORT=(\d+)$/m)?.[1],
        ),
      ),
    );
    const offset = parseInt(id.slice(0, 6), 16) % 800;
    for (let i = 0; i < 800; i++) {
      const port = 5200 + ((offset + i) % 800);
      if (!reserved.has(port) && (await portAvailable(port))) {
        settings = { port };
        atomicWrite(
          envPath,
          `# Generated for this worktree; do not copy or commit.\nGALLERIFY_WORKTREE_ID=${id}\nGALLERIFY_DEV_PORT=${port}\n`,
        );
        break;
      }
    }
    if (!settings) throw new Error('No free worktree port in 5200–5999.');
  }
  return settings;
}

async function ready(state) {
  if (!ownsProcess(state)) return false;
  try {
    const response = await fetch(`${url(state.port)}/__gallerify_worktree_health`, {
      signal: AbortSignal.timeout(500),
    });
    return response.ok && (await response.text()) === state.token && ownsProcess(state);
  } catch {
    return false;
  }
}

async function stop(state) {
  if (!ownsProcess(state)) return;
  process.kill(state.pid, 'SIGTERM');
  for (let i = 0; i < 50 && ownsProcess(state); i++) await delay(100);
  if (ownsProcess(state)) {
    process.kill(state.pid, 'SIGKILL');
    for (let i = 0; i < 20 && ownsProcess(state); i++) await delay(100);
  }
  if (ownsProcess(state)) throw new Error(`Unable to stop owned process ${state.pid}.`);
}

async function up() {
  const settings = await setup();
  const previous = processState();
  if (ownsProcess(previous)) {
    if (previous.port !== settings.port)
      throw new Error('Port changed while running. Run down, then up.');
    if (!(await ready(previous)))
      throw new Error(`Managed server is not responding. See ${logPath}; run down, then up.`);
    console.log(`Already running: ${url(previous.port)}`);
    return;
  }
  rmSync(processPath, { force: true });
  if (!existsSync(join(root, 'node_modules/vite/package.json'))) {
    throw new Error(
      'Dependencies are missing. Run scripts/worktree-dev/bootstrap-worktree.sh first.',
    );
  }
  if (!(await portAvailable(settings.port))) {
    throw new Error(
      `Port ${settings.port} is occupied. Stop its owner, or remove .env.worktree and run setup to choose another port.`,
    );
  }
  const token = randomUUID();
  const log = openSync(logPath, 'a', 0o600);
  const child = spawn(process.execPath, [serverPath, token, String(settings.port)], {
    cwd: root,
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  closeSync(log);
  await new Promise((resolveSpawn, reject) => {
    child.once('spawn', resolveSpawn);
    child.once('error', reject);
  });
  child.unref();
  const state = { pid: child.pid, token, port: settings.port };
  try {
    atomicWrite(processPath, JSON.stringify(state, null, 2) + '\n');
    for (let i = 0; i < 100; i++) {
      if (await ready(state)) {
        console.log(`Running: ${url(settings.port)}\nLog: ${logPath}`);
        return;
      }
      if (!ownsProcess(state)) break;
      await delay(100);
    }
    throw new Error(`Vite did not become ready. See ${logPath}.`);
  } catch (error) {
    await stop(state);
    rmSync(processPath, { force: true });
    throw error;
  }
}

async function main() {
  if (process.platform !== 'linux')
    throw new Error(
      'The managed launcher supports Linux/WSL (/proc). Use yarn dev on other platforms.',
    );
  if (Number(process.versions.node.split('.')[0]) !== 24)
    throw new Error('Use Node.js 24 (see .node-version).');
  const [command = 'help', ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Unexpected arguments. Use help for supported commands.');
  switch (command) {
    case 'setup': {
      const settings = await setup();
      console.log(
        `Configured: ${url(settings.port)}\nEnvironment: ${envPath}\nRun up to start Vite.`,
      );
      break;
    }
    case 'up':
      await up();
      break;
    case 'down': {
      const state = processState();
      const owned = ownsProcess(state);
      await stop(state);
      rmSync(processPath, { force: true });
      console.log(
        owned ? 'Stopped this worktree server.' : 'No owned server running; stale state cleared.',
      );
      break;
    }
    case 'status': {
      const settings = config();
      const state = processState();
      console.log(`Worktree: ${root}`);
      console.log(
        `State: ${(await ready(state)) ? 'running' : ownsProcess(state) ? 'unhealthy' : 'stopped'}`,
      );
      console.log(`URL: ${settings ? url(settings.port) : 'not configured (run setup)'}`);
      if (state && !ownsProcess(state))
        console.log(
          'Stale process state; up/down will clear it without stopping unrelated processes.',
        );
      if (existsSync(logPath)) console.log(`Log: ${logPath}`);
      break;
    }
    case 'logs': {
      if (!existsSync(logPath)) console.log('No log yet. Run up first.');
      else process.stdout.write(execFileSync('tail', ['-n', '80', logPath]));
      break;
    }
    case 'help':
    case '--help':
    case '-h':
      console.log('Usage: scripts/worktree-dev/gallerify-worktree-dev <setup|up|status|logs|down>');
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
