// ============================================================================
// lib/ratelimit.ts — dependency-free in-memory sliding-window rate limiter.
// Server-only. Protects the AI endpoint (cost) and auth endpoints (brute
// force) against abuse.
//
// NOTE: state is per-server-process (Map). Fine for the single-process
// `pnpm start` deployment; switch to a shared store (Redis/Upstash) if the
// app is ever scaled to multiple instances.
// ============================================================================

export interface RateLimitConfig {
  max: number;        // max requests per window
  windowMs: number;   // sliding window length in ms
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;  // requests still allowed in the current window
  resetAt: number;    // epoch ms when the window resets (Retry-After)
}

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Optional hard cap so the Map cannot grow unbounded in a long-lived server.
const MAX_KEYS = 10_000;

/** Read limits from env with sane defaults (20 req / 60 s). */
export function readRateLimitConfig(): RateLimitConfig {
  const max = Number(process.env.RATE_LIMIT_MAX);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS);
  return {
    max: Number.isFinite(max) && max > 0 ? max : 20,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
  };
}

function prune(bucket: Bucket, windowMs: number, now: number) {
  while (bucket.timestamps.length > 0 && bucket.timestamps[0] <= now - windowMs) {
    bucket.timestamps.shift();
  }
}

/**
 * Sliding-window check. Call once per request. When `allowed` is false the
 * caller should respond HTTP 429 with Retry-After: ceil((resetAt - now)/1000).
 */
export function rateLimit(key: string, max = 20, windowMs = 60_000): RateLimitResult {
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    // Prevent unbounded growth: if the map is at capacity, evict the oldest
    // entry. Keeps worst-case O(1) per request.
    if (buckets.size >= MAX_KEYS) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    buckets.set(key, bucket);
  }

  prune(bucket, windowMs, now);

  if (bucket.timestamps.length >= max) {
    const resetAt = bucket.timestamps[0] + windowMs;
    return { allowed: false, remaining: 0, resetAt };
  }

  bucket.timestamps.push(now);
  return { allowed: true, remaining: max - bucket.timestamps.length, resetAt: now + windowMs };
}

/**
 * Best-effort client key: X-Forwarded-For (first hop) → X-Real-IP → unknown.
 * Behind a proxy, make sure the proxy sets X-Forwarded-For and strips client
 * input. Direct exposure = all clients share the "unknown" bucket (safe, just
 * conservative).
 */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Build a standard 429 response. */
export function tooManyRequests(resetAt: number): Response {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return new Response(JSON.stringify({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
  });
}

/** Test hook: clear all buckets. */
export function _clearRateLimitBuckets() {
  buckets.clear();
}
