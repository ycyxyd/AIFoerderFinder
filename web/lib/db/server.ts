// ============================================================================
// Supabase server client (admin / service-role).
// IMPORTANT: this module is SERVER-ONLY. The service-role key bypasses RLS and
// must never be exposed to the client (no NEXT_PUBLIC_ prefix, no imports from
// client components). RLS policies remain active for any client-direct access
// as defense in depth.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let admin: SupabaseClient | null = null;

/** True when the server can talk to Supabase (URL + service role configured). */
export function supabaseConfigured(): boolean {
  return Boolean(url && serviceRoleKey);
}

export function getAdminClient(): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase nicht konfiguriert. NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local setzen.'
    );
  }
  if (!admin) {
    admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/**
 * Map a DB error to a friendly code so callers can degrade gracefully
 * (e.g. tables not migrated yet -> 'TABLE_NOT_FOUND').
 */
export function classifyDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('42P01')) return 'TABLE_NOT_FOUND'; // undefined_table
  if (msg.includes('42P02')) return 'COLUMN_NOT_FOUND';
  if (msg.includes('42501')) return 'PERMISSION_DENIED'; // RLS / privileges
  if (msg.includes('23505')) return 'DUPLICATE';
  return 'DB_ERROR';
}
