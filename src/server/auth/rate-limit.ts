export interface LoginRateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds?: number;
}

/**
 * Login rate-limit boundary.
 *
 * TASK-003 ships `MemoryLoginRateLimiter`, which is process-local (in-memory).
 * It is NOT a production distributed limiter and does NOT coordinate across
 * multiple application containers or instances.
 *
 * The approved future production implementation is Redis (BullMQ/Redis
 * infrastructure). Swap the `LoginRateLimiter` implementation later without
 * changing login application services.
 */
export interface LoginRateLimiter {
  consume(key: string): Promise<LoginRateLimitResult>;
}

export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

interface MemoryBucket {
  count: number;
  resetAt: number;
}

export class MemoryLoginRateLimiter implements LoginRateLimiter {
  private readonly buckets = new Map<string, MemoryBucket>();

  constructor(
    private readonly maxAttempts = LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    private readonly windowMs = LOGIN_RATE_LIMIT_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async consume(key: string): Promise<LoginRateLimitResult> {
    const now = this.now();
    this.prune(now);

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }

    if (existing.count >= this.maxAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return { allowed: true };
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

export function loginRateLimitKey(ipAddress: string): string {
  return `login:${ipAddress}`;
}

let defaultLimiter: LoginRateLimiter | undefined;

export function getLoginRateLimiter(): LoginRateLimiter {
  defaultLimiter ??= new MemoryLoginRateLimiter();
  return defaultLimiter;
}

export function resetLoginRateLimiterForTests(): void {
  defaultLimiter = new MemoryLoginRateLimiter();
}
