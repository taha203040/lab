import type { Pool } from 'pg';

export class CrashError extends Error {}

export interface Ctx {
  pool: Pool;
  sagaId: string;
}

export interface Step {
  name: string;
  action: (ctx: Ctx) => Promise<void>;
  compensate: (ctx: Ctx) => Promise<void>;
}

/** Failure injection for the experiments. */
export const faults: { failAction?: string; crashAfterAction?: string } = {};

// Each step writes a row into saga_effects (stands in for a call to another service).
// The primary key makes actions idempotent; deleting the row is the idempotent compensation.
function makeStep(name: string): Step {
  return {
    name,
    action: async ({ pool, sagaId }) => {
      if (faults.failAction === name) throw new Error(`${name} failed`);
      await pool.query(
        'INSERT INTO saga_effects(saga_id, step) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [sagaId, name],
      );
    },
    compensate: async ({ pool, sagaId }) => {
      await pool.query('DELETE FROM saga_effects WHERE saga_id = $1 AND step = $2', [sagaId, name]);
    },
  };
}

export const steps: Step[] = [
  makeStep('reserve-inventory'),
  makeStep('charge-payment'),
  makeStep('create-shipment'),
];

export async function effectsOf(pool: Pool, sagaId: string): Promise<string[]> {
  const { rows } = await pool.query<{ step: string }>(
    'SELECT step FROM saga_effects WHERE saga_id = $1 ORDER BY step',
    [sagaId],
  );
  return rows.map((r) => r.step);
}

async function setState(pool: Pool, id: string, nextStep: number, status: string): Promise<void> {
  await pool.query('UPDATE saga_instances SET next_step = $2, status = $3 WHERE id = $1', [
    id,
    nextStep,
    status,
  ]);
}

/**
 * Orchestrator. Progress is persisted after every step, so a restarted process resumes where it
 * left off. Because steps and compensations are idempotent, re-running one is harmless.
 */
export async function runSaga(pool: Pool, sagaId: string): Promise<string> {
  await pool.query('INSERT INTO saga_instances(id) VALUES ($1) ON CONFLICT DO NOTHING', [sagaId]);
  const ctx: Ctx = { pool, sagaId };

  for (;;) {
    const { rows } = await pool.query<{ next_step: number; status: string }>(
      'SELECT next_step, status FROM saga_instances WHERE id = $1',
      [sagaId],
    );
    const { next_step: n, status } = rows[0]!;

    if (status === 'completed' || status === 'compensated') return status;

    if (status === 'compensating') {
      if (n === 0) {
        await setState(pool, sagaId, 0, 'compensated');
        continue;
      }
      await steps[n - 1]!.compensate(ctx); // undo in reverse order
      await setState(pool, sagaId, n - 1, 'compensating');
      continue;
    }

    if (n === steps.length) {
      await setState(pool, sagaId, n, 'completed');
      continue;
    }

    const step = steps[n]!;
    try {
      await step.action(ctx);
      if (faults.crashAfterAction === step.name) {
        delete faults.crashAfterAction;
        // Process dies AFTER the side effect but BEFORE progress is saved.
        throw new CrashError(`process died after ${step.name}`);
      }
    } catch (e) {
      if (e instanceof CrashError) throw e;
      console.log(`  step ${step.name} failed (${(e as Error).message}) -> compensating`);
      await setState(pool, sagaId, n, 'compensating');
      continue;
    }
    await setState(pool, sagaId, n + 1, 'running');
  }
}
