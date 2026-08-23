import Link from 'next/link';

// ============================================================================
// Impressum (§ 5 DDG). Placeholders marked with 【…】 MUST be replaced with
// the operator's real data before going live.
// ============================================================================

export const metadata = { title: 'Impressum – FörderFinder' };

export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-teal-700 hover:underline">
        ← Zurück zur Startseite
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Impressum</h1>
      <p className="mt-1 text-sm text-slate-500">Angaben gemäß § 5 DDG</p>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Hinweis:</strong> Die mit 【…】 markierten Stellen sind Platzhalter
        und müssen vor dem Livegang mit den echten Betreiberdaten ersetzt werden.
      </div>

      <section className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Diensteanbieter</h2>
          <p className="mt-1">
            【Vorname Nachname / Firma】<br />
            【Straße Hausnummer】<br />
            【PLZ Ort】
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">Kontakt</h2>
          <p className="mt-1">
            E-Mail: 【kontakt@beispiel.de】<br />
            Telefon: 【+49 …】<br />
            Website: 【https://…】
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">Umsatzsteuer-ID</h2>
          <p className="mt-1">
            Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: 【USt-IdNr., falls
            vorhanden】
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
          </h2>
          <p className="mt-1">【Name, Anschrift wie oben, falls abweichend】</p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">Haftungsausschluss</h2>
          <p className="mt-1">
            Die Inhalte dieser Anwendung dienen ausschließlich der allgemeinen
            Orientierung und ersetzen keine Rechts-, Steuer- oder Förderberatung.
            Alle Angaben erfolgen ohne Gewähr. Für Entscheidungen, die auf
            Grundlage dieser Inhalte getroffen werden, wird keine Haftung
            übernommen. Die endgültige Entscheidung über die Gewährung einer
            Leistung trifft ausschließlich die zuständige Stelle.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Verbraucherstreitbeilegung
          </h2>
          <p className="mt-1">
            Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung (OS) bereit:{' '}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              className="text-teal-700 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://ec.europa.eu/consumers/odr/
            </a>
            . Wir sind nicht bereit und nicht verpflichtet, an
            Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
            teilzunehmen.
          </p>
        </div>
      </section>
    </main>
  );
}
