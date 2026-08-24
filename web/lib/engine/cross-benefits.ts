// ============================================================================
// lib/engine/cross-benefits.ts — deterministisches Querwissen:
// 1) Verwandte Förderungen vorschlagen (z.B. Kindergeld → Elterngeld,
//    Wohngeld, Kinderzuschlag; Wärmepumpe → PV-Anlage).
// 2) Geschätzte maximale Jahres-/Monatsleistung ("Max. Förderungen bis zu X €").
// Reine Schätzungen, klar gekennzeichnet — niemals eine Zusage.
// ============================================================================

import type { DecisionSnapshot, UserProfile } from '../types';

export interface RelatedSuggestion {
  /** Funding-ID, falls als eigene Förderung hinterlegt. */
  id?: string;
  name: string;
  reason: string;
  /** Knowledge-Dokument (knowledge/*.md) für Details. */
  knowledgeDoc?: string;
}

export interface BenefitLine {
  funding_id: string;
  name: string;
  amount: number; // annual EUR (estimated)
  unit: string;
}

export interface BenefitEstimate {
  lines: BenefitLine[];
  totalAnnual: number;
  totalMonthly: number;
  estimated: boolean;
}

// ---------------------------------------------------------------------------
// 1) Verwandte Förderungen
// ---------------------------------------------------------------------------

const TOPIC_RULES: { test: RegExp; suggestions: Omit<RelatedSuggestion, 'reason'>[]; reason: string }[] = [
  {
    test: /kindergeld|kind\b|kinder/i,
    reason: 'Familie: weitere Leistungen möglich',
    suggestions: [
      { id: 'elterngeld', name: 'Elterngeld', knowledgeDoc: 'familienleistungen.md' },
      { id: 'wohngeld', name: 'Wohngeld', knowledgeDoc: 'familienleistungen.md' },
      { name: 'Kinderzuschlag (KiZ)', knowledgeDoc: 'familienleistungen.md' },
    ],
  },
  {
    test: /waermepumpe|wärmepumpe|heizung|heizungstausch|sanier/i,
    reason: 'Energie/Sanierung: kombinierbare Förderungen',
    suggestions: [
      { id: 'pv_anlage', name: 'Photovoltaik-Anlage', knowledgeDoc: 'pv-anlage.md' },
      { name: 'Balkonkraftwerk (Mini-Steckersolar)', knowledgeDoc: 'pv-anlage.md' },
    ],
  },
  {
    test: /pv|photovoltaik|solar|balkonkraft/i,
    reason: 'Solar: passende Ergänzungen',
    suggestions: [
      { name: 'Wärmepumpe (Heizungstausch)', knowledgeDoc: 'waermepumpe.md' },
    ],
  },
  {
    test: /student|studium|bafög|bafoeg/i,
    reason: 'Ausbildung: weitere Leistungen möglich',
    suggestions: [
      { name: 'Bildungs- und Teilhabepaket (BuT)', knowledgeDoc: 'familienleistungen.md' },
    ],
  },
];

export function suggestRelated(
  text: string,
  profile: UserProfile,
  decisions: DecisionSnapshot[]
): RelatedSuggestion[] {
  const out: RelatedSuggestion[] = [];
  const seen = new Set<string>();

  for (const rule of TOPIC_RULES) {
    if (!rule.test.test(text)) continue;
    for (const s of rule.suggestions) {
      const key = s.id ?? s.name;
      if (seen.has(key)) continue;
      seen.add(key);
      // Bereits als "nicht in Betracht kommend" beurteilte Förderungen nicht
      // als neuen Vorschlag wiederholen; eligible/unclear bleiben sichtbar
      // (sie sind genau die erwünschten Querverweise).
      if (s.id && decisions.some((d) => d.funding_id === s.id && d.status === 'not_eligible')) continue;
      out.push({ ...s, reason: rule.reason });
    }
  }

  // Profilbasiert: niedriges Einkommen + Kinder → Kinderzuschlag/Wohngeld.
  if ((profile.children ?? 0) >= 1) {
    const income = profile.monthly_income ?? 0;
    if (income > 0 && income < 4000 && !seen.has('wohngeld')) {
      seen.add('wohngeld');
      out.push({
        id: 'wohngeld',
        name: 'Wohngeld',
        reason: 'Niedriges Einkommen + Kinder: Wohngeld prüfen',
        knowledgeDoc: 'familienleistungen.md',
      });
    }
    if (!seen.has('Kinderzuschlag (KiZ)') && income > 0) {
      seen.add('Kinderzuschlag (KiZ)');
      out.push({
        name: 'Kinderzuschlag (KiZ)',
        reason: 'Erwerbseinkommen + Kindergeld: bis 292 €/Monat je Kind',
        knowledgeDoc: 'familienleistungen.md',
      });
    }
  }

  return out.slice(0, 5);
}

// ---------------------------------------------------------------------------
// 2) Max. Förderungen (Schätzung)
// ---------------------------------------------------------------------------

function annualFor(decision: DecisionSnapshot, profile: UserProfile): BenefitLine | null {
  switch (decision.funding_id) {
    case 'kindergeld': {
      const kids = Math.max(1, profile.children ?? 1);
      return { funding_id: 'kindergeld', name: 'Kindergeld', amount: 259 * 12 * kids, unit: '/Jahr' };
    }
    case 'elterngeld': {
      // Mindest-Elterngeld 300 € × 12, wenn Neugeborenes; sonst nicht schätzbar.
      if (profile.newborn_child || (profile.children ?? 0) >= 1) {
        return { funding_id: 'elterngeld', name: 'Elterngeld (Mindestbetrag)', amount: 300 * 12, unit: '/Jahr (Mindestbetrag)' };
      }
      return null;
    }
    case 'alg1': {
      if (decision.status === 'eligible' && profile.monthly_income) {
        const monatlich = Math.round(profile.monthly_income * 0.6);
        return { funding_id: 'alg1', name: 'Arbeitslosengeld I (≈60%)', amount: monatlich * 12, unit: '/Jahr (Schätzung)' };
      }
      return null;
    }
    case 'wohngeld': {
      // Nicht seriös ohne Miete → bewusst keine Zahl.
      return null;
    }
    default:
      return null;
  }
}

export function estimateAnnualBenefits(
  decisions: DecisionSnapshot[],
  profile: UserProfile
): BenefitEstimate {
  const lines = decisions
    .filter((d) => d.status === 'eligible')
    .map((d) => annualFor(d, profile))
    .filter((l): l is BenefitLine => l !== null);

  const totalAnnual = lines.reduce((s, l) => s + l.amount, 0);
  return {
    lines,
    totalAnnual,
    totalMonthly: Math.round(totalAnnual / 12),
    estimated: true,
  };
}
