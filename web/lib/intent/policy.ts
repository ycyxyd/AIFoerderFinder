// ============================================================================
// Policy Gate — decides what happens per intent, BEFORE the LLM.
// Blocked intents never reach the model; predefined German templates are
// returned instead (production-grade, from the project design doc Phase 5).
// ============================================================================

import type { IntentType } from '../types';

export interface PolicyDecision {
  /** true only for NORMAL_INFORMATION — the only intent allowed to hit the LLM */
  allowLLM: boolean;
  /** predefined safe response (German), used when allowLLM === false */
  template?: string;
}

export const POLICY_TEMPLATES: Record<Exclude<IntentType, 'NORMAL_INFORMATION'>, string> = {
  GUARANTEE_REQUEST:
    'Nein, das kann und darf ich nicht bestätigen. Ich kann keine Garantie oder verbindliche Zusage über den Erhalt einer Förderung geben. Die Entscheidung trifft ausschließlich die zuständige Stelle. Ich kann Ihnen lediglich erläutern, welche Voraussetzungen üblicherweise gelten, warum eine Förderung grundsätzlich in Betracht kommt oder nicht, und welche nächsten Schritte vorgesehen sind.',
  LEGAL_ACTION:
    'Ich kann keine rechtliche Bewertung oder Empfehlung geben. Ich kann lediglich den allgemeinen Ablauf erklären. Für verbindliche Auskünfte wenden Sie sich bitte an die zuständige Behörde oder eine Beratungsstelle.',
  RULE_CIRCUMVENTION:
    'Ich kann nicht dabei helfen, Angaben zu verschweigen oder Regelungen zu umgehen. Bitte beachten Sie, dass falsche Angaben rechtliche Konsequenzen haben können.',
  PROMPT_INJECTION:
    'Ich kann diese Anfrage in dieser Form nicht beantworten. Ich erkläre ausschließlich allgemeine Informationen im vorgesehenen Rahmen.',
};

export function applyPolicy(intent: IntentType): PolicyDecision {
  if (intent === 'NORMAL_INFORMATION') {
    return { allowLLM: true };
  }
  return { allowLLM: false, template: POLICY_TEMPLATES[intent] };
}
