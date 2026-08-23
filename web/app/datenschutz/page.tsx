import Link from 'next/link';

// ============================================================================
// Datenschutzerklärung (DSGVO). Placeholders marked with 【…】 MUST be replaced
// with the operator's real data. This app collects employment/income facts and
// sends explanation prompts to an LLM provider — both need explicit disclosure.
// ============================================================================

export const metadata = { title: 'Datenschutzerklärung – FörderFinder' };

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-teal-700 hover:underline">
        ← Zurück zur Startseite
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Datenschutzerklärung</h1>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Hinweis:</strong> Die mit 【…】 markierten Stellen sind Platzhalter
        und müssen vor dem Livegang mit den echten Betreiberdaten ersetzt werden.
      </div>

      <section className="mt-6 space-y-5 text-sm leading-relaxed text-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            1. Verantwortlicher
          </h2>
          <p className="mt-1">
            Verantwortlicher im Sinne der DSGVO ist:<br />
            【Vorname Nachname / Firma】, 【Straße Hausnummer】, 【PLZ Ort】<br />
            E-Mail: 【kontakt@beispiel.de】, Telefon: 【+49 …】
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            2. Welche Daten wir verarbeiten
          </h2>
          <p className="mt-1">
            Bei der Nutzung der Anwendung verarbeiten wir folgende Kategorien
            personenbezogener Daten:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <strong>Kontodaten:</strong> E-Mail-Adresse und Passwort
              (gehasht, Verwaltung über unseren Anbieter Supabase).
            </li>
            <li>
              <strong>Angaben zur persönlichen Situation (Fakten):</strong>{' '}
              z.&nbsp;B. Beschäftigungsstatus, Einkommen, Vermögen, Kinderzahl,
              Versicherungszeiten. Diese Angaben sind freiwillig und werden nur
              für die Berechnung der Orientierungs-Ergebnisse verwendet.
            </li>
            <li>
              <strong>Ergebnis-Schnappschüsse:</strong> berechnete
              Eignungsentscheidungen sowie Ihre Fragen im Chat, die zur
              Erläuterung an einen KI-Dienstleister übermittelt werden.
            </li>
            <li>
              <strong>Audit-Protokolle:</strong> technische Ereignisse (z.&nbsp;B.
              Sperrungen von missbräuchlichen Anfragen) zur rechtlichen
              Verteidigung.
            </li>
          </ul>
          <p className="mt-2">
            Es werden <strong>keine Gesundheitsdaten</strong> im Sinne von Art. 9
            DSGVO abgefragt oder verarbeitet.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            3. Zwecke und Rechtsgrundlagen
          </h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              Bereitstellung des Dienstes und Vertragserfüllung – Art. 6 Abs. 1
              lit. b DSGVO.
            </li>
            <li>
              Nachweis der erteilten Einwilligung und rechtlicher
              Pflichten (z.&nbsp;B. Aufbewahrung) – Art. 6 Abs. 1 lit. c DSGVO.
            </li>
            <li>
              Schutz vor Missbrauch (Rate-Limiting, Sperrung) – Art. 6 Abs. 1
              lit. f DSGVO (berechtigtes Interesse).
            </li>
            <li>
              Erläuterung der Ergebnisse durch ein Sprachmodell – Art. 6 Abs. 1
              lit. b DSGVO (Vertrag) bzw. Einwilligung, soweit erforderlich.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            4. Empfänger und Drittlandübermittlung
          </h2>
          <p className="mt-1">
            Wir setzen Dienstleister als Auftragsverarbeiter ein (Art. 28 DSGVO):
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase Inc.</strong> – Datenbank und
              Benutzerverwaltung (Server in der EU).
            </li>
            <li>
              <strong>KI-Sprachmodell-Anbieter</strong> (z.&nbsp;B. OpenRouter
              bzw. zugrunde liegende Modellanbieter) – Erläuterungstexte. Diese
              Anbieter können Server außerhalb der EU (insbesondere USA)
              nutzen; die Übermittlung erfolgt auf Grundlage eines
              Angemessenheitsbeschlusses bzw. Standardvertragsklauseln.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            5. Speicherdauer
          </h2>
          <p className="mt-1">
            Wir speichern personenbezogene Daten nur so lange, wie es für die
            genannten Zwecke erforderlich ist oder gesetzliche
            Aufbewahrungspflichten bestehen. Ergebnis-Schnappschüsse sind
            technisch unveränderbar (Decision Freeze) und werden gelöscht,
            sobald eine Löschung beantragt wird.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            6. Ihre Rechte
          </h2>
          <p className="mt-1">
            Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16),
            Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
            Datenübertragbarkeit (Art. 20) sowie Widerspruch (Art. 21 DSGVO).
            Zudem können Sie eine erteilte Einwilligung jederzeit mit Wirkung
            für die Zukunft widerrufen. Für die Ausübung Ihrer Rechte wenden Sie
            sich bitte an: 【kontakt@beispiel.de】.
          </p>
          <p className="mt-2">
            Sie haben außerdem das Recht, sich bei einer Aufsichtsbehörde zu
            beschweren, z.&nbsp;B. bei der für den Sitz des Verantwortlichen
            zuständigen Datenschutzaufsichtsbehörde.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            7. Automatisierte Entscheidungen
          </h2>
          <p className="mt-1">
            Die Eignungsprüfung erfolgt auf Grundlage fest definierter,
            nachvollziehbarer Regeln. Das Ergebnis ist eine unverbindliche
            Orientierung, keine Entscheidung mit rechtlicher Wirkung. Ein
            KI-Sprachmodell erzeugt lediglich verständliche Erläuterungen; es
            trifft keine Entscheidungen.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            8. Cookies und Tracking
          </h2>
          <p className="mt-1">
            Diese Anwendung verwendet keine Werbe-Cookies und kein
            Tracking-Tooling. Technisch notwendige lokale Speicherung (z.&nbsp;B.
            Anmeldezustand) erfolgt ausschließlich in Ihrem Browser.
          </p>
        </div>
      </section>
    </main>
  );
}
