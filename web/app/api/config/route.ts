// ============================================================================
// GET /api/config — public capabilities for the client UI
// (e.g. whether account creation should be offered).
// ============================================================================

import { NextResponse } from 'next/server';
import { supabaseConfigured } from '../../../lib/db/server';
import { hasMistralKey } from '../../../lib/ai/mistral';

export async function GET() {
  return NextResponse.json({
    supabaseConfigured: supabaseConfigured(),
    aiConfigured: hasMistralKey(),
    fundingCount: null, // filled lazily by /api/fundings to avoid fs read on every config call
  });
}
