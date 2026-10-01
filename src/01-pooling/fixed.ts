import { makePool } from '../shared/db';
import { runConcurrently, sleep, summarize, timed, title } from '../shared/util';

const POOL_MAX = 5; // same pool as the broken version: the fix is NOT a bigger pool
const pool = makePool({ max: POOL_MAX, connectionTimeoutMillis: 1000 });

async function handleRequest(): Promise<void> {
  await sleep(200); // external call first, no connection held
  await pool.query('SELECT 1'); // borrow a connection only for the query itself
}

title('01 pooling / FIXED: borrow a connection only while querying');

let maxWaiting = 0;
const sampler = setInterval(() => {
  maxWaiting = Math.max(maxWaiting, pool.waitingCount);
}, 10);

const { value: results, ms } = await timed(() => runConcurrently(50, handleRequest));
clearInterval(sampler);

console.table({ ...summarize(results), maxWaiting, elapsedMs: ms, poolMax: POOL_MAX });
console.log('Sizing rule: app_instances x pool.max must stay below Postgres max_connections.');
await pool.end();
