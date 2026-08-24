'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { DecisionSnapshot, UserProfile } from '../../lib/types';
import AdSlot, { bumpAdInteractions, fireAdEvent } from '../../components/AdSlot';

// Web Speech API types (not in TS DOM lib by default).
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

interface UiMessage {
  role: 'user' | 'assistant';
  text: string;
  blocked?: boolean;
  mock?: boolean;
  /** Rendert einen AdSlot VOR dieser Nachricht (Event before_assessment). */
  adBefore?: boolean;
}

interface RelatedItem {
  id?: string;
  name: string;
  reason: string;
  knowledgeDoc?: string;
}

interface BenefitEstimate {
  lines: { funding_id: string; name: string; amount: number; unit: string }[];
  totalAnnual: number;
  totalMonthly: number;
  estimated: boolean;
}

interface FahrplanEntry {
  funding_id: string;
  funding_name: string;
  status: string;
  authority: string;
  online: boolean;
  offline: boolean;
  links: string[];
  documents: string[];
  steps: { step_id?: string; title: string; when?: string; explain?: string; risk_if_missed?: string }[];
}

const STATUS_LABEL: Record<DecisionSnapshot['status'], string> = {
  eligible: 'grundsätzlich in Betracht kommend',
  not_eligible: 'nicht in Betracht kommend',
  unclear: 'nicht abschließend beurteilbar',
};

