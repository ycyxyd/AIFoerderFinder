import { describe, it, expect } from 'vitest';
import { tokenize, chunkMarkdown, retrieve, formatKnowledge } from '../index';

describe('RAG tokenize', () => {
  it('lowercases, strips punctuation and stopwords', () => {
    const t = tokenize('Die Wärmepumpe und die PV-Anlage sind 30% förderbar.');
    expect(t).toContain('wärmepumpe');
    expect(t).toContain('pv');
    expect(t).not.toContain('und');
    expect(t).not.toContain('die');
  });
});

describe('chunkMarkdown', () => {
  it('splits on ## headings and keeps title', () => {
    const chunks = chunkMarkdown('test.md', '# Wärmepumpe\n\n## Grundförderung\n\n30% Zuschuss.\n\n## Voraussetzungen\n\nBestandsgebäude.');
    expect(chunks.length).toBe(2);
    expect(chunks[0].text).toContain('Grundförderung');
    expect(chunks[0].text).toContain('Wärmepumpe');
    expect(chunks[1].text).toContain('Voraussetzungen');
  });
});

describe('retrieve over the real knowledge base', () => {
  it('finds the Wärmepumpe doc for a heat-pump query', () => {
    const hits = retrieve('Ich will eine Wärmepumpe einbauen und Förderung beantragen', 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].score).toBeGreaterThan(0);
    expect(hits.some((h) => h.chunk.doc === 'waermepumpe.md')).toBe(true);
  });

  it('finds family benefits for Kindergeld queries', () => {
    const hits = retrieve('Kindergeld Kinderzuschlag Wohngeld für meine Familie', 3);
    expect(hits.some((h) => h.chunk.doc === 'familienleistungen.md')).toBe(true);
  });

  it('formats hits into a prompt block', () => {
    const hits = retrieve('Wärmepumpe', 1);
    const formatted = formatKnowledge(hits, 500);
    expect(formatted).toContain('Wärmepumpe');
  });
});
