import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];

// Share only the Google application's credentials, never per-worktree secrets,
// URLs, ports, database paths, or the rest of another checkout's environment.
export function syncGoogleEnv(sourceRoot, targetRoot, { overwrite = false } = {}) {
  const sourcePath = join(sourceRoot, '.env.local');
  const targetPath = join(targetRoot, '.env.local');
  if (sourcePath === targetPath || !existsSync(sourcePath)) return false;
  const source = parseEnv(readFileSync(sourcePath, 'utf8'));
  if (!keys.every((key) => source[key]?.trim())) return false;
  if (keys.some((key) => /[\r\n]/.test(source[key]))) {
    throw new Error('Google OAuth credentials must each be a single line.');
  }
  const original = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';
  const current = parseEnv(original);
  // A partial/custom pair must not be combined with a different Google client.
  if (!overwrite && keys.some((key) => current[key]?.trim())) return false;
  if (keys.every((key) => current[key] === source[key])) return false;
  const remaining = original
    .split('\n')
    .filter((line) => !/^\s*(?:export\s+)?GOOGLE_CLIENT_(?:ID|SECRET)\s*=/.test(line))
    .join('\n')
    .replace(/\n*$/, '\n');
  const updated =
    remaining + keys.map((key) => `${key}=${JSON.stringify(source[key])}`).join('\n') + '\n';
  const temporary = `${targetPath}.${process.pid}.tmp`;
  writeFileSync(temporary, updated, { mode: 0o600 });
  renameSync(temporary, targetPath);
  chmodSync(targetPath, 0o600);
  return true;
}
