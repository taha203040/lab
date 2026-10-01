# 06 Migration race conditions

Two different races. Do both.

**A) Concurrent migration runners** - `broken.ts` / `fixed.ts`
Two pods start together, both see "not applied", both apply a non-idempotent migration (n = 200, not 100).
Fix: `pg_advisory_lock` around check + apply, or run migrations once (Kubernetes Job / init step), and
write migrations to be idempotent.

**B) Migration vs live traffic** - `backfill-broken.ts` / `backfill-fixed.ts`
Backfilling a new column while old code keeps inserting leaves NULLs behind.
Fix: expand (add nullable column) -> deploy dual-write -> backfill in batches -> verify (0 NULLs)
-> switch reads -> contract in a later release. Never ship a schema change and a breaking code change together.

**Numbers (fill in):** appliedTwice (broken) = ___, rowsMissingBackfill (broken) = ___, (fixed) = ___

**Say it aloud (90 s):** zero-downtime migration steps, why each step is a separate deploy, how you prevent
two runners, how you verify a backfill.

**Interview questions:** How do you migrate a schema with zero downtime? What if two instances migrate at once?
