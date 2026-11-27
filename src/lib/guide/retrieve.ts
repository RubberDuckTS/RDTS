/**
 * Tiny BM25 retrieval over the guide KB. The corpus is small enough that an
 * embedding service would add latency and a failure mode without improving
 * recall, so this runs in-process with zero network calls.
 */
import { KB, type KbChunk } from './kb';

const STOP = new Set(
  'a an and are as at be but by can do for from has have how i if in is it its me my of on or our so that the this to us we what when where which who why will with you your'.split(' '),
);

const SYNONYMS: Record<string, string[]> = {
  price: ['pricing', 'cost', 'rate', 'budget', 'charge', 'quote', 'expensive', 'cheap'],
  website: ['site', 'wordpress', 'web', 'landing', 'seo', 'speed', 'page'],
  ai: ['agent', 'agents', 'automation', 'automate', 'llm', 'chatgpt', 'claude', 'gpt', 'bot', 'chatbot'],
  book: ['call', 'meeting', 'schedule', 'calendar', 'talk', 'meet', 'booking'],
  work: ['portfolio', 'examples', 'case', 'proof', 'projects', 'built', 'clients'],
  retainer: ['monthly', 'ongoing', 'partner', 'fractional'],
  train: ['training', 'teach', 'workshop', 'onboard', 'rollout'],
};

function stem(t: string) {
  return t.replace(/(ing|ed|es|s)$/, '');
}

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out: string[] = [];
  for (const w of raw) {
    if (STOP.has(w)) continue;
    out.push(stem(w));
    for (const [head, syns] of Object.entries(SYNONYMS)) {
      if (w === head || syns.includes(w)) out.push(head);
    }
  }
  return out;
}

const docs = KB.map(c => tokenize(`${c.title} ${c.title} ${c.text}`));
const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length;
const df = new Map<string, number>();
for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);

export function retrieve(query: string, k = 5): KbChunk[] {
  const q = tokenize(query);
  const N = docs.length;
  const scored = docs.map((d, i) => {
    let score = 0;
    for (const t of q) {
      const f = d.filter(x => x === t).length;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.length / avgLen))));
    }
    return { i, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const hits = scored.filter(s => s.score > 0).slice(0, k).map(s => KB[s.i]);
  // Always ground on who/booking/pricing so the guide can route any turn to a call.
  for (const id of ['who', 'booking', 'pricing']) {
    if (!hits.some(h => h.id === id)) hits.push(KB.find(c => c.id === id)!);
  }
  return hits;
}
