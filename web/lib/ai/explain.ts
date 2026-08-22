// ============================================================================
// AI Explanation Service — the ONLY place the LLM is called.
// Input is strictly a DecisionSnapshot (+ optional funding context).
// The AI can explain, never decide. Output passes the Response Filter.
// When no MISTRAL_API_KEY is configured, a deterministic German mock
// explanation is returned (marked usedMock=true) so the app stays demoable.
// ============================================================================

import type { DecisionSnapshot, FundingSchema } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { chatCompletion, hasMistralKey, MistralError } from './mistral';
import { filterResponse } from './response-filter';

export interface ExplainInput {
  decision: DecisionSnapshot;
  funding?: FundingSchema;
  question: string;
}

export interface ExplainOutput {
  text: string;
  usedMock: boolean;
  neutralized: boolean;
  error?: string;
}

const STATUS_LABEL: Record<DecisionSnapshot['status'], string> = {
  eligible: 'grundsätzlich in Betracht kommend',
  not_eligible: 'nach den bekannten Voraussetzungen nicht in Betracht kommend',
  unclear: 'anhand der vorliegenden Daten nicht abschließend beurteilbar',
};

/** Build the structured context that is handed to the LLM (never the raw rules). */
export function buildDecisionContext(input: ExplainInput): string {
  const { decision, funding } = input;

  const reasons = decision.reason_codes.length
    ? decision.reason_codes.map((r) => `- ${r.code}`).join('\n')
    : '- keine';

  const risks = decision.risks.length
    ? decision.risks.map((r) => `- ${r.risk_code}${r.message_key ? ` (${r.message_key})` : ''}`).join('\n')
    : '- keine';

  const alternatives = decision.alternatives.length
    ? decision.alternatives.join(', ')
    : '- keine';

  const links = decision.official_links.length
    ? decision.official_links.map((l) => `- ${l}`).join('\n')
    : '- (keine hinterlegt)';

  const steps = funding?.steps?.length
    ? funding.steps.map((s) => `- ${s.title}`).join('\n')
    : '- (keine hinterlegt)';

  return [
    'ENTSCHEDUNGSERGEBNIS (vorgegeben, NICHT änderbar):',
    `Förderung: ${decision.funding_name} (${decision.funding_id})`,
    `Status: ${STATUS_LABEL[decision.status]}`,
    '',
    'GRÜNDE (Codes):',
    reasons,
    '',
    'RISIKEN:',
    risks,
    '',
    'MÖGLICHE ALTERNATIVEN:',
    alternatives,
    '',
    'TYPISCHE SCHRITTE:',
    steps,
    '',
    'OFFIZIELLE STELLEN & LINKS:',
    links,
    '',
    'GÜLTIG BIS: ' + decision.valid_until,
  ].join('\n');
}

/** Deterministic German explanation — used only when no LLM key is configured. */
function mockExplanation(input: ExplainInput): string {
  const { decision } = input;
  const lines: string[] = [];

  lines.push(`Kurze Einordnung`);
  lines.push(
    `Nach den derzeit bekannten Voraussetzungen kommt ${decision.funding_name} für Sie ${STATUS_LABEL[decision.status].replace('grundsätzlich ', '')}.`
  );

  lines.push(`Voraussetzungen`);
  if (decision.reason_codes.length) {
    for (const r of decision.reason_codes) {
      lines.push(`- Der Prüfcode „${r.code}“ wurde festgestellt.`);
    }
  } else {
    lines.push(`- Es wurden keine Ausschlussgründe aus den hinterlegten Regeln festgestellt.`);
  }

  if (decision.risks.length) {
    lines.push(`Risiken & wichtige Hinweise`);
    for (const r of decision.risks) {
      lines.push(`- ${r.risk_code}`);
    }
  }

  if (decision.alternatives.length) {
    lines.push(`Mögliche Alternativen`);
    lines.push(`- ${decision.alternatives.join(', ')}`);
  }

  lines.push(`Zuständige Stelle`);
  lines.push(
    `Die zuständige Stelle trifft die endgültige Entscheidung. Bitte prüfen Sie die Voraussetzungen dort im Einzelfall.`
  );

  lines.push(`Hinweis`);
  lines.push(
    `Diese Einschätzung basiert auf den zum ${decision.valid_until.slice(0, 10)} hinterlegten Informationen und ersetzt keine Entscheidung der zuständigen Stelle. Alle Angaben erfolgen ohne Gewähr.`
  );

  return lines.join('\n\n');
}

export async function explainDecision(input: ExplainInput): Promise<ExplainOutput> {
  const context = buildDecisionContext(input);

  if (!hasMistralKey()) {
    return {
      text: filterResponse(mockExplanation(input)).text,
      usedMock: true,
      neutralized: false,
    };
  }

  const userPrompt = [
    context,
    '',
    'FRAGE DES NUTZERS:',
    input.question,
    '',
    'Antworte auf Deutsch, sachlich, nach der vorgegebenen Antwortstruktur.',
  ].join('\n');

  try {
    const raw = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
    const filtered = filterResponse(raw);
    return { text: filtered.text, usedMock: false, neutralized: filtered.neutralized };
  } catch (err) {
    const message = err instanceof MistralError ? err.message : 'Unbekannter Fehler bei der Anfrage.';
    return {
      text: filterResponse(mockExplanation(input)).text,
      usedMock: true,
      neutralized: false,
      error: message,
    };
  }
}
