import { describe, it, expect } from 'vitest';
import { filterResponse } from '../response-filter';

describe('filterResponse', () => {
  it('neutralizes explicit guarantees', () => {
    const { text, neutralized } = filterResponse('Sie bekommen sicher Arbeitslosengeld.');
    expect(neutralized).toBe(true);
    expect(text).toContain('Eine verbindliche Zusage ist nicht möglich.');
  });

  it('neutralizes "das steht Ihnen zu"', () => {
    const { text, neutralized } = filterResponse('Das steht Ihnen zu.');
    expect(neutralized).toBe(true);
    expect(text).toContain('Ob ein Anspruch besteht, entscheidet ausschließlich die zuständige Stelle.');
  });

  it('neutralizes "die Behörde muss"', () => {
    const { text } = filterResponse('Die Behörde muss Ihnen das zahlen.');
    expect(text).toContain('Die zuständige Behörde prüft den Einzelfall.');
  });

  it('replaces 100% with cautious phrasing', () => {
    const { text, neutralized } = filterResponse('Das ist zu 100% sicher.');
    expect(neutralized).toBe(true);
    expect(text).toContain('mit hoher Wahrscheinlichkeit');
  });

  it('always appends the standard disclaimer when missing', () => {
    const { text } = filterResponse('Hier ist eine neutrale Erklärung.');
    expect(text).toContain('ohne Gewähr');
  });

  it('does not double the disclaimer', () => {
    const withDisclaimer = 'Erklärung.\n\nHinweis: Diese Einschätzung ersetzt keine Entscheidung der zuständigen Stelle. Alle Angaben erfolgen ohne Gewähr.';
    const { text } = filterResponse(withDisclaimer);
    expect(text.match(/ohne Gewähr/g)).toHaveLength(1);
  });

  it('leaves clean text untouched', () => {
    const clean = 'Die Voraussetzungen werden in der Regel von der zuständigen Stelle geprüft.';
    const { text, neutralized } = filterResponse(clean);
    expect(neutralized).toBe(false);
    expect(text).toContain(clean);
  });
});
