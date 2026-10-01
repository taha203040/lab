# 04 Isolation levels

**Run:** `npx tsx src/04-isolation/broken.ts`, then `fixed.ts`

**Break:**
1. READ COMMITTED: the same SELECT inside one transaction returns different values (non-repeatable read).
2. REPEATABLE READ: two transactions each check "2 on call", each remove themselves -> 0 on call (write skew).

**Fix:**
1. REPEATABLE READ gives one snapshot for the whole transaction.
2. SERIALIZABLE aborts one transaction with `40001`; retry it and the invariant holds.

**Postgres facts to state correctly:** default is READ COMMITTED; READ UNCOMMITTED behaves like
READ COMMITTED (no dirty reads); REPEATABLE READ also prevents phantoms; only SERIALIZABLE stops write skew.

**Say it aloud (90 s):** the anomalies each level removes, why not everything SERIALIZABLE
(throughput, retries), what your app must do when it picks SERIALIZABLE (retry loop).

**Interview questions:** Explain isolation levels. What is write skew? Why isn't every transaction serializable?
