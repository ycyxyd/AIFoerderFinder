// ============================================================================
// Eligibility Engine — the "judge". AI can NEVER touch this.
// Deterministic rule evaluation following the documented DSL semantics:
//   - eligibility_rules:  ANY match -> eligible = true
//   - exclusion_rules:    ANY match -> eligible = false (+ reason, alternatives)
//   - risk_rules:         ANY match -> risk flag appended (never flips status)
// ============================================================================

import { randomUUID } from 'node:crypto';
import type { DecisionSnapshot, FundingSchema, UserProfile } from '../types';
import { matchCondition } from './operators';

export interface EvaluationInput {
  userProfile: UserProfile;
  funding: FundingSchema;
}

export interface EvaluationOutput extends DecisionSnapshot {
  /** true when the evaluation ran fully on deterministic rules */
  deterministic: true;
}

/**
 * Evaluate one funding against a user profile.
 *
 * Deliberate semantics (documented in docs/ARCHITECTURE.md):
 * - A funding with NO eligibility_rules has no stated preconditions and is
 *   treated as eligible unless an exclusion rule fires.
 * - If eligibility rules exist but none match and no exclusion fired, the
 *   result is 'unclear' — the model has not confirmed eligibility, which the
 *   AI layer must communicate cautiously.
 */
export function evaluateEligibility({ userProfile, funding }: EvaluationInput): EvaluationOutput {
  const profile = userProfile as unknown as Record<string, unknown>;

  let eligible = false;
  const reasonCodes: DecisionSnapshot['reason_codes'] = [];
  const risks: DecisionSnapshot['risks'] = [];
  let alternatives: string[] = [];

  const hasEligibilityRules = Array.isArray(funding.eligibility_rules) && funding.eligibility_rules.length > 0;

  if (!hasEligibilityRules) {
    eligible = true; // no stated preconditions
  } else {
    for (const rule of funding.eligibility_rules) {
      if (matchCondition(rule.if, profile)) {
        eligible = true;
        break;
      }
    }
  }

  for (const rule of funding.exclusion_rules ?? []) {
    if (matchCondition(rule.if, profile)) {
      eligible = false;
      if (rule.then.reason) reasonCodes.push({ code: rule.then.reason });
      if (rule.then.alternative) alternatives = alternatives.concat(rule.then.alternative);
    }
  }

  for (const rule of funding.risk_rules ?? []) {
    if (matchCondition(rule.if, profile)) {
      risks.push({
        risk_code: rule.then.risk ?? 'UNKNOWN_RISK',
        message_key: rule.then.message_key,
      });
    }
  }

  let status: DecisionSnapshot['status'];
  if (eligible) {
    status = 'eligible';
  } else if (reasonCodes.length > 0) {
    status = 'not_eligible';
  } else {
    status = 'unclear'; // eligibility rules exist but none matched, no explicit exclusion
  }

  const validUntil = funding.valid_until ?? new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();

  return {
    decision_id: randomUUID(),
    user_id: userProfile.user_id,
    funding_id: funding.id,
    funding_name: funding.name,
    provider: funding.provider,
    status,
    reason_codes: reasonCodes,
    risks,
    alternatives: Array.from(new Set(alternatives)), // dedupe
    official_links: funding.application?.links ?? [],
    created_at: new Date().toISOString(),
    valid_until: validUntil,
    deterministic: true,
  };
}

/**
 * Evaluate a profile against many fundings.
 * Pure function: identical inputs -> identical outputs (ids aside).
 */
export function evaluateAll(
  userProfile: UserProfile,
  fundings: FundingSchema[]
): EvaluationOutput[] {
  return fundings.map((f) => evaluateEligibility({ userProfile, funding: f }));
}
