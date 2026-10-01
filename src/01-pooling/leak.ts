import { makePool } from '../shared/db';
import { runConcurrently, summarize, title } from '../shared/util';

const pool = makePool({ max: 5, connectionTimeoutMillis: 500 });

title('01 pooling / LEAK: some code paths forget client.release()');

const results = await runConcurrently(30, async (i) => {
  const client = await pool.connect();
  await client.query('SELECT 1');
  if (i % 4 !== 0) client.release(); // every 4th request "forgets" to release
});

console.table({
  ...summarize(results),
  idle: pool.idleCount,
  total: pool.totalCount,
  waiting: pool.waitingCount,
});
console.log('Once leaked connections reach pool.max, every later request times out.');
process.exit(0); // pool.end() would hang forever on the leaked clients
