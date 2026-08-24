// ============================================================================
// lib/rag/index.ts — server-side RAG knowledge base (MVP, no external deps).
//
// Sources: markdown docs in web/knowledge/*.md (official content). Chunks are
// indexed in memory with a BM25-style scorer; top-K chunks are injected into
// LLM prompts as "WISSENSDATENBANK". Docs are re-read from disk with a TTL so
// updates (scripts/update-knowledge.mjs) take effect without a restart.
// ============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface KnowledgeChunk {
  id: string;
  doc: string;
  title: string;
  text: string;
  tokens: string[];
}

interface Doc {
  name: string;
  title: string;
  mtimeMs: number;
}

const KNOWLEDGE_DIR = join(process.cwd(), 'knowledge');
const TTL_MS = 30_000;

let cache: { at: number; docs: Doc[] } | null = null;
let chunks: KnowledgeChunk[] | null = null;

const STOPWORDS = new Set([
  'der', 'die', 'das', 'und', 'oder', 'in', 'im', 'den', 'dem', 'des', 'ein', 'eine', 'einen',
  'einer', 'einem', 'eines', 'ist', 'sind', 'war', 'werden', 'wird', 'nicht', 'mit', 'von',
  'für', 'auf', 'an', 'zu', 'zur', 'zum', 'bei', 'auch', 'nur', 'als', 'sich', 'nach', 'über',
  'aber', 'es', 'sie', 'wir', 'ihr', 'ich', 'er', 'wie', 'was', 'weil', 'dass', 'dann',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}€%]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function listDocs(): Doc[] {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.docs;
  const files = readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.md'));
  const docs = files.map((f) => {
    const st = statSync(join(KNOWLEDGE_DIR, f));
    return { name: f, title: f.replace(/\.md$/, ''), mtimeMs: st.mtimeMs };
  });
  cache = { at: now, docs };
  return docs;
}

function extractTitle(text: string, fallback: string): string {
  const m = text.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

/** Split markdown into chunks on ## headings (keeps heading as part of chunk). */
export function chunkMarkdown(docName: string, text: string): KnowledgeChunk[] {
  const title = extractTitle(text, docName);
  const sections = text.split(/^##\s+/m);
  const out: KnowledgeChunk[] = [];
  // preamble (before first ##) goes into the first chunk
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;
    const heading = i === 0 ? '' : section.split('\n')[0].trim();
    const body = i === 0 ? section : section.split('\n').slice(1).join('\n').trim();
    const textBlock = [title, heading, body].filter(Boolean).join(' — ').trim();
    if (textBlock.length < 30) continue;
    out.push({
      id: `${docName}#${i}`,
      doc: docName,
      title,
      text: textBlock,
      tokens: tokenize(textBlock),
    });
  }
  return out;
}

export function loadKnowledge(force = false): KnowledgeChunk[] {
  if (chunks && !force) return chunks;
  const docs = listDocs();
  chunks = docs.flatMap((d) => {
    const raw = readFileSync(join(KNOWLEDGE_DIR, d.name), 'utf8');
    return chunkMarkdown(d.name, raw);
  });
  return chunks;
}

export interface RetrievalHit {
  chunk: KnowledgeChunk;
  score: number;
}

/** BM25-style retrieval over the in-memory index. */
export function retrieve(query: string, topK = 3): RetrievalHit[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const all = loadKnowledge();
  const df = new Map<string, number>();
  for (const c of all) {
    for (const t of new Set(c.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = Math.max(1, all.length);
  const avgLen = all.reduce((s, c) => s + c.tokens.length, 0) / N;

  const scored = all
    .map((c) => {
      const len = c.tokens.length;
      let score = 0;
      for (const t of qTokens) {
        const tf = c.tokens.filter((x) => x === t).length;
        if (tf === 0) continue;
        const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        score += idf * ((tf * 1.5) / (tf + 0.5 * (1 - 0.75 + 0.75 * (len / avgLen))));
      }
      return { chunk: c, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/** Format retrieved chunks for prompt injection (max chars budget). */
export function formatKnowledge(hits: RetrievalHit[], maxChars = 3000): string {
  if (hits.length === 0) return '(keine passenden Wissensdokumente gefunden)';
  const parts: string[] = [];
  let used = 0;
  for (const h of hits) {
    const block = `[${h.chunk.title}] ${h.chunk.text}`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join('\n\n');
}
