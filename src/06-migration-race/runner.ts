import type { Pool } from 'pg';
import { sleep } from '../shared/util';

export const MIGRATION_ID = 'v2-bonus';
const LOCK_KEY = 727274;

/** A deliberately NON-idempotent data migration with a check-then-act gap. */
async function applyMigration(pool: Pool, runner: string): Promise<void> {
  const seen = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [MIGRATION_ID]);
  if (seen.rowCount) {
    console.log(`  [${runner}] already applied, skipping`);
    return;
  }
  console.log(`  [${runner}] applying ${MIGRATION_ID}`);
  await pool.query('UPDATE counters SET n = n + 100 WHERE id = 1');
  await sleep(200); // slow migration: the window where the other runner also passes the check
  await pool.query('INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING', [
    MIGRATION_ID,
  ]);
}

export function migrateUnsafe(pool: Pool, runner: string): Promise<void> {
  return applyMigration(pool, runner);
}

/** Session-level advisory lock: only one runner at a time does check + apply. */
export async function migrateWithLock(pool: Pool, runner: string): Promise<void> {
  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    try {
      await applyMigration(pool, runner);
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } finally {
    lockClient.release();
  }
}
