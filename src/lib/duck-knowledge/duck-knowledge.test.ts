import { describe, it, expect } from 'vitest';
import { serializeKnowledge } from './types';
import { getKnowledge } from './index';

describe('duck-knowledge', () => {
  it('getKnowledge resolves cline by slug and alias, null otherwise', () => {
    expect(getKnowledge('cline')?.tool).toBe('Cline');
    expect(getKnowledge('Cline')?.slug).toBe('cline');
    expect(getKnowledge('nope')).toBeNull();
  });

  it('serializeKnowledge includes intro, every reference heading, and every FAQ', () => {
    const k = getKnowledge('cline')!;
    const text = serializeKnowledge(k);
    expect(text).toContain(k.intro);
    for (const s of k.reference) expect(text).toContain(s.heading);
    for (const f of k.faqs) { expect(text).toContain(f.q); expect(text).toContain(f.a); }
  });
});
