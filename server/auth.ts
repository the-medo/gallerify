import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { galleryMigration } from './galleries.ts';
import { publicationMigration } from './publications.ts';
import { artworkMigration } from './artworks.ts';
import type { AuthConfig } from './config.ts';

function openDatabase(config: AuthConfig) {
  mkdirSync(dirname(config.databasePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(config.databasePath);
  chmodSync(config.databasePath, 0o600);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return database;
}

function authOptions(config: AuthConfig, database: DatabaseSync) {
  return {
    appName: 'Gallerify',
    baseURL: config.baseURL,
    secret: config.secret,
    database,
    trustedOrigins: [config.baseURL],
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
    socialProviders: config.google
      ? { google: { ...config.google, prompt: 'select_account', accessType: 'online' } }
      : {},
    account: {
      encryptOAuthTokens: true,
      // Email/password addresses are not verified yet. Never merge them with
      // Google identities solely because the email strings match.
      accountLinking: { enabled: false },
    },
    advanced: {
      cookiePrefix: config.cookiePrefix,
      ipAddress: { ipAddressHeaders: ['x-gallerify-client-ip'] },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      customRules: {
        '/sign-up/email': { window: 60, max: 5 },
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-in/social': { window: 60, max: 10 },
      },
    },
  } satisfies BetterAuthOptions;
}

export function createAuth(config: AuthConfig) {
  const database = openDatabase(config);
  const auth = betterAuth(authOptions(config, database));
  return { auth, database };
}

export async function migrateAuth(config: AuthConfig, apply = true) {
  const database = openDatabase(config);
  try {
    const migration = await getMigrations(authOptions(config, database));
    if (apply) {
      await migration.runMigrations();
      database.exec(galleryMigration);
      database.exec(artworkMigration);
      database.exec(publicationMigration);
    } else {
      const authPlan = await migration.compileMigrations();
      const galleriesExist = database
        .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'gallery'")
        .get();
      const artworksExist = database
        .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'artwork'")
        .get();
      const publicationsExist = database
        .prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='exhibitionVersion'")
        .get();
      return [
        authPlan,
        galleriesExist ? '' : galleryMigration,
        artworksExist ? '' : artworkMigration,
        publicationsExist ? '' : publicationMigration,
      ]
        .filter(Boolean)
        .join('\n');
    }
  } finally {
    if (database.isOpen) database.close();
  }
}
