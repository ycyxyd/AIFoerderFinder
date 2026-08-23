import Link from 'next/link';

// ============================================================================
// AGB. Placeholders marked with 【…】 MUST be replaced with the operator's real
// data before going live. Core promise: orientation only, no advice, no
// guarantees — matches the app's compliance-first architecture.
// ============================================================================

export const metadata = { title: 'Allgemeine Geschäftsbedingungen – FörderFinder' };

export default function AgbPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-teal-700 hover:underline">
        ← Zurück zur Startseite
      </Link>
      <h1 className="mt-4 text-3xl font-bold">
        Allgemeine Geschäftsbedingungen (AGB)
      </h1>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Hinweis:</strong> Die mit 【…】 markierten Stellen sind Platzhalter
        und müssen vor dem Livegang mit den echten Betreiberdaten ersetzt werden.
      </div>

      <section className="mt-6 space-y-5 text-sm leading-relaxed text-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-900">1. Geltungsbereich</h2>
          <p className="mt-1">
            Diese Bedingungen gelten für die Nutzung der Anwendung „FörderFinder“
            (im Folgenden „Dienst“) durch Nutzerinnen und Nutzer. Betreiber des
            Dienstes ist 【Vorname Nachname / Firma】, 【Straße Hausnummer】,
            【PLZ Ort】 (im Folgenden „Anbieter“).
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">2. Leistungsbeschreibung</h2>
          <p className="mt-1">
            Der Dienst liefert eine unverbindliche Orientierung, welche
            Förderprogramme für die vom Nutzer angegebenen Umstände grundsätzlich
            in Betracht kommen könnten. Die Prüfung erfolgt auf Grundlage
            fest definierter Regeln; ein KI-Sprachmodell erstellt ausschließlich
            verständliche Erläuterungen.
          </p>
          <p className="mt-2">
            Der Dienst ist <strong>keine</strong> Rechts-, Steuer- oder
            Förderberatung und erhebt keinen Anspruch auf Vollständigkeit oder
            Richtigkeit der Informationen. Die endgültige Entscheidung über die
            Gewährung einer Leistung trifft ausschließlich die zuständige Stelle.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">3. Keine Gewähr, keine Haftung</h2>
          <p className="mt-1">
            Der Anbieter übernimmt keine Gewähr für die inhaltliche Richtigkeit,
            Aktualität und Vollständigkeit der bereitgestellten Informationen.
            Eine Haftung für Schäden, die durch die Nutzung des Dienstes oder im
            Vertrauen auf die Ergebnisse entstehen, ist – soweit gesetzlich
            zulässig – ausgeschlossen. Dies gilt nicht bei Vorsatz, grober
            Fahrlässigkeit, Verletzung von Leben, Körper oder Gesundheit sowie
            bei Verstößen gegen wesentliche Vertragspflichten.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">4. Pflichten des Nutzers</h2>
          <p className="mt-1">
            Der Nutzer verpflichtet sich, wahrheitsgemäße Angaben zu seiner
            Situation zu machen und den Dienst nicht missbräuchlich zu nutzen
            (insbesondere keine automatisierte Massenabfrage, keine Umgehung von
            Zugangs- oder Sicherheitsvorkehrungen).
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">5. Konto und Beendigung</h2>
          <p className="mt-1">
            Für die Nutzung bestimmter Funktionen kann ein Konto erforderlich
            sein. Der Anbieter kann den Dienst jederzeit einstellen oder
            einzelne Nutzer bei Verstoß gegen diese Bedingungen von der Nutzung
            ausschließen. Der Nutzer kann sein Konto jederzeit löschen lassen;
            die Datenschutzerklärung regelt die Datenverarbeitung.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">6. Änderungen dieser Bedingungen</h2>
          <p className="mt-1">
            Der Anbieter kann diese Bedingungen mit angemessener Frist ändern.
            Änderungen werden dem Nutzer rechtzeitig mitgeteilt; die Nutzung des
            Dienstes nach Wirksamwerden gilt als Zustimmung.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">7. Schlussbestimmungen</h2>
          <p className="mt-1">
            Es gilt das Recht der Bundesrepublik Deutschland. Soweit gesetzlich
            zulässig, ist Gerichtsstand der Sitz des Anbieters. Sollten einzelne
            Bestimmungen dieser Bedingungen unwirksam sein, bleibt die
            Wirksamkeit der übrigen Bestimmungen unberührt.
          </p>
        </div>
      </section>
    </main>
  );
}
