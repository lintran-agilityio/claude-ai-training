import 'reflect-metadata';
import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseEntities } from './entities';

// Resolve migrations next to this file rather than from a fixed `src/**/*.ts`
// glob: under ts-node (`pnpm db:migrate`) this file is `.ts`, but the deploy
// runs the compiled `dist/database/run-migrations.js`, where the migrations are
// `.js`. Matching the current extension also keeps the glob from picking up the
// emitted `*.d.ts` declaration files.
const migrationExtension = __filename.endsWith('.ts') ? 'ts' : 'js';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: databaseEntities,
  migrations: [join(__dirname, 'migrations', `*.${migrationExtension}`)],
  synchronize: false,
});
