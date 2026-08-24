// ============================================================================
// lib/ai/extract.ts — conversational intake: LLM extracts STRUCTURED FACTS
// from a user's free-text description.
//
// COMPLIANCE BOUNDARY (non-negotiable): extraction only fills facts. It can
// NEVER emit eligibility decisions — those come exclusively from the rule
// engine. The sanitizer below whitelists known UserProfile fields and drops
// everything else (e.g. an injected "eligible": true is discarded).
// ============================================================================

import type { UserProfile } from '../types';
import { chatCompletion, hasMistralKey, MistralError } from './mistral';

export const ALLOWED_PROFILE_FIELDS: (keyof UserProfile)[] = [
  'age',
  'birth_year',
  'residence_city',
  'residence_plz',
  'employment_status',
  'monthly_income',
  'assets_total',
  'has_car',
  'has_property',
  'children',
  'insurance_months',
  'single_parent',
  'student',
  'in_vocational_training',
  'receives_buergergeld',
  'receives_alg1',
  'starting_self_employment',
  'business_registered',
  'business_plan',
  'newborn_child',
  'pflegegrad',
  'working_hours_reduced',
  'employer_insolvent',
];

const EMPLOYMENT_STATUSES = [
  'employed',
  'self_employed',
  'freelancer',
  'unemployed',
  'student',
  'retired',
  'homemaker',
  'other',
] as const;

export interface ExtractResult {
  profile: UserProfile;
  missing: string[];
  usedMock: boolean;
  error?: string;
}

const EXTRACT_SYSTEM_PROMPT = `Du bist ein datenschutzfreundlicher Sachbearbeiter für eine deutsche Förderberatung.
Aufgabe: Extrahiere aus der Beschreibung des Nutzers strukturierte Fakten.
Regeln:
- Antworte NUR mit einem JSON-Objekt, ohne Markdown, ohne Erklärungen.
- Format: {"profile": {...}, "missing": ["feld1", "feld2"]}
- Erlaubte profile-Felder (nur diese, unbekannte weglassen):
  age (Zahl), birth_year (Zahl), residence_city (Text), residence_plz (Text),
  employment_status (einer von: employed, self_employed, freelancer, unemployed, student, retired, homemaker, other),
  monthly_income (Zahl, netto EUR), assets_total (Zahl, EUR), has_car (true/false),
  has_property (true/false), children (Zahl), insurance_months (Zahl),
  single_parent (true/false), student (true/false), in_vocational_training (true/false),
  receives_buergergeld (true/false), receives_alg1 (true/false),
  starting_self_employment (true/false), business_registered (true/false),
  business_plan (true/false), newborn_child (true/false), pflegegrad (Zahl 1-5),
  working_hours_reduced (true/false), employer_insolvent (true/false)
- Fehlt eine Angabe, nimm sie NICHT an und lasse das Feld weg. "missing" enthält Felder,
  die für eine Beurteilung wichtig wären, aber nicht erwähnt wurden (maximal 5).
- Wenn der Nutzer z.B. "arbeitslos" sagt → employment_status: "unemployed".
- Wandle deutsche Zahlwörter um (z.B. "sechshundert" → 600).`;

/**
 * Take arbitrary LLM JSON and keep ONLY known, type-coerced profile fields.
 * This is the security boundary: injected decision fields never survive.
 */