function AssistInner() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<DecisionSnapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<string[]>([]);
  const [related, setRelated] = useState<RelatedItem[]>([]);
  const [benefit, setBenefit] = useState<BenefitEstimate | null>(null);
  const [fahrplan, setFahrplan] = useState<FahrplanEntry[]>([]);
  const [listening, setListening] = useState(false);
  const [micSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  });
  const baseTextRef = useRef('');
  const answersRef = useRef('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function startVoice() {
    if (listening) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'de-DE';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => Array.from(r).map((alt) => alt.transcript).join(''))
        .join(' ');
      setInput((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript));
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function runAssess(text: string) {
    const res = await fetch('/api/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Fehler');
    setDecisions(data.decisions);
    if (data.decisions?.length) setActiveId(data.decisions[0].decision_id);
    setRelated(data.related ?? []);
    setBenefit(data.benefitEstimate ?? null);
    setFahrplan(data.fahrplan ?? []);

    const questions: string[] = data.clarificationQuestions ?? [];
    setPendingQuestions(questions);

    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        text: data.advice,
        mock: Boolean(data.adviceUsedMock || data.extractUsedMock),
        adBefore: true,
      },
      ...(questions.length
        ? [
            {
              role: 'assistant' as const,
              text: `Um die Einschätzung zu verbessern, beantworten Sie bitte:\n${questions
                .map((q, i) => `${i + 1}) ${q}`)
                .join('\n')}`,
            },
          ]
        : []),
    ]);

    try {
      localStorage.setItem(
        'foerderfinder.check',
        JSON.stringify({ profile: data.profile, decisions: data.decisions, created_at: new Date().toISOString() })
      );
    } catch {
      /* localStorage unavailable — non-fatal */
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    bumpAdInteractions(1);
    setInput('');
    setLoading(true);
    try {
      const isClarify = pendingQuestions.length > 0;
      if (decisions.length === 0 || isClarify) {
        // Vollständige Einschätzung (erste Nachricht oder Antwort auf Rückfragen).
        const combined = isClarify
          ? `${baseTextRef.current} ${answersRef.current} ${text}`.trim()
          : text;
        if (!baseTextRef.current) baseTextRef.current = text;
        answersRef.current = combined;
        await runAssess(combined);
      } else {
        // Rückfrage zur ausgewählten Förderung (explain-only).
        const decisionId = activeId ?? decisions[0]?.decision_id;
        if (!decisionId) throw new Error('Keine Entscheidung vorhanden');
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision_id: decisionId, question: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Fehler');
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: data.text, blocked: Boolean(data.blocked), mock: Boolean(data.usedMock) },
        ]);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: err instanceof Error ? err.message : 'Unbekannter Fehler', blocked: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const extracted: UserProfile | undefined = (() => {
    try {
      const raw = localStorage.getItem('foerderfinder.check');
      if (!raw) return undefined;
      return (JSON.parse(raw) as { profile?: UserProfile }).profile;
    } catch {
      return undefined;
    }
  })();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">KI-Assistent</h1>
          <p className="text-sm text-slate-500">
            Beschreiben Sie Ihre Situation – per Text oder Sprache.
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold text-teal-700">
          ← Start
        </Link>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500">
            <p className="mb-2">
              Beispiel: <em>„Ich bin 32, arbeitslos gemeldet, habe 18 Monate in die
              Arbeitslosenversicherung eingezahlt, 6.000 Euro Vermögen und ein Kind.“</em>
            </p>
            <p>
              Oder: <em>„Ich möchte in Köln eine Wärmepumpe einbauen, mein Haus gehört
              mir, Einkommen 45.000 €.“</em>
            </p>
            <p>
              Die App erkennt Angaben, fragt bei Bedarf nach, prüft alle Förderprogramme
              und gibt eine verständliche Gesamteinschätzung.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            {m.adBefore && <AdSlot event="before_assessment" />}
            <div
              className={`inline-block max-w-[88%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'bg-teal-700 text-white'
                  : m.blocked
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-slate-800'
              }`}
            >
              {m.text}
              {m.mock && (
                <span className="mt-2 block text-xs font-medium text-slate-500">
                  (Hinweis: teilweise lokale Demo-Antwort, da die KI-Anfrage nicht
                  vollständig verarbeitet werden konnte.)
                </span>
              )}
            </div>
          </div>
        ))}
        <AdSlot event="after_assessment" />
        {loading && <p className="text-sm text-slate-400">Wird analysiert…</p>}
      </div>

      {benefit && benefit.lines.length > 0 && (
        <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm">
          <p className="font-semibold text-teal-900">
            Max. Förderungen (Schätzung): bis zu{' '}
            {benefit.totalAnnual.toLocaleString('de-DE')} € pro Jahr
            <span className="font-normal text-teal-700">
              {' '}
              (≈ {benefit.totalMonthly.toLocaleString('de-DE')} €/Monat)
            </span>
          </p>
          <table className="mt-2 w-full text-left text-xs text-teal-900">
            <tbody>
              {benefit.lines.map((l) => (
                <tr key={l.funding_id}>
                  <td className="py-0.5 pr-2">{l.name}</td>
                  <td className="py-0.5 text-right font-medium">
                    {l.amount.toLocaleString('de-DE')} € {l.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-teal-600">
            Unverbindliche Schätzung, keine Zusage. Maßgeblich ist die zuständige Stelle.
          </p>
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="font-semibold text-slate-700">Außerdem prüfen:</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-600">
            {related.map((r) => (
              <li key={r.id ?? r.name}>
                <strong>{r.name}</strong> — {r.reason}
                {r.knowledgeDoc && (
                  <span className="text-slate-400"> (Details in der Wissensdatenbank)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {fahrplan.length > 0 && (
        <section className="mt-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Antrags-Fahrplan</h2>
          {fahrplan.map((fp) => (
            <div key={fp.funding_id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-800">{fp.funding_name}</h3>
                <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                  in Betracht kommend
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Zuständige Stelle: <strong className="text-slate-700">{fp.authority}</strong>
                {fp.online && <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[10px]">Online-Antrag</span>}
                {fp.offline && <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[10px]">Papierformular</span>}
              </p>

              {fp.steps.length > 0 && (
                <ol className="mt-3 space-y-2">
                  {fp.steps.map((s, i) => (
                    <li key={s.step_id ?? i} className="flex gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700">{s.title}</p>
                        {s.when && <p className="text-xs text-amber-700">⏰ {s.when}</p>}
                        {s.explain && <p className="text-xs text-slate-500">{s.explain}</p>}
                        {s.risk_if_missed && <p className="text-xs text-red-600">⚠️ {s.risk_if_missed}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {fp.documents.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500">Unterlagen:</p>
                  <ul className="mt-0.5 list-disc pl-5 text-xs text-slate-600">
                    {fp.documents.map((doc, i) => (
                      <li key={i}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {fp.links.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {fp.links.map((l, i) => (
                    <a
                      key={i}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => fireAdEvent('exit_intent')}
                      className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
                    >
                      {l.replace(/^https?:\/\//, '')} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {decisions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {decisions.map((d) => (
            <button
              key={d.decision_id}
              type="button"
              onClick={() => setActiveId(d.decision_id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                activeId === d.decision_id
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : d.status === 'eligible'
                    ? 'border-teal-300 bg-teal-50 text-teal-800'
                    : d.status === 'not_eligible'
                      ? 'border-slate-200 bg-slate-50 text-slate-500'
                      : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
              title={STATUS_LABEL[d.status]}
            >
              {d.funding_name} · {STATUS_LABEL[d.status]}
            </button>
          ))}
        </div>
      )}
      {decisions.length > 0 && extracted && (
        <p className="mt-2 text-xs text-slate-400">
          Erkannt: Alter {extracted.age ?? '?'}, Einkommen {extracted.monthly_income ?? '?'} €,
          Vermögen {extracted.assets_total ?? '?'} €, Kinder {extracted.children ?? '?'},
          Versicherung {extracted.insurance_months ?? '?'} Monate.
          Wählen Sie eine Förderung oben aus und stellen Sie gezielte Fragen.
        </p>
      )}

      {(() => {
        const userCount = messages.filter((m) => m.role === 'user').length;
        if (userCount >= 6) return <AdSlot key="f6" event="chat_followup_6" />;
        if (userCount >= 3) return <AdSlot key="f3" event="chat_followup_3" />;
        return null;
      })()}

      <form onSubmit={send} className="mt-4 flex gap-2">
        {micSupported && (
          <button
            type="button"
            onClick={listening ? stopVoice : startVoice}
            className={`shrink-0 rounded-lg border px-4 py-2 text-lg ${
              listening
                ? 'border-red-400 bg-red-50 text-red-600'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title={listening ? 'Aufnahme beenden' : 'Spracheingabe (Deutsch)'}
            aria-label="Spracheingabe"
          >
            {listening ? '■' : '🎤'}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            pendingQuestions.length > 0
              ? 'Beantworten Sie die Rückfragen…'
              : decisions.length === 0
                ? 'Beschreiben Sie Ihre Situation…'
                : 'Ihre Frage zur ausgewählten Förderung…'
          }
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
        >
          Senden
        </button>
      </form>

      <p className="mt-4 text-xs text-slate-400">
        Hinweis: Diese Einschätzung ersetzt keine Entscheidung der zuständigen
        Stelle. Eine Garantie oder verbindliche Zusage kann nicht gegeben werden.
        Die KI trifft keine Entscheidungen – sie erkennt Angaben und erklärt
        Ergebnisse einer festen Prüfungslogik.
      </p>
    </main>
  );
}

export default function AssistPage() {
  return <AssistInner />;
}
