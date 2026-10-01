import { makePool, resetSchema } from '../shared/db';
import { sleep, title } from '../shared/util';

const pool = makePool({ max: 10 });
await resetSchema(pool);
await pool.query(`INSERT INTO users(full_name) SELECT 'User ' || g FROM generate_series(1, 5000) g`);

title('06 migration race / BROKEN: backfill while old code keeps writing');

let running = true;
// "Old code" is still deployed: it knows nothing about the new column name_lower.
const oldWriter = (async () => {
  while (running) {
    await pool.query('INSERT INTO users(full_name) VALUES ($1)', [`Late ${Date.now()}`]);
    await sleep(2);
  }
})();

// Typical bug: backfill up to the max id captured when the backfill started.
const { rows: maxRows } = await pool.query<{ max: number }>('SELECT max(id) AS max FROM users');
const maxId = maxRows[0]!.max;
for (let from = 1; from <= maxId; from += 500) {
  await pool.query('UPDATE users SET name_lower = lower(full_name) WHERE id >= $1 AND id < $2', [
    from,
    from + 500,
  ]);
  await sleep(20); // batching pause, as you would in production
}
running = false;
await oldWriter;

const { rows } = await pool.query<{ missing: string }>(
  'SELECT count(*) AS missing FROM users WHERE name_lower IS NULL',
);
console.table({ rowsMissingBackfill: Number(rows[0]!.missing), expected: 0 });
await pool.end();
