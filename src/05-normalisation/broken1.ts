import { makePool } from '../shared/db';
import { sleep, title } from '../shared/util';

const pool = makePool({ max: 60 });
const WHALE_ID = 1; // owns ~200k of the 1M orders (see seed1.ts)

async function currentLsn(): Promise<string> {
  const { rows } = await pool.query<{ lsn: string }>('SELECT pg_current_wal_lsn()::text AS lsn');
  return rows[0]!.lsn;
}

async function walBytesSince(startLsn: string): Promise<number> {
  const { rows } = await pool.query<{ bytes: string }>(
    'SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), $1::pg_lsn)::bigint::text AS bytes',
    [startLsn],
  );
  return Number(rows[0]!.bytes);
}

// Denormalised write path: the same logical change must touch BOTH tables,
// and the big UPDATE holds ~200k row locks until COMMIT.
async function moveCustomerDenorm(newCity: string): Promise<number> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const a = await c.query('UPDATE customers SET city = $1 WHERE id = $2', [newCity, WHALE_ID]);
    const b = await c.query('UPDATE orders_denorm SET customer_city = $1 WHERE customer_id = $2', [
      newCity,
      WHALE_ID,
    ]);
    await c.query('COMMIT');
    return (a.rowCount ?? 0) + (b.rowCount ?? 0);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

title('05 normalisation / BROKEN1: write cost of the denormalised copy');

const newCity = `city-moved-${Date.now()}`;
const startLsn = await currentLsn();
const latencies: number[] = [];
const writers: Promise<void>[] = [];
let done = false;

const t0 = performance.now();
const big = moveCustomerDenorm(newCity).finally(() => {
  done = true;
});

// Meanwhile, unrelated traffic keeps editing this customer's orders.
while (!done || writers.length < 10) {
  const id = 1 + Math.floor(Math.random() * 200000);
  writers.push(
    (async () => {
      const t = performance.now();
      await pool.query('UPDATE orders_denorm SET amount = amount + 1 WHERE id = $1', [id]);
      latencies.push(performance.now() - t);
    })(),
  );
  await sleep(50);
}

const rowsTouched = await big;
const bigWriteMs = Math.round(performance.now() - t0);
await Promise.all(writers);

latencies.sort((a, b) => a - b);
const pct = (p: number) =>
  Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]!);

console.table({
  rowsTouched,
  bigWriteMs,
  walMB: Math.round((await walBytesSince(startLsn)) / 1e5) / 10,
  concurrentWrites: latencies.length,
  writerP50Ms: pct(0.5),
  writerMaxMs: pct(1),
  writersBlockedOver200ms: latencies.filter((l) => l > 200).length,
});
console.log('One logical change rewrote ~200k rows and blocked other writers until COMMIT.');
await pool.end();