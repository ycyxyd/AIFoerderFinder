'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { DecisionSnapshot } from '../../lib/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  blocked?: boolean;
  mock?: boolean;
}

function ChatInner() {
  const searchParams = useSearchParams();
  const decisionId = searchParams.get('decision_id') ?? '';

  const decision: DecisionSnapshot | undefined = useMemo(() => {
    try {
      const raw = localStorage.getItem('foerderfinder.check');
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as { decisions: DecisionSnapshot[] };
      return parsed.decisions.find((d) => d.decision_id === decisionId);
    } catch {
      return undefined;
    }
  }, [decisionId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!decision) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-slate-600">Keine gültige Prüfung gefunden.</p>
        <Link href="/onboarding" className="mt-4 inline-block font-semibold text-teal-700">
          Jetzt prüfen
        </Link>
      </main>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading || !decision) return;
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision_id: decision.decision_id, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: data.text,
          blocked: Boolean(data.blocked),
          mock: Boolean(data.usedMock),
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: err instanceof Error ? err.message : 'Unbekannter Fehler',
          blocked: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">KI-Beratung</h1>
          <p className="text-sm text-slate-500">{decision.funding_name}</p>
        </div>
        <Link href="/results" className="text-sm font-semibold text-teal-700">
          ← Ergebnisse
        </Link>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Fragen Sie z. B.: „Warum komme ich grundsätzlich in Betracht?“ oder
            „Was brauche ich für den Antrag?“
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm ${
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
                  (Hinweis: Antwort aus der lokalen Demo-Engine, da noch kein
                  KI-Schlüssel konfiguriert ist.)
                </span>
              )}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-slate-400">Antwort wird erstellt…</p>}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ihre Frage…"
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
      </p>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-500">Wird geladen…</p>}>
      <ChatInner />
    </Suspense>
  );
}
