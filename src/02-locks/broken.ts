import { makePool, resetSchema } from '../shared/db';
import { runConcurrently, sleep, title } from '../shared/util';

const N = 50;
const pool = makePool({ max: N });
await resetSchema(pool);

title('02 locks / BROKEN: read-modify-write lost update');

await runConcurrently(N, async () => {
  const { rows } = await pool.query<{ n: number }>('SELECT n FROM counters WHERE id = 1');
  await sleep(Math.random() * 10); // widen the race window
  await pool.query('UPDATE counters SET n = $1 WHERE id = 1', [rows[0]!.n + 1]);
});

const { rows } = await pool.query<{ n: number }>('SELECT n FROM counters WHERE id = 1');
const actual = rows[0]!.n;
console.table({ expected: N, actual, lostUpdates: N - actual });
await pool.end();
