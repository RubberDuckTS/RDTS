import { describe, it, expect } from 'vitest';
import { buildAskSystemPrompt, tryParseAsk } from './ask-prompt';
import { getKnowledge } from './duck-knowledge';

describe('ask-prompt', () => {
  const k = getKnowledge('cline')!;

  it('embeds persona, the tool name, the knowledge, and the vetted-first rule', () => {
    const p = buildAskSystemPrompt(k);
    expect(p).toContain('leverage');            // persona present
    expect(p).toContain('Cline');               // tool
    expect(p).toContain(k.faqs[0].q);           // grounding present
    expect(p.toLowerCase()).toContain('not sure'); // vetted-first / route-when-unsure
    expect(p).toContain('ready_for_lead');      // JSON contract
  });

  it('tryParseAsk parses a valid object and rejects junk', () => {
    const ok = tryParseAsk('"message":"hi","spec":null,"ready_for_lead":false,"turn_count":1}');
    expect(ok?.message).toBe('hi');
    expect(tryParseAsk('not json')).toBeNull();
  });
});
