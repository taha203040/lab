# 05 Normalisation vs denormalisation

**Run:** `npm run seed:05`, then `npx tsx src/05-normalisation/broken.ts`.
Seed again, then `npx tsx src/05-normalisation/fixed.ts`.

**Break:** the city of customer 7 is copied onto the orders table. Updating only `customers`
leaves the copy stale (update anomaly).

**Fix:** keep the normalised schema as the source of truth; denormalise only a hot read path you
measured, and update both copies in one transaction (or derive the copy with a trigger/job).

**Do this on your own schema too:** find one fact stored in two places in your project. Is it
deliberate? What keeps the copies in sync?

**Numbers (fill in):** join = ___ ms, flat = ___ ms

**Say it aloud (90 s):** what normalisation removes (duplication, anomalies), when joins cost
more than duplication does, the maintenance cost of a denormalised copy.

**Interview questions:** What is normalisation? When would you denormalise? Why did you design this schema this way?
