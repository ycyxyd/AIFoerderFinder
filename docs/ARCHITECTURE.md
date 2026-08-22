# FörderFinder — Systemarchitektur (MVP)

Compliance-first AI-Beratungs-App für deutsche Förderprogramme (PWA).

## Leitprinzip (NON-NEGOTIABLE)

> **AI ist Explain-only. Die Entscheidung trifft der Regel-Engine.**

```
User Input → Intent Detection → Policy Gate → Decision Store (read-only)
                                                  ↓
                                          LLM (Explain-only)
                                                  ↓
                                          Response Filter
                                                  ↓
                                                  User
```

## Module

| Modul | Pfad | Verantwortung |
|---|---|---|
| Domain-Typen | `lib/types.ts` | Facts / Decisions / Chat strikt getrennt |
| Regel-Engine | `lib/engine/` | DSL-Auswertung, deterministisch, kein AI |
| Förder-Registry | `lib/engine/registry.ts` | Lädt `data/foerderungen/*.json` (server-only) |
| Intent Detection | `lib/intent/detector.ts` | Keyword-Regeln, vor jedem LLM-Call |
| Policy Gate | `lib/intent/policy.ts` | Sperrt gefährliche Intents, deutsche Vorlagen |
| AI Explain | `lib/ai/explain.ts` | Einziger LLM-Aufruf; bekommt nur Decision-Snapshot |
| Response Filter | `lib/ai/response-filter.ts` | Neutralisiert verbotene Formulierungen |
| API | `app/api/` | decisions (erzeugen), explain (Chat), fundings (Meta) |
| UI | `app/` | Landing, Onboarding, Results, Chat |

## Entscheidungen (bewusst getroffen)

1. **Decision-Erzeugung nur über `/api/decisions`** — es gibt keinen
   `update`-Pfad; neue Daten → neue decision_id. (Decision Freeze)
2. **Chat beeinflusst nie Facts/Decisions.** `chat_messages` sind reine
   Sprach-Kontinuität. (Memory-Layering)
3. **Leere `eligibility_rules`** = „keine genannten Voraussetzungen“ →
   als eligible behandelt, solange keine Exclusion greift.
4. **`unclear`-Status**: Eligibility-Regeln vorhanden, aber keine greift und
   keine Exclusion greift → „nicht abschließend beurteilbar“. Die AI muss das
   vorsichtig kommunizieren.
5. **Kein LangChain / kein Agent.** Ein Prompt, ein Call, Determinismus.
6. **Demo-Modus**: Ohne `MISTRAL_API_KEY` liefert der Explain-Service eine
   deterministische deutsche Mock-Antwort (`usedMock: true`), damit die App
   sofort lauffähig und testbar ist.
7. **In-Memory-Store (Fallback)**: Ohne `SUPABASE_SERVICE_ROLE_KEY` hält die
   App Entscheidungen im Prozess (`lib/db/repository.ts` → MemoryRepository).
   Mit konfiguriertem Supabase (URL + Service-Role-Key) speichert sie in
   `eligibility_decisions` + `audit_logs` (SupabaseRepository). Die
   Datenbank-Migration liegt in `supabase/migrations/0001_init.sql`
   (siehe `docs/SUPABASE_SETUP.md`).
8. **Auth (MVP)**: `/api/auth/signup` (Pflicht: `accepted_terms: true` →
   `accepted_terms_at` in `users`), `/api/auth/login`, `/api/auth/me`.
   Token-basiert, Client hält Session. Noch kein Cookie-/SSR-Session-Flow.

## Bekannte offene Punkte (Review-Ergebnis, 2026-08-22)

- **Regelverifikation**: Alle Förderungen (inkl. `alg1.json`) müssen gegen
  offizielle Quellen geprüft werden; `last_verified` aktuell nur von der
  Datenlieferung. Jährliche Änderungen (Bedarfssätze etc.) einplanen.
- **Auth**: Supabase Auth + `accepted_terms_at` (Pflicht-Checkbox) ist noch
  nicht verdrahtet — Onboarding-Checkbox ist UI-only.
- **audit_logs**: Aktuell `console.log`; Supabase-Tabelle vorbereitet, noch
  nicht aktiv.
- **DSGVO Art. 9**: Daten zu Gesundheit (Pflegegrad, Krankheit) sind
  besondere Kategorien → Einwilligung + Löschkonzept nötig.
- **Rate-Limiting / Token-Limits** für `/api/explain` fehlen noch.
- **RLS-Policies** werden beim Supabase-Migrationsschritt mitgeliefert.

## Befehle

```sh
pnpm dev        # Entwicklung (http://127.0.0.1:3000)
pnpm test       # Vitest (Engine + Intent)
pnpm typecheck  # tsc --noEmit
pnpm build      # Produktions-Build
node scripts/validate-fundings.mjs   # Review-Gate für data/foerderungen/*.json
```
