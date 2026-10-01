export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function title(text: string): void {
  console.log(`\n=== ${text} ===`);
}

export function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Postgres SQLSTATE of an error, if it has one (e.g. 40P01 deadlock, 40001 serialization). */
export function pgCode(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    return String((e as { code: unknown }).code);
  }
  return undefined;
}

export interface RetryOptions {
  retryOn?: string[];
  tries?: number;
  baseMs?: number;
  onRetry?: (code: string, attempt: number) => void;
}

/** Retries only on specific SQLSTATEs, with exponential backoff + jitter. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retryOn = ['40P01', '40001'], tries = 5, baseMs = 25 } = opts;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const code = pgCode(e);
      if (!code || !retryOn.includes(code) || attempt >= tries) throw e;
      opts.onRetry?.(code, attempt + 1);
      await sleep(2 ** attempt * baseMs + Math.random() * baseMs);
    }
  }
}

export function runConcurrently<T>(
  n: number,
  fn: (i: number) => Promise<T>,
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)));
}

export function summarize<T>(results: PromiseSettledResult<T>[]) {
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const codes = [...new Set(failed.map((r) => pgCode(r.reason) ?? 'n/a'))].join(',') || '-';
  return {
    ok: results.length - failed.length,
    failed: failed.length,
    errorCodes: codes,
    firstError: failed[0] ? messageOf(failed[0].reason) : '-',
  };
}

export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - start) };
}
