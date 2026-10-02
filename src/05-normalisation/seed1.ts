import { makePool, resetSchema } from '../shared/db';
import { timed, title } from '../shared/util';

const pool = makePool();
title('05 normalisation / seed1: skewed data (customer 1 is a "whale" with ~200k orders)');

await resetSchema(pool);
const { ms } = await timed(async () => {
  await pool.query(`
    CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, city text NOT NULL);
    INSERT INTO customers
      SELECT g, 'customer-' || g, 'city-' || (g % 100) FROM generate_series(1, 100000) g;

    CREATE TABLE orders (
      id int PRIMARY KEY,
      customer_id int NOT NULL REFERENCES customers(id),
      amount int NOT NULL
    );
    -- first 200k orders belong to customer 1, the rest are spread evenly
    INSERT INTO orders
      SELECT g, CASE WHEN g <= 200000 THEN 1 ELSE 1 + (g % 100000) END, g % 500
      FROM generate_series(1, 1000000) g;

    CREATE TABLE orders_denorm AS
      SELECT o.id, o.customer_id, c.city AS customer_city, o.amount
      FROM orders o JOIN customers c ON c.id = o.customer_id;
    ALTER TABLE orders_denorm ADD PRIMARY KEY (id);

    CREATE INDEX orders_customer_idx ON orders (customer_id);
    CREATE INDEX customers_city_idx ON customers (city);
    CREATE INDEX orders_denorm_customer_idx ON orders_denorm (customer_id);
    CREATE INDEX orders_denorm_city_idx ON orders_denorm (customer_city);
    ANALYZE;
  `);
});
console.log(`seeded in ${ms} ms`);
await pool.end();