/**
 * Resend wrapper. Two outbound emails per conversion:
 *   - sendLeadToLong    — full intake brief + transcript to RDTS inbox
 *   - sendSpecToVisitor — short summary + "Long replies within 24h" note
 *
 * Env required:
 *   RESEND_API_KEY   — Resend API key
 *   RDTS_INBOX       — receiving address for leads (e.g. long@rubberducktechsolutions.com)
 *   RDTS_FROM        — verified Resend sender (e.g. duck@rubberducktechsolutions.com)
 *   CALENDLY_URL     — fallback link if buyer wants to skip the back-and-forth
 */

import { Resend } from 'resend';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const RDTS_INBOX     = import.meta.env.RDTS_INBOX     || 'long@rubberducktechsolutions.com';
const RDTS_FROM      = import.meta.env.RDTS_FROM      || 'duck@rubberducktechsolutions.com';
const CALENDLY_URL   = import.meta.env.CALENDLY_URL   || 'https://calendly.com/nguy4227/let-s-connect-project-role-or-collaboration';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * State object captured by the duck during the scoping conversation.
 * Matches Section 3H of the pivot design spec.
 */
export interface SpecSheet {
  shape: string;                  // "Quick fix" | "Tuneup" | "Workspace" | "Rollout" | "Custom" | "Ad iteration" | "Software build" | "unsure"
  team_size: string | null;       // "solo" | "4" | "12" | ...
  budget_range: string | null;    // "$2K" | "$3-5K" | "open" | ...
  budget_flex: string;            // "below_floor" | "in_band" | "above_ceiling" | "unknown"
  current_stack: string | null;
  current_pain: string | null;
  urgency: string | null;
  scope_proposed: string | null;
  hard_no_triggered: boolean;
  name: string | null;
  email: string | null;
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
    `Shape: ${spec.shape || 'unsure'}`,
    `Team size: ${spec.team_size || '(unset)'}`,
    `Budget range: ${spec.budget_range || '(unset)'} (${spec.budget_flex || 'unknown'})`,
    `Urgency: ${spec.urgency || '(unset)'}`,
    `Current stack: ${spec.current_stack || '(unset)'}`,
    `Current pain: ${spec.current_pain || '(unset)'}`,
    `Scope proposed: ${spec.scope_proposed || '(unset)'}`,
    `Hard-no triggered: ${spec.hard_no_triggered ? 'YES' : 'no'}`,
  ].join('\n');
}

function formatTranscript(transcript: LeadPayload['transcript']): string {
  return transcript
    .map(t => `${t.role === 'duck' ? 'Duck' : 'Visitor'}: ${t.text}`)
    .join('\n\n');
}

/**
 * Buyer-facing summary lines pulled from the spec.
 * Used in the buyer confirmation email.
 */
function buyerSummary(spec: SpecSheet): string {
  const teamPhrase = spec.team_size === 'solo' || spec.team_size === '1'
    ? 'a solo setup'
    : spec.team_size
      ? `a team of ${spec.team_size}`
      : 'your setup';
  return `${spec.shape || 'A setup'} for ${teamPhrase}. ${spec.scope_proposed || ''}`.trim();
}

export async function sendLeadToLong(payload: LeadPayload) {
  if (!resend) throw new Error('RESEND_API_KEY not configured');

  const subject = `[RDTS lead] ${payload.name} · ${payload.spec.shape || 'unsure'}${payload.spec.budget_range ? ` · ${payload.spec.budget_range}` : ''}`;

  const body = [
    payload.intakeBrief,
    '',
    '— — — — — — — — — — — — — —',
    'State object (raw):',
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

  const firstName = payload.name.split(' ')[0];
  const shape = payload.spec.shape || 'setup';
  const subject = `Your AI setup brief — ${shape}`;

  const tldr = buyerSummary(payload.spec);
  const scopeShort = payload.spec.scope_proposed || '(scope to be confirmed)';

  // "Not included" — derive from spec; if nothing explicit, give a short honest line.
  const notIncluded = payload.spec.hard_no_triggered
    ? 'This one is outside what I take on — see the note above.'
    : 'Anything outside the scope above is a separate conversation. If you want it folded in, just reply.';

  const body = [
    `Hey ${firstName},`,
    '',
    'Quick summary of what we talked about:',
    '',
    tldr,
    '',
    `What I'd actually do:`,
    scopeShort,
    '',
    'Not included:',
    notIncluded,
    '',
    'If any of that looks wrong, just reply and tell me.',
    '',
    'Long will follow up within 24 hours. If urgent, reply with "urgent" in the subject.',
    '',
    'If you want to skip the back-and-forth and book a call: ' + CALENDLY_URL,
    '',
    '— The duck',
    'RDTS',
  ].join('\n');

  return resend.emails.send({
    from:    `RDTS Duck <${RDTS_FROM}>`,
    to:      [payload.email],
    replyTo: RDTS_INBOX,
    subject,
    text:    body,
  });
}
