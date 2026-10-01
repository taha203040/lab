# Backend failure lab

Break it -> fix it -> prove it -> say it aloud. TypeScript + Postgres 16.

## Setup

```bash
npm install
npm run db:up        # Postgres on localhost:5433 (needs Docker)
npm run db:reset     # (re)create the schema
```

Override the connection with `DATABASE_URL` if you use your own Postgres.

## Run an experiment

```bash
npx tsx src/02-locks/broken.ts
npx tsx src/02-locks/fixed.ts
```

## Order

1. 01-pooling
2. 02-locks
3. 03-deadlock
4. 04-isolation
5. 05-normalisation (run `npm run seed:05` before each run)
6. 06-migration-race
7. 07-eventual-consistency
8. 08-saga
9. 09-circuit-breaker (no database needed)

## An experiment is done when

- [ ] `broken` reproduces the failure on demand
- [ ] `fixed` makes it disappear, and you can say why
- [ ] before/after numbers are written in that experiment's README
- [ ] you recorded a 90-second spoken answer: what it is, when it fails, the trade-off, one example from your own project
