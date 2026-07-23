import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Limiter = Pick<Ratelimit, 'limit'> | null;

/** Build the check fn from any limiter-like object (real or fake). Fail-open. */
export function makeRateLimiter(limiter: Limiter) {
  return async function check(ip: string): Promise<{ ok: boolean }> {
    if (!limiter) return { ok: true };
    try {
      const { success } = await limiter.limit(ip);
      return { ok: success };
    } catch (err) {
      console.warn('[ratelimit] limiter error — failing open:', err);
      return { ok: true };
    }
  };
}

const url = import.meta.env.UPSTASH_REDIS_REST_URL;
const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN;

const realLimiter: Limiter =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        // 30 requests / 10 minutes per IP — generous for a human, caps a script.
        limiter: Ratelimit.slidingWindow(30, '10 m'),
        prefix: 'rdts-duck',
      })
    : null;

export const checkRateLimit = makeRateLimiter(realLimiter);

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || request.headers.get('x-real-ip') || 'unknown';
}
