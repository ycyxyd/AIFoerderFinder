import { describe, it, expect } from 'vitest';
import { sanitizeProfile, fallbackExtract, ALLOWED_PROFILE_FIELDS } from '../extract';

describe('sanitizeProfile (security boundary)', () => {
  it('keeps only whitelisted, type-coerced fields', () => {
    const out = sanitizeProfile({
      age: '32',
      monthly_income: '2.400,50',
      employment_status: 'unemployed',
      children: 2,
      eligible: true, // injected decision field — must be dropped
      funding_id: 'alg1', // injected decision field — must be dropped
      malicious: 'x',
    });
    expect(out.age).toBe(32);
    expect(out.monthly_income).toBe(2400.5);
    expect(out.employment_status).toBe('unemployed');
    expect(out.children).toBe(2);
    expect(out).not.toHaveProperty('eligible');
    expect(out).not.toHaveProperty('funding_id');
    expect(out).not.toHaveProperty('malicious');
  });

  it('drops invalid enum values and out-of-range numbers', () => {
    const out = sanitizeProfile({
      employment_status: 'king', // invalid
      age: 150, // out of range
      pflegegrad: 9, // out of range
      insurance_months: 12,
    });
    expect(out.employment_status).toBeUndefined();
    expect(out.age).toBeUndefined();
    expect(out.pflegegrad).toBeUndefined();
    expect(out.insurance_months).toBe(12);
  });

  it('returns empty profile for non-object input', () => {
    expect(sanitizeProfile(null)).toEqual({});
    expect(sanitizeProfile('str')).toEqual({});
  });

  it('exposes only the documented whitelist', () => {
    expect(ALLOWED_PROFILE_FIELDS).toContain('age');
    expect(ALLOWED_PROFILE_FIELDS).not.toContain('eligible');
  });
});

describe('fallbackExtract (no-LLM deterministic intake)', () => {
  it('extracts age, income, children, insurance months from German text', () => {
    const { profile } = fallbackExtract(
      'Ich bin 30 Jahre alt, habe 2 Kinder, 18 Monate in die Arbeitslosenversicherung eingezahlt und verdiene 2.000 Euro netto.'
    );
    expect(profile.age).toBe(30);
    expect(profile.children).toBe(2);
    expect(profile.insurance_months).toBe(18);
    expect(profile.monthly_income).toBe(2000);
  });

  it('recognizes employment keywords', () => {
    const { profile } = fallbackExtract('Ich bin arbeitslos gemeldet.');
    expect(profile.employment_status).toBe('unemployed');
  });

  it('reports missing age and income when absent', () => {
    const { missing } = fallbackExtract('Ich habe ein Kind.');
    expect(missing).toContain('age');
    expect(missing).toContain('monthly_income');
  });
});
