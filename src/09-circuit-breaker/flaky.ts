import { sleep } from '../shared/util';

/** Healthy, then hangs for a window (1.0s - 3.5s after creation), then healthy again. */
export function makeFlakyService(downFromMs = 1000, downToMs = 3500): () => Promise<string> {
  const start = Date.now();
  return async () => {
    const t = Date.now() - start;
    if (t >= downFromMs && t < downToMs) {
      await sleep(2000); // dependency hangs instead of failing fast
      throw new Error('upstream hung');
    }
    await sleep(20);
    return 'ok';
  };
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
