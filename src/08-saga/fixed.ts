import { makePool, resetSchema } from '../shared/db';
import { title } from '../shared/util';
import { CrashError, effectsOf, faults, runSaga } from './lib';

const pool = makePool();
await resetSchema(pool);

title('08 saga / FIXED (A): a step fails -> compensations run in reverse');
faults.failAction = 'charge-payment';
const a = await runSaga(pool, 'order-A');
delete faults.failAction;
console.table({ status: a, effects: (await effectsOf(pool, 'order-A')).join(', ') || '-' });

title('08 saga / FIXED (B): process crashes mid-saga, restart resumes');
faults.crashAfterAction = 'charge-payment';
try {
  await runSaga(pool, 'order-B');
} catch (e) {
  if (!(e instanceof CrashError)) throw e;
  console.log(`  ${e.message} -> restarting`);
}
const b = await runSaga(pool, 'order-B'); // resume from persisted state; re-run step is idempotent
console.table({ status: b, effects: (await effectsOf(pool, 'order-B')).join(', ') });

console.log('Interview point: persisted state + idempotent steps + idempotent compensations.');
await pool.end();
