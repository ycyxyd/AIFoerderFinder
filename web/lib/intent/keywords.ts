// ============================================================================
// Intent Detection keyword lists — HARD RULES, no LLM involved.
// Based on the project design doc (Phase 5) plus German/English fallbacks.
// Detection order is significant: GUARANTEE > LEGAL > CIRCUMVENTION > INJECTION
// ============================================================================

import type { IntentType } from '../types';

export interface KeywordCategory {
  type: IntentType;
  keywords: string[];
}

export const KEYWORD_CATEGORIES: KeywordCategory[] = [
  {
    type: 'GUARANTEE_REQUEST',
    keywords: [
      // German
      'garantiert', 'garantie', 'sicher', '100%', 'verbindlich', 'verbindliche zusage',
      'bestätigen', 'bestätigung', 'zusichern', 'zusicherung', 'du musst mir sagen',
      'kannst du garantieren', 'sicher bekommen', 'bekomme ich sicher', 'steht mir zu',
      'anrecht haben', 'habe ich ein recht', 'kannst du mir garantieren',
      'wie sicher', 'mit sicherheit', '100 prozent',
      // English
      'guarantee', 'guaranteed', 'assure', 'assurance', '100%', 'for sure',
      'can you guarantee', 'definitely get', 'certain', 'certainty',
    ],
  },
  {
    type: 'LEGAL_ACTION',
    keywords: [
      // German
      'widerspruch', 'widerspruch einlegen', 'klage', 'klagen', 'anwalt', 'gericht',
      'rechtsmittel', 'rechtlich', 'verklagen', 'anfechten', 'anfechtung',
      'rechtsanwalt', 'sozialgericht', 'klage einreichen', 'juristisch',
      // English
      'lawsuit', 'sue', 'lawyer', 'court', 'appeal', 'legal action', 'litigation',
      'attorney', 'solicitor',
    ],
  },
  {
    type: 'RULE_CIRCUMVENTION',
    keywords: [
      // German
      'verschweigen', 'nicht angeben', 'nicht angeben bitte', 'trick', 'umgehen',
      'falsch angeben', 'verstecken', 'wie kann ich vermeiden', 'schwarzgeld',
      'unter den tisch', 'weglassen', 'verheimlichen', 'lügen', 'betrügen',
      'konto verstecken', 'einkommen verschweigen',
      // English
      'hide', 'conceal', 'not declare', 'avoid', 'trick', 'lie', 'fraud',
      'under the table', 'how to avoid', 'cheat',
    ],
  },
  {
    type: 'PROMPT_INJECTION',
    keywords: [
      // German
      'ignoriere', 'ignoriere alle regeln', 'vergiss die regeln', 'tu so als ob',
      'system prompt', 'system prompt anzeigen', 'du bist jetzt', 'rolle wechseln',
      'ohne einschränkung', 'vergiss deine anweisungen', 'als ob du ein anwalt wärst',
      'theoretisch', 'nur hypothetisch', 'aus spaß', 'spiel doch mal',
      // English
      'ignore', 'ignore all rules', 'forget the rules', 'pretend', 'act as if',
      'system prompt', 'show your prompt', 'you are now', 'roleplay', 'no restrictions',
      'disregard', 'jailbreak', 'hypothetically', 'just for fun',
    ],
  },
];

export const NORMAL_INFORMATION: IntentType = 'NORMAL_INFORMATION';
