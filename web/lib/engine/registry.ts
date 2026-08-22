// ============================================================================
// Förderungen registry — loads structured funding definitions from
// data/foerderungen/*.json. Server-only (Node fs). 
// These JSON files are the "structured knowledge" layer. The AI can read them
// but can NEVER modify them at runtime.
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FundingSchema } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data', 'foerderungen');

// Short TTL so data-file updates are picked up without a server restart,
// while still avoiding a readdir+parse on every single request.
const CACHE_TTL_MS = 30_000;
let cache: FundingSchema[] | null = null;
let cacheTime = 0;

/** Validate minimal invariants of a funding definition. */
export function isValidFunding(f: unknown): f is FundingSchema {
  if (typeof f !== 'object' || f === null) return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    o.id.length > 0 &&
    typeof o.name === 'string' &&
    Array.isArray(o.eligibility_rules) &&
    Array.isArray(o.exclusion_rules) &&
    Array.isArray(o.risk_rules)
  );
}

export function loadFundings(): FundingSchema[] {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) return cache;

  const result: FundingSchema[] = [];
  if (!fs.existsSync(DATA_DIR)) {
    cache = result;
    return result;
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
      if (isValidFunding(raw)) {
        if (result.some((x) => x.id === raw.id)) {
          console.warn(`[registry] duplicate funding id "${raw.id}" in ${file}, skipping`);
          continue;
        }
        result.push(raw);
      } else {
        console.warn(`[registry] invalid funding file skipped: ${file}`);
      }
    } catch (err) {
      console.warn(`[registry] failed to parse ${file}:`, err);
    }
  }

  // Deterministic order for stable results pages.
  result.sort((a, b) => a.id.localeCompare(b.id));
  cache = result;
  cacheTime = now;
  return result;
}

export function getFunding(id: string): FundingSchema | undefined {
  return loadFundings().find((f) => f.id === id);
}

/** Clear the module cache (tests). */
export function _resetRegistryForTests(): void {
  cache = null;
  cacheTime = 0;
}
