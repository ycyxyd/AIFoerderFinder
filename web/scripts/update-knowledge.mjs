// ============================================================================
// scripts/update-knowledge.mjs
// Pflegt die RAG-Wissensdatenbank (web/knowledge/*.md).
// 1) Validiert alle Docs (Chunking, Mindestlänge).
// 2) (Vorbereitet) Ruft offizielle Quellen ab und schreibt sie als .md ab —
//    aktuell deaktiviert, da die Zielseiten oft JS-gerendert sind; stattdessen
//    Docs manuell/kuratiert aktualisieren und dieses Skript als Check laufen
//    lassen. Der Server liest Änderungen dank TTL (30s) ohne Neustart.
// ============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_DIR = join(root, 'knowledge');

const files = readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.md'));
if (files.length === 0) {
  console.error('❌ Keine .md-Dokumente in', KNOWLEDGE_DIR);
  process.exit(1);
}

let ok = 0;
for (const f of files) {
  const p = join(KNOWLEDGE_DIR, f);
  const text = readFileSync(p, 'utf8');
  const st = statSync(p);
  const sections = text.split(/^##\s+/m).length;
  if (text.trim().length < 100) {
    console.error(`❌ ${f}: zu kurz (${text.trim().length} Zeichen)`);
    process.exit(1);
  }
  console.log(
    `✓ ${f.padEnd(28)} ${text.length.toString().padStart(5)} Zeichen, ${sections} Abschnitte, geändert ${st.mtime.toISOString().slice(0, 10)}`
  );
  ok++;
}

console.log(`\n✅ Wissensdatenbank OK (${ok} Dokumente). Server liest Änderungen innerhalb von 30 s.`);
