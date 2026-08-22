import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-teal-700">
          Förderprogramme in Deutschland
        </p>
        <h1 className="text-4xl font-bold tracking-tight">FörderFinder</h1>
        <p className="mt-4 text-lg text-slate-600">
          Finden Sie heraus, welche Förderungen für Ihre Situation grundsätzlich in
          Betracht kommen – verständlich erklärt, mit Hinweisen auf Risiken und die
          zuständige Stelle.
        </p>
      </div>

      <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Wichtiger Hinweis:</strong> Diese Anwendung bietet keine Rechts-,
        Steuer- oder Förderberatung. Alle Angaben erfolgen ohne Gewähr. Die
        endgültige Entscheidung trifft ausschließlich die zuständige Stelle.
      </div>

      <Link
        href="/onboarding"
        className="rounded-lg bg-teal-700 px-8 py-3 text-lg font-semibold text-white shadow transition hover:bg-teal-800"
      >
        Jetzt prüfen
      </Link>

      <p className="max-w-xl text-center text-xs text-slate-400">
        Hinweis: Diese Einschätzung ersetzt keine Entscheidung der zuständigen
        Stelle. Eine Garantie oder verbindliche Zusage kann nicht gegeben werden.
      </p>
    </main>
  );
}
