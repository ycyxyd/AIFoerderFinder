// ============================================================================
// Intent Detection — runs BEFORE any LLM call. Deterministic, auditable,
// and immune to prompt-injection (it does not "understand", it matches).
// ============================================================================

import type { IntentResult } from '../types';
import { KEYWORD_CATEGORIES } from './keywords';

/** Order matters: guarantee > legal > circumvention > injection. */
export function detectIntent(userInput: string): IntentResult {
  const text = userInput.toLowerCase();

  for (const category of KEYWORD_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (text.includes(keyword)) {
        return { type: category.type, matchedKeyword: keyword };
      }
    }
  }

  return { type: 'NORMAL_INFORMATION' };
}
