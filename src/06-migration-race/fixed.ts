import { makePool, resetSchema } from '../shared/db';
import { title } from '../shared/util';
import { migrateWithLock } from './runner';

const pool = makePool({ max: 10 });
await resetSchema(pool);

title('06 migration race / FIXED: advisory lock around check + apply');
await Promise.all([migrateWithLock(pool, 'pod-1'), migrateWithLock(pool, 'pod-2')]);

const { rows } = await pool.query<{ n: number }>('SELECT n FROM counters WHERE id = 1');
console.table({ expected: 100, actual: rows[0]!.n, appliedTwice: rows[0]!.n === 200 });
console.log('In Kubernetes, prefer running migrations as ONE Job / init step instead of in every pod.');
await pool.end();
