// ============================================================================
// lib/fahrplan.ts — Antrags-Fahrplan (deterministisch, aus den Funding-Daten).
// Für jede "in Betracht kommende" Förderung: zuständige Stelle, Formular-Art,
// Unterlagen, Schritte mit Fristen/Risiken, offizielle Links.
// Kein LLM nötig — reine Datenaufbereitung (verlässlich, auditierbar).
// ============================================================================

import type { DecisionSnapshot, FundingSchema } from './types';

export interface FahrplanEntry {
  funding_id: string;
  funding_name: string;
  status: DecisionSnapshot['status'];
  authority: string;
  online: boolean;
  offline: boolean;
  links: string[];
  documents: string[];
  steps: FundingSchema['steps'];
}

export function buildFahrplan(
  decisions: DecisionSnapshot[],
  fundings: FundingSchema[]
): FahrplanEntry[] {
  const byId = new Map(fundings.map((f) => [f.id, f]));
  return decisions
    .filter((d) => d.status === 'eligible')
    .map((d) => {
      const f = byId.get(d.funding_id);
      return {
        funding_id: d.funding_id,
        funding_name: d.funding_name,
        status: d.status,
        authority: f?.application?.authority ?? 'Zuständige Stelle bitte prüfen',
        online: f?.application?.online ?? false,
        offline: f?.application?.offline ?? false,
        links: f?.application?.links ?? [],
        documents: f?.documents_required ?? [],
        steps: f?.steps ?? [],
      };
    });
}
