# 09 Circuit breaker

**Run:** `npx tsx src/09-circuit-breaker/broken.ts`, then `fixed.ts` (no database needed)

**Break:** a dependency hangs for ~2.5 s. Every request waits 300 ms and fails; callers pile up and
would exhaust your pool/threads (see 01-pooling).

**Fix:** closed -> open after 5 failures, fail fast while open, after `resetMs` allow ONE probe
(half-open); success closes it, failure re-opens it. Combine with a timeout, retry with backoff
(idempotent calls only) and a fallback.

**Numbers (fill in):** msSpentWaitingOnFailures broken = ___, fixed = ___; maxInFlight broken = ___, fixed = ___

**Say it aloud (90 s):** the three states, how it prevents cascading failure, retry vs breaker
(retries amplify load on a struggling service; the breaker stops it), what the fallback should be.

**Interview questions:** What is a circuit breaker? How do you stop a failing dependency from taking
your service down? Retry vs circuit breaker?
