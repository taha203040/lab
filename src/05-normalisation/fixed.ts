import { makePool } from '../shared/db';
import { title } from '../shared/util';

const pool = makePool();

const joinSql = `SELECT sum(o.amount) FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.city = 'city-7'`;
const flatSql = `SELECT sum(amount) FROM orders_denorm WHERE customer_city = 'city-7'`;

async function executionMs(sql: string): Promise<number> {
  const runs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const { rows } = await pool.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`);
    runs.push(rows[0]['QUERY PLAN'][0]['Execution Time'] as number);
  }
  return Math.round(Math.min(...runs) * 10) / 10;
}

title('05 normalisation / FIXED: measure the read win, pay the write cost explicitly');
console.table({
  'normalised (join)': { executionMs: await executionMs(joinSql) },
  'denormalised (flat)': { executionMs: await executionMs(flatSql) },
});

// The denormalised copy is only safe if EVERY write path updates both, in one transaction.
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query(`UPDATE customers SET city = 'city-moved' WHERE id = 7`);
  await c.query(`UPDATE orders_denorm SET customer_city = 'city-moved' WHERE customer_id = 7`);
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  c.release();
}

const { rows } = await pool.query<{ stale: string }>(`
  SELECT count(*) AS stale
  FROM orders_denorm d JOIN customers c ON c.id = d.customer_id
  WHERE d.customer_city <> c.city
`);
console.table({ staleDenormRows: Number(rows[0]!.stale), expected: 0 });
console.log('Rule: denormalise only a measured hot read path, and own the write-side maintenance.');
await pool.end();
