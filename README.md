# FörderFinder

**Compliance-first assistant for German public funding programmes (Förderungen) — the rule engine decides, the AI only explains.**

> ⚠️ Keine Rechts-, Steuer- oder Förderberatung. This software provides information only and cannot replace professional advice. / Explain-only AI.

## Why this exists

Billions in German public funding (Bürgergeld, Wohngeld, KfW, BAFA, BAföG, Bildungsscheck, Aufstiegs-BAföG, …) go unclaimed every year — not because people are ineligible, but because the landscape is fragmented across federal, state and municipal programmes and the rules are hard to read. At the same time, LLMs are **not** a safe decision maker for legally consequential advice: they hallucinate eligibility and cannot cite a source for a threshold.

FörderFinder separates the two concerns:

- **Deterministic rule engine** evaluates eligibility from structured facts — no AI in the decision path.
- **LLM (explain-only)** turns the stored decision into readable language, always bound to the decision snapshot.

Every result is an immutable, traceable **Decision** with the rule version and source references that produced it.

## Architecture

```
User input → Intent detection → Policy gate → Decision store (read-only, immutable snapshots)
                                                     ↓
                                            LLM (explain-only, citation-bound)
                                                     ↓
                                            Response filter (policy + safety)
                                                     ↓
                                                    User
```

| Layer | Path | Responsibility |
|---|---|---|
| Domain types | `web/lib/types.ts` | Facts / Decisions / Chat strictly separated |
| Rule engine | `web/lib/engine/` | DSL evaluation, deterministic, no AI |
| Funding registry | `web/lib/engine/registry.ts` + `web/data/foerderungen/*.json` | Versioned programme data (server-only) |
| RAG knowledge | `web/knowledge/`, `web/lib/rag/` | Curated documents per programme with sources |
| AI layer | `web/lib/ai/`, `web/lib/intent/` | Fact extraction (whitelist-sanitized), intent detection, explain-only responses, response filter |
| Ads | `web/lib/ads/` | Contextual, exit-intent only — never interrupts a consultation |
| Mobile | `web/android/`, `web/ios/` | Capacitor packaging of the PWA |

See `docs/ARCHITECTURE.md` for the full design and `docs/CAPACITOR_HARDENING.md` / `docs/MOBILE_DEV.md` for the mobile build.

## Quick start

```sh
cd web
pnpm install
cp .env.example .env.local   # optional: MISTRAL_API_KEY — without it the app runs in demo mode with mock answers
pnpm dev                     # http://127.0.0.1:3000
pnpm test                    # 72 tests (rule engine, cross-benefits, intent, RAG, ads)
pnpm typecheck && pnpm build
```

The rule engine, registry and tests run **without any API key** — that is intentional: the decision path must be testable offline.

## Flow

1. `/` — landing with disclaimer
2. `/onboarding` — structured questions (facts)
3. `/results` — rule-engine results (immutable snapshots)
4. `/chat?decision_id=…` — explain-only AI consultation, bound to that snapshot

## Status

Early but working prototype: engine, registry, conversational intake, explain-only chat, RAG, ads layer and Capacitor mobile shell are in place and covered by tests. Supabase persistence and the production programme registry are next — see `docs/ARCHITECTURE.md`.

## Contributing

Issues and pull requests are welcome — especially **programme data** (new funding programmes, updated thresholds, official sources) and rule-engine test cases. Please include an official source link for any data contribution.

## License

MIT — see [LICENSE](LICENSE).
