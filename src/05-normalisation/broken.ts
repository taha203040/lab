import { makePool } from '../shared/db';
import { title } from '../shared/util';

const pool = makePool();
title('05 normalisation / BROKEN: update anomaly in the denormalised copy');

// One fact (customer 7's city) is stored on 10 rows' worth of orders. Update only the source.
await pool.query(`UPDATE customers SET city = 'city-moved' WHERE id = 7`);

const { rows } = await pool.query<{ stale: string }>(`
  SELECT count(*) AS stale
  FROM orders_denorm d JOIN customers c ON c.id = d.customer_id
  WHERE d.customer_city <> c.city
`);
console.table({ staleDenormRows: Number(rows[0]!.stale), expected: 0 });
console.log('Re-run `npm run seed:05` before the next experiment.');
await pool.end();
