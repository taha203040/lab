import { makePool, resetSchema } from '../shared/db';
import { summarize, title, withRetry } from '../shared/util';
import { goOffCall, onCallCount, readTwice, resetOnCall } from './lib';

const pool = makePool({ max: 10 });
await resetSchema(pool);

title('04 isolation / FIXED (1): REPEATABLE READ gives a stable snapshot');
console.table([await readTwice(pool, 'REPEATABLE READ')]);

title('04 isolation / FIXED (2): SERIALIZABLE + retry stops write skew');
await resetOnCall(pool);
let retries = 0;
const run = (doctor: string) =>
  withRetry(() => goOffCall(pool, doctor, 'SERIALIZABLE'), { onRetry: () => retries++ });

const results = await Promise.allSettled([run('alice'), run('bob')]);
console.table({
  ...summarize(results),
  retries,
  onCallRemaining: await onCallCount(pool),
  invariant: 'at least 1',
});

console.log('Why not SERIALIZABLE everywhere? Aborts + retries cost throughput; use it where an invariant spans rows.');
await pool.end();
