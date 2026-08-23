# Supabase Setup (FörderFinder)

Die App kann ohne Supabase laufen (Demo-Modus: In-Memory-Speicher). Für echte
Persistenz + Auth zwei Schritte:

## 1. Migrationen anwenden

Öffne dein Supabase-Projekt-Dashboard →
**SQL Editor** → **New query** → Inhalt von
`web/supabase/migrations/0001_init.sql` einfügen → **Run**.

Das legt an:
- `users` (mit `accepted_terms_at` — legaler Pflicht-Nachweis)
- `user_profiles` (Facts)
- `fundings` (Förder-Schema als JSONB)
- `eligibility_decisions` (**immutable** — Update-Trigger blockt Änderungen)
- `chat_sessions`, `chat_messages`, `audit_logs`
- Row-Level-Security-Policies auf allen Tabellen

Anschließend `web/supabase/migrations/0002_fix_funding_fk.sql` ausführen
(entfernt den FK `eligibility_decisions.funding_id → fundings(id)`: die
`fundings`-Tabelle ist im MVP optional — die Regel-Engine lädt Schemas aus
`data/foerderungen/*.json`, nicht aus der DB).

## 1b. Fundings-Spiegel befüllen (optional, für Backoffice)

```bash
cd web && node scripts/seed-fundings.mjs
```

Upsertet alle `data/foerderungen/*.json` in die `fundings`-Tabelle
(`SUPABASE_SERVICE_ROLE_KEY` aus `.env.local`). Nach jedem Daten-Update erneut
ausführen.

## 2. Umgebungsvariablen

In `web/.env.local` (NIE committen):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>        # öffentlich, für Client
SUPABASE_SERVICE_ROLE_KEY=<service_role key>    # NUR Server! Holt aus Dashboard → Settings → API
```

⚠️ Der `service_role`-Key umgeht RLS. Er darf **nie** in Client-Code oder
`NEXT_PUBLIC_`-Variablen landen. Er wird ausschließlich server-seitig in
`lib/db/server.ts` verwendet.

## Verhalten

- Beide Keys gesetzt → Entscheidungen & Audit-Logs werden in Supabase
  gespeichert; Registrierung (`/api/auth/signup`) erstellt Auth-User + trägt
  `accepted_terms_at` ein; Login über `/api/auth/login`.
- Kein Service-Role-Key → App läuft weiter im Demo-Modus (In-Memory),
  Registrierungs-UI wird ausgeblendet (`/api/config`).

## Auth-Hinweise (MVP)

- `email_confirm: true` beim Signup (kein SMTP konfiguriert). Vor Produktion
  E-Mail-Verifizierung aktivieren.
- Sessions werden client-seitig gehalten (localStorage). Für eine
  Cookie-basierte Session mit `@supabase/ssr` später umstellen.
