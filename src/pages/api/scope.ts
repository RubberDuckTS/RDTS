/**
 * POST /api/scope
 *
 * Body: { messages: [{ role: 'user' | 'assistant', content: string }, ...] }
 * Resp: { message, spec, ready_for_lead, turn_count }
 *
 * Calls Claude Haiku with the master scoping prompt. Forces strict JSON via
 * assistant prefill, retries once on parse failure, and never wipes the spec
 * sheet on graceful fallback.
 */

import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { SCOPING_SYSTEM_PROMPT } from '../../lib/prompts';
import { sendChatLeadToLong } from '../../lib/email';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export const prerender = false;

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 800;
const MAX_USER_TURNS = 12;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ScopeResponse {
  message: string;
  spec: Record<string, unknown> | null;
  ready_for_lead: boolean;
  /** True when the duck has wrapped the session (visitor said they're done). */
  session_complete?: boolean;
  turn_count: number;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tryParseScope(raw: string): ScopeResponse | null {
  // The model output starts after our `{` prefill, so re-attach it.
  // Also strip code fences just in case the model wraps.
  const reattached = raw.startsWith('{') ? raw : '{' + raw;
  const cleaned = reattached.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.message === 'string') return parsed as ScopeResponse;
    return null;
  } catch {
    return null;
  }
}

async function callHaiku(
  client: Anthropic,
  messages: ChatMessage[],
  extraInstruction?: string,
): Promise<string> {
  const sys = extraInstruction
    ? SCOPING_SYSTEM_PROMPT + '\n\n# CRITICAL\n' + extraInstruction
    : SCOPING_SYSTEM_PROMPT;
  const result = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: MAX_TOKENS,
    system: sys,
    messages: [
      ...messages.map(m => ({
        role: m.role,
        content: m.content.slice(0, 4000),
      })),
      // Prefill: forces the model to continue from `{`, locking output to JSON.
      { role: 'assistant' as const, content: '{' },
    ],
  });
  const block = result.content.find(b => b.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : '';
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: 'ANTHROPIC_API_KEY not configured' },
      503,
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'messages required' }, 400);
  }

  const userTurns = messages.filter(m => m.role === 'user').length;
  if (userTurns > MAX_USER_TURNS) {
    return jsonResponse(
      { error: `Conversation limit reached (${MAX_USER_TURNS} turns). Submit your spec or refresh to start over.` },
      429,
    );
  }

  const anthropic = new Anthropic({ apiKey });

  // Chat-lead capture: the visitor volunteered an email in their latest
  // message. Forward it to Long BEFORE generating the reply, so the duck can
  // confirm honestly — or recover honestly if the send fails. Sent to Long
  // only (never to the typed address), deduped per conversation.
  const lastMsg = messages[messages.length - 1];
  const volunteered =
    lastMsg?.role === 'user' ? lastMsg.content?.match?.(EMAIL_RE)?.[0] : undefined;
  const alreadyForwarded = volunteered
    ? messages.slice(0, -1).some(m => typeof m.content === 'string' && m.content.includes(volunteered))
    : false;

  let chatLeadNote: string | undefined;
  if (volunteered && !alreadyForwarded) {
    try {
      await sendChatLeadToLong(volunteered, messages);
      chatLeadNote = `SYSTEM NOTE: the visitor just shared their email (${volunteered}) in the chat, and it has ALREADY been forwarded to Long together with this conversation. Confirm that honestly — Long will follow up within 24 hours. Do not tell them nothing happened, and do not demand the form (you may mention it as an optional way to add details).`;
    } catch (err) {
      console.error('[scope] chat-lead forward failed:', err);
      chatLeadNote = `SYSTEM NOTE: the visitor shared an email in chat but automatic forwarding FAILED. Do NOT claim Long received anything — point them to the form beside the chat or long@rubberducktechsolutions.com.`;
    }
  }

  try {
    // Attempt 1: standard prefill
    let raw = await callHaiku(anthropic, messages, chatLeadNote);
    let parsed = tryParseScope(raw);

    // Attempt 2: retry with stricter instruction if first attempt didn't parse
    if (!parsed) {
      console.warn('[scope] first attempt failed to parse — retrying. raw:', raw.slice(0, 200));
      raw = await callHaiku(
        anthropic,
        messages,
        [
          chatLeadNote,
          'Your previous response failed to parse as JSON. Output ONLY the JSON object, starting with { and ending with }. No markdown, no prose, no preamble.',
        ].filter(Boolean).join('\n'),
      );
      parsed = tryParseScope(raw);
    }

    if (!parsed) {
      // Soft fallback — keep the conversation alive without nuking the spec.
      // Returning spec: null tells the frontend not to overwrite the live spec.
      console.error('[scope] both attempts failed. raw:', raw.slice(0, 200));
      return jsonResponse(
        {
          message:
            "One more line — tell me the stack you use today and what's the worst part of it.",
          spec: null,
          ready_for_lead: false,
          turn_count: userTurns,
        } as ScopeResponse,
        200,
      );
    }

    return jsonResponse(parsed, 200);
  } catch (err) {
    console.error('[scope] anthropic call failed:', err);
    return jsonResponse(
      { error: 'Upstream model call failed. Try again or email Long directly.' },
      502,
    );
  }
};
