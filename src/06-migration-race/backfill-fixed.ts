import { makePool, resetSchema } from '../shared/db';
import { sleep, title } from '../shared/util';

const pool = makePool({ max: 10 });
await resetSchema(pool);
await pool.query(`INSERT INTO users(full_name) SELECT 'User ' || g FROM generate_series(1, 5000) g`);

title('06 migration race / FIXED: expand -> dual-write -> backfill -> verify');

// Step 1 (expand) is already in schema.sql: users.name_lower exists and is nullable.
// Step 2: deploy NEW code that writes BOTH columns, before any backfill starts.
let running = true;
const dualWriter = (async () => {
  while (running) {
    const name = `Late ${Date.now()}`;
    await pool.query('INSERT INTO users(full_name, name_lower) VALUES ($1, lower($1))', [name]);
    await sleep(2);
  }
})();

// Step 3: backfill old rows in batches. New rows are already correct.
const { rows: maxRows } = await pool.query<{ max: number }>('SELECT max(id) AS max FROM users');
const maxId = maxRows[0]!.max;
for (let from = 1; from <= maxId; from += 500) {
  await pool.query(
    'UPDATE users SET name_lower = lower(full_name) WHERE id >= $1 AND id < $2 AND name_lower IS NULL',
    [from, from + 500],
  );
  await sleep(20);
}
running = false;
await dualWriter;

// Step 4: verify before switching reads or dropping the old column.
const { rows } = await pool.query<{ missing: string }>(
  'SELECT count(*) AS missing FROM users WHERE name_lower IS NULL',
);
console.table({ rowsMissingBackfill: Number(rows[0]!.missing), expected: 0 });
console.log('Next: switch reads to name_lower, then contract (drop the old path) in a LATER release.');
await pool.end();
