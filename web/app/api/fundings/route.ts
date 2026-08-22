// ============================================================================
// GET /api/fundings — public metadata about the structured Förderungen.
// (IDs, names, categories — NOT the rules; the rules stay server-side.)
// ============================================================================

import { NextResponse } from 'next/server';
import { loadFundings } from '../../../lib/engine/registry';

export async function GET() {
  const fundings = loadFundings().map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    provider: f.provider,
    description: f.description ?? undefined,
    last_verified: f.last_verified ?? undefined,
  }));
  return NextResponse.json({ fundings });
}
