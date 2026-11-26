import { describe, it, expect } from 'vitest';
import { groundMessage, cleanActions, groundReply } from './ground';
import { retrieve } from './retrieve';
import { scriptedReply, GREETING } from './scripted';

describe('grounding', () => {
  it('strips prices and adds the pricing line', () => {
    const r = groundMessage('A site like that runs about $3,000. Want to book?');
    expect(r.text).not.toMatch(/\$/);
    expect(r.text).toMatch(/Pricing depends on scope/);
    expect(r.flags).toContain('price_removed');
  });
  it('strips hourly and monthly rates', () => {
    expect(groundMessage('He charges 120/hr for that.').text).not.toMatch(/120/);
    expect(groundMessage('Retainers are 4k per month.').text).not.toMatch(/4k/);
  });
  it('strips guarantees and invented stats', () => {
    expect(groundMessage('We guarantee page one of Google. Let\'s talk.').text).toBe("Let's talk.");
    expect(groundMessage('Clients cut costs by 40%. Book a call?').text).toBe('Book a call?');
  });
  it('strips claims that the guide contacted Long', () => {
    expect(groundMessage("I've emailed Long for you. Anything else?").text).toBe('Anything else?');
  });
  it('keeps the 24-hour follow-up line', () => {
    expect(groundMessage('Long follows up within 24 hours.').text).toBe('Long follows up within 24 hours.');
  });
  it('never returns an empty message', () => {
    expect(groundMessage('$500 flat.').text.length).toBeGreaterThan(10);
  });
});

describe('actions', () => {
  it('drops unknown pages and targets', () => {
    expect(cleanActions([{ type: 'navigate', href: 'https://evil.example' }, { type: 'scroll', target: 'nope' }])).toEqual([]);
  });
  it('normalises trailing slashes and keeps allowed pages', () => {
    expect(cleanActions([{ type: 'navigate', href: '/about' }])).toEqual([{ type: 'navigate', href: '/about/' }]);
  });
  it('keeps booking with a navigation but drops a scroll', () => {
    expect(cleanActions([{ type: 'scroll', target: 'proof' }, { type: 'navigate', href: '/work/' }, { type: 'book' }]))
      .toEqual([{ type: 'navigate', href: '/work/' }, { type: 'book' }]);
  });
  it('builds a full reply from loose model JSON', () => {
    const r = groundReply({ message: 'Hi', actions: [{ type: 'book' }], chips: ['Book', 'Only $99!'], stage: 'book', notes: { need: 'new site' } });
    expect(r.chips).toEqual(['Book']);
    expect(r.notes.need).toBe('new site');
    expect(r.stage).toBe('book');
  });
});

describe('retrieval and scripted fallback', () => {
  it('finds website work for a website question', () => {
    const ids = retrieve('can you fix my wordpress site speed').map(c => c.id);
    expect(['svc-websites-wordpress', 'svc-page-speed-local-seo']).toContain(ids[0]);
    expect(ids).toContain('booking');
  });
  it('routes an overpaying question to the AI tools check', () => {
    const r = scriptedReply([{ role: 'user', content: 'am I overpaying for AI subscriptions?' }]);
    expect(r.actions).toEqual([{ type: 'scroll', target: 'overpay' }]);
  });
  it('every guide page link points at a real page', async () => {
    const { ALLOWED_PAGES } = await import('./kb');
    expect(ALLOWED_PAGES).toContain('/work/local-ai-lab/');
    expect(ALLOWED_PAGES).toContain('/services/ai-consulting/');
  });
  it('scripted guide books on a buy signal', () => {
    const r = scriptedReply([{ role: 'assistant', content: GREETING.message }, { role: 'user', content: "sounds good, let's book a call" }]);
    expect(r.actions).toEqual([{ type: 'book' }]);
  });
});
