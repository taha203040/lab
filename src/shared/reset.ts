import { makePool, resetSchema } from './db';

const pool = makePool();
await resetSchema(pool);
await pool.end();
console.log('schema reset');
