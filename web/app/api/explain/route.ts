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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      decision_id?: string;
      question?: string;
    };

    const question = (body.question ?? '').trim();
    if (!question) {
      return NextResponse.json({ error: 'Bitte geben Sie eine Frage ein.' }, { status: 400 });
    }

    // 1) Intent detection (hard rules, no LLM)
    const intent = detectIntent(question);

    // 2) Policy gate
    const policy = applyPolicy(intent.type);

    // audit log (MVP: console; Supabase audit_logs table in next iteration)
    console.log('[audit]', JSON.stringify({
      event_type: policy.allowLLM ? 'LLM_CALL' : 'INTENT_BLOCKED',
      intent: intent.type,
      matched_keyword: intent.matchedKeyword ?? undefined,
      decision_id: body.decision_id ?? undefined,
      ts: new Date().toISOString(),
    }));

    if (!policy.allowLLM) {
      return NextResponse.json({
        blocked: true,
        intent: intent.type,
        text: policy.template,
      });
    }

    // 3) Resolve decision (only existing snapshots — AI cannot create decisions)
    let decision = null;
    if (body.decision_id) {
      decision = getDecision(body.decision_id);
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

    // 4) Explain-only LLM call
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
