import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rateLimit,
  readRateLimitConfig,
  getClientKey,
  tooManyRequests,
  _clearRateLimitBuckets,
} from '../ratelimit';

describe('rateLimit (sliding window)', () => {
  beforeEach(() => {
    _clearRateLimitBuckets();
  });

  it('allows requests up to the max, then blocks', () => {
    for (let i = 0; i < 3; i++) {
      const r = rateLimit('ip-a', 3, 60_000);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(2 - i);
    }
    const blocked = rateLimit('ip-a', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('treats different keys independently', () => {
    for (let i = 0; i < 3; i++) rateLimit('ip-a', 3, 60_000);
    expect(rateLimit('ip-a', 3, 60_000).allowed).toBe(false);
    expect(rateLimit('ip-b', 3, 60_000).allowed).toBe(true);
  });

  it('prunes old timestamps so the window slides forward', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    for (let i = 0; i < 3; i++) rateLimit('ip-a', 3, 1_000);

    // Advance past the window: the 3 old hits expire.
    vi.spyOn(Date, 'now').mockReturnValue(now + 1_500);
    expect(rateLimit('ip-a', 3, 1_000).allowed).toBe(true);

    vi.restoreAllMocks();
  });

  it('reports a usable resetAt on the blocked response', () => {
    const r = tooManyRequests(Date.now() + 5_000);
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('5');
  });
});

describe('readRateLimitConfig', () => {
  const orig = process.env;
  beforeEach(() => {
    process.env = { ...orig };
  });
  afterEach(() => {
    process.env = orig;
  });

  it('uses defaults when env is unset', () => {
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    expect(readRateLimitConfig()).toEqual({ max: 20, windowMs: 60_000 });
  });

  it('reads env overrides', () => {
    process.env.RATE_LIMIT_MAX = '5';
    process.env.RATE_LIMIT_WINDOW_MS = '30000';
    expect(readRateLimitConfig()).toEqual({ max: 5, windowMs: 30_000 });
  });

  it('ignores invalid env values', () => {
    process.env.RATE_LIMIT_MAX = 'abc';
    process.env.RATE_LIMIT_WINDOW_MS = '-1';
    expect(readRateLimitConfig()).toEqual({ max: 20, windowMs: 60_000 });
  });
});

describe('getClientKey', () => {
  it('prefers the first X-Forwarded-For hop', () => {
    const req = new Request('http://localhost/api/explain', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientKey(req)).toBe('1.2.3.4');
  });

  it('falls back to X-Real-IP', () => {
    const req = new Request('http://localhost/api/explain', {
      headers: { 'x-real-ip': '9.9.9.9' },
    });
    expect(getClientKey(req)).toBe('9.9.9.9');
  });

  it('falls back to unknown', () => {
    expect(getClientKey(new Request('http://localhost/api/explain'))).toBe('unknown');
  });
});
