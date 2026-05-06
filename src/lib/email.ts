/**
 * Resend wrapper. Two outbound emails per conversion:
 *   - sendLeadToLong  — full intake brief + transcript to RDTS inbox
 *   - sendSpecToVisitor — clean spec sheet to the visitor
 *
 * Env required:
 *   RESEND_API_KEY        — Resend API key
 *   RDTS_INBOX            — receiving address for leads (e.g. long@rubberducktechsolutions.com)
 *   RDTS_FROM             — verified Resend sender (e.g. duck@rubberducktechsolutions.com)
 *   CALENDLY_URL          — link included in visitor confirmation
 */

import { Resend } from 'resend';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const RDTS_INBOX     = import.meta.env.RDTS_INBOX     || 'long@rubberducktechsolutions.com';
const RDTS_FROM      = import.meta.env.RDTS_FROM      || 'duck@rubberducktechsolutions.com';
const CALENDLY_URL   = import.meta.env.CALENDLY_URL   || 'https://calendly.com/nguy4227/let-s-connect-project-role-or-collaboration';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface SpecSheet {
  project_name: string | null;
  tier: string;
  tier_reason: string | null;
  timeline: string | null;
  price_range: string | null;
  summary: string | null;
  integrations: string[];
  out_of_scope: string[];
}

export interface LeadPayload {
  name: string;
  email: string;
  company?: string;
  spec: SpecSheet;
  intakeBrief: string;
  transcript: { role: 'duck' | 'visitor'; text: string }[];
}

function formatSpecText(spec: SpecSheet): string {
  return [
    `Project: ${spec.project_name || '(unset)'}`,
    `Tier: ${spec.tier}${spec.tier_reason ? ` — ${spec.tier_reason}` : ''}`,
    `Timeline: ${spec.timeline || '(unset)'}`,
    `Price: ${spec.price_range || '(unset)'}`,
    `Summary: ${spec.summary || '(unset)'}`,
    spec.integrations.length ? `Integrations: ${spec.integrations.join(', ')}` : null,
    spec.out_of_scope.length ? `Out of scope: ${spec.out_of_scope.join('; ')}` : null,
  ].filter(Boolean).join('\n');
}

function formatTranscript(transcript: LeadPayload['transcript']): string {
  return transcript
    .map(t => `${t.role === 'duck' ? 'Duck' : 'Visitor'}: ${t.text}`)
    .join('\n\n');
}

export async function sendLeadToLong(payload: LeadPayload) {
  if (!resend) throw new Error('RESEND_API_KEY not configured');

  const subject = `[RDTS lead] ${payload.name} · ${payload.spec.tier} · ${payload.spec.project_name || 'unnamed'}`;

  const body = [
    payload.intakeBrief,
    '',
    '— — — — — — — — — — — — — —',
    'Spec sheet (raw):',
    formatSpecText(payload.spec),
    '',
    '— — — — — — — — — — — — — —',
    'Full transcript:',
    formatTranscript(payload.transcript),
  ].join('\n');

  return resend.emails.send({
    from:     `RDTS Duck <${RDTS_FROM}>`,
    to:       [RDTS_INBOX],
    replyTo:  payload.email,
    subject,
    text:     body,
  });
}

export async function sendSpecToVisitor(payload: LeadPayload) {
  if (!resend) throw new Error('RESEND_API_KEY not configured');

  const subject = `Your RDTS spec sheet — ${payload.spec.project_name || 'project'}`;

  const body = [
    `Hey ${payload.name.split(' ')[0]} —`,
    '',
    'Thanks for talking to the duck. Here\'s the spec sheet from our conversation:',
    '',
    formatSpecText(payload.spec),
    '',
    'I (Long) will read this myself within a business day and reply directly. If you want',
    'to skip the back-and-forth and just book a call, here\'s my Calendly:',
    '',
    CALENDLY_URL,
    '',
    '— Long',
    'Rubber Duck Tech Solutions',
    'rubberducktechsolutions.com',
  ].join('\n');

  return resend.emails.send({
    from:    `Long Nguyen <${RDTS_FROM}>`,
    to:      [payload.email],
    replyTo: RDTS_INBOX,
    subject,
    text:    body,
  });
}
