import { makePool } from '../shared/db';
import { sleep, title } from '../shared/util';

const pool = makePool({ max: 60 });
const WHALE_ID = 1;

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

// A) Normalised: the city lives in exactly one row.
async function moveCustomerNormalised(newCity: string): Promise<number> {
  const r = await pool.query('UPDATE customers SET city = $1 WHERE id = $2', [newCity, WHALE_ID]);
  return r.rowCount ?? 0;
}

// B) Denormalised copy kept, but updated in small batches (many short transactions).
//    `customer_city <> $1` makes it resumable: re-running only touches rows not yet fixed.
async function moveCustomerDenormBatched(newCity: string, batchSize = 5000): Promise<number> {
  const first = await pool.query('UPDATE customers SET city = $1 WHERE id = $2', [newCity, WHALE_ID]);
  let touched = first.rowCount ?? 0;
  for (;;) {
    const r = await pool.query(
      `UPDATE orders_denorm SET customer_city = $1
       WHERE id IN (
         SELECT id FROM orders_denorm
         WHERE customer_id = $2 AND customer_city <> $1
         LIMIT $3
       )`,
      [newCity, WHALE_ID, batchSize],
    );
    const n = r.rowCount ?? 0;
    if (n === 0) break;
    touched += n;
    await sleep(10); // let other writers in between batches
  }
  return touched;
}

async function scenario(
  ordersTable: 'orders' | 'orders_denorm',
  bigWrite: (newCity: string) => Promise<number>,
) {
  const newCity = `city-moved-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const startLsn = await currentLsn();
  const latencies: number[] = [];
  const writers: Promise<void>[] = [];
  let done = false;

  const t0 = performance.now();
  const big = bigWrite(newCity).finally(() => {
    done = true;
  });

  while (!done || writers.length < 10) {
    const id = 1 + Math.floor(Math.random() * 200000);
    writers.push(
      (async () => {
        const t = performance.now();
        await pool.query(`UPDATE ${ordersTable} SET amount = amount + 1 WHERE id = $1`, [id]);
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

  return {
    rowsTouched,
    bigWriteMs,
    walMB: Math.round((await walBytesSince(startLsn)) / 1e5) / 10,
    concurrentWrites: latencies.length,
    writerP50Ms: pct(0.5),
    writerMaxMs: pct(1),
    writersBlockedOver200ms: latencies.filter((l) => l > 200).length,
  };
}

title('05 normalisation / FIXED1: same change, three write strategies');

const results = {
  'A normalised (1 place)': await scenario('orders', moveCustomerNormalised),
  'B denormalised, batched': await scenario('orders_denorm', (c) => moveCustomerDenormBatched(c)),
};
console.table(results);

console.log('A: one row changed, nobody blocked. Cost: reads need the join (see fixed.ts).');
console.log('B: still ~200k rows rewritten, but in short transactions, so writers wait far less.');
console.log('   Trade-off: for a short time customers.city and orders_denorm.customer_city disagree.');
await pool.end();