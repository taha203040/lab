# 05 Normalisation vs denormalisation

Two sides of the same trade-off:

- **Read side** (`seed`, `broken`, `fixed`): what denormalisation gains, and the update anomaly it risks.
- **Write side** (`seed1`, `broken1`, `fixed1`): what denormalisation costs when the duplicated fact changes.

## Part 1: Read side and update anomaly

**Run:**
1. `npm run seed:05`, then `npx tsx src/05-normalisation/broken.ts`
2. `npm run seed:05` again, then `npx tsx src/05-normalisation/fixed.ts`

**Break:** the city of customer 7 is copied onto the orders table. Updating only `customers`
leaves the copy stale (update anomaly).

**Fix:** keep the normalised schema as the source of truth; denormalise only a hot read path you
measured, and update both copies in one transaction (or derive the copy with a trigger/job).

**Numbers (fill in):** join = ___ ms, flat = ___ ms

## Part 2: Write cost of the denormalised copy

**Scenario:** customer 1 is a "whale" with ~200k of the 1M orders. They move to a new city.

**Run:**
1. `npm run seed1:05` (skewed data: whale customer)
2. `npx tsx src/05-normalisation/broken1.ts`
3. `npx tsx src/05-normalisation/fixed1.ts`

**Break (`broken1.ts`):** keeping the copy in sync in ONE transaction rewrites ~200k rows, writes a
lot of WAL, and holds row locks until COMMIT. Other writers touching those orders get blocked.

**Fix (`fixed1.ts`), two strategies compared:**
- **A. Normalised:** the city lives in one row. One row changes, nobody is blocked. Cost: reads need the join.
- **B. Denormalised, batched:** keep the copy, but update it in small batches (short transactions,
  resumable with `customer_city <> $1`). Writers wait far less. Cost: for a short time the two
  copies disagree, so readers may see stale data.

**Numbers (fill in):**

| strategy | rowsTouched | bigWriteMs | walMB | writerMaxMs | writersBlockedOver200ms |
|----------|-------------|------------|-------|-------------|-------------------------|
| broken1 (denorm, one tx) | | | | | |
| A normalised | | | | | |
| B denorm, batched | | | | | |

If `writersBlockedOver200ms` is 0 in `broken1`, the big update finished too fast on your machine.
Raise the whale size in `seed1.ts` (e.g. `g <= 400000`) and re-seed.

## Do this on your own schema too

Find one fact stored in two places in your project. Is it deliberate? What keeps the copies in sync?
How many rows would one change to that fact rewrite?

## Say it aloud (90 s)

- What normalisation removes (duplication, update/insert/delete anomalies).
- When joins cost more than duplication does (a measured, hot read path).
- The maintenance cost of a denormalised copy: write amplification, long locks, WAL, and the
  window where copies disagree.
- The decision rule: denormalise only data that is read often and changes rarely.

## Interview questions

- What is normalisation?
- When would you denormalise?
- Why did you design this schema this way?
- What happens to writes when you denormalise? How would you update a copy that touches millions of rows?