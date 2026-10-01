import type { Pool } from 'pg';
import { sleep } from '../shared/util';

export type Level = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

/** Transaction A reads twice while B commits an update in between. */
export async function readTwice(pool: Pool, level: Level) {
  await pool.query('UPDATE accounts SET balance = 1000 WHERE id = 1');
  const a = await pool.connect();
  const b = await pool.connect();
  try {
    await a.query(`BEGIN ISOLATION LEVEL ${level}`);
    const first = (await a.query<{ balance: number }>('SELECT balance FROM accounts WHERE id = 1'))
      .rows[0]!.balance;
    await b.query('UPDATE accounts SET balance = balance + 500 WHERE id = 1'); // autocommit
    const second = (await a.query<{ balance: number }>('SELECT balance FROM accounts WHERE id = 1'))
      .rows[0]!.balance;
    await a.query('COMMIT');
    return { level, first, second, repeatableRead: first === second };
  } finally {
    a.release();
    b.release();
  }
}

/** Invariant: at least one doctor stays on call. Check, wait, then update. */
export async function goOffCall(pool: Pool, doctor: string, level: Level): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query(`BEGIN ISOLATION LEVEL ${level}`);
    const { rows } = await c.query<{ count: string }>('SELECT count(*) FROM oncall WHERE on_call');
    if (Number(rows[0]!.count) < 2) {
      await c.query('ROLLBACK');
      return; // invariant would break, so refuse
    }
    await sleep(100); // both transactions have now seen "2 on call"
    await c.query('UPDATE oncall SET on_call = false WHERE doctor = $1', [doctor]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export async function resetOnCall(pool: Pool): Promise<void> {
  await pool.query('UPDATE oncall SET on_call = true');
}

export async function onCallCount(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>('SELECT count(*) FROM oncall WHERE on_call');
  return Number(rows[0]!.count);
}
