import { makePool, resetSchema } from '../shared/db';
import { title } from '../shared/util';
import { migrateUnsafe } from './runner';

const pool = makePool({ max: 10 });
await resetSchema(pool);

title('06 migration race / BROKEN: two pods run migrations at startup');
await Promise.all([migrateUnsafe(pool, 'pod-1'), migrateUnsafe(pool, 'pod-2')]);

const { rows } = await pool.query<{ n: number }>('SELECT n FROM counters WHERE id = 1');
console.table({ expected: 100, actual: rows[0]!.n, appliedTwice: rows[0]!.n === 200 });
await pool.end();
