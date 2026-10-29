export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

/**
 * In-memory fixed-window limiter. Enough for a single instance; state is lost on restart and
 * not shared between instances.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly now: () => number;

  constructor(private readonly options: RateLimiterOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Records an attempt for the key and returns whether it is within the limit. */
  consume(key: string): boolean {
    const now = this.now();
    const entry = this.hits.get(key);

    if (!entry || entry.resetAt <= now) {
      this.prune(now);
      this.hits.set(key, { count: 1, resetAt: now + this.options.windowMs });
      return true;
    }

    entry.count += 1;
    return entry.count <= this.options.limit;
  }

  private prune(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}
