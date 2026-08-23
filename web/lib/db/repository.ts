// ============================================================================
// Repository layer — persistence for decisions + audit logs.
// Two implementations behind one interface:
//   1. SupabaseRepository  (service-role, used when configured)
//   2. MemoryRepository    (per-process Map — MVP fallback / tests)
// The rest of the app never touches Supabase directly.
// ============================================================================

import type { AuditEntry, DecisionSnapshot } from '../types';
import { classifyDbError, getAdminClient, supabaseConfigured } from './server';

export interface DecisionRepository {
  saveDecisions(decisions: DecisionSnapshot[]): Promise<void>;
  getDecision(decisionId: string): Promise<DecisionSnapshot | null>;
  listDecisionsByUser(userId: string): Promise<DecisionSnapshot[]>;
  saveAudit(entry: AuditEntry): Promise<void>;
}

// ---------------------------------------------------------------------------
// Memory implementation (fallback + tests)
// ---------------------------------------------------------------------------
class MemoryRepository implements DecisionRepository {
  private decisions = new Map<string, DecisionSnapshot>();
  private audits: AuditEntry[] = [];

  async saveDecisions(list: DecisionSnapshot[]): Promise<void> {
    for (const d of list) this.decisions.set(d.decision_id, d);
  }
  async getDecision(id: string): Promise<DecisionSnapshot | null> {
    return this.decisions.get(id) ?? null;
  }
  async listDecisionsByUser(userId: string): Promise<DecisionSnapshot[]> {
    return Array.from(this.decisions.values()).filter((d) => d.user_id === userId);
  }
  async saveAudit(entry: AuditEntry): Promise<void> {
    this.audits.push(entry);
  }
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------
class SupabaseRepository implements DecisionRepository {
  async saveDecisions(list: DecisionSnapshot[]): Promise<void> {
    const client = getAdminClient();
    const rows = list.map((d) => ({
      decision_id: d.decision_id,
      user_id: d.user_id ?? null,
      funding_id: d.funding_id,
      status: d.status,
      reason_codes: d.reason_codes,
      risks: d.risks,
      alternatives: d.alternatives,
      official_links: d.official_links,
      valid_until: d.valid_until ? d.valid_until.slice(0, 10) : null,
    }));
    const { error } = await client.from('eligibility_decisions').insert(rows);
    if (error) throw error;
  }

  async getDecision(decisionId: string): Promise<DecisionSnapshot | null> {
    const client = getAdminClient();
    const { data, error } = await client
      .from('eligibility_decisions')
      .select('*')
      .eq('decision_id', decisionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      decision_id: data.decision_id,
      user_id: data.user_id ?? undefined,
      funding_id: data.funding_id,
      funding_name: data.funding_name ?? data.funding_id,
      provider: data.provider ?? '',
      status: data.status,
      reason_codes: data.reason_codes ?? [],
      risks: data.risks ?? [],
      alternatives: data.alternatives ?? [],
      official_links: data.official_links ?? [],
      created_at: data.created_at,
      valid_until: data.valid_until ?? '',
    };
  }

  async listDecisionsByUser(userId: string): Promise<DecisionSnapshot[]> {
    const client = getAdminClient();
    const { data, error } = await client
      .from('eligibility_decisions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapRow);
  }

  async saveAudit(entry: AuditEntry): Promise<void> {
    const client = getAdminClient();
    const { error } = await client.from('audit_logs').insert({
      user_id: entry.user_id ?? null,
      event_type: entry.event_type,
      payload: entry.payload,
    });
    if (error) throw error;
  }
}

function mapRow(data: Record<string, unknown>): DecisionSnapshot {
  return {
    decision_id: String(data.decision_id),
    user_id: (data.user_id as string | null) ?? undefined,
    funding_id: String(data.funding_id),
    funding_name: (data.funding_name as string | undefined) ?? String(data.funding_id),
    provider: (data.provider as string | undefined) ?? '',
    status: data.status as DecisionSnapshot['status'],
    reason_codes: (data.reason_codes as DecisionSnapshot['reason_codes']) ?? [],
    risks: (data.risks as DecisionSnapshot['risks']) ?? [],
    alternatives: (data.alternatives as string[]) ?? [],
    official_links: (data.official_links as string[]) ?? [],
    created_at: String(data.created_at),
    valid_until: (data.valid_until as string | undefined) ?? '',
  };
}

// ---------------------------------------------------------------------------
// Factory + shared instances
// ---------------------------------------------------------------------------
let memoryRepo: MemoryRepository | null = null;
let supabaseRepo: SupabaseRepository | null = null;

/** Returns the active repository (Supabase when configured, else memory). */
export function getRepository(): DecisionRepository {
  if (supabaseConfigured()) {
    supabaseRepo ??= new SupabaseRepository();
    return supabaseRepo;
  }
  return getMemoryRepository();
}

/** Always-available in-process store — used as fallback when Supabase is
 *  configured but unreachable (e.g. migration not applied yet). */
export function getMemoryRepository(): DecisionRepository {
  memoryRepo ??= new MemoryRepository();
  return memoryRepo;
}

export { classifyDbError };
