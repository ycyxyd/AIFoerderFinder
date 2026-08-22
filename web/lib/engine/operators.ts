// ============================================================================
// DSL condition matcher — deterministic, no AI, no probabilities.
// Same input ALWAYS produces the same output.
// ============================================================================

import type { Condition } from '../types';

type NumericOp = 'gte' | 'gt' | 'lte' | 'lt';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function compareNumeric(actual: number, expected: unknown, op: NumericOp): boolean {
  const exp = toNumber(expected);
  if (exp === null) return false;
  switch (op) {
    case 'gte':
      return actual >= exp;
    case 'gt':
      return actual > exp;
    case 'lte':
      return actual <= exp;
    case 'lt':
      return actual < exp;
  }
}

/** Match a single expected field condition against the actual profile value. */
export function matchField(actual: unknown, expected: Condition[string]): boolean {
  if (expected === null || expected === undefined) return false;

  // Literal shorthand: { field: 'unemployed' } => equality
  if (typeof expected !== 'object' || Array.isArray(expected)) {
    return actual === expected;
  }

  const cond = expected as Record<string, unknown>;

  if ('eq' in cond) return actual === cond.eq;
  if ('neq' in cond) return actual !== cond.neq;

  if ('gte' in cond || 'gt' in cond || 'lte' in cond || 'lt' in cond) {
    const num = toNumber(actual);
    if (num === null) return false;
    if ('gte' in cond && !compareNumeric(num, cond.gte, 'gte')) return false;
    if ('gt' in cond && !compareNumeric(num, cond.gt, 'gt')) return false;
    if ('lte' in cond && !compareNumeric(num, cond.lte, 'lte')) return false;
    if ('lt' in cond && !compareNumeric(num, cond.lt, 'lt')) return false;
    return true;
  }

  if ('contains' in cond) {
    const want = cond.contains;
    return Array.isArray(actual) && Array.isArray(want) && want.every((x) => actual.includes(x));
  }

  if ('in' in cond) {
    return Array.isArray(cond.in) && cond.in.includes(actual);
  }

  return false;
}

/**
 * Match a whole condition object. ALL fields must match (logical AND).
 * Returns true for an empty condition (vacuous truth) — keep rules explicit.
 */
export function matchCondition(condition: Condition, profile: Record<string, unknown>): boolean {
  return Object.entries(condition).every(([field, expected]) => {
    const actual = profile[field];
    return matchField(actual, expected);
  });
}
