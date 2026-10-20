/**
 * POST /api/lead
 *
 * Body: {
 *   name, email, company?,
 *   spec: SpecSheet,
 *   transcript: [{ role: 'duck' | 'visitor', text }]
 * }
 *
 * Flow:
 *   0. Reject oversize (413) or malformed (400) input before any API call.
 *   1. Synthesize an intake brief via Haiku (full transcript → 350-word brief).
 *   2. Resend two emails:
 *      - to Long  (intake brief + spec + transcript)
 *      - to visitor (fixed confirmation + Calendly link; echoes no visitor text)
 */

import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { INTAKE_BRIEF_SYSTEM_PROMPT } from '../../lib/prompts';
import {
  sendLeadToLong,
  sendSpecToVisitor,
  type LeadPayload,
} from '../../lib/email';
import { isOversizeBody, validateLeadBody } from '../../lib/lead-request';

export const prerender = false;

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 700;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  // Validate before anything else, so oversize or malformed input never
  // reaches Anthropic or Resend.
  const raw = await request.text();
  if (isOversizeBody(raw)) {
    return jsonResponse({ error: 'Request too large.' }, 413);
  }

  let body: { honeypot?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Honeypot — bot defense
  if (body?.honeypot) {
    return jsonResponse({ ok: true }, 200);
  }

  const check = validateLeadBody(body);
  if (!check.ok) {
    return jsonResponse({ error: check.error }, check.status);
  }
  const { name, email, company, spec, transcript } = check.lead;

  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  const resendKey = import.meta.env.RESEND_API_KEY;

  if (!apiKey || !resendKey) {
    return jsonResponse(
      { error: 'Lead capture not configured. Email long@rubberducktechsolutions.com directly.' },
      503,
    );
  }

  const anthropic = new Anthropic({ apiKey });

  // Synthesize intake brief
  const transcriptText = transcript
    .map(t => `${t.role === 'duck' ? 'Duck' : 'Visitor'}: ${t.text}`)
    .join('\n\n');

  let intakeBrief: string;
  try {
    const briefResult = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: MAX_TOKENS,
      system: INTAKE_BRIEF_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            `Buyer: ${name} · ${email}${company ? ` · ${company}` : ''}`,
            '',
            'State object captured by the duck:',
            JSON.stringify(spec, null, 2),
            '',
            'Full transcript:',
            transcriptText,
            '',
            'Write the brief now, matching the exact markdown structure from your system prompt.',
          ].join('\n'),
        },
      ],
    });
    const block = briefResult.content.find(b => b.type === 'text');
    intakeBrief = block && block.type === 'text' ? block.text.trim() : 'Intake brief synthesis failed.';
  } catch (err) {
    console.error('[lead] intake brief synthesis failed:', err);
    intakeBrief = 'Intake brief synthesis failed — see transcript below.';
  }

  const payload: LeadPayload = {
    name,
    email,
    company,
    spec,
    intakeBrief,
    transcript,
  };

  // Fire both emails
  try {
    await Promise.all([
      sendLeadToLong(payload),
      sendSpecToVisitor(payload),
    ]);
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error('[lead] resend failed:', err);
    return jsonResponse(
      { error: 'Email send failed. Try again or email long@rubberducktechsolutions.com directly.' },
      502,
    );
  }
};
