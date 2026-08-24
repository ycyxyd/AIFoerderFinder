'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { DecisionSnapshot, UserProfile } from '../../lib/types';

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
  const [listening, setListening] = useState(false);
  const [micSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  });
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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      if (decisions.length === 0) {
        // First message: full assessment.
        const res = await fetch('/api/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Fehler');
        setDecisions(data.decisions);
        if (data.decisions?.length) setActiveId(data.decisions[0].decision_id);
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: data.advice,
            mock: Boolean(data.adviceUsedMock || data.extractUsedMock),
          },
        ]);
        // Mirror the assessment into localStorage so /results can show it too.
        try {
          localStorage.setItem(
            'foerderfinder.check',
            JSON.stringify({ profile: data.profile, decisions: data.decisions, created_at: new Date().toISOString() })
          );
          const uid = localStorage.getItem('foerderfinder.user_id');
          if (uid && !data.profile?.user_id) {
            // store association for future requests
          }
        } catch {
          /* localStorage unavailable — non-fatal */
        }
      } else {
        // Follow-up question on the active decision (explain-only).
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
              Die App erkennt die wichtigsten Angaben, prüft automatisch alle
              Förderprogramme und gibt Ihnen eine verständliche Gesamteinschätzung.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
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
        {loading && <p className="text-sm text-slate-400">Wird analysiert…</p>}
      </div>

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
            decisions.length === 0
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
