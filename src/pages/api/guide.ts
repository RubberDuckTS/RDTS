/**
 * POST /api/guide
 *
 * Body: { messages: [{role, content}], page: string, section?: string, notes?: GuideLeadNotes }
 * Resp: GuideReply (message, actions, chips, stage, notes, source)
 *
 * Retrieval over the KB -> cheap model -> grounding check -> reply. Falls back
 * to the scripted guide when no model is reachable, so the panel always answers.
 */
import type { APIRoute } from 'astro';
import { retrieve } from '../../lib/guide/retrieve';
import { guideSystemPrompt } from '../../lib/guide/prompt';
import { askGuideModel } from '../../lib/guide/llm';
import { groundReply, cleanNotes } from '../../lib/guide/ground';
import { scriptedReply } from '../../lib/guide/scripted';
import type { GuideTurn } from '../../lib/guide/types';

export const prerender = false;

const MAX_TURNS = 30;
const MAX_CHARS = 1200;
const RATE = { windowMs: 60_000, max: 20 };
const hits = new Map<string, number[]>();

const INJECTION = [
  /ignore (all |any |the )?(previous|prior|above) (instructions|rules)/i,
  /(reveal|print|show|repeat) (your|the) (system )?(prompt|instructions)/i,
  /developer mode|jailbreak|\bDAN\b/i,
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter(t => now - t < RATE.windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE.max;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let ip = 'unknown';
  try { ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || 'unknown'; } catch {}
  if (limited(ip)) return json({ error: 'Slow down a little and try again in a minute.' }, 429);

  let body: { messages?: GuideTurn[]; page?: string; section?: string; notes?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_TURNS)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  // Model APIs want the transcript to open with a user turn.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) return json({ error: 'messages required' }, 400);

  const prevNotes = cleanNotes(body.notes);
  const page = typeof body.page === 'string' ? body.page.slice(0, 80) : '/';
  const section = typeof body.section === 'string' ? body.section.slice(0, 40) : null;
  const last = messages[messages.length - 1].content;
  const suspicious = INJECTION.some(r => r.test(last));

  const recentUser = messages.filter(m => m.role === 'user').slice(-3).map(m => m.content).join(' ');
  const chunks = retrieve(recentUser);
  const system = guideSystemPrompt({ chunks, page, section, turn: messages.filter(m => m.role === 'user').length });

  const result = suspicious ? null : await askGuideModel(system, messages, request.headers.get('x-vercel-oidc-token'));
  if (!result) {
    const reply = scriptedReply(messages, prevNotes);
    return json(suspicious ? { ...reply, message: "I'll stay in my lane: showing you around and getting you to Long. What are you working on?" } : reply);
  }
  const reply = groundReply(result.json, prevNotes);
  if (reply.grounded) console.info('[guide] grounding rewrote reply', reply.grounded, result.model);
  return json(reply);
};
