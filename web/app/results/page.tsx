'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DecisionSnapshot } from '../../lib/types';

const STATUS_STYLE: Record<DecisionSnapshot['status'], string> = {
  eligible: 'bg-emerald-100 text-emerald-800',
  not_eligible: 'bg-rose-100 text-rose-800',
  unclear: 'bg-amber-100 text-amber-800',
};

const STATUS_LABEL: Record<DecisionSnapshot['status'], string> = {
  eligible: 'kommt grundsätzlich in Betracht',
  not_eligible: 'nach bekannten Voraussetzungen nicht in Betracht kommend',
  unclear: 'nicht abschließend beurteilbar',
};

export default function ResultsPage() {
  const [decisions, setDecisions] = useState<DecisionSnapshot[] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('foerderfinder.check');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { decisions: DecisionSnapshot[] };
      // Intentional: hydrate client-side persisted check from localStorage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDecisions(parsed.decisions);
    } catch {
      setDecisions([]);
    }
  }, []);

  if (decisions === null) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-slate-500">Wird geladen…</p>
      </main>
    );
  }

  if (decisions.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-slate-600">Noch keine Prüfung vorhanden.</p>
        <Link href="/onboarding" className="mt-4 inline-block font-semibold text-teal-700">
          Jetzt prüfen
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Ergebnisse</h1>
      <p className="mt-1 text-sm text-slate-500">
        Diese Ergebnisse basieren auf den hinterlegten Regeln (Stand: hinterlegte
        Daten). Sie sind keine Entscheidung einer Behörde.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {decisions.map((d) => (
          <div key={d.decision_id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{d.funding_name}</h2>
                <p className="text-xs text-slate-400">{d.provider}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[d.status]}`}>
                {STATUS_LABEL[d.status]}
              </span>
            </div>

            {d.reason_codes.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-medium text-slate-700">Gründe</p>
                <ul className="mt-1 list-inside list-disc text-slate-600">
                  {d.reason_codes.map((r) => (
                    <li key={r.code}>{r.code}</li>
                  ))}
                </ul>
              </div>
            )}

            {d.risks.length > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <p className="font-medium">Risiken / zu beachten</p>
                <ul className="mt-1 list-inside list-disc">
                  {d.risks.map((r) => (
                    <li key={r.risk_code}>{r.risk_code}</li>
                  ))}
                </ul>
              </div>
            )}

            {d.alternatives.length > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                <span className="font-medium">Mögliche Alternativen: </span>
                {d.alternatives.join(', ')}
              </p>
            )}

            {d.official_links.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-medium text-slate-700">Offizielle Stellen</p>
                <ul className="mt-1 space-y-1">
                  {d.official_links.map((l) => (
                    <li key={l}>
                      <a href={l} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              href={`/chat?decision_id=${d.decision_id}`}
              className="mt-4 inline-block rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Mit KI besprechen
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Hinweis: Diese Einschätzung ersetzt keine Entscheidung der zuständigen
        Stelle. Eine Garantie oder verbindliche Zusage kann nicht gegeben werden.
      </p>
    </main>
  );
}
