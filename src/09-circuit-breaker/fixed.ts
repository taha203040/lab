import { title } from '../shared/util';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { makeFlakyService, withTimeout } from './flaky';

title('09 circuit breaker / FIXED: fail fast while the dependency is down');

const t0 = Date.now();
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetMs: 1000,
  onStateChange: (from, to) => console.log(`  +${Date.now() - t0}ms  ${from} -> ${to}`),
});

const service = makeFlakyService();
let inFlight = 0;
let maxInFlight = 0;
let ok = 0;
let slowFailures = 0;
let failedFast = 0;
let msSpentWaitingOnFailures = 0;
const pending: Promise<void>[] = [];

const ticker = setInterval(() => {
  pending.push(
    (async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const started = Date.now();
      try {
        await breaker.call(() => withTimeout(service(), 300));
        ok++;
      } catch (e) {
        if (e instanceof CircuitOpenError) {
          failedFast++; // fallback (cache / default / friendly error) would go here
        } else {
          slowFailures++;
          msSpentWaitingOnFailures += Date.now() - started;
        }
      } finally {
        inFlight--;
      }
    })(),
  );
}, 50);

await new Promise((r) => setTimeout(r, 5000));
clearInterval(ticker);
await Promise.all(pending);

console.table({ ok, slowFailures, failedFast, maxInFlight, msSpentWaitingOnFailures });
console.log('Compare msSpentWaitingOnFailures and maxInFlight with broken.ts.');
console.log('Production: breaker + per-call timeout + retry with backoff (only on idempotent calls) + fallback.');
