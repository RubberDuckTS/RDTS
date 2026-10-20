/**
 * Resend wrapper. Two outbound emails per conversion:
 *   - sendLeadToLong    — full intake brief + transcript to RDTS inbox
 *   - sendSpecToVisitor — fixed confirmation + "Long replies within 24h" note
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
 * State object captured by the duck during the qualification conversation.
 * Matches Section 3H of the pivot design spec.
 */
export interface SpecSheet {
  shape: string;                  // "Quick fix" | "Tuneup" | "Workspace" | "Rollout" | "Custom" | "Ad iteration" | "Software build" | "unsure"
  team_size: string | null;       // "solo" | "4" | "12" | "40" | ...
  budget_range: string | null;    // "monthly retainer" | "open" | "project budget ~$20K" | ...
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
    `Engagement shape: ${spec.shape || 'unsure'}`,
    `Team size: ${spec.team_size || '(unset)'}`,
    `Retainer / budget: ${spec.budget_range || '(unset)'} (${spec.budget_flex || 'unknown'})`,
    `Urgency / forcing function: ${spec.urgency || '(unset)'}`,
    `Current AI tools: ${spec.current_stack || '(unset)'}`,
    `Pain / overwhelm: ${spec.current_pain || '(unset)'}`,
    `Proposed engagement: ${spec.scope_proposed || '(unset)'}`,
    `Hard-no triggered: ${spec.hard_no_triggered ? 'YES' : 'no'}`,
  ].join('\n');
}

function formatTranscript(transcript: LeadPayload['transcript']): string {
  return transcript
    .map(t => `${t.role === 'duck' ? 'Duck' : 'Visitor'}: ${t.text}`)
    .join('\n\n');
}

/**
 * Chat-lead notification — fires when a visitor volunteers an email address
 * IN the chat instead of using the form. Goes to Long ONLY; the visitor
 * receives nothing until Long replies personally (so the chat can never be
 * used to send mail to arbitrary third-party addresses). Deduped per
 * conversation in scope.ts. replyTo is the visitor, so Long answers in one click.
 */
export async function sendChatLeadToLong(
  visitorEmail: string,
  chatMessages: { role: string; content: string }[],
) {
  if (!resend) throw new Error('RESEND_API_KEY not configured');

  const lines: string[] = [];
  for (const m of chatMessages) {
    if (m.role === 'user') {
      lines.push(`Visitor: ${m.content}`);
    } else {
      // assistant turns hold the duck's raw JSON — surface just its message
      try {
        lines.push(`Duck: ${JSON.parse(m.content).message ?? m.content}`);
      } catch {
        lines.push(`Duck: ${m.content}`);
      }
    }
  }

  return resend.emails.send({
    from:    `RDTS Duck <${RDTS_FROM}>`,
    to:      [RDTS_INBOX],
    replyTo: visitorEmail,
    subject: `[RDTS chat lead] ${visitorEmail} left their email in the duck chat`,
    text: [
      `${visitorEmail} shared their email in the /talk chat without submitting the form.`,
      'Reply to this email to reach them directly.',
      '',
      '— — — — — — — — — — — — — —',
      'Conversation so far:',
      lines.join('\n\n'),
    ].join('\n'),
  });
}

export async function sendLeadToLong(payload: LeadPayload) {
  if (!resend) throw new Error('RESEND_API_KEY not configured');

  const subject = `[RDTS lead] ${payload.name} · ${payload.spec.shape || 'unsure'}${payload.spec.team_size ? ` · ${payload.spec.team_size} people` : ''}${payload.spec.budget_range ? ` · ${payload.spec.budget_range}` : ''}`;

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

/** Shapes the duck can set. Only these are ever echoed back to the visitor. */
const VISITOR_SHAPES = ['Software build', 'Maintenance', 'AI integration', 'Consulting', 'Training', 'Retainer', 'Custom'];

/**
 * The visitor confirmation is a fixed template. It goes to whatever address
 * was typed into the form, so it must echo nothing the sender controls: no
 * name, company, transcript or free-text spec field. Otherwise /api/lead
 * relays attacker-written text from the RDTS domain to any inbox. Only an
 * allowlisted shape is shown; Long gets the full brief separately.
 */
export function buildVisitorEmail(payload: LeadPayload, calendlyUrl = CALENDLY_URL) {
  const shape = VISITOR_SHAPES.includes(payload.spec?.shape) ? payload.spec.shape : null;
  return {
    subject: `Your RDTS brief: ${shape ?? 'your project'}`,
    text: [
      'Hi,',
      '',
      `Thanks for talking with the duck. Long now has your brief${shape ? ` (${shape})` : ''}.`,
      '',
      'Long will follow up within 24 hours. If urgent, reply with "urgent" in the subject.',
      'To add anything or correct the brief, just reply to this email.',
      '',
      'If you want to skip the back-and-forth and book a call: ' + calendlyUrl,
      '',
      '— The duck',
      'RDTS',
    ].join('\n'),
  };
}

export async function sendSpecToVisitor(payload: LeadPayload) {
  if (!resend) throw new Error('RESEND_API_KEY not configured');

  const { subject, text } = buildVisitorEmail(payload);
  return resend.emails.send({
    from:    `RDTS Duck <${RDTS_FROM}>`,
    to:      [payload.email],
    replyTo: RDTS_INBOX,
    subject,
    text,
  });
}
