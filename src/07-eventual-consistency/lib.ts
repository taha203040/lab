import type { Pool } from 'pg';
import { sleep } from '../shared/util';

/** Stands in for a cache, read replica or search index that is fed asynchronously. */
export const readModel = new Map<number, string>();
export const LAG_MS = 500;
export const stats = { duplicatesIgnored: 0 };

const processedEventIds = new Set<number>(); // consumer-side dedupe = idempotency

/** Write the row AND the event in ONE transaction (the outbox pattern). */
export async function updateProfile(pool: Pool, id: number, displayName: string): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(
      `INSERT INTO profiles(id, display_name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [id, displayName],
    );
    await c.query('INSERT INTO outbox(aggregate_id, payload) VALUES ($1, $2)', [
      id,
      JSON.stringify({ displayName }),
    ]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

function deliver(eventId: number, aggregateId: number, displayName: string): void {
  if (processedEventIds.has(eventId)) {
    stats.duplicatesIgnored++;
    return;
  }
  processedEventIds.add(eventId);
  readModel.set(aggregateId, displayName);
}

/** Relay: publish unprocessed outbox rows. SKIP LOCKED lets several relays run safely. */
export async function relayOnce(pool: Pool, opts: { deliverTwice?: boolean } = {}): Promise<number> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows } = await c.query<{
      id: string;
      aggregate_id: number;
      payload: { displayName: string };
    }>(
      `SELECT id, aggregate_id, payload FROM outbox
       WHERE NOT processed ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED`,
    );
    for (const ev of rows) {
      await sleep(LAG_MS); // broker / network / replica lag
      deliver(Number(ev.id), ev.aggregate_id, ev.payload.displayName);
      if (opts.deliverTwice) deliver(Number(ev.id), ev.aggregate_id, ev.payload.displayName);
      await c.query('UPDATE outbox SET processed = true WHERE id = $1', [ev.id]);
    }
    await c.query('COMMIT');
    return rows.length;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/** Read-after-write: the writer's own reads go to the source of truth. */
export async function readProfile(
  pool: Pool,
  id: number,
  opts: { ownWrite: boolean },
): Promise<string | undefined> {
  if (opts.ownWrite) {
    const { rows } = await pool.query<{ display_name: string }>(
      'SELECT display_name FROM profiles WHERE id = $1',
      [id],
    );
    return rows[0]?.display_name;
  }
  return readModel.get(id);
}
