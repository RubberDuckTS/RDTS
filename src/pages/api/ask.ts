import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { buildAskSystemPrompt, tryParseAsk, type AskResponse } from '../../lib/ask-prompt';
import { getKnowledge } from '../../lib/duck-knowledge';
import { checkRateLimit, clientIp } from '../../lib/ratelimit';

export const prerender = false;

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;
const MAX_USER_TURNS = 8;

interface ChatMessage { role: 'user' | 'assistant'; content: string }

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function callHaiku(client: Anthropic, system: string, messages: ChatMessage[], extra?: string): Promise<string> {
  const result = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: MAX_TOKENS,
    system: extra ? `${system}\n\n# CRITICAL\n${extra}` : system,
    messages: [
      ...messages.map(m => ({ role: m.role, content: m.content.slice(0, 4000) })),
      { role: 'assistant' as const, content: '{' },
    ],
  });
  const block = result.content.find(b => b.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : '';
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 503);

  const { ok } = await checkRateLimit(clientIp(request));
  if (!ok) return jsonResponse({ error: "You've hit the limit. Email long@rubberducktechsolutions.com directly." }, 429);

  let body: { topic?: string; messages?: ChatMessage[] };
  try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  if (typeof body.topic !== 'string') return jsonResponse({ error: 'Unknown topic' }, 400);

  const knowledge = getKnowledge(body.topic || '');
  if (!knowledge) return jsonResponse({ error: 'Unknown topic' }, 400);

  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) return jsonResponse({ error: 'messages required' }, 400);

  if (messages.length > MAX_USER_TURNS * 2) return jsonResponse({ error: 'Too many messages.' }, 400);

  if (
    messages.some(
      m => typeof m !== 'object' || m === null || typeof (m as any).role !== 'string' || typeof (m as any).content !== 'string',
    )
  ) {
    return jsonResponse({ error: 'Invalid message format.' }, 400);
  }

  const userTurns = messages.filter(m => m.role === 'user').length;
  if (userTurns > MAX_USER_TURNS) {
    return jsonResponse({ error: `Conversation limit reached (${MAX_USER_TURNS} turns). Email Long to keep going.` }, 429);
  }

  const anthropic = new Anthropic({ apiKey });
  const system = buildAskSystemPrompt(knowledge);

  try {
    let raw = await callHaiku(anthropic, system, messages);
    let parsed = tryParseAsk(raw);
    if (!parsed) {
      raw = await callHaiku(anthropic, system, messages, 'Your previous response failed to parse. Output ONLY the JSON object, starting with { and ending with }.');
      parsed = tryParseAsk(raw);
    }
    if (!parsed) {
      return jsonResponse({
        message: `One sec — ask that again, or if it's getting specific, email long@rubberducktechsolutions.com and Long will answer directly.`,
        spec: null, ready_for_lead: false, turn_count: userTurns,
      } as AskResponse, 200);
    }
    return jsonResponse(parsed, 200);
  } catch (err) {
    console.error('[ask] anthropic call failed:', err);
    return jsonResponse({ error: 'Upstream model call failed. Try again or email Long directly.' }, 502);
  }
};
