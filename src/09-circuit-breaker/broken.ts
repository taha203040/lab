import { title } from '../shared/util';
import { makeFlakyService, withTimeout } from './flaky';

title('09 circuit breaker / BROKEN: keep calling a hung dependency');

const service = makeFlakyService();
let inFlight = 0;
let maxInFlight = 0;
let ok = 0;
let failed = 0;
let msSpentWaitingOnFailures = 0;
const pending: Promise<void>[] = [];

const ticker = setInterval(() => {
  pending.push(
    (async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const started = Date.now();
      try {
        await withTimeout(service(), 300);
        ok++;
      } catch {
        failed++;
        msSpentWaitingOnFailures += Date.now() - started;
      } finally {
        inFlight--;
      }
    })(),
  );
}, 50);

await new Promise((r) => setTimeout(r, 5000));
clearInterval(ticker);
await Promise.all(pending);

console.table({ ok, failed, maxInFlight, msSpentWaitingOnFailures });
console.log('Every request during the outage burns a slot (and 300 ms) before failing.');
