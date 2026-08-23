// ============================================================================
// POST /api/decisions
// Creates eligibility decisions for ALL fundings for a given user profile.
// This is the ONLY endpoint that produces DecisionSnapshots — via the
// deterministic engine, never via AI. Snapshots are persisted through the
// repository (Supabase when configured, in-memory fallback otherwise).
// ============================================================================

import { NextResponse } from 'next/server';
import type { UserProfile } from '../../../lib/types';
import { evaluateAll } from '../../../lib/engine/evaluator';
import { loadFundings } from '../../../lib/engine/registry';
import { getMemoryRepository, getRepository } from '../../../lib/db/repository';

// Convenience accessor for the explain route. Tries the primary repository,
// then the in-process fallback (works while Supabase migration is pending).
export async function getDecision(decisionId: string) {
  try {
    const d = await getRepository().getDecision(decisionId);
    if (d) return d;
  } catch (err) {
    console.error('[api/decisions] primary read failed:', err);
  }
  try {
    return await getMemoryRepository().getDecision(decisionId);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      profile?: Partial<UserProfile>;
      user_id?: string;
    };
    const profile = (body.profile ?? {}) as UserProfile;
    if (body.user_id) profile.user_id = body.user_id;

    const fundings = loadFundings();
    if (fundings.length === 0) {
      return NextResponse.json(
        { error: 'Keine Förderungen hinterlegt. Warten Sie auf die Datenlieferung oder prüfen Sie data/foerderungen/.' },
        { status: 503 }
      );
    }

    const results = evaluateAll(profile, fundings);

    const repo = getRepository();
    let persisted = true;
    try {
      await repo.saveDecisions(results);
    } catch (err) {
      // e.g. tables not migrated yet -> keep the response usable, log loudly,
      // and mirror the snapshots into the in-process store so reads work.
      persisted = false;
      console.error('[api/decisions] persist failed (falling back to memory):', err);
      try {
        await getMemoryRepository().saveDecisions(results);
      } catch (memErr) {
        console.error('[api/decisions] memory fallback failed:', memErr);
      }
    }

    return NextResponse.json({ decisions: results, persisted });
  } catch (err) {
    console.error('[api/decisions]', err);
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }
}
