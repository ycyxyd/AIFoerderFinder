// ============================================================================
// POST /api/auth/signup
// Creates a Supabase Auth user AND records the mandatory legal consent
// (accepted_terms_at) in public.users. Compliance gate: signup is REJECTED
// unless accepted_terms === true.
// ============================================================================

import { NextResponse } from 'next/server';
import { classifyDbError, getAdminClient, supabaseConfigured } from '../../../../lib/db/server';
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

  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string; accepted_terms?: boolean }
    | null;

  const email = (body?.email ?? '').trim().toLowerCase();
  const password = body?.password ?? '';
  const acceptedTerms = body?.accepted_terms === true;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }, { status: 400 });
  }
  if (!acceptedTerms) {
    return NextResponse.json(
      { error: 'Die Beratungs- und Haftungshinweise müssen akzeptiert werden (accepted_terms).' },
      { status: 400 }
    );
  }

  const client = getAdminClient();
  try {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // MVP: no SMTP configured; production should send verification
    });
    if (error) throw error;
    if (!data.user) throw new Error('Kein Benutzer erstellt');

    // Record mandatory legal consent.
    const { error: insertError } = await client.from('users').upsert(
      {
        id: data.user.id,
        email,
        password_hash: 'managed-by-supabase-auth',
        accepted_terms_at: new Date().toISOString(),
        plan: 'free',
      },
      { onConflict: 'id' }
    );
    if (insertError) {
      // The auth user exists but consent row failed (e.g. table not migrated).
      return NextResponse.json(
        {
          error: `Konto angelegt, aber Einwilligungsnachweis fehlgeschlagen (${classifyDbError(insertError)}). Bitte Migrationen anwenden: docs/SUPABASE_SETUP.md`,
          code: classifyDbError(insertError),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ user_id: data.user.id, email }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already')) {
      return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 });
    }
    console.error('[api/auth/signup]', err);
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 });
  }
}
