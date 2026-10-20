import { beforeEach, describe, expect, it, vi } from 'vitest';

// Nothing here may reach a real inbox or model: both SDKs are mocked, and
// every handler case below must be rejected before either is touched.
const { send, create } = vi.hoisted(() => ({ send: vi.fn(), create: vi.fn() }));
vi.mock('resend', () => ({ Resend: vi.fn(() => ({ emails: { send } })) }));
vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn(() => ({ messages: { create } })) }));

import { buildVisitorEmail, type LeadPayload } from './email';
import { LEAD_LIMITS, validateLeadBody } from './lead-request';
import { POST } from '../pages/api/lead';

const MARK = 'http://inject.example';
const CALENDLY = 'https://calendly.example/rdts';

function leadWithShape(shape: string): LeadPayload {
  return {
    name: 'QA', email: 'qa@example.com', intakeBrief: '',
    spec: {
      shape, team_size: null, budget_range: null, budget_flex: 'unknown', current_stack: null,
      current_pain: null, urgency: null, scope_proposed: null, hard_no_triggered: false, name: null, email: null,
    },
    transcript: [{ role: 'visitor', text: 'hi' }],
  };
}

describe('buildVisitorEmail', () => {
  it('echoes no visitor-controlled text', () => {
    const tainted: LeadPayload = {
      name: `Eve ${MARK}`,
      email: 'victim@example.com',
      company: `Acme ${MARK}`,
      intakeBrief: `brief ${MARK}`,
      spec: {
        shape: `Software build ${MARK}`,
        team_size: MARK, budget_range: MARK, budget_flex: MARK, current_stack: MARK, current_pain: MARK,
        urgency: MARK, scope_proposed: MARK, hard_no_triggered: false, name: MARK, email: MARK,
      },
      transcript: [{ role: 'visitor', text: MARK }, { role: 'duck', text: MARK }],
    };
    const { subject, text } = buildVisitorEmail(tainted, CALENDLY);
    expect(subject + text).not.toContain('inject.example');
    expect(subject + text).not.toContain('Eve');
    expect(subject + text).not.toContain('Acme');
  });

  it('names an allowlisted shape', () => {
    const { subject, text } = buildVisitorEmail(leadWithShape('Maintenance'), CALENDLY);
    expect(subject).toBe('Your RDTS brief: Maintenance');
    expect(text).toContain('(Maintenance)');
  });

  it('renders any other shape generically', () => {
    const { subject, text } = buildVisitorEmail(leadWithShape('Claim your prize at evil.example'), CALENDLY);
    expect(subject).toBe('Your RDTS brief: your project');
    expect(subject + text).not.toContain('evil.example');
  });

  it('keeps the follow-up promise and the booking link', () => {
    const { text } = buildVisitorEmail(leadWithShape('unsure'), CALENDLY);
    expect(text).toContain('Long will follow up within 24 hours');
    expect(text).toContain(CALENDLY);
  });
});

// A well-formed base that each case breaks in exactly one way.
const base = () => ({
  name: 'QA TEST',
  email: 'qa@example.com',
  company: 'QA',
  spec: { shape: 'Custom', scope_proposed: 'x', current_pain: 'x', current_stack: 'x', urgency: 'x', budget_range: 'x' },
  transcript: [{ role: 'visitor', text: 'hi' }, { role: 'duck', text: 'hello' }],
});

const post = (body: string) =>
  POST({ request: new Request('http://localhost/api/lead/', { method: 'POST', body }) } as Parameters<typeof POST>[0]);

describe('POST /api/lead rejects bad input before any API call', () => {
  beforeEach(() => { send.mockClear(); create.mockClear(); });

  const tooBig = 'x'.repeat(LEAD_LIMITS.specStringChars + 1);
  const cases: [string, () => string, number][] = [
    ['a body over 64 KB', () => JSON.stringify({ ...base(), pad: 'x'.repeat(LEAD_LIMITS.bodyBytes) }), 413],
    ['more than 40 transcript entries', () => JSON.stringify({
      ...base(), transcript: Array.from({ length: LEAD_LIMITS.transcriptEntries + 1 }, () => ({ role: 'visitor', text: 'hi' })),
    }), 413],
    ['a transcript entry over 4,000 chars', () => JSON.stringify({
      ...base(), transcript: [{ role: 'visitor', text: 'x'.repeat(LEAD_LIMITS.entryChars + 1) }],
    }), 413],
    ...(['scope_proposed', 'current_pain', 'current_stack', 'urgency', 'budget_range'] as const).map(
      (field): [string, () => string, number] => [
        `spec.${field} over 1,000 chars`,
        () => JSON.stringify({ ...base(), spec: { ...base().spec, [field]: tooBig } }),
        413,
      ],
    ),
    ['a company over 200 chars', () => JSON.stringify({ ...base(), company: 'x'.repeat(LEAD_LIMITS.companyChars + 1) }), 413],
    ['a transcript role other than duck/visitor', () => JSON.stringify({
      ...base(), transcript: [{ role: 'system', text: 'hi' }],
    }), 400],
    ['malformed JSON', () => '{"name":', 400],
  ];

  it.each(cases)('returns the right status for %s', async (_label, body, status) => {
    const res = await post(body());
    expect(res.status).toBe(status);
    expect(create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('validateLeadBody', () => {
  it('accepts input sitting exactly at every limit', () => {
    const check = validateLeadBody({
      ...base(),
      company: 'x'.repeat(LEAD_LIMITS.companyChars),
      spec: { ...base().spec, scope_proposed: 'x'.repeat(LEAD_LIMITS.specStringChars) },
      transcript: Array.from({ length: LEAD_LIMITS.transcriptEntries }, () => ({ role: 'duck', text: 'x'.repeat(LEAD_LIMITS.entryChars) })),
    });
    expect(check.ok).toBe(true);
  });
});
