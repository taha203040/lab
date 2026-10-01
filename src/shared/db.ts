import { readFileSync } from 'node:fs';
import { Pool, type PoolConfig } from 'pg';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://lab:lab@localhost:5433/lab';

export function makePool(overrides: PoolConfig = {}): Pool {
  return new Pool({ connectionString: DATABASE_URL, ...overrides });
}

export async function resetSchema(pool: Pool): Promise<void> {
  const sql = readFileSync(new URL('../../sql/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}
