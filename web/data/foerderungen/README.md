# Förderungen-Datenlieferung (DeepSeek Harness Aufgabe)

Dieses Verzeichnis enthält die **strukturierten Förderungen** als JSON-Dateien.
Die Dateien werden vom Regel-Engine geladen (`lib/engine/registry.ts`) — die
KI kann sie lesen, aber NIE verändern.

## Auftrag

Erstelle **9 weitere JSON-Dateien** nach dem Muster von `alg1.json`
(bereits vorhanden). Verwendet die **offiziellen Quellen** (Bundesagentur für
Arbeit, familienkasse.de, bafoeg.de, kfw.de, jobcenter.digital, etc.).
Nur Informationen verwenden, die EXPLIZIT in der Quelle stehen. Nicht raten,
nicht ergänzen, unbekannte Felder leer lassen.

## Pflicht-Schema (jede Datei MUSS diesen Aufbau haben)

```jsonc
{
  "id": "eindeutige-id",            // klein, ohne Umlaute
  "name": "Offizieller Name",
  "category": "Kategorie",
  "provider": "Zuständige Stelle",
  "description": "Kurzbeschreibung (deutsch)",
  "target_group": ["Zielgruppe"],
  "eligibility_rules": [   // Regeln: wenn Bedingung wahr -> grundsätzlich in Betracht
    { "if": { "feld": { "op": wert } }, "then": { "eligible": true } }
  ],
  "exclusion_rules": [     // Regeln: wenn wahr -> NICHT berechtigt (+ Grund + Alternative)
    { "if": { "feld": { "op": wert } }, "then": { "eligible": false, "reason": "CODE", "alternative": ["andere-id"] } }
  ],
  "risk_rules": [          // Warnungen, kippen den Status NICHT
    { "if": { "feld": { "op": wert } }, "then": { "risk": "RISK_CODE", "message_key": "KEY" } }
  ],
  "benefits": { "type": "money|services|mixed", "description": "…" },
  "application": { "authority": "…", "online": true|false, "offline": true|false, "links": ["https://…"] },
  "documents_required": ["…"],
  "steps": [
    { "step_id": "ID_STEP_1", "title": "…", "when": "…", "explain": "…", "risk_if_missed": "…" }
  ],
  "notes": ["…"],
  "valid_until": "JJJJ-MM-TT",
  "last_verified": "JJJJ-MM-TT",   // Datum der Quellenprüfung
  "sources": ["Offizielle Quelle"]
}
```

## Operatoren (nur diese)

`gte`, `gt`, `lte`, `lt` (Zahlen), `eq`, `neq` (Gleichheit), `contains`
(Array enthält), `in` (Wert in Liste). Bedingungen im selben `if` sind UND-verknüpft.

## Verfügbare Profil-Felder (Bedingungen dürfen nur diese verwenden)

`age`, `birth_year`, `employment_status` (employed|self_employed|freelancer|
unemployed|student|retired|other), `monthly_income`, `assets_total`, `has_car`,
`has_property`, `children`, `insurance_months`, `single_parent`, `student`,
`in_vocational_training`, `receives_buergergeld`, `receives_alg1`,
`starting_self_employment`, `business_registered`, `business_plan`,
`newborn_child`, `pflegegrad`, `working_hours_reduced`, `employer_insolvent`,
`heating_cost_high`, `resigned_voluntarily` (weitere nur nach Absprache)

## Zu erstellen (9 Dateien)

| Datei | id | Förderung |
|---|---|---|
| `buergergeld.json` | `buergergeld` | Bürgergeld (Jobcenter) — Achtung: Vermögensfreibeträge seit 2023 (40.000 € pro Person, Staffelung), kein pauschaler Einkommenswert |
| `wohngeld.json` | `wohngeld` | Wohngeld — Einkommensgrenzen sind komplex, bei Unsicherheit Regeln leer lassen und Note ergänzen |
| `kindergeld.json` | `kindergeld` | Kindergeld (Familienkasse) |
| `elterngeld.json` | `elterngeld` | Elterngeld / ElterngeldPlus — Einkommensgrenze aktuell (175.000 € / 2025) |
| `bafoeg.json` | `bafoeg` | BAföG (Studentenwerk) |
| `bildungsgutschein.json` | `bildungsgutschein` | Bildungsgutschein (Agentur für Arbeit) |
| `gruendungszuschuss.json` | `gruendungszuschuss` | Gründungszuschuss (Agentur für Arbeit) |
| `einstiegsgeld.json` | `einstiegsgeld` | Einstiegsgeld (Jobcenter) |
| `kfw_gruenderkredit.json` | `kfw_gruenderkredit` | KfW-Gründerkredit (über Hausbank) |

## Regeln

1. **Wahrheit vor Vollständigkeit**: Wenn die Quelle eine Bedingung nicht
   eindeutig als Ja/Nein-Regel hergibt → Regel WEGLASSEN und in `notes`
   schreiben „Bedingungen im Einzelfall bei der zuständigen Stelle prüfen.“
2. **Keine Grenzwerte erfinden**: Nur Beträge/Prozentsätze verwenden, die in
   der Quelle explizit stehen.
3. `last_verified` = Datum, an dem du die Quelle geprüft hast.
4. JSON muss gültig sein und dem obigen Schema entsprechen (keine
   Kommentare, keine Trailing Commas).
5. Nach Fertigstellung: `data/foerderungen/` enthält genau 10 .json-Dateien.
