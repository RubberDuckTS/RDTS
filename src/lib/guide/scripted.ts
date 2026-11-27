/**
 * Deterministic guide. Runs when no model is reachable (no keys, outage, rate
 * limit) and in the static preview, so the site never shows a dead chat box.
 * Pure and dependency-free: imported by both the API route and the browser.
 */
import type { GuideReply, GuideTurn, GuideLeadNotes } from './types';

export const GREETING: GuideReply = {
  message:
    "Hey, I'm the duck. Long built me to show you around and get you to the right person fast. What brings you here today?",
  actions: [],
  chips: ['Am I overpaying for AI?', 'Add AI to my business', 'Just looking around'],
  stage: 'greet',
  notes: { need: null, business: null, timeline: null, shape: 'unsure' },
  source: 'scripted',
};

const has = (t: string, words: string[]) => words.some(w => t.includes(w));

export function scriptedReply(history: GuideTurn[], prev?: GuideLeadNotes): GuideReply {
  const last = [...history].reverse().find(m => m.role === 'user')?.content.toLowerCase() ?? '';
  const userTurns = history.filter(m => m.role === 'user').length;
  const notes: GuideLeadNotes = { ...(prev ?? GREETING.notes) };
  const base = { source: 'scripted' as const, notes };

  if (has(last, ['book', 'call', 'schedule', 'meet', 'calendar', 'talk to long', "let's do it", 'sounds good', 'how do i start'])) {
    return { ...base, stage: 'book', message: "Perfect. Here's Long's calendar. Pick any open slot: it's free, 15 to 45 minutes, and he reads your notes before the call.", actions: [{ type: 'book' }], chips: ["I'd rather leave my email"] };
  }
  if (has(last, ['email', 'later', 'not ready', 'contact'])) {
    return { ...base, stage: 'book', message: 'No problem. Leave your name and email and Long follows up within 24 hours.', actions: [{ type: 'lead_form' }], chips: ['Actually, book a call'] };
  }
  if (has(last, ['price', 'cost', 'how much', 'rate', 'budget', 'expensive', 'cheap'])) {
    return { ...base, stage: 'qualify', message: 'Pricing depends on scope, and Long sets real numbers on the first call once he understands the work. Want to grab 15 minutes with him?', actions: [{ type: 'scroll', target: 'process' }], chips: ['Book a call', 'What happens on the call?'] };
  }
  if (has(last, ['overpay', 'subscription', 'too much', 'paying for', 'tools check', 'which ai', 'which tools', 'chatgpt or'])) {
    notes.shape = 'AI consulting'; notes.need = notes.need ?? last.slice(0, 200);
    return { ...base, stage: 'qualify', message: "That's exactly what the free call is for. Long looks at what you pay for and use, and tells you what to keep, what to drop and what you could own instead. What tools are you paying for right now?", actions: [{ type: 'scroll', target: 'overpay' }], chips: ['Book the free check', 'A few AI subscriptions', 'None yet'] };
  }
  if (has(last, ['local', 'private', 'own server', 'on-prem', 'self-host', 'gpu', 'fine-tun'])) {
    notes.shape = 'AI consulting'; notes.need = notes.need ?? last.slice(0, 200);
    return { ...base, stage: 'qualify', message: "Long runs and fine-tunes open models on in-house GPUs, so he can tell you straight when private AI pays off. Here's his local AI lab.", actions: [{ type: 'navigate', href: '/work/local-ai-lab/' }], chips: ['Book a call', 'What would it cost to run?'] };
  }
  if (has(last, ['website', 'site', 'wordpress', 'seo', 'speed', 'google'])) {
    notes.shape = 'Website'; notes.need = notes.need ?? last.slice(0, 200);
    return { ...base, stage: 'qualify', message: "Websites are home turf: builds, WordPress, page speed and local SEO. Is this a new site, or fixing one you already have?", actions: [{ type: 'scroll', target: 'services' }], chips: ['New site', 'Fix my current site', 'Book a call'] };
  }
  if (has(last, ['agent', 'ai', 'automat', 'chatbot', 'bot', 'gpt', 'claude', 'workflow'])) {
    notes.shape = 'AI integration'; notes.need = notes.need ?? last.slice(0, 200);
    return { ...base, stage: 'qualify', message: "That's the core of what Long does: agents and automations wired into the tools you already use. What's the one task you'd hand off first?", actions: [{ type: 'scroll', target: 'services' }], chips: ['Customer support', 'Sales follow-up', 'Not sure yet'] };
  }
  if (has(last, ['built', 'build', 'app', 'software', 'tool', 'dashboard', 'mvp'])) {
    notes.shape = 'Software build'; notes.need = notes.need ?? last.slice(0, 200);
    return { ...base, stage: 'qualify', message: "Long builds and maintains custom apps and tools, with AI inside where it helps. Here's some of what he's shipped. What are you trying to build?", actions: [{ type: 'scroll', target: 'proof' }], chips: ['An internal tool', 'A customer app', 'Book a call'] };
  }
  if (has(last, ['work', 'portfolio', 'example', 'proof', 'project', 'shipped'])) {
    return { ...base, stage: 'discover', message: "Here's real stuff he's built and shipped, all solo. Anything here close to what you need?", actions: [{ type: 'scroll', target: 'proof' }], chips: ['Something like that', 'Book a call'] };
  }
  if (has(last, ['who', 'about', 'long', 'experience', 'background'])) {
    return { ...base, stage: 'discover', message: "Long's been shipping production software since 2018, started at two marketing agencies, and now runs RDTS solo. The person you talk to is the person who builds it.", actions: [{ type: 'navigate', href: '/about/' }], chips: ['What does he build?', 'Book a call'] };
  }
  if (has(last, ['look', 'brows', 'tour', 'curious', 'nothing', 'just'])) {
    return { ...base, stage: 'discover', message: "Quick tour then. First stop: the three kinds of work Long takes on. Anything jump out?", actions: [{ type: 'scroll', target: 'services' }], chips: ['Show me his work', 'How does it work?', 'Book a call'] };
  }
  if (has(last, ['how does it work', 'process', 'happens on the call', 'next step'])) {
    return { ...base, stage: 'qualify', message: "Short free call, Long reviews your notes first, then you get a clear scope and price. Sign or pass, no pressure.", actions: [{ type: 'scroll', target: 'process' }], chips: ['Book a call', 'Leave my email'] };
  }
  if (userTurns >= 2 && !notes.need) notes.need = last.slice(0, 200);
  return {
    ...base,
    stage: userTurns >= 3 ? 'book' : 'discover',
    message: userTurns >= 3
      ? "Sounds like a good one to talk through with Long directly. Want me to pull up his calendar?"
      : "Got it. Tell me a bit more about the business and what you want done, and I'll point you to the right spot.",
    actions: userTurns >= 3 ? [{ type: 'scroll', target: 'book' }] : [],
    chips: userTurns >= 3 ? ['Book a call', 'Leave my email'] : ['A website', 'AI or automation', 'A custom app'],
  };
}
