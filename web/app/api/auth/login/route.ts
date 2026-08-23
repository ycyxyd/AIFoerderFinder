// ============================================================================
// POST /api/auth/login — returns a session token (JWT) for the client.
// The token is stored by the client (localStorage) and sent back as
// Authorization: Bearer for /api/auth/me. MVP: stateless, no cookies.
// ============================================================================

import { NextResponse } from 'next/server';
import { getAdminClient, supabaseConfigured } from '../../../../lib/db/server';
import {
  rateLimit,
  readRateLimitConfig,
  getClientKey,
  tooManyRequests,
} from '../../../../lib/ratelimit';

// Brute-force protection: limited attempts per window per client
// (RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS; default 20 / 60 s).
const { max: AUTH_MAX, windowMs: AUTH_WINDOW } = readRateLimitConfig();

export async function POST(request: Request) {
  const { allowed, resetAt } = rateLimit(getClientKey(request), AUTH_MAX, AUTH_WINDOW);
  if (!allowed) return tooManyRequests(resetAt);

  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase nicht konfiguriert (SUPABASE_SERVICE_ROLE_KEY fehlt).' },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = (body?.email ?? '').trim().toLowerCase();
  const password = body?.password ?? '';

  if (!email || !password) {
    return NextResponse.json({ error: 'E-Mail und Passwort angeben.' }, { status: 400 });
  }

  try {
    const { data, error } = await getAdminClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return NextResponse.json({ error: 'E-Mail oder Passwort ist falsch.' }, { status: 401 });
    }
    return NextResponse.json({
      access_token: data.session.access_token,
      user_id: data.user.id,
      email: data.user.email,
    });
  } catch (err) {
    console.error('[api/auth/login]', err);
    return NextResponse.json({ error: 'Anmeldung fehlgeschlagen.' }, { status: 500 });
  }
}