export function sanitizeProfile(raw: unknown): UserProfile {
  const out: UserProfile = {};
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;

  const num = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      let s = v.trim();
      // German format "2.400,50" -> 2400.5; "2.400" -> 2400; "2400.5" -> 2400.5
      if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      } else if (s.includes('.')) {
        const [intPart, decPart] = s.split('.');
        if (decPart !== undefined && decPart.length <= 2 && intPart.length > 0) {
          // decimal point (2400.5)
        } else {
          s = s.replace(/\./g, ''); // thousands separator (2.400)
        }
      }
      const n = Number(s.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };
  const bool = (v: unknown): boolean | undefined =>
    typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : undefined;

  if (obj.age !== undefined) {
    const n = num(obj.age);
    if (n !== undefined && n >= 16 && n <= 99) out.age = Math.round(n);
  }
  if (obj.birth_year !== undefined) {
    const n = num(obj.birth_year);
    if (n !== undefined && n >= 1920 && n <= 2025) out.birth_year = Math.round(n);
  }
  if (typeof obj.residence_city === 'string') out.residence_city = obj.residence_city.slice(0, 100);
  if (typeof obj.residence_plz === 'string') out.residence_plz = obj.residence_plz.slice(0, 10);
  if (typeof obj.employment_status === 'string' && (EMPLOYMENT_STATUSES as readonly string[]).includes(obj.employment_status)) {
    out.employment_status = obj.employment_status as UserProfile['employment_status'];
  }
  const income = num(obj.monthly_income);
  if (income !== undefined && income >= 0 && income <= 10_000_000) out.monthly_income = income;
  const assets = num(obj.assets_total);
  if (assets !== undefined && assets >= 0 && assets <= 100_000_000) out.assets_total = assets;
  const car = bool(obj.has_car);
  if (car !== undefined) out.has_car = car;
  const prop = bool(obj.has_property);
  if (prop !== undefined) out.has_property = prop;
  const kids = num(obj.children);
  if (kids !== undefined && kids >= 0 && kids <= 30) out.children = Math.round(kids);
  const ins = num(obj.insurance_months);
  if (ins !== undefined && ins >= 0 && ins <= 600) out.insurance_months = Math.round(ins);
  const single = bool(obj.single_parent);
  if (single !== undefined) out.single_parent = single;
  const studentB = bool(obj.student);
  if (studentB !== undefined) out.student = studentB;
  const voc = bool(obj.in_vocational_training);
  if (voc !== undefined) out.in_vocational_training = voc;
  const bg = bool(obj.receives_buergergeld);
  if (bg !== undefined) out.receives_buergergeld = bg;
  const a1 = bool(obj.receives_alg1);
  if (a1 !== undefined) out.receives_alg1 = a1;
  const selfStart = bool(obj.starting_self_employment);
  if (selfStart !== undefined) out.starting_self_employment = selfStart;
  const reg = bool(obj.business_registered);
  if (reg !== undefined) out.business_registered = reg;
  const plan = bool(obj.business_plan);
  if (plan !== undefined) out.business_plan = plan;
  const newborn = bool(obj.newborn_child);
  if (newborn !== undefined) out.newborn_child = newborn;
  const pflege = num(obj.pflegegrad);
  if (pflege !== undefined && pflege >= 1 && pflege <= 5) out.pflegegrad = Math.round(pflege);
  const reduced = bool(obj.working_hours_reduced);
  if (reduced !== undefined) out.working_hours_reduced = reduced;
  const insolvent = bool(obj.employer_insolvent);
  if (insolvent !== undefined) out.employer_insolvent = insolvent;

  return out;
}

/** Deterministic fallback: regex-based number/boolean extraction (no LLM). */
export function fallbackExtract(text: string): { profile: UserProfile; missing: string[] } {
  const profile: UserProfile = {};
  const missing: string[] = [];

  const ageM = text.match(/(\d{1,2})\s*(?:Jahre|Jahren)\s*alt/i);
  if (ageM) profile.age = Math.min(99, Math.max(16, Number(ageM[1])));
  else missing.push('age');

  const incomeM = text.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:€|Euro|EUR)/i);
  if (incomeM) profile.monthly_income = Number(incomeM[1].replace(/[.,]/g, ''));
  else missing.push('monthly_income');

  const assetsM = text.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:€|Euro|EUR)\s*(?:Vermögen|Ersparnisse|Guthaben)/i) ??
    text.match(/(?:Vermögen|Ersparnisse|Guthaben)\s*(?:von)?\s*(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:€|Euro|EUR)/i);
  if (assetsM) profile.assets_total = Number(assetsM[1].replace(/[.,]/g, ''));

  const kidsM = text.match(/(\d)\s*(?:Kind|Kinder)/i);
  if (kidsM) profile.children = Math.min(30, Number(kidsM[1]));

  const insM = text.match(/(\d{1,3})\s*(?:Monate|Monaten)\s*(?:eingezahlt|versichert|in die Arbeitslosenversicherung)/i);
  if (insM) profile.insurance_months = Math.min(600, Number(insM[1]));

  if (/arbeitslos|arbeitssuchend/i.test(text)) profile.employment_status = 'unemployed';
  if (/selbstständig|freiberuflich/i.test(text)) profile.employment_status = 'self_employed';
  if (/Student|Studentin|studier/i.test(text)) profile.student = true;
  if (/Rentner|im Ruhestand/i.test(text)) profile.employment_status = 'retired';
  if (/verheiratet|Partner|Ehefrau|Ehemann|Lebenspartner/i.test(text)) profile.single_parent = false;

  return { profile, missing };
}

function parseLlmJson(raw: string): unknown {
  // Strip markdown fences if the model wrapped the JSON.
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find the first {...} block as a last resort.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function extractProfile(text: string): Promise<ExtractResult> {
  if (!hasMistralKey()) {
    const { profile, missing } = fallbackExtract(text);
    return { profile, missing, usedMock: true };
  }

  const userPrompt = [
    'Beschreibung des Nutzers:',
    text.slice(0, 2000),
    '',
    'Antworte NUR mit dem JSON-Objekt.',
  ].join('\n');

  try {
    const raw = await chatCompletion([
      { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
    const parsed = parseLlmJson(raw) as { profile?: unknown; missing?: unknown } | null;
    const profile = sanitizeProfile(parsed?.profile);
    const missing = Array.isArray(parsed?.missing)
      ? (parsed.missing as unknown[]).filter((m): m is string => typeof m === 'string').slice(0, 5)
      : [];
    return { profile, missing, usedMock: false };
  } catch (err) {
    const message = err instanceof MistralError ? err.message : 'Unbekannter Fehler bei der Extraktion.';
    const { profile, missing } = fallbackExtract(text);
    return { profile, missing, usedMock: true, error: message };
  }
}
