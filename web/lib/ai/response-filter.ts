// ============================================================================
// Response Filter — second line of defense, AFTER the LLM.
// Scans output for forbidden guarantee/advice phrasing and neutralizes it.
// ============================================================================

import { STANDARD_DISCLAIMER } from './system-prompt';

interface FilterPattern {
  pattern: RegExp;
  replacement: string;
}

const FORBIDDEN_PATTERNS: FilterPattern[] = [
  { pattern: /(sie|du)\s+(bekommen|bekommst)\s+sicher/gi, replacement: 'Eine verbindliche Zusage ist nicht möglich.' },
  { pattern: /das\s+ist\s+garantiert/gi, replacement: 'Eine verbindliche Zusage ist nicht möglich.' },
  { pattern: /das\s+steht\s+ihnen\s+zu|das\s+steht\s+dir\s+zu/gi, replacement: 'Ob ein Anspruch besteht, entscheidet ausschließlich die zuständige Stelle.' },
  { pattern: /die\s+behörde\s+muss/gi, replacement: 'Die zuständige Behörde prüft den Einzelfall.' },
  { pattern: /ich\s+empfehle\s+ihnen,?[^.]*zu\s+machen/gi, replacement: 'Bitte klären Sie Einzelheiten direkt mit der zuständigen Stelle.' },
  { pattern: /\b100\s?%/gi, replacement: 'mit hoher Wahrscheinlichkeit' },
  { pattern: /ich\s+garantiere/gi, replacement: 'Ich kann keine Garantie geben.' },
  { pattern: /ich\s+verspreche/gi, replacement: 'Ich kann nichts verbindlich zusagen.' },
];

/**
 * Sanitize an LLM response. Returns the cleaned text plus whether anything
 * was neutralized (so we can audit it).
 */
export function filterResponse(input: string): { text: string; neutralized: boolean } {
  let text = input;
  let neutralized = false;

  for (const { pattern, replacement } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement);
      neutralized = true;
    }
  }

  // Always enforce the standard disclaimer at the end.
  if (!text.includes('ohne Gewähr')) {
    text = `${text.trim()}\n\n${STANDARD_DISCLAIMER}`;
  }

  return { text, neutralized };
}
