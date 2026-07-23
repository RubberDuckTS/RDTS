import { describe, it, expect } from 'vitest';
import { DUCK_PERSONA } from './duck-persona';
import { SCOPING_SYSTEM_PROMPT } from './prompts';

const BANNED = ['leverage', 'synergy', 'AI-powered', 'transformation', 'journey', 'unlock', 'empower', 'revolutionize'];

describe('DUCK_PERSONA', () => {
  it('carries the shared voice invariants', () => {
    expect(DUCK_PERSONA).toContain('long@rubberducktechsolutions.com');
    expect(DUCK_PERSONA).toContain('Mirror the buyer');
    expect(DUCK_PERSONA).toMatch(/One question per turn|One question/);
    for (const w of BANNED) expect(DUCK_PERSONA).toContain(w);
  });

  it('the scope prompt still contains every persona invariant (no drift)', () => {
    expect(SCOPING_SYSTEM_PROMPT).toContain('long@rubberducktechsolutions.com');
    expect(SCOPING_SYSTEM_PROMPT).toContain('Mirror the buyer');
    for (const w of BANNED) expect(SCOPING_SYSTEM_PROMPT).toContain(w);
    // Intake-specific content that must survive the refactor:
    expect(SCOPING_SYSTEM_PROMPT).toContain('ready_for_lead');
    expect(SCOPING_SYSTEM_PROMPT).toContain('hard_no_triggered');
    // Creative/marketing positioning is a locked direction — dropping it is a regression:
    expect(SCOPING_SYSTEM_PROMPT).toContain('technical AND creative/marketing teams alike');
    expect(SCOPING_SYSTEM_PROMPT).toContain('creative / marketing / content team using AI');
  });
});
