/**
 * Request validation for POST /api/lead. Pure, so it is unit-testable and
 * runs before any Anthropic or Resend call: oversize input is rejected with
 * 413, malformed input with 400.
 */

import type { LeadPayload, SpecSheet } from './email';

export const LEAD_LIMITS = {
  bodyBytes: 64 * 1024,
  transcriptEntries: 40,
  entryChars: 4000,
  specStringChars: 1000,
  nameChars: 200,
  companyChars: 200,
} as const;

type ValidLead = Omit<LeadPayload, 'intakeBrief'>;

export type LeadCheck =
  | { ok: true; lead: ValidLead }
  | { ok: false; status: 400 | 413; error: string };

const fail = (status: 400 | 413, error: string): LeadCheck => ({ ok: false, status, error });

function isValidEmail(s: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length < 200;
}

export function isOversizeBody(raw: string) {
  return new TextEncoder().encode(raw).length > LEAD_LIMITS.bodyBytes;
}

export function validateLeadBody(body: unknown): LeadCheck {
  if (!body || typeof body !== 'object') return fail(400, 'Invalid JSON');
  const b = body as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const name = str(b.name);
  const email = str(b.email).toLowerCase();
  const company = str(b.company) || undefined;

  if (!name || name.length > LEAD_LIMITS.nameChars) return fail(400, 'Name required.');
  if (!isValidEmail(email)) return fail(400, 'Valid email required.');
  if (company && company.length > LEAD_LIMITS.companyChars) return fail(413, 'Company name too long.');

  const { spec, transcript } = b;
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)
      || !Array.isArray(transcript) || transcript.length === 0) {
    return fail(400, 'Spec and transcript required.');
  }
  if (Object.values(spec).some(v => typeof v === 'string' && v.length > LEAD_LIMITS.specStringChars)) {
    return fail(413, 'Spec field too long.');
  }
  if (transcript.length > LEAD_LIMITS.transcriptEntries) return fail(413, 'Transcript too long.');
  for (const t of transcript) {
    if (!t || typeof t !== 'object' || (t.role !== 'duck' && t.role !== 'visitor') || typeof t.text !== 'string') {
      return fail(400, 'Invalid transcript entry.');
    }
    if (t.text.length > LEAD_LIMITS.entryChars) return fail(413, 'Transcript entry too long.');
  }

  return {
    ok: true,
    lead: {
      name,
      email,
      company,
      spec: spec as SpecSheet,
      transcript: transcript as LeadPayload['transcript'],
    },
  };
}
