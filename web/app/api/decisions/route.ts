// ============================================================================
// POST /api/decisions
// Creates eligibility decisions for ALL fundings for a given user profile.
// This is the ONLY endpoint that produces DecisionSnapshots — via the
// deterministic engine, never via AI. For MVP the store is in-memory
// (per-process); Supabase persistence is the next iteration.
// ============================================================================

import { NextResponse } from 'next/server';
import type { UserProfile } from '../../../lib/types';
import { evaluateAll } from '../../../lib/engine/evaluator';
import { loadFundings } from '../../../lib/engine/registry';

// In-memory decision store (MVP). Supabase replaces this in the next iteration.
const decisions = new Map<string, ReturnType<typeof evaluateAll>[number]>();

export function getDecision(decisionId: string) {
  return decisions.get(decisionId);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { profile?: Partial<UserProfile> };
    const profile = (body.profile ?? {}) as UserProfile;

    const fundings = loadFundings();
    if (fundings.length === 0) {
      return NextResponse.json(
        { error: 'Keine Förderungen hinterlegt. Warten Sie auf die Datenlieferung oder prüfen Sie data/foerderungen/.' },
        { status: 503 }
      );
    }

    const results = evaluateAll(profile, fundings);
    for (const r of results) {
      decisions.set(r.decision_id, r);
    }

    return NextResponse.json({ decisions: results });
  } catch (err) {
    console.error('[api/decisions]', err);
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }
}
