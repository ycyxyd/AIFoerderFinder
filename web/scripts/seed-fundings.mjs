// ============================================================================
// scripts/seed-fundings.mjs
// Upserts ALL data/foerderungen/*.json into the Supabase `fundings` table.
//
// The rule engine loads funding schemas from the filesystem (single source of
// truth); this script mirrors them into Supabase so the table can serve an
// admin/backoffice UI. Uses the server-side service_role key from .env.local.
//
// Usage:  node scripts/seed-fundings.mjs
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- minimal .env.local parser (no dotenv dependency) ----------------------
function loadEnvLocal() {
  const env = {};
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    // fall through
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ .env.local fehlt NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const dataDir = join(root, 'data', 'foerderungen');
const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'));

const rows = files.map((f) => {
  const schema = JSON.parse(readFileSync(join(dataDir, f), 'utf8'));
  return {
    id: schema.id,
    name: schema.name,
    category: schema.category ?? null,
    provider: schema.provider ?? null,
    schema,                                    // full FundingSchema JSON
    last_verified: schema.last_verified ?? null,
  };
});

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await sb.from('fundings').upsert(rows, { onConflict: 'id' }).select('id, name');
if (error) {
  console.error('❌ Upsert fehlgeschlagen:', error.message);
  process.exit(1);
}
console.log(`✅ fundings upsert: ${data.length} Zeilen`);
for (const r of data) console.log(`  - ${r.id.padEnd(20)} ${r.name}`);
