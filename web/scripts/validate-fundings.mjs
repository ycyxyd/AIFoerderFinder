#!/usr/bin/env node
// ============================================================================
// validate-fundings.mjs — code-review gate for data/foerderungen/*.json
// Usage: node scripts/validate-fundings.mjs
// Checks: JSON validity, required fields, allowed operators, allowed profile
// fields, valid dates, known funding id duplicates.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data', 'foerderungen');

const ALLOWED_OPS = ['gte', 'gt', 'lte', 'lt', 'eq', 'neq', 'contains', 'in'];
const ALLOWED_FIELDS = new Set([
  'age', 'birth_year', 'employment_status', 'monthly_income', 'assets_total',
  'has_car', 'has_property', 'children', 'insurance_months', 'single_parent',
  'student', 'in_vocational_training', 'receives_buergergeld', 'receives_alg1',
  'starting_self_employment', 'business_registered', 'business_plan',
  'newborn_child', 'pflegegrad', 'working_hours_reduced', 'employer_insolvent',
  'heating_cost_high', 'resigned_voluntarily',
]);
const REQUIRED = ['id', 'name', 'category', 'provider', 'eligibility_rules', 'exclusion_rules', 'risk_rules'];

let errors = 0;
let warnings = 0;

function err(file, msg) { errors++; console.error(`  ✖ ${file}: ${msg}`); }
function warn(file, msg) { warnings++; console.warn(`  ⚠ ${file}: ${msg}`); }

function checkRules(file, funding, kind, rules) {
  if (!Array.isArray(rules)) { err(file, `${kind} ist kein Array`); return; }
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object' || !rule.if || !rule.then) {
      err(file, `${kind}: Regel ohne if/then`); continue;
    }
    for (const [field, cond] of Object.entries(rule.if)) {
      if (!ALLOWED_FIELDS.has(field)) err(file, `${kind}: unbekanntes Feld "${field}"`);
      if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
        for (const op of Object.keys(cond)) {
          if (!ALLOWED_OPS.includes(op)) err(file, `${kind}: unbekannter Operator "${op}"`);
        }
      }
    }
  }
}

if (!fs.existsSync(DATA_DIR)) {
  console.error(`Verzeichnis nicht gefunden: ${DATA_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
console.log(`Prüfe ${files.length} JSON-Dateien in ${DATA_DIR}\n`);

const ids = new Map();

for (const file of files.sort()) {
  const p = path.join(DATA_DIR, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    err(file, `ungültiges JSON: ${e.message}`);
    continue;
  }

  for (const req of REQUIRED) {
    if (data[req] === undefined) err(file, `Pflichtfeld fehlt: ${req}`);
  }
  if (typeof data.id !== 'string' || data.id.length < 2) err(file, 'id fehlt/ungültig');
  if (ids.has(data.id)) err(file, `doppelte id "${data.id}" (auch in ${ids.get(data.id)})`);
  else ids.set(data.id, file);

  checkRules(file, data, 'eligibility_rules', data.eligibility_rules);
  checkRules(file, data, 'exclusion_rules', data.exclusion_rules);
  checkRules(file, data, 'risk_rules', data.risk_rules);

  if (data.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(data.valid_until)) warn(file, `valid_until kein Datum: ${data.valid_until}`);
  if (data.last_verified && !/^\d{4}-\d{2}-\d{2}$/.test(data.last_verified)) warn(file, `last_verified kein Datum: ${data.last_verified}`);
  if (!data.sources || data.sources.length === 0) warn(file, 'keine Quellen angegeben');
  if (!data.last_verified) warn(file, 'last_verified fehlt (nicht gegen Quelle verifiziert)');
}

console.log(`\nErgebnis: ${errors} Fehler, ${warnings} Warnungen`);
process.exit(errors > 0 ? 1 : 0);
