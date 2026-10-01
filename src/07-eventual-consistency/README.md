# 07 Eventual consistency

**Run:** `npx tsx src/07-eventual-consistency/broken.ts`, then `fixed.ts`

**Break:** write the DB, then update a derived store (cache / replica / index). Crash between the
two and they diverge forever.

**Fix:** outbox pattern - write the row and an event in ONE transaction; a relay publishes events
(`FOR UPDATE SKIP LOCKED`); the consumer dedupes by event id because delivery is at-least-once.
Reads that must see your own write go to the source of truth (read-after-write).

**Numbers (fill in):** staleWindowMs = ___, duplicatesIgnored = ___

**Say it aloud (90 s):** strong vs eventual consistency, where each is acceptable (follower count vs
account balance), why dual writes break, why consumers must be idempotent.

**Interview questions:** What is eventual consistency and when is it acceptable? How do you keep a
cache or search index in sync with a database? What is read-after-write consistency?
