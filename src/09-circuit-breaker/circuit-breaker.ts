export type BreakerState = 'closed' | 'open' | 'half-open';

export class CircuitOpenError extends Error {}

export interface BreakerOptions {
  failureThreshold: number;
  resetMs: number;
  onStateChange?: (from: BreakerState, to: BreakerState) => void;
}

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private probing = false;

  constructor(private readonly opts: BreakerOptions) {}

  private transition(to: BreakerState): void {
    if (to === this.state) return;
    const from = this.state;
    this.state = to;
    this.opts.onStateChange?.(from, to);
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.opts.resetMs) throw new CircuitOpenError('circuit open');
      this.transition('half-open');
    }
    if (this.state === 'half-open') {
      if (this.probing) throw new CircuitOpenError('half-open: probe already in flight');
      this.probing = true; // exactly one trial request
    }

    try {
      const result = await fn();
      this.failures = 0;
      this.probing = false;
      if (this.state === 'half-open') this.transition('closed');
      return result;
    } catch (e) {
      this.probing = false;
      this.failures++;
      if (this.state !== 'open' && (this.state === 'half-open' || this.failures >= this.opts.failureThreshold)) {
        this.openedAt = Date.now();
        this.transition('open');
      }
      throw e;
    }
  }
}
