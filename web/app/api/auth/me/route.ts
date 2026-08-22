// ============================================================================
// GET /api/auth/me — validates a bearer token and returns the user record
// including the mandatory accepted_terms_at timestamp.
// ============================================================================

import { NextResponse } from 'next/server';
import { getAdminClient, supabaseConfigured } from '../../../../lib/db/server';

export async function GET(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 503 });
  }

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Kein Token angegeben.' }, { status: 401 });
  }

  const client = getAdminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Ungültiges oder abgelaufenes Token.' }, { status: 401 });
  }

  const { data: profile } = await client
    .from('users')
    .select('accepted_terms_at, plan')
    .eq('id', data.user.id)
    .maybeSingle();

  return NextResponse.json({
    user_id: data.user.id,
    email: data.user.email,
    accepted_terms_at: profile?.accepted_terms_at ?? null,
    plan: profile?.plan ?? 'free',
  });
}
