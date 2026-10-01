import { makePool, resetSchema } from '../shared/db';
import { sleep, title } from '../shared/util';
import { LAG_MS, readModel, readProfile, relayOnce, stats, updateProfile } from './lib';

const pool = makePool();
await resetSchema(pool);

title('07 eventual consistency / FIXED: outbox + idempotent consumer');

const writtenAt = Date.now();
await updateProfile(pool, 1, 'Ada'); // row + outbox event commit together

// The relay runs asynchronously and delivers every event twice (at-least-once delivery).
const relay = relayOnce(pool, { deliverTwice: true });

console.log(`  immediately after write:`);
console.table({
  'read from primary (own write)': await readProfile(pool, 1, { ownWrite: true }),
  'read from read model (others)': (await readProfile(pool, 1, { ownWrite: false })) ?? '(stale / missing)',
});

while (readModel.get(1) !== 'Ada') await sleep(25);
const staleWindowMs = Date.now() - writtenAt;
await relay;

console.table({
  staleWindowMs,
  injectedLagMs: LAG_MS,
  duplicatesIgnored: stats.duplicatesIgnored,
  readModelNow: readModel.get(1),
});
console.log('Eventually consistent is fine for feeds/counters; use the primary (or a version token) for read-after-write.');
await pool.end();
