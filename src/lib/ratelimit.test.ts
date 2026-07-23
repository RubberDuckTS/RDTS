import { describe, it, expect, vi } from 'vitest';
import { makeRateLimiter, clientIp } from './ratelimit';

describe('rate limiter', () => {
  it('allows under the limit', async () => {
    const check = makeRateLimiter({ limit: async () => ({ success: true }) } as any);
    expect(await check('1.2.3.4')).toEqual({ ok: true });
  });
  it('blocks over the limit', async () => {
    const check = makeRateLimiter({ limit: async () => ({ success: false }) } as any);
    expect(await check('1.2.3.4')).toEqual({ ok: false });
  });
  it('fails open when the limiter throws', async () => {
    const check = makeRateLimiter({ limit: async () => { throw new Error('redis down'); } } as any);
    expect(await check('1.2.3.4')).toEqual({ ok: true });
  });
  it('fails open when no limiter is configured', async () => {
    const check = makeRateLimiter(null);
    expect(await check('1.2.3.4')).toEqual({ ok: true });
  });
});

describe('clientIp', () => {
  it('extracts first IP from x-forwarded-for header', () => {
    const req = new Request('https://x/', {
      headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }
    });
    expect(clientIp(req)).toBe('1.1.1.1');
  });
  it('returns "unknown" when no IP headers are present', () => {
    const req = new Request('https://x/', { headers: {} });
    expect(clientIp(req)).toBe('unknown');
  });
});
