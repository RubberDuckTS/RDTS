/**
 * Output grounding for the guide. Runs on every model reply before it reaches
 * the visitor. The model is told the rules; this file enforces them, because a
 * sales agent that invents a price, a guarantee or a client result costs Long
 * far more than a slightly blander sentence.
 */
import { ALLOWED_PAGES, SECTIONS, type GuideSection } from './kb';
import type { GuideAction, GuideReply, GuideStage, GuideLeadNotes } from './types';

const PRICE_LINE =
  "Pricing depends on scope, and Long sets real numbers on the first call once he understands the work.";

// Money in any form: $5k, $1,200, 500 dollars, 80/hr, "per month" next to a number.
const MONEY = /(\$\s?\d|\d[\d,.]*\s?k?\s?(usd|dollars?|bucks)\b|\b\d[\d,.]*\s?k\b|\b\d[\d,.]*\s?k?\s?(\/|per|a)\s?(hr|hour|mo|month|project|year|yr)\b)/i;
// Promises nobody can keep from a chat box.
const PROMISE = /\b(guarantee[ds]?|money[- ]back|risk[- ]free|100%|double your|triple your|10x your|#1 ranking|rank (you )?#?1|first page of google)\b/i;
// Invented performance stats: "cut costs by 40%", "3x more leads", "in 2 weeks".
const STAT = /\b\d{1,3}\s?%|\b\d+(\.\d+)?x\s(more|faster|growth|leads|revenue)|\bwithin\s\d+\s(days?|weeks?)\b/i;
// The model must never claim it contacted Long or booked anything itself.
const FALSE_ACTION = /\b(i('ve| have)? (emailed|messaged|texted|notified|booked|scheduled|pinged)|i('ll| will) (email|text|notify|ping) (him|long))\b/i;

function splitSentences(s: string) {
  return s.match(/[^.!?]+[.!?]*\s*/g) ?? [s];
}

export function groundMessage(message: string): { text: string; flags: string[] } {
  const flags: string[] = [];
  let priceHit = false;
  const kept: string[] = [];
  for (const sentence of splitSentences(message)) {
    if (MONEY.test(sentence)) { priceHit = true; flags.push('price_removed'); continue; }
    if (PROMISE.test(sentence)) { flags.push('promise_removed'); continue; }
    if (STAT.test(sentence)) { flags.push('stat_removed'); continue; }
    if (FALSE_ACTION.test(sentence)) { flags.push('false_action_removed'); continue; }
    kept.push(sentence);
  }
  let text = kept.join('').trim();
  if (priceHit) text = (text ? text + ' ' : '') + PRICE_LINE;
  if (!text) text = "Good question for Long directly. Want to grab a quick call with him?";
  return { text: text.slice(0, 600), flags };
}

const STAGES: GuideStage[] = ['greet', 'discover', 'qualify', 'book', 'done'];

export function cleanActions(raw: unknown): GuideAction[] {
  if (!Array.isArray(raw)) return [];
  const out: GuideAction[] = [];
  for (const a of raw.slice(0, 3)) {
    if (!a || typeof a !== 'object') continue;
    const t = (a as { type?: unknown }).type;
    if (t === 'scroll' && SECTIONS.includes((a as { target?: GuideSection }).target as GuideSection)) {
      out.push({ type: 'scroll', target: (a as { target: GuideSection }).target });
    } else if (t === 'navigate') {
      let href = String((a as { href?: unknown }).href ?? '');
      if (href && !href.endsWith('/')) href += '/';
      if ((ALLOWED_PAGES as readonly string[]).includes(href)) out.push({ type: 'navigate', href });
    } else if (t === 'book') {
      out.push({ type: 'book' });
    } else if (t === 'lead_form') {
      out.push({ type: 'lead_form' });
    }
  }
  // One navigation at most, and never navigate and scroll in the same turn.
  const nav = out.find(a => a.type === 'navigate');
  return nav ? [nav, ...out.filter(a => a.type === 'book' || a.type === 'lead_form')] : out;
}

function cleanChips(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is string => typeof c === 'string')
    .map(c => c.trim().slice(0, 40))
    .filter(c => c && !MONEY.test(c) && !PROMISE.test(c))
    .slice(0, 3);
}

function str(v: unknown, max = 300): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

export function cleanNotes(raw: unknown, prev?: GuideLeadNotes): GuideLeadNotes {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    need: str(r.need) ?? prev?.need ?? null,
    business: str(r.business) ?? prev?.business ?? null,
    timeline: str(r.timeline) ?? prev?.timeline ?? null,
    shape: str(r.shape, 40) ?? prev?.shape ?? 'unsure',
  };
}

export function groundReply(raw: Record<string, unknown>, prevNotes?: GuideLeadNotes): GuideReply {
  const { text, flags } = groundMessage(typeof raw.message === 'string' ? raw.message : '');
  const stage = STAGES.includes(raw.stage as GuideStage) ? (raw.stage as GuideStage) : 'discover';
  return {
    message: text,
    actions: cleanActions(raw.actions),
    chips: cleanChips(raw.chips),
    stage,
    notes: cleanNotes(raw.notes, prevNotes),
    source: 'model',
    grounded: flags.length ? flags : undefined,
  };
}
