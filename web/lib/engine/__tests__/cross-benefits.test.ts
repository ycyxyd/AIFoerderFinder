import { describe, it, expect } from 'vitest';
import { suggestRelated, estimateAnnualBenefits } from '../cross-benefits';
import type { DecisionSnapshot, UserProfile } from '../../types';

function decision(id: string, status: DecisionSnapshot['status']): DecisionSnapshot {
  return {
    decision_id: `${id}-id`,
    funding_id: id,
    funding_name: id,
    status,
    reason_codes: [],
    risks: [],
    alternatives: [],
    official_links: [],
    valid_until: '2099-12-31',
    provider: 'x',
    created_at: new Date().toISOString(),
  } as DecisionSnapshot;
}

describe('suggestRelated', () => {
  it('suggests family benefits when user mentions Kindergeld', () => {
    const suggestions = suggestRelated('Ich bekomme Kindergeld für meine zwei Kinder.', {}, []);
    const names = suggestions.map((s) => s.name);
    expect(names).toContain('Elterngeld');
    expect(names).toContain('Wohngeld');
    expect(names.some((n) => n.includes('Kinderzuschlag'))).toBe(true);
  });

  it('suggests PV when user plans a Wärmepumpe', () => {
    const suggestions = suggestRelated('Ich will eine Wärmepumpe einbauen.', {}, []);
    expect(suggestions.some((s) => s.id === 'pv_anlage')).toBe(true);
  });

  it('keeps eligible evaluated suggestions (cross-references), skips not_eligible', () => {
    const withEligible = suggestRelated('Wärmepumpe und PV-Anlage', {}, [decision('pv_anlage', 'eligible')]);
    expect(withEligible.some((s) => s.id === 'pv_anlage')).toBe(true);

    const withNotEligible = suggestRelated('Wärmepumpe und PV-Anlage', {}, [decision('pv_anlage', 'not_eligible')]);
    expect(withNotEligible.some((s) => s.id === 'pv_anlage')).toBe(false);
  });

  it('profile-based: children + low income → Wohngeld/KiZ', () => {
    const profile: UserProfile = { children: 2, monthly_income: 1500 };
    const suggestions = suggestRelated('Meine Situation allgemein', profile, []);
    expect(suggestions.some((s) => s.name === 'Wohngeld')).toBe(true);
  });
});

describe('estimateAnnualBenefits', () => {
  it('sums Kindergeld for children count', () => {
    const est = estimateAnnualBenefits([decision('kindergeld', 'eligible')], { children: 2 });
    expect(est.totalAnnual).toBe(259 * 12 * 2);
    expect(est.totalMonthly).toBe(Math.round((259 * 12 * 2) / 12));
    expect(est.estimated).toBe(true);
  });

  it('includes ALG I estimate for eligible unemployed with income', () => {
    const est = estimateAnnualBenefits([decision('alg1', 'eligible')], {
      monthly_income: 2000,
      employment_status: 'unemployed',
    });
    const alg1 = est.lines.find((l) => l.funding_id === 'alg1');
    expect(alg1?.amount).toBe(Math.round(2000 * 0.6) * 12);
  });

  it('ignores not_eligible and non-quantifiable fundings', () => {
    const est = estimateAnnualBenefits(
      [decision('wohngeld', 'eligible'), decision('alg1', 'not_eligible')],
      { monthly_income: 2000 }
    );
    expect(est.lines.length).toBe(0);
    expect(est.totalAnnual).toBe(0);
  });
});
