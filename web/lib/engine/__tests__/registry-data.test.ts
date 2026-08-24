import { describe, it, expect, beforeAll } from 'vitest';
import { loadFundings, getFunding, _resetRegistryForTests } from '../registry';
import { evaluateEligibility } from '../evaluator';
import type { UserProfile } from '../../types';

beforeAll(() => {
  _resetRegistryForTests();
});

describe('registry (real data/foerderungen/*.json)', () => {
  it('loads exactly 12 fundings with unique ids', () => {
    const fundings = loadFundings();
    expect(fundings).toHaveLength(12);
    const ids = fundings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains the expected MVP ids', () => {
    const ids = loadFundings().map((f) => f.id).sort();
    expect(ids).toEqual([
      'alg1', 'bafoeg', 'bildungsgutschein', 'buergergeld', 'einstiegsgeld',
      'elterngeld', 'gruendungszuschuss', 'kfw_gruenderkredit', 'kindergeld',
      'pv_anlage', 'waermepumpe', 'wohngeld',
    ]);
  });
});

// Scenario tests against the REAL data — these mirror the product doc's cases.
describe('scenarios (real data)', () => {
  // Doc case: only 5 months of insurance -> no ALG I, Bürgergeld alternative.
  it('5 months insurance -> ALG I not eligible with buergergeld alternative', () => {
    const profile: UserProfile = { insurance_months: 5, employment_status: 'unemployed' };
    const d = evaluateEligibility({ userProfile: profile, funding: getFunding('alg1')! });
    expect(d.status).toBe('not_eligible');
    expect(d.reason_codes[0]?.code).toBe('INSURANCE_PERIOD_TOO_SHORT');
    expect(d.alternatives).toContain('buergergeld');
  });

  // Bürgergeld asset freibeträge (verified against SGB II §12 on 2026-08-22).
  it('age 30 + 6.000€ assets -> Bürgergeld asset risk (5.000€ Freibetrag)', () => {
    const profile: UserProfile = { age: 30, assets_total: 6000 };
    const d = evaluateEligibility({ userProfile: profile, funding: getFunding('buergergeld')! });
    expect(d.risks.map((r) => r.risk_code)).toContain('VERMOEGEN_UEBER_FREIBETRAG');
    expect(d.status).toBe('eligible'); // risk must not flip status
  });

  it('age 51 + 25.000€ assets -> 20.000€ Freibetrag risk', () => {
    const profile: UserProfile = { age: 51, assets_total: 25000 };
    const d = evaluateEligibility({ userProfile: profile, funding: getFunding('buergergeld')! });
    expect(d.risks.map((r) => r.risk_code)).toContain('VERMOEGEN_UEBER_FREIBETRAG');
  });

  it('age 51 + 15.000€ assets -> no asset risk (within 20.000€ Freibetrag)', () => {
    const profile: UserProfile = { age: 51, assets_total: 15000 };
    const d = evaluateEligibility({ userProfile: profile, funding: getFunding('buergergeld')! });
    expect(d.risks.map((r) => r.risk_code)).not.toContain('VERMOEGEN_UEBER_FREIBETRAG');
  });

  it('Bürgergeld: pensioners are excluded', () => {
    const profile: UserProfile = { age: 66, employment_status: 'retired' };
    const d = evaluateEligibility({ userProfile: profile, funding: getFunding('buergergeld')! });
    expect(d.status).toBe('not_eligible');
    expect(d.reason_codes[0]?.code).toBe('ALTERSRENTE_VORRANG');
  });

  it('Kindergeld: children >= 1 -> eligible', () => {
    const d = evaluateEligibility({ userProfile: { children: 1 }, funding: getFunding('kindergeld')! });
    expect(d.status).toBe('eligible');
  });

  it('Gründungszuschuss: needs ALG1 + self-employment; alternative einstiegsgeld otherwise', () => {
    const withoutAlg1 = evaluateEligibility({
      userProfile: { receives_alg1: false },
      funding: getFunding('gruendungszuschuss')!,
    });
    expect(withoutAlg1.status).toBe('not_eligible');
    expect(withoutAlg1.alternatives).toContain('einstiegsgeld');

    const ready = evaluateEligibility({
      userProfile: { receives_alg1: true, starting_self_employment: true, business_plan: true },
      funding: getFunding('gruendungszuschuss')!,
    });
    expect(ready.status).toBe('eligible');
  });

  it('Einstiegsgeld: requires Bürgergeld receipt', () => {
    const d = evaluateEligibility({
      userProfile: { receives_buergergeld: true, starting_self_employment: true },
      funding: getFunding('einstiegsgeld')!,
    });
    expect(d.status).toBe('eligible');
  });

  it('Wohngeld: Bürgergeld recipients excluded', () => {
    const d = evaluateEligibility({
      userProfile: { receives_buergergeld: true },
      funding: getFunding('wohngeld')!,
    });
    expect(d.status).toBe('not_eligible');
  });

  it('deterministic across all fundings', () => {
    const profile: UserProfile = { age: 35, employment_status: 'unemployed', insurance_months: 10, assets_total: 18000, children: 2 };
    const a = loadFundings().map((f) => evaluateEligibility({ userProfile: profile, funding: f }));
    const b = loadFundings().map((f) => evaluateEligibility({ userProfile: profile, funding: f }));
    for (let i = 0; i < a.length; i++) {
      expect(a[i].status).toBe(b[i].status);
      expect(a[i].reason_codes).toEqual(b[i].reason_codes);
      expect(a[i].risks).toEqual(b[i].risks);
    }
  });
});
