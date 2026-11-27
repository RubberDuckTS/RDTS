/**
 * Model calls for the guide, cheapest-first with fallbacks:
 *   1. Vercel AI Gateway (AI_GATEWAY_API_KEY, or the deployment's OIDC token):
 *      GUIDE_MODEL, then GUIDE_FALLBACK_MODEL on another provider.
 *   2. Anthropic directly (ANTHROPIC_API_KEY, already set for /talk).
 * Every call has a hard timeout; the caller drops to the scripted guide if all fail.
 */
import Anthropic from '@anthropic-ai/sdk';
import { parseJsonObject } from './llm-parse';
export { parseJsonObject };

const GATEWAY = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const env = (k: string) => (import.meta.env?.[k] as string | undefined) ?? process.env[k];

const PRIMARY = () => env('GUIDE_MODEL') || 'anthropic/claude-haiku-5.5';
const FALLBACK = () => env('GUIDE_FALLBACK_MODEL') || 'google/gemini-2.5-flash-lite';
const ANTHROPIC_MODEL = () => env('GUIDE_ANTHROPIC_MODEL') || 'claude-haiku-5-5';
const TIMEOUT_MS = 9000;
const MAX_TOKENS = 450;

export type Msg = { role: 'user' | 'assistant'; content: string };

// On Vercel, every function request carries the deployment's OIDC token, which
// the AI Gateway accepts with no API key to manage.
function gatewayToken(oidcHeader?: string | null): string | null {
  return env('AI_GATEWAY_API_KEY') || oidcHeader || env('VERCEL_OIDC_TOKEN') || null;
}

async function callGateway(model: string, system: string, messages: Msg[], token: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GATEWAY, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: MAX_TOKENS,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`gateway ${model} ${res.status}`);
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content ?? '');
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(system: string, messages: Msg[], key: string): Promise<string> {
  const client = new Anthropic({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 0 });
  const r = await client.messages.create({ model: ANTHROPIC_MODEL(), max_tokens: MAX_TOKENS, system, messages });
  const block = r.content.find(b => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}

/** Returns the parsed reply and which model produced it, or null if every route failed. */
export async function askGuideModel(system: string, messages: Msg[], oidcHeader?: string | null): Promise<{ json: Record<string, unknown>; model: string } | null> {
  const attempts: [string, () => Promise<string>][] = [];
  const token = gatewayToken(oidcHeader);
  if (token) {
    attempts.push([PRIMARY(), () => callGateway(PRIMARY(), system, messages, token)]);
    attempts.push([FALLBACK(), () => callGateway(FALLBACK(), system, messages, token)]);
  }
  const key = env('ANTHROPIC_API_KEY');
  if (key) attempts.push([ANTHROPIC_MODEL(), () => callAnthropic(system, messages, key)]);

  for (const [model, run] of attempts) {
    try {
      const json = parseJsonObject(await run());
      if (json) return { json, model };
      console.warn('[guide] unparseable reply from', model);
    } catch (err) {
      console.warn('[guide] model failed', model, (err as Error).message);
    }
  }
  return null;
}
