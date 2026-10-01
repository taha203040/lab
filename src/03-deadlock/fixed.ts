import { makePool, resetSchema } from '../shared/db';
import { runConcurrently, sleep, summarize, title, withRetry } from '../shared/util';

const pool = makePool({ max: 20 });
await resetSchema(pool);

let retries = 0;

async function transfer(from: number, to: number, amount: number): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    // Fix 1: take ALL row locks up front, always in id order.
    await c.query('SELECT id FROM accounts WHERE id = ANY($1) ORDER BY id FOR UPDATE', [
      [from, to],
    ]);
    await c.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, from]);
    await sleep(100);
    await c.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, to]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

title('03 deadlock / FIXED: consistent lock order + retry on 40P01');

const results = await runConcurrently(20, (i) =>
  // Fix 2: retry only on deadlock / serialization errors, with backoff + jitter.
  withRetry(() => (i % 2 === 0 ? transfer(1, 2, 10) : transfer(2, 1, 10)), {
    onRetry: () => retries++,
  }),
);

const { rows } = await pool.query<{ total: string }>('SELECT sum(balance) AS total FROM accounts');
console.table({ ...summarize(results), retries, totalBalance: Number(rows[0]!.total), expectedTotal: 2000 });
await pool.end();
