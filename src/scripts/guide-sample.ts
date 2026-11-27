/**
 * Preview-only path: when the page runs as a Claude artifact, the guide asks
 * Claude through the artifact runtime instead of /api/guide. Same retrieval,
 * same prompt, same grounding check as the server, so the preview behaves like
 * production. Loaded on demand; production visitors never download it.
 */
import { retrieve } from '../lib/guide/retrieve';
import { guideSystemPrompt } from '../lib/guide/prompt';
import { groundReply } from '../lib/guide/ground';
import { parseJsonObject } from '../lib/guide/llm-parse';
import type { GuideLeadNotes, GuideReply, GuideTurn } from '../lib/guide/types';

type Sample = ((input: { role: 'user' | 'assistant'; content: string }[], opts?: Record<string, unknown>) => Promise<{ text: string }>) | null;
let samplePromise: Promise<Sample> | null = null;

export function artifactRuntime(): boolean {
  return typeof (window as unknown as { claude?: { use?: unknown } }).claude?.use === 'function';
}

function getSample(): Promise<Sample> {
  if (!samplePromise) {
    const c = (window as unknown as { claude: { use: (n: string) => Promise<Sample> } }).claude;
    samplePromise = c.use('sample').catch(() => null);
  }
  return samplePromise;
}

export async function askViaArtifact(turns: GuideTurn[], notes: GuideLeadNotes, section: string | null): Promise<GuideReply | null> {
  const sample = await getSample();
  if (!sample) return null;
  const msgs = turns.slice(-24).map(t => ({ role: t.role, content: t.content.slice(0, 1200) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length) return null;
  const recent = msgs.filter(m => m.role === 'user').slice(-3).map(m => m.content).join(' ');
  const system = guideSystemPrompt({ chunks: retrieve(recent), page: '/', section, turn: msgs.filter(m => m.role === 'user').length });
  // sample() is memoryless and has no system slot: the instructions ride in
  // the first user turn.
  const input = [{ role: 'user' as const, content: `${system}\n\n--- conversation starts ---\n${msgs[0].content}` }, ...msgs.slice(1)];
  try {
    const r = await sample(input, { modelTier: 'quick', cache: false });
    const json = parseJsonObject(r.text);
    return json ? groundReply(json, notes) : null;
  } catch {
    return null;
  }
}
