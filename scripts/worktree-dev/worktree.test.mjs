import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(path, 'utf8');
const statePath = (path) => join(path, '.gallerify/server.json');
const state = (path) => JSON.parse(read(statePath(path)));
const envPath = (path) => join(path, '.env.worktree');
const port = (path) => Number(read(envPath(path)).match(/^GALLERIFY_DEV_PORT=(\d+)$/m)[1]);
const run = async (path, command) =>
  (
    await exec(join(path, 'scripts/worktree-dev/gallerify-worktree-dev'), [command], {
      cwd: '/',
      timeout: 40000,
    })
  ).stdout;
const get = async (port, path = '/') => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    signal: AbortSignal.timeout(2000),
  });
  assert.equal(response.status, 200);
  return response.text();
};

test(
  'managed worktrees preserve configuration and isolate ports and processes',
  { timeout: 90000 },
  async (t) => {
    assert.ok(
      existsSync(join(root, 'node_modules/vite/package.json')),
      'Run bootstrap before testing.',
    );
    // Keep even temporary Git worktrees inside the Gallerify workspace.
    const fixture = mkdtempSync(join(dirname(root), '.gallerify-worktree-test-'));
    const base = join(fixture, 'main');
    const first = join(fixture, 'first worktree');
    const second = join(fixture, 'second');
    let occupied;
    t.after(async () => {
      if (occupied?.listening) await new Promise((resolveClose) => occupied.close(resolveClose));
      for (const path of [first, second]) {
        if (existsSync(join(path, '.git'))) await run(path, 'down');
      }
      rmSync(fixture, { recursive: true, force: true });
    });
    mkdirSync(base);
    cpSync(join(root, 'scripts'), join(base, 'scripts'), { recursive: true });
    for (const name of ['.env.example', '.gitignore'])
      copyFileSync(join(root, name), join(base, name));
    writeFileSync(join(base, 'package.json'), '{"type":"module"}\n');
    writeFileSync(
      join(base, 'index.html'),
      '<!doctype html><title>Worktree fixture</title><script type="module" src="/probe.js"></script>',
    );
    writeFileSync(join(base, 'probe.js'), 'export default import.meta.env.VITE_FIXTURE_LABEL;');
    const git = async (...args) => exec('git', ['-C', base, ...args]);
    await git('init', '-b', 'main');
    await git('config', 'core.hooksPath', '/dev/null');
    await git('add', '.');
    await git(
      '-c',
      'user.name=Worktree test',
      '-c',
      'user.email=worktree-test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'Local lifecycle fixture',
    );
    writeFileSync(join(base, '.env.local'), 'VITE_BASE_ONLY=do-not-copy\n');
    await git('worktree', 'add', '--detach', first);
    await git('worktree', 'add', '--detach', second);
    for (const path of [first, second])
      symlinkSync(join(root, 'node_modules'), join(path, 'node_modules'), 'dir');

    await t.test(
      'status does not provision; setup skips an occupied port and preserves env',
      async () => {
        assert.match(await run(first, 'status'), /not configured/);
        assert.equal(existsSync(join(first, '.gallerify')), false);
        assert.equal(existsSync(envPath(first)), false);
        const id = createHash('sha256').update(first).digest('hex').slice(0, 12);
        const initialPort = 5200 + (parseInt(id.slice(0, 6), 16) % 800);
        occupied = createServer();
        occupied.listen(initialPort, '127.0.0.1');
        await once(occupied, 'listening');
        await run(first, 'setup');
        assert.notEqual(port(first), initialPort);
        await new Promise((resolveClose) => occupied.close(resolveClose));
        assert.equal(read(join(first, '.env.local')), read(join(root, '.env.example')));
        const customEnv = 'VITE_FIXTURE_LABEL=local-edit\n';
        writeFileSync(join(first, '.env.local'), customEnv);
        const original = read(envPath(first));
        await Promise.all([run(first, 'setup'), run(second, 'setup'), run(first, 'setup')]);
        assert.equal(read(envPath(first)), original);
        assert.equal(read(join(first, '.env.local')), customEnv);
        assert.notEqual(port(first), port(second));
        assert.equal(existsSync(statePath(first)), false);
        const ignored = (
          await exec('git', [
            '-C',
            first,
            'check-ignore',
            '.env.local',
            '.env.worktree',
            '.gallerify/',
          ])
        ).stdout;
        assert.match(ignored, /\.env.local/);
        assert.match(ignored, /\.env.worktree/);
        assert.match(ignored, /\.gallerify\//);
      },
    );

    await t.test(
      'concurrent up serves distinct identities and local env; repeat up reuses its PID',
      async () => {
        await Promise.all([run(first, 'up'), run(second, 'up'), run(first, 'up')]);
        assert.notEqual(state(first).pid, state(second).pid);
        assert.match(await get(port(first)), /Worktree fixture/);
        assert.match(await get(port(first), '/probe.js'), /local-edit/);
        assert.equal(await get(port(first), '/__gallerify_worktree_health'), state(first).token);
        assert.equal(await get(port(second), '/__gallerify_worktree_health'), state(second).token);
        const firstPid = state(first).pid;
        assert.match(await run(first, 'up'), /Already running/);
        assert.equal(state(first).pid, firstPid);
        assert.match(await run(first, 'status'), /State: running/);
        assert.match(await run(first, 'logs'), /127\.0\.0\.1/);
      },
    );

    await t.test('down preserves the other worktree and local configuration', async () => {
      const original = read(envPath(first));
      await run(first, 'down');
      assert.equal(existsSync(statePath(first)), false);
      assert.equal(read(envPath(first)), original);
      assert.match(read(join(first, '.env.local')), /local-edit/);
      assert.match(await run(first, 'status'), /State: stopped/);
      assert.match(await get(port(second)), /Worktree fixture/);
    });

    await t.test('stale metadata cannot stop another worktree or an unrelated PID', async () => {
      writeFileSync(statePath(first), JSON.stringify(state(second)));
      assert.match(await run(first, 'status'), /Stale process state/);
      await run(first, 'down');
      assert.match(await get(port(second)), /Worktree fixture/);
      writeFileSync(
        statePath(first),
        JSON.stringify({ pid: process.pid, token: 'stale', port: port(first) }),
      );
      await run(first, 'down');
      assert.equal(existsSync(statePath(first)), false);
      assert.ok(process.kill(process.pid, 0));
    });

    await t.test(
      'occupied persisted port and copied env fail without touching the owner',
      async () => {
        const original = read(envPath(first));
        try {
          writeFileSync(
            envPath(first),
            original.replace(/^GALLERIFY_DEV_PORT=\d+$/m, `GALLERIFY_DEV_PORT=${port(second)}`),
          );
          await assert.rejects(run(first, 'up'), /occupied/);
          assert.equal(existsSync(statePath(first)), false);
          assert.match(await get(port(second)), /Worktree fixture/);
          writeFileSync(envPath(first), read(envPath(second)));
          await assert.rejects(run(first, 'setup'), /Invalid or copied/);
        } finally {
          writeFileSync(envPath(first), original);
        }
      },
    );

    await t.test('failed startup cleans process state and retains a useful log', async () => {
      const configPath = join(first, 'vite.config.mjs');
      writeFileSync(configPath, 'throw new Error("intentional-startup-failure");');
      try {
        await assert.rejects(run(first, 'up'), /did not become ready/);
        assert.equal(existsSync(statePath(first)), false);
        assert.match(await run(first, 'logs'), /intentional-startup-failure/);
        assert.match(await get(port(second)), /Worktree fixture/);
      } finally {
        rmSync(configPath);
      }
      await run(first, 'up');
      assert.match(await get(port(first)), /Worktree fixture/);
      await run(first, 'down');
      await run(first, 'down');
    });
  },
);
