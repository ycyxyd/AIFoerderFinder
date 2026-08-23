-- ============================================================================
-- 0002_fix_funding_fk.sql
-- Applied 2026-08-23 via Supabase SQL Editor (project flgsxhinowajpbyhfjzx).
--
-- WHY: 0001_init.sql created eligibility_decisions.funding_id -> fundings(id)
-- with an FK constraint, but the fundings table is intentionally empty at MVP:
-- the rule engine loads funding schemas from the filesystem
-- (data/foerderungen/*.json), not from this table. Every insert therefore
-- failed with 23503 "violates FK eligibility_decisions_funding_id_fkey".
--
-- DECISION: drop the FK instead of seeding the table. fundings remains as an
-- optional future admin table; decisions must never be blocked by it.
-- ============================================================================

ALTER TABLE eligibility_decisions
  DROP CONSTRAINT IF EXISTS eligibility_decisions_funding_id_fkey;
