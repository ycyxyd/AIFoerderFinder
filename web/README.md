# FörderFinder (PWA)

Compliance-first AI-Beratungs-App für deutsche Förderprogramme.
**Keine Rechts-, Steuer- oder Förderberatung. Explain-only AI.**

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind 4)
- Eigenes DSL-Regelwerk + deterministischer Engine (`lib/engine/`)
- Intent Detection + Policy Gate + Response Filter (`lib/intent/`, `lib/ai/`)
- Mistral API (Explain-only) — ohne Key: Demo-Modus mit Mock-Antworten
- Supabase vorbereitet (`.env.example`), Persistenz in nächster Iteration

## Entwicklung

```sh
pnpm install
cp .env.example .env.local   # optional: MISTRAL_API_KEY setzen
pnpm dev                     # http://127.0.0.1:3000
pnpm test                    # 16 Tests (Engine + Intent)
pnpm build
```

## Flow

1. `/` — Landing mit Haftungsausschluss
2. `/onboarding` — strukturierte Fragen (Facts)
3. `/results` — Regel-Engine-Ergebnisse (immutable Snapshots)
4. `/chat?decision_id=…` — Explain-only KI-Beratung

## Architektur

Siehe `docs/ARCHITECTURE.md` (Repowurzel) — Leitprinzip: Die KI entscheidet nie.
