import { makePool } from '../shared/db';
import { runConcurrently, sleep, summarize, timed, title } from '../shared/util';

const POOL_MAX = 5;
const pool = makePool({ max: POOL_MAX, connectionTimeoutMillis: 1000 });

async function handleRequest(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    await sleep(200); // simulated external call while HOLDING a connection (the bug)
  } finally {
    client.release();
  }
}

title('01 pooling / BROKEN: connection held across a slow call');

let maxWaiting = 0;
const sampler = setInterval(() => {
  maxWaiting = Math.max(maxWaiting, pool.waitingCount);
}, 10);

const { value: results, ms } = await timed(() => runConcurrently(50, handleRequest));
clearInterval(sampler);

console.table({ ...summarize(results), maxWaiting, elapsedMs: ms, poolMax: POOL_MAX });
await pool.end();
