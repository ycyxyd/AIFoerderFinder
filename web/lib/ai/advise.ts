// ============================================================================
// lib/ai/advise.ts — comprehensive German advice based on the FULL set of
// decision snapshots produced by the rule engine.
//
// COMPLIANCE BOUNDARY: the LLM only summarizes the decisions it is given
// (statuses, reason codes, alternatives, verified notes). It never creates or
// modifies decisions. Falls back to a deterministic template without a key.
// ============================================================================

import type { DecisionSnapshot, UserProfile } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { chatCompletion, hasMistralKey, MistralError } from './mistral';
import { filterResponse } from './response-filter';

export interface AdviseInput {
  profile: UserProfile;
  decisions: DecisionSnapshot[];
  text: string; // the user's original description
}

export interface AdviseOutput {
  text: string;
  usedMock: boolean;
  neutralized: boolean;
  error?: string;
}

const STATUS_LABEL: Record<DecisionSnapshot['status'], string> = {
  eligible: 'grundsätzlich in Betracht kommend',
  not_eligible: 'nicht in Betracht kommend',
  unclear: 'anhand der Daten nicht abschließend beurteilbar',
};

/** Structured, verified-only context handed to the LLM (no raw rules). */
export function buildAssessmentContext(input: AdviseInput): string {
  const { profile, decisions, text } = input;

  const profileLines = [
    `Alter: ${profile.age ?? 'unbekannt'}`,
    `Beschäftigung: ${profile.employment_status ?? 'unbekannt'}`,
    `Monatliches Nettoeinkommen: ${profile.monthly_income !== undefined ? profile.monthly_income + ' EUR' : 'unbekannt'}`,
    `Vermögen: ${profile.assets_total !== undefined ? profile.assets_total + ' EUR' : 'unbekannt'}`,
    `Kinder: ${profile.children ?? 'unbekannt'}`,
    `Versicherungsmonate (Pflicht, letzte 30 Monate): ${profile.insurance_months ?? 'unbekannt'}`,
  ];

  const decisionLines = decisions.map((d) => {
    const reasons = d.reason_codes.length ? d.reason_codes.map((r) => r.code).join(', ') : 'keine';
    const risks = d.risks.length ? d.risks.map((r) => r.risk_code).join(', ') : 'keine';
    const alts = d.alternatives.length ? d.alternatives.join(', ') : 'keine';
    const steps = d.official_links.length ? d.official_links.join('; ') : '(keine Links hinterlegt)';
    return [
      `- ${d.funding_name} (${d.funding_id}): ${STATUS_LABEL[d.status]}`,
      `  Gründe: ${reasons}`,
      `  Risiken: ${risks}`,
      `  Alternativen: ${alts}`,
      `  Zuständige Stelle / Links: ${steps}`,
      `  Gültig bis: ${d.valid_until}`,
    ].join('\n');
  });

  return [
    'URSCHRIFTLICHE BESCHREIBUNG DES NUTZERS (nur Kontext):',
    text.slice(0, 500),
    '',
    'EXTRAHIERTES PROFIL:',
    profileLines.join('\n'),
    '',
    'ERGEBNISSE DER REGEL-ENGINE (vorgegeben, NICHT änderbar — bitte NUR diese verwenden):',
    decisionLines.join('\n\n'),
    '',
    'WICHTIG: Nenne NUR Förderungen und Details, die in den ERGEBNISSEN stehen. Keine eigenen Vermutungen.',
  ].join('\n');
}

/** Deterministic fallback when no LLM key is configured or the call fails. */
function mockAdvice(input: AdviseInput): string {
  const { decisions } = input;
  const lines: string[] = [];

  lines.push('Kurze Gesamteinschätzung');
  const eligible = decisions.filter((d) => d.status === 'eligible');
  const notEligible = decisions.filter((d) => d.status === 'not_eligible');
  const unclear = decisions.filter((d) => d.status === 'unclear');

  if (eligible.length) {
    lines.push(`Grundsätzlich in Betracht kommend: ${eligible.map((d) => d.funding_name).join(', ')}.`);
  }
  if (unclear.length) {
    lines.push(
      `Nicht abschließend beurteilbar (weitere Angaben erforderlich): ${unclear.map((d) => d.funding_name).join(', ')}.`
    );
  }
  if (notEligible.length) {
    lines.push(`Nach den bekannten Voraussetzungen nicht in Betracht kommend: ${notEligible.map((d) => d.funding_name).join(', ')}.`);
  }

  lines.push('Nächste Schritte');
  lines.push(
    'Prüfen Sie die Antragsunterlagen bei der jeweils zuständigen Stelle und stellen Sie den Antrag möglichst früh. Die endgültige Entscheidung trifft ausschließlich die zuständige Stelle.'
  );

  lines.push('Hinweis');
  lines.push(
    'Diese Einschätzung basiert auf Ihren Angaben und den hinterlegten Regeln zum aktuellen Stand. Sie ersetzt keine Entscheidung der zuständigen Stelle. Alle Angaben erfolgen ohne Gewähr.'
  );

  return lines.join('\n\n');
}

export async function composeAdvice(input: AdviseInput): Promise<AdviseOutput> {
  if (!hasMistralKey()) {
    return { text: filterResponse(mockAdvice(input)).text, usedMock: true, neutralized: false };
  }

  const context = buildAssessmentContext(input);
  const userPrompt = [
    context,
    '',
    'Aufgabe: Verfasse eine umfassende, verständliche Gesamteinschätzung auf Deutsch mit folgender Struktur:',
    '1) Kurzer Überblick (1-2 Sätze)',
    '2) Förderungen mit guten Chancen — je mit kurzem Grund',
    '3) Förderungen, die nach den bekannten Voraussetzungen nicht in Betracht kommen — mit Grund (Prüfcode)',
    '4) Mögliche Alternativen',
    '5) Nächste konkrete Schritte (welche Stelle, welche Unterlagen)',
    '6) Hinweis auf den unverbindlichen Charakter',
    'Bleibe sachlich, nutze die vorgegebenen verifizierten Hinweise, nichts aus dem Gedächtnis ergänzen.',
  ].join('\n');

  try {
    const raw = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
    const filtered = filterResponse(raw);
    return { text: filtered.text, usedMock: false, neutralized: filtered.neutralized };
  } catch (err) {
    const message = err instanceof MistralError ? err.message : 'Unbekannter Fehler bei der Einschätzung.';
    return { text: filterResponse(mockAdvice(input)).text, usedMock: true, neutralized: false, error: message };
  }
}
