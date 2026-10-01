# 02 Locks / race conditions

**Run:** `npx tsx src/02-locks/broken.ts`, then `fixed.ts`

**Break:** 50 concurrent "read n, add 1, write n+1". Final value is below 50 (lost updates).

**Fix (compare all three):**
1. atomic `UPDATE ... SET n = n + 1` - cheapest, use when the new value is a function of the old
2. `SELECT ... FOR UPDATE` - pessimistic, queues writers, use when you need to read then decide
3. version column - optimistic, retries on conflict, use when conflicts are rare

**Numbers (fill in):**

| strategy | actual | ms | retries |
|----------|--------|----|---------|
| atomic   |        |    |         |
| for update |      |    |         |
| optimistic |      |    |         |

**Say it aloud (90 s):** why read-modify-write races, which of the three you pick and when,
what each costs (blocking vs retries), where this exists in your own project.

**Interview questions:** How do you stop two requests updating the same row incorrectly?
Pessimistic vs optimistic locking? What does FOR UPDATE actually lock?
