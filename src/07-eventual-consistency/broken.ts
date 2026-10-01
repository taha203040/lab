import { makePool, resetSchema } from '../shared/db';
import { title } from '../shared/util';
import { readModel } from './lib';

const pool = makePool();
await resetSchema(pool);

// Dual write: DB first, then the derived store. Nothing makes the two atomic.
async function dualWrite(id: number, name: string, crashBetween: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO profiles(id, display_name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [id, name],
  );
  if (crashBetween) throw new Error('process crashed between the two writes');
  readModel.set(id, name);
}

title('07 eventual consistency / BROKEN: dual write without an outbox');

await dualWrite(1, 'Ada', false);
await dualWrite(1, 'Grace', true).catch((e: Error) => console.log(`  ${e.message}`));

const { rows } = await pool.query<{ display_name: string }>(
  'SELECT display_name FROM profiles WHERE id = 1',
);
const database = rows[0]!.display_name;
console.table({ database, readModel: readModel.get(1), consistent: database === readModel.get(1) });
console.log('Nothing will ever repair this: the event that should fix it was never recorded.');
await pool.end();
