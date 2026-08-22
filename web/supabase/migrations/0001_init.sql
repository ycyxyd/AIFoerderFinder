-- ============================================================================
-- FörderFinder — initial schema (compliance-first)
-- Layers are STRICTLY separated: facts | decisions (immutable) | chat | audit
-- Decisions are immutable: no UPDATE path, insert-only via the rule engine.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- users — account + mandatory legal consent
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  accepted_terms_at timestamptz not null,          -- legal key field
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- user_profiles — STRUCTURED FACTS ONLY (authoritative).
-- Never derived from chat. Only the user may update their own facts.
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  birth_year int,
  residence_city text,
  residence_plz text,
  employment_status text check (
    employment_status in ('employed','self_employed','freelancer','unemployed','student','retired','homemaker','other')
  ),
  monthly_income numeric,
  assets_total numeric,
  has_car boolean,
  has_property boolean,
  children int,
  insurance_months int,
  single_parent boolean,
  student boolean,
  in_vocational_training boolean,
  receives_buergergeld boolean,
  receives_alg1 boolean,
  starting_self_employment boolean,
  business_registered boolean,
  business_plan boolean,
  newborn_child boolean,
  pflegegrad int check (pflegegrad between 1 and 5),
  last_updated timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- fundings — structured Förderungen definitions (JSONB schema, server-loaded)
-- ---------------------------------------------------------------------------
create table if not exists public.fundings (
  id text primary key,
  name text not null,
  category text,
  provider text,
  schema jsonb not null,          -- the FundingSchema JSON (data/foerderungen/*.json)
  valid_from date,
  valid_until date,
  last_verified date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- eligibility_decisions — IMMUTABLE SNAPSHOTS (Decision Freeze).
-- No update trigger path: decisions cannot be modified once created.
-- ---------------------------------------------------------------------------
create table if not exists public.eligibility_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  funding_id text references public.fundings(id),
  status text not null check (status in ('eligible','not_eligible','unclear')),
  reason_codes jsonb not null default '[]',
  risks jsonb not null default '[]',
  alternatives jsonb not null default '[]',
  official_links jsonb not null default '[]',
  valid_until date,
  created_at timestamptz not null default now()
);

-- Hard block: decisions are write-once.
create or replace function public.prevent_decision_update()
returns trigger language plpgsql as $$
begin
  raise exception 'eligibility_decisions are immutable (decision freeze)';
end $$;

drop trigger if exists trg_decisions_immutable on public.eligibility_decisions;
create trigger trg_decisions_immutable
  before update on public.eligibility_decisions
  for each row execute function public.prevent_decision_update();

-- ---------------------------------------------------------------------------
-- chat — LANGUAGE CONTINUITY ONLY. Never influences facts or decisions.
-- ---------------------------------------------------------------------------
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  decision_id uuid references public.eligibility_decisions(decision_id),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id bigserial primary key,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  blocked boolean not null default false,
  intent text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_logs — legal defense / compliance (also stores intent-block events)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security — every table locked down to the owning user.
-- The service role / rule engine bypasses RLS via the server; clients can
-- only ever see their own rows.
-- ============================================================================
alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.fundings enable row level security;
alter table public.eligibility_decisions enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.audit_logs enable row level security;

-- fundings is read-only reference data: readable by any authenticated user,
-- writable by nobody (server side only).
create policy "fundings readable by all users"
  on public.fundings for select using (auth.role() = 'authenticated');

create policy "users own their row"
  on public.users for all using (auth.uid() = id);

create policy "profiles own their row"
  on public.user_profiles for all using (auth.uid() = user_id);

create policy "decisions readable by owner"
  on public.eligibility_decisions for select using (auth.uid() = user_id);
create policy "decisions insertable by owner"
  on public.eligibility_decisions for insert with check (auth.uid() = user_id);

create policy "chat sessions own"
  on public.chat_sessions for all using (auth.uid() = user_id);
create policy "chat messages via own sessions"
  on public.chat_messages for all using (
    exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy "audit logs insertable"
  on public.audit_logs for insert with check (auth.uid() = user_id);
create policy "audit logs readable by owner"
  on public.audit_logs for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Indexes for the hot paths
-- ---------------------------------------------------------------------------
create index if not exists idx_decisions_user on public.eligibility_decisions(user_id, created_at desc);
create index if not exists idx_chat_session on public.chat_messages(session_id, created_at);
create index if not exists idx_audit_user on public.audit_logs(user_id, created_at desc);
