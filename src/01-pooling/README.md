# 01 Pooling

**Run:** `npx tsx src/01-pooling/broken.ts`, then `fixed.ts`, then `leak.ts`

**Break:** 50 concurrent requests, pool of 5, each request holds a connection for 200 ms.
Requests queue, then fail with "timeout exceeded when trying to connect".

**Fix:** do the slow work outside the connection; borrow only for the query. Same pool size.
Never hold a connection across an HTTP call, a queue publish, or a sleep.

**Numbers (fill in):**

| version | ok | failed | maxWaiting | elapsedMs |
|---------|----|--------|------------|-----------|
| broken  |    |        |            |           |
| fixed   |    |        |            |           |

**Say it aloud (90 s):** what a pool is, why connections are expensive, what "pool exhausted"
looks like (slow app, not a DB error), sizing rule (instances x max < max_connections),
leaks vs slow holders.

**Interview questions:** What happens when the pool is exhausted? How do you size a pool?
Why can adding instances take the database down?
