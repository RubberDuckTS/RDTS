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
 *   1. Synthesize an intake brief via Haiku (full transcript → 350-word brief).
 *   2. Resend two emails:
 *      - to Long  (intake brief + spec + transcript)
 *      - to visitor (clean spec + Calendly link)
 */

import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { INTAKE_BRIEF_SYSTEM_PROMPT } from '../../lib/prompts';
import {
  sendLeadToLong,
  sendSpecToVisitor,
  type LeadPayload,
  type SpecSheet,
} from '../../lib/email';

export const prerender = false;

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 700;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidEmail(s: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length < 200;
}

interface LeadRequest {
  name?: string;
  email?: string;
  company?: string;
  honeypot?: string;
  spec?: SpecSheet;
  transcript?: { role: 'duck' | 'visitor'; text: string }[];
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  const resendKey = import.meta.env.RESEND_API_KEY;

  if (!apiKey || !resendKey) {
    return jsonResponse(
      { error: 'Lead capture not configured. Email long@rubberducktechsolutions.com directly.' },
      503,
    );
  }

  let body: LeadRequest;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Honeypot — bot defense
  if (body.honeypot) {
    return jsonResponse({ ok: true }, 200);
  }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const company = (body.company || '').trim() || undefined;
  const spec = body.spec;
  const transcript = body.transcript;

  if (!name || name.length > 200) {
    return jsonResponse({ error: 'Name required.' }, 400);
  }
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'Valid email required.' }, 400);
  }
  if (!spec || !transcript || !Array.isArray(transcript) || transcript.length === 0) {
    return jsonResponse({ error: 'Spec and transcript required.' }, 400);
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
            `Visitor: ${name} · ${email}${company ? ` · ${company}` : ''}`,
            '',
            'Spec sheet (live during conversation):',
            JSON.stringify(spec, null, 2),
            '',
            'Full transcript:',
            transcriptText,
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
