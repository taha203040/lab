import { makePool, resetSchema } from '../shared/db';
import { title } from '../shared/util';
import { effectsOf, faults, steps, type Ctx } from './lib';

const pool = makePool();
await resetSchema(pool);

title('08 saga / BROKEN: sequential calls, no compensation');

const ctx: Ctx = { pool, sagaId: 'order-1' };
faults.failAction = 'charge-payment';

try {
  for (const step of steps) await step.action(ctx); // naive "distributed transaction"
} catch (e) {
  console.log(`  failed: ${(e as Error).message}`);
}

console.table({ leftoverEffects: (await effectsOf(pool, 'order-1')).join(', ') || '-', expected: '-' });
console.log('Inventory stays reserved for an order that never completed.');
await pool.end();
