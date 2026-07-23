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

if (!realLimiter) {
  console.warn(
    '[ratelimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — ' +
      'rate limiting is DISABLED (fail-open). Public LLM endpoints are unthrottled ' +
      'until these are configured in the environment.',
  );
}

export const checkRateLimit = makeRateLimiter(realLimiter);

/** Best-effort client IP from proxy headers. Prefer x-real-ip: on Vercel it is
 *  the true client IP set by the platform and is NOT client-appendable, unlike
 *  the leftmost x-forwarded-for token (which a caller can spoof to dodge the
 *  per-IP rate limit). Fall back to the leftmost x-forwarded-for only if
 *  x-real-ip is absent (e.g. local dev). */
export function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || 'unknown';
}
