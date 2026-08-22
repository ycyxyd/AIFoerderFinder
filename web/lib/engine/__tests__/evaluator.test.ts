import { describe, it, expect } from 'vitest';
import { evaluateEligibility } from '../evaluator';
import type { FundingSchema, UserProfile } from '../../types';

// Inline fixture — independent of data/foerderungen/*.json (which the batch
// agent may be editing in parallel).
const ALG1: FundingSchema = {
  id: 'alg1',
  name: 'Arbeitslosengeld I',
  category: 'Arbeitslosigkeit',
  provider: 'Bundesagentur für Arbeit',
  eligibility_rules: [
    { if: { insurance_months: { gte: 12 } }, then: { eligible: true } },
  ],
  exclusion_rules: [
    { if: { insurance_months: { lt: 12 } }, then: { eligible: false, reason: 'INSURANCE_PERIOD_TOO_SHORT', alternative: ['buergergeld'] } },
  ],
  risk_rules: [
    { if: { employment_status: { neq: 'unemployed' } }, then: { risk: 'NOT_OFFICIALLY_REGISTERED' } },
  ],
  application: { authority: 'Agentur für Arbeit', online: true, offline: true, links: ['https://www.arbeitsagentur.de/arbeitslosengeld'] },
};

describe('evaluateEligibility', () => {
  it('marks not_eligible when insurance period is too short (the user’s 5-months case)', () => {
    const profile: UserProfile = { insurance_months: 5, employment_status: 'unemployed' };
    const d = evaluateEligibility({ userProfile: profile, funding: ALG1 });
    expect(d.status).toBe('not_eligible');
    expect(d.reason_codes).toContainEqual({ code: 'INSURANCE_PERIOD_TOO_SHORT' });
    expect(d.alternatives).toContain('buergergeld');
  });

  it('marks eligible with 18 insurance months and unemployed status', () => {
    const profile: UserProfile = { insurance_months: 18, employment_status: 'unemployed' };
    const d = evaluateEligibility({ userProfile: profile, funding: ALG1 });
    expect(d.status).toBe('eligible');
    expect(d.reason_codes).toHaveLength(0);
  });

  it('appends risks without flipping the status', () => {
    const profile: UserProfile = { insurance_months: 18, employment_status: 'employed' };
    const d = evaluateEligibility({ userProfile: profile, funding: ALG1 });
    // not unemployed -> risk, but no exclusion fired
    expect(d.risks).toContainEqual({ risk_code: 'NOT_OFFICIALLY_REGISTERED' });
    expect(d.status).toBe('eligible');
  });

  it('treats a funding with no eligibility rules as eligible unless excluded', () => {
    const funding: FundingSchema = {
      id: 'x',
      name: 'X',
      category: 'Test',
      provider: 'Test',
      eligibility_rules: [],
      exclusion_rules: [
        { if: { receives_buergergeld: true }, then: { eligible: false, reason: 'EXCLUDED' } },
      ],
      risk_rules: [],
    };
    expect(evaluateEligibility({ userProfile: {}, funding }).status).toBe('eligible');
    expect(evaluateEligibility({ userProfile: { receives_buergergeld: true }, funding }).status).toBe('not_eligible');
  });

  it('returns unclear when eligibility rules exist but none match and no exclusion fired', () => {
    const funding: FundingSchema = {
      id: 'grundsicherung',
      name: 'Grundsicherung',
      category: 'Sozialleistung',
      provider: 'Sozialamt',
      eligibility_rules: [
        { if: { age: { gte: 67 }, monthly_income: { lt: 1000 } }, then: { eligible: true } },
      ],
      exclusion_rules: [],
      risk_rules: [],
    };
    const d = evaluateEligibility({ userProfile: { age: 65, monthly_income: 900 }, funding });
    expect(d.status).toBe('unclear');
  });

  it('is deterministic: same input -> same status/reasons/risks', () => {
    const profile: UserProfile = { insurance_months: 10, employment_status: 'unemployed' };
    const a = evaluateEligibility({ userProfile: profile, funding: ALG1 });
    const b = evaluateEligibility({ userProfile: profile, funding: ALG1 });
    expect(a.status).toBe(b.status);
    expect(a.reason_codes).toEqual(b.reason_codes);
    expect(a.risks).toEqual(b.risks);
    expect(a.alternatives).toEqual(b.alternatives);
  });

  it('matches numeric operators (gte/lt) and literal equality', () => {
    const funding: FundingSchema = {
      id: 'y',
      name: 'Y',
      category: 'Test',
      provider: 'Test',
      eligibility_rules: [
        { if: { age: { gte: 67 }, monthly_income: { lt: 1000 } }, then: { eligible: true } },
      ],
      exclusion_rules: [],
      risk_rules: [],
    };
    expect(evaluateEligibility({ userProfile: { age: 70, monthly_income: 800 }, funding }).status).toBe('eligible');
    expect(evaluateEligibility({ userProfile: { age: 65, monthly_income: 800 }, funding }).status).toBe('unclear');
    expect(evaluateEligibility({ userProfile: { age: 70, monthly_income: 1500 }, funding }).status).toBe('unclear');
  });
});
