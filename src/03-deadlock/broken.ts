import { makePool, resetSchema } from '../shared/db';
import { messageOf, sleep, summarize, title } from '../shared/util';

const pool = makePool({ max: 10 });
await resetSchema(pool);

async function transfer(from: number, to: number, amount: number): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, from]);
    await sleep(100); // both transactions now hold one row lock and want the other
    await c.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, to]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

title('03 deadlock / BROKEN: opposite lock order');

// Postgres waits deadlock_timeout (default 1s), then aborts one transaction.
const results = await Promise.allSettled([transfer(1, 2, 10), transfer(2, 1, 10)]);
const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');

console.table(summarize(results));
if (failed) console.log(`DB said: ${messageOf(failed.reason)}`);
await pool.end();
