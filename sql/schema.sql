DROP TABLE IF EXISTS
  counters, accounts, oncall, users, schema_migrations, profiles, outbox,
  saga_instances, saga_effects, customers, orders, orders_denorm
CASCADE;

-- 02 locks
CREATE TABLE counters (
  id int PRIMARY KEY,
  n int NOT NULL DEFAULT 0,
  version int NOT NULL DEFAULT 0
);
INSERT INTO counters VALUES (1, 0, 0);

-- 03 deadlock / 04 isolation
CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL);
INSERT INTO accounts VALUES (1, 1000), (2, 1000);

CREATE TABLE oncall (doctor text PRIMARY KEY, on_call boolean NOT NULL);
INSERT INTO oncall VALUES ('alice', true), ('bob', true);

-- 06 migration race
CREATE TABLE schema_migrations (version text PRIMARY KEY);
CREATE TABLE users (
  id serial PRIMARY KEY,
  full_name text NOT NULL,
  name_lower text            -- the "expand" step already happened: new nullable column
);

-- 07 eventual consistency (outbox)
CREATE TABLE profiles (id int PRIMARY KEY, display_name text NOT NULL);
CREATE TABLE outbox (
  id bigserial PRIMARY KEY,
  aggregate_id int NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 08 saga
CREATE TABLE saga_instances (
  id text PRIMARY KEY,
  next_step int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running'
);
-- stands in for side effects in other services; PK makes every step idempotent
CREATE TABLE saga_effects (
  saga_id text NOT NULL,
  step text NOT NULL,
  PRIMARY KEY (saga_id, step)
);
