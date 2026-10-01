# 03 Deadlock

**Run:** `npx tsx src/03-deadlock/broken.ts`, then `fixed.ts`

**Break:** transfer(1->2) and transfer(2->1) lock rows in opposite order. Postgres detects the
cycle after `deadlock_timeout` and aborts one transaction with SQLSTATE `40P01`.

**Fix:**
1. acquire locks in a consistent order (`ORDER BY id FOR UPDATE`) - prevents the cycle
2. keep transactions short
3. retry on `40P01` with backoff + jitter - handles what prevention misses

**Numbers (fill in):** failed (broken) = ___, failed (fixed) = ___, retries (fixed) = ___

**Say it aloud (90 s):** the cycle (A holds 1 wants 2, B holds 2 wants 1), why the DB must abort
one, prevention vs recovery, why retry must be specific to the deadlock error.

**Interview questions:** What is a deadlock and how do you prevent it? Why not retry every error?
How does your DB detect deadlocks?
