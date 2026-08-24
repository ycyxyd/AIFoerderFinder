// ============================================================================
// POST /api/assess — conversational intake.
// Pipeline: free text -> LLM fact extraction (whitelisted/sanitized)
//           -> deterministic rule engine (the judge)
//           -> LLM comprehensive advice (explain-only on decision snapshots)
//           -> persist decisions + audit log
// The AI never decides; extraction can't inject decision fields (sanitizer).
// ============================================================================

import { NextResponse } from 'next/server';
import type { UserProfile } from '../../../lib/types';
import { loadFundings } from '../../../lib/engine/registry';
import { evaluateAll } from '../../../lib/engine/evaluator';
import { extractProfile } from '../../../lib/ai/extract';
import { composeAdvice } from '../../../lib/ai/advise';
import { getMemoryRepository, getRepository } from '../../../lib/db/repository';
import {
  rateLimit,
  readRateLimitConfig,
  getClientKey,
  tooManyRequests,
} from '../../../lib/ratelimit';

const { max: ASSESS_MAX, windowMs: ASSESS_WINDOW } = readRateLimitConfig();

export async function POST(request: Request) {
  try {
    const { allowed, resetAt } = rateLimit(getClientKey(request), ASSESS_MAX, ASSESS_WINDOW);
    if (!allowed) return tooManyRequests(resetAt);

    const body = (await request.json()) as {
      text?: string;
      user_id?: string;
    };

    const text = (body.text ?? '').trim();
    if (text.length < 5) {
      return NextResponse.json(
        { error: 'Bitte beschreiben Sie Ihre Situation kurz (mindestens 5 Zeichen).' },
        { status: 400 }
      );
    }
    if (text.length > 3000) {
      return NextResponse.json({ error: 'Die Beschreibung ist zu lang (max. 3000 Zeichen).' }, { status: 400 });
    }

    // 1) Extract facts (LLM, whitelist-sanitized; deterministic fallback).
    const { profile, missing, usedMock: extractMock, error: extractError } = await extractProfile(text);
    const p = { ...profile } as UserProfile;
    if (body.user_id) p.user_id = body.user_id;

    // 2) Rule engine decides (deterministic, never AI).
    const fundings = loadFundings();
    if (fundings.length === 0) {
      return NextResponse.json(
        { error: 'Keine Förderungen hinterlegt. Bitte später erneut versuchen.' },
        { status: 503 }
      );
    }
    const decisions = evaluateAll(p, fundings);

    // 3) Persist decisions (Supabase when configured, memory fallback).
    let persisted = true;
    try {
      await getRepository().saveDecisions(decisions);
    } catch (err) {
      persisted = false;
      console.error('[api/assess] persist failed (memory fallback):', err);
      try {
        await getMemoryRepository().saveDecisions(decisions);
      } catch (memErr) {
        console.error('[api/assess] memory fallback failed:', memErr);
      }
    }

    // 4) Comprehensive advice (explain-only on the snapshots).
    const advice = await composeAdvice({ profile: p, decisions, text });

    // 5) Audit log.
    try {
      await getRepository().saveAudit({
        event_type: 'ASSESSMENT',
        user_id: body.user_id,
        payload: {
          intent: 'CONVERSATIONAL_INTAKE',
          question_excerpt: text.slice(0, 200),
          decisions: decisions.length,
          extract_used_mock: extractMock,
        },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[api/assess] audit log failed:', err);
    }

    return NextResponse.json({
      profile: p,
      missing,
      decisions,
      advice: advice.text,
      adviceUsedMock: advice.usedMock,
      adviceNeutralized: advice.neutralized,
      extractUsedMock: extractMock,
      extractError: extractError ?? undefined,
      persisted,
    });
  } catch (err) {
    console.error('[api/assess]', err);
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }
}
