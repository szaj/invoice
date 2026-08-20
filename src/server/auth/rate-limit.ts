export interface AuthRateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds?: number;
}

/**
 * Auth rate-limit boundary used by login and password recovery.
 *
 * TASK-003/TASK-004 ship `MemoryWindowRateLimiter`, which is process-local
 * (in-memory). It is NOT a production distributed limiter and does NOT
 * coordinate across multiple application containers or instances.
 *
 * The approved future production implementation is Redis (BullMQ/Redis
 * infrastructure). Swap the `AuthRateLimiter` implementation later without
 * changing login or password-recovery application services.
 */
export interface AuthRateLimiter {
  consume(key: string): Promise<AuthRateLimitResult>;
}

/** @deprecated Use AuthRateLimiter. Kept as a compatible alias for login callers. */
export type LoginRateLimiter = AuthRateLimiter;
/** @deprecated Use AuthRateLimitResult. */
export type LoginRateLimitResult = AuthRateLimitResult;

export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

interface MemoryBucket {
  count: number;
  resetAt: number;
}

export class MemoryWindowRateLimiter implements AuthRateLimiter {
  private readonly buckets = new Map<string, MemoryBucket>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async consume(key: string): Promise<AuthRateLimitResult> {
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

export class MemoryLoginRateLimiter extends MemoryWindowRateLimiter {
  constructor(
    maxAttempts = LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs = LOGIN_RATE_LIMIT_WINDOW_MS,
    now: () => number = Date.now,
  ) {
    super(maxAttempts, windowMs, now);
  }
}

export class MemoryPasswordResetRateLimiter extends MemoryWindowRateLimiter {
  constructor(
    maxAttempts = PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs = PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    now: () => number = Date.now,
  ) {
    super(maxAttempts, windowMs, now);
  }
}

export function loginRateLimitKey(ipAddress: string): string {
  return `login:${ipAddress}`;
}

export function passwordResetRateLimitKey(ipAddress: string): string {
  return `password-reset:${ipAddress}`;
}

let defaultLoginLimiter: AuthRateLimiter | undefined;
let defaultPasswordResetLimiter: AuthRateLimiter | undefined;

export function getLoginRateLimiter(): AuthRateLimiter {
  defaultLoginLimiter ??= new MemoryLoginRateLimiter();
  return defaultLoginLimiter;
}

export function getPasswordResetRateLimiter(): AuthRateLimiter {
  defaultPasswordResetLimiter ??= new MemoryPasswordResetRateLimiter();
  return defaultPasswordResetLimiter;
}

export function resetLoginRateLimiterForTests(): void {
  defaultLoginLimiter = new MemoryLoginRateLimiter();
}

export function resetPasswordResetRateLimiterForTests(): void {
  defaultPasswordResetLimiter = new MemoryPasswordResetRateLimiter();
}
