import { migrateAuth } from './auth.ts';
import { readAuthConfig } from './config.ts';

const config = readAuthConfig(
  process.env,
  process.env.NODE_ENV === 'production'
    ? {}
    : {
        developmentURL: 'http://localhost:5173',
      },
);
const plan = process.argv.includes('--plan');
const sql = await migrateAuth(config, !plan);
console.log(plan ? sql || 'Schema is up to date.' : 'Authentication schema is up to date.');
