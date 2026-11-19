import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
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
import { portAvailable } from './ports.mjs';

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
        let initialPort = 5281;
        while (initialPort <= 5290 && !(await portAvailable(initialPort, '0.0.0.0'))) initialPort++;
        assert.ok(initialPort < 5290, 'The lifecycle fixture needs two available pool ports.');
        occupied = createServer();
        occupied.listen(initialPort, '127.0.0.1');
        await once(occupied, 'listening');
        await run(first, 'setup');
        assert.ok(port(first) > initialPort && port(first) <= 5290);
        await new Promise((resolveClose) => occupied.close(resolveClose));
        assert.equal(read(join(first, '.env.local')), read(join(root, '.env.example')));
        const customEnv = 'VITE_FIXTURE_LABEL=local-edit\n';
        writeFileSync(join(first, '.env.local'), customEnv);
        const original = read(envPath(first));
        await Promise.all([run(first, 'setup'), run(second, 'setup'), run(first, 'setup')]);
        assert.equal(read(envPath(first)), original);
        assert.equal(read(join(first, '.env.local')), customEnv);
        assert.equal(port(second), initialPort);
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

    await t.test(
      'legacy assignments remain visible and cannot start outside the pool',
      async () => {
        const original = read(envPath(first));
        try {
          writeFileSync(
            envPath(first),
            original.replace(/^GALLERIFY_DEV_PORT=\d+$/m, 'GALLERIFY_DEV_PORT=5976'),
          );
          assert.match(await run(first, 'status'), /127\.0\.0\.1:5976/);
          await assert.rejects(run(first, 'up'), /outside 5281–5290/);
          assert.equal(existsSync(statePath(first)), false);
        } finally {
          writeFileSync(envPath(first), original);
        }
      },
    );

    await t.test('all ten reservations exhaust the pool and removal releases a slot', async () => {
      const candidate = join(fixture, 'candidate');
      await git('worktree', 'add', '--detach', candidate);
      const available = port(first);
      const slots = [];
      for (let slot = 5281; slot <= 5290; slot++) {
        if ([available, port(second)].includes(slot)) continue;
        const path = join(fixture, 'reserved-' + slot);
        await git('worktree', 'add', '--detach', path);
        writeFileSync(envPath(path), 'GALLERIFY_DEV_PORT=' + slot + '\n');
        slots.push(path);
      }
      await assert.rejects(run(candidate, 'setup'), /All Gallerify ports 5281–5290/);
      assert.equal(existsSync(envPath(candidate)), false);
      // A stopped checkout keeps its slot. Releasing its reservation makes it reusable.
      const original = read(envPath(first));
      rmSync(envPath(first));
      try {
        await run(candidate, 'setup');
        assert.equal(port(candidate), available);
      } finally {
        await git('worktree', 'remove', '--force', candidate);
        writeFileSync(envPath(first), original);
        for (const path of slots) await git('worktree', 'remove', '--force', path);
      }
    });

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
