import { makePool, resetSchema } from '../shared/db';
import { summarize, title } from '../shared/util';
import { goOffCall, onCallCount, readTwice, resetOnCall } from './lib';

const pool = makePool({ max: 10 });
await resetSchema(pool);

title('04 isolation / BROKEN (1): non-repeatable read under READ COMMITTED');
console.table([await readTwice(pool, 'READ COMMITTED')]);

title('04 isolation / BROKEN (2): write skew under REPEATABLE READ');
await resetOnCall(pool);
const results = await Promise.allSettled([
  goOffCall(pool, 'alice', 'REPEATABLE READ'),
  goOffCall(pool, 'bob', 'REPEATABLE READ'),
]);
console.table({ ...summarize(results), onCallRemaining: await onCallCount(pool), invariant: 'at least 1' });

console.log('Note: dirty reads cannot be reproduced in Postgres (READ UNCOMMITTED behaves as READ COMMITTED).');
await pool.end();
