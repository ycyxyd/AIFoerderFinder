// ============================================================================
// POST /api/explain
// Explain-only chat endpoint. Pipeline:
//   User input -> Intent Detection -> Policy Gate -> LLM (Explain-only)
//                 -> Response Filter -> audit log
// Blocked intents NEVER reach the LLM; predefined German templates are returned.
// ============================================================================

import { NextResponse } from 'next/server';
import { detectIntent } from '../../../lib/intent/detector';
import { applyPolicy } from '../../../lib/intent/policy';
import { explainDecision } from '../../../lib/ai/explain';
import { getFunding } from '../../../lib/engine/registry';
import { getDecision } from '../decisions/route';
import { getRepository } from '../../../lib/db/repository';
import {
  rateLimit,
  readRateLimitConfig,
  getClientKey,
  tooManyRequests,
} from '../../../lib/ratelimit';

// The AI endpoint is the costly one: 20 requests / 60 s per client by default
// (override via RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS).
const { max: EXPLAIN_MAX, windowMs: EXPLAIN_WINDOW } = readRateLimitConfig();

export async function POST(request: Request) {
  try {
    const { allowed, resetAt } = rateLimit(getClientKey(request), EXPLAIN_MAX, EXPLAIN_WINDOW);
    if (!allowed) return tooManyRequests(resetAt);

    const body = (await request.json()) as {
      decision_id?: string;
      question?: string;
      user_id?: string;
    };

    const question = (body.question ?? '').trim();
    if (!question) {
      return NextResponse.json({ error: 'Bitte geben Sie eine Frage ein.' }, { status: 400 });
    }

    // 1) Intent detection (hard rules, no LLM)
    const intent = detectIntent(question);

    // 2) Policy gate
    const policy = applyPolicy(intent.type);

    // 3) audit log (Supabase when configured, console fallback)
    const auditEntry = {
      event_type: policy.allowLLM ? 'LLM_CALL' : 'INTENT_BLOCKED',
      user_id: body.user_id,
      payload: {
        intent: intent.type,
        matched_keyword: intent.matchedKeyword ?? undefined,
        decision_id: body.decision_id ?? undefined,
        question_excerpt: question.slice(0, 200),
      },
      created_at: new Date().toISOString(),
    };
    try {
      await getRepository().saveAudit(auditEntry);
    } catch (err) {
      console.error('[api/explain] audit log failed:', err);
    }

    if (!policy.allowLLM) {
      return NextResponse.json({
        blocked: true,
        intent: intent.type,
        text: policy.template,
      });
    }

    // 4) Resolve decision (only existing snapshots — AI cannot create decisions)
    let decision = null;
    if (body.decision_id) {
      decision = await getDecision(body.decision_id);
      if (!decision) {
        return NextResponse.json(
          { error: 'Entscheidung nicht gefunden. Bitte führen Sie zuerst eine Prüfung durch.' },
          { status: 404 }
        );
      }
    }
    if (!decision) {
      return NextResponse.json(
        { error: 'Keine Entscheidung angegeben. Bitte führen Sie zuerst eine Prüfung durch.' },
        { status: 400 }
      );
    }

    // 5) Explain-only LLM call
    const result = await explainDecision({
      decision,
      funding: getFunding(decision.funding_id),
      question,
    });

    return NextResponse.json({
      blocked: false,
      intent: intent.type,
      text: result.text,
      usedMock: result.usedMock,
      neutralized: result.neutralized,
      error: result.error ?? undefined,
    });
  } catch (err) {
    console.error('[api/explain]', err);
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }
}
