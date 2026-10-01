import { makePool, resetSchema } from '../shared/db';
import { runConcurrently, sleep, timed, title } from '../shared/util';

const N = 50;
const pool = makePool({ max: N });
await resetSchema(pool);

let optimisticRetries = 0;

const strategies: Array<{ name: string; run: () => Promise<void> }> = [
  {
    name: 'atomic UPDATE',
    run: async () => {
      await pool.query('UPDATE counters SET n = n + 1 WHERE id = 1');
    },
  },
  {
    name: 'SELECT ... FOR UPDATE',
    run: async () => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const { rows } = await c.query<{ n: number }>(
          'SELECT n FROM counters WHERE id = 1 FOR UPDATE',
        );
        await sleep(Math.random() * 10);
        await c.query('UPDATE counters SET n = $1 WHERE id = 1', [rows[0]!.n + 1]);
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      } finally {
        c.release();
      }
    },
  },
  {
    name: 'optimistic (version column)',
    run: async () => {
      for (;;) {
        const { rows } = await pool.query<{ n: number; version: number }>(
          'SELECT n, version FROM counters WHERE id = 1',
        );
        const row = rows[0]!;
        await sleep(Math.random() * 10);
        const res = await pool.query(
          'UPDATE counters SET n = $1, version = version + 1 WHERE id = 1 AND version = $2',
          [row.n + 1, row.version],
        );
        if (res.rowCount === 1) return;
        optimisticRetries++; // someone else won; re-read and try again
      }
    },
  },
];

title('02 locks / FIXED: three ways to make the update safe');

const table: Array<Record<string, string | number>> = [];
for (const s of strategies) {
  await pool.query('UPDATE counters SET n = 0, version = 0 WHERE id = 1');
  optimisticRetries = 0;
  const { ms } = await timed(() => runConcurrently(N, s.run));
  const { rows } = await pool.query<{ n: number }>('SELECT n FROM counters WHERE id = 1');
  table.push({
    strategy: s.name,
    expected: N,
    actual: rows[0]!.n,
    ms,
    retries: s.name.startsWith('optimistic') ? optimisticRetries : 0,
  });
}
console.table(table);
await pool.end();
