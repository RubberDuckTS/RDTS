/**
 * The site guide, browser side. Opens agent-first, keeps the conversation
 * across pages (sessionStorage), runs the guide's actions (scroll, navigate,
 * open booking, open the lead form), and falls back to the scripted guide when
 * the API is unreachable, so the panel never goes silent.
 */
import { GREETING, scriptedReply } from '../lib/guide/scripted';
import type { GuideAction, GuideLeadNotes, GuideReply, GuideTurn } from '../lib/guide/types';
import { BOOKING_URL } from '../lib/guide/kb';

type View = 'chat' | 'book' | 'lead' | 'booked';
interface State {
  turns: GuideTurn[];
  chips: string[];
  notes: GuideLeadNotes;
  open: boolean;
  dismissed: boolean;
  view: View;
  nudged: string[];
  voice: boolean;
}

const KEY = 'rdts-guide-v1';
const API = (window as unknown as { RDTS_GUIDE_API?: string }).RDTS_GUIDE_API ?? '/api/guide/';
const OFFLINE = (window as unknown as { RDTS_GUIDE_OFFLINE?: boolean }).RDTS_GUIDE_OFFLINE === true;

// Static previews (Claude artifact) serve pages as files under a base path.
function pageHref(path: string): string {
  if (!OFFLINE) return path;
  const base = (window as unknown as { RDTS_BASE?: string }).RDTS_BASE ?? '';
  const [p, hash] = path.split('#');
  const file = p.replace(/^\//, '') + (p.endsWith('/') ? 'index.html' : '');
  return base + file + (hash ? '#' + hash : '');
}

function track(name: string, data: Record<string, unknown> = {}) {
  const va = (window as unknown as { va?: (e: string, d: unknown) => void }).va;
  if (va) va('event', { name, data: { ...data, path: location.pathname } });
}

function load(): State | null {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function initGuide(root: HTMLElement) {
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const panel = $('[data-g-panel]');
  const log = $('[data-g-log]');
  const chipsEl = $('[data-g-chips]');
  const form = $<HTMLFormElement>('[data-g-form]');
  const input = $<HTMLInputElement>('[data-g-input]');
  const launcher = $<HTMLButtonElement>('[data-g-launch]');
  const peek = $('[data-g-peek]');
  const bookEl = $('[data-g-book]');
  const leadEl = $('[data-g-lead]');
  const bookedEl = $('[data-g-booked]');
  const micBtn = $<HTMLButtonElement>('[data-g-mic]');
  const voiceBtn = $<HTMLButtonElement>('[data-g-voice]');
  const typing = $('[data-g-typing]');

  const firstVisit = !load();
  const state: State = load() ?? {
    turns: [{ role: 'assistant', content: GREETING.message }],
    chips: GREETING.chips,
    notes: GREETING.notes,
    open: false,
    dismissed: false,
    view: 'chat',
    nudged: [],
    voice: false,
  };
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  let currentSection: string | null = null;
  let busy = false;

  // ---------- rendering ----------
  function bubble(turn: GuideTurn) {
    const el = document.createElement('div');
    el.className = turn.role === 'assistant' ? 'g-msg g-msg--duck' : 'g-msg g-msg--you';
    el.textContent = turn.content;
    return el;
  }
  function renderLog() {
    log.replaceChildren(...state.turns.map(bubble));
    log.scrollTop = log.scrollHeight;
  }
  function renderChips() {
    chipsEl.replaceChildren(...state.chips.map(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'g-chip';
      b.textContent = c;
      b.addEventListener('click', () => send(c, 'chip'));
      return b;
    }));
  }
  function renderView() {
    root.dataset.view = state.view;
    bookEl.hidden = state.view !== 'book';
    leadEl.hidden = state.view !== 'lead';
    bookedEl.hidden = state.view !== 'booked';
    if (state.view === 'book') mountCalendly();
  }
  function setOpen(open: boolean, why = 'toggle') {
    state.open = open;
    if (!open) state.dismissed = true;
    root.dataset.open = String(open);
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    peek.hidden = open || state.dismissed;
    if (open) {
      renderLog();
      setTimeout(() => (window.matchMedia('(pointer: fine)').matches ? input.focus() : null), 50);
      track('guide_open', { why });
    }
    save();
  }
  function say(text: string) {
    window.dispatchEvent(new CustomEvent('guide:speaking'));
    if (state.voice && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      speechSynthesis.speak(u);
    }
    const peekText = peek.querySelector('[data-g-peek-text]');
    if (peekText) peekText.textContent = text;
  }

  // ---------- actions ----------
  function highlight(el: Element) {
    el.classList.remove('g-spotlight');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('g-spotlight');
  }
  function runActions(actions: GuideAction[]) {
    for (const a of actions) {
      if (a.type === 'scroll') {
        const el = document.getElementById(`s-${a.target}`);
        if (el) {
          const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          highlight(el);
          // On phones, get the panel out of the way so they can see what it pointed at.
          if (window.innerWidth < 640 && state.view === 'chat') { state.open = false; root.dataset.open = 'false'; panel.hidden = true; peek.hidden = false; save(); }
        } else {
          save();
          location.href = pageHref(`/#s-${a.target}`);
          return;
        }
      } else if (a.type === 'navigate' && a.href !== location.pathname && !(OFFLINE && location.pathname.endsWith(a.href + 'index.html'))) {
        save();
        track('guide_navigate', { to: a.href });
        location.href = pageHref(a.href);
        return;
      } else if (a.type === 'book') {
        state.view = 'book';
        track('guide_book_open');
      } else if (a.type === 'lead_form') {
        state.view = 'lead';
      }
    }
    renderView();
    save();
  }

  // ---------- talking ----------
  async function ask(): Promise<GuideReply> {
    if (OFFLINE) {
      // Preview as a Claude artifact: ask Claude through the artifact runtime.
      const { artifactRuntime, askViaArtifact } = await import('./guide-sample');
      if (artifactRuntime()) {
        const r = await askViaArtifact(state.turns, state.notes, currentSection);
        if (r) return r;
      }
      await new Promise(r => setTimeout(r, 350));
      return scriptedReply(state.turns, state.notes);
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 14000);
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: state.turns, page: location.pathname, section: currentSection, notes: state.notes }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as GuideReply;
    } catch {
      return scriptedReply(state.turns, state.notes);
    }
  }

  async function send(text: string, via: 'typed' | 'chip' | 'voice' = 'typed') {
    text = text.trim();
    if (!text || busy) return;
    if (!state.open) setOpen(true, via);
    busy = true;
    state.turns.push({ role: 'user', content: text.slice(0, 1200) });
    state.chips = [];
    renderLog();
    renderChips();
    typing.hidden = false;
    track('guide_message', { via, n: state.turns.filter(t => t.role === 'user').length });
    const reply = await ask();
    typing.hidden = true;
    state.turns.push({ role: 'assistant', content: reply.message });
    state.chips = reply.chips ?? [];
    state.notes = reply.notes ?? state.notes;
    renderLog();
    renderChips();
    say(reply.message);
    busy = false;
    save();
    runActions(reply.actions ?? []);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    send(v);
  });

  // ---------- booking ----------
  let calendlyMounted = false;
  function bookingUrl() {
    const u = new URL(BOOKING_URL);
    const n = state.notes;
    const shape = n.shape && n.shape !== 'unsure' ? n.shape : '';
    // Prefill Long's existing Calendly questions: reason, topic, source.
    u.searchParams.set('a1', /consult|train|retainer/i.test(shape) ? 'Consultation' : 'Project proposal');
    const summary = [n.need, n.business && `Business: ${n.business}`, n.timeline && `Timeline: ${n.timeline}`, shape && `Type: ${shape}`]
      .filter(Boolean).join(' | ').slice(0, 900);
    if (summary) u.searchParams.set('a2', summary);
    u.searchParams.set('a5', 'Portfolio website');
    u.searchParams.set('hide_gdpr_banner', '1');
    u.searchParams.set('background_color', '161b22');
    u.searchParams.set('text_color', 'f5efe0');
    u.searchParams.set('primary_color', 'ffc83d');
    u.searchParams.set('embed_type', 'Inline');
    u.searchParams.set('embed_domain', location.host || 'rubberducktechsolutions.com');
    return u.toString();
  }
  function mountCalendly() {
    const frameWrap = bookEl.querySelector('[data-g-cal]') as HTMLElement;
    const link = bookEl.querySelector('[data-g-cal-link]') as HTMLAnchorElement;
    link.href = bookingUrl();
    if (calendlyMounted) return;
    calendlyMounted = true;
    if (OFFLINE) {
      // Previews can't frame other sites, so hand off to Calendly in a new tab.
      const p = document.createElement('div');
      p.className = 'g-cal-handoff';
      p.innerHTML = '<p>Pick any open slot on Long\'s calendar. Your notes from this chat ride along.</p>';
      const a = document.createElement('a');
      a.className = 'btn btn-primary';
      a.href = bookingUrl();
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = "Open Long's calendar →";
      p.appendChild(a);
      frameWrap.replaceChildren(p);
      return;
    }
    const f = document.createElement('iframe');
    f.src = bookingUrl();
    f.title = 'Book a call with Long Nguyen';
    f.loading = 'lazy';
    f.setAttribute('allow', 'payment');
    frameWrap.replaceChildren(f);
  }
  window.addEventListener('message', e => {
    if (!/calendly\.com$/.test(new URL(e.origin || 'https://x.invalid').hostname)) return;
    const ev = (e.data as { event?: string })?.event;
    if (ev === 'calendly.event_scheduled') {
      state.view = 'booked';
      state.turns.push({ role: 'assistant', content: "You're booked. Long gets your notes before the call, and the invite is in your inbox." });
      track('guide_booked');
      renderLog();
      renderView();
      save();
    }
  });

  // ---------- lead form ----------
  const leadForm = leadEl.querySelector('form') as HTMLFormElement;
  const leadStatus = leadEl.querySelector('[data-g-lead-status]') as HTMLElement;
  leadForm.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(leadForm);
    const n = state.notes;
    const payload = {
      name: String(fd.get('name') || ''),
      email: String(fd.get('email') || ''),
      company: String(fd.get('company') || ''),
      honeypot: String(fd.get('website') || ''),
      spec: {
        shape: n.shape || 'unsure', team_size: null, budget_range: null, budget_flex: 'unknown',
        current_stack: null, current_pain: n.need, urgency: n.timeline, scope_proposed: n.business ? `For: ${n.business}` : null,
        hard_no_triggered: false, name: null, email: null,
      },
      transcript: state.turns.slice(-40).map(t => ({ role: t.role === 'assistant' ? 'duck' : 'visitor', text: t.content.slice(0, 4000) })),
    };
    leadStatus.textContent = 'Sending…';
    try {
      if (OFFLINE) throw new Error('preview');
      const res = await fetch('/api/lead/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'failed');
      leadStatus.textContent = 'Sent. Long follows up within 24 hours.';
      state.turns.push({ role: 'assistant', content: 'Got it. Long has your notes and follows up within 24 hours.' });
      track('guide_lead_sent');
      state.view = 'chat';
      renderLog();
      renderView();
      save();
    } catch (err) {
      leadStatus.textContent = (err as Error).message === 'preview'
        ? 'Preview mode: nothing was sent.'
        : "That didn't go through. Email long@rubberducktechsolutions.com and it reaches him directly.";
    }
  });

  // ---------- voice (browser speech, no extra cost) ----------
  type Rec = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
  const SR = (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
  if (!SR) micBtn.hidden = true;
  let rec: Rec | null = null;
  micBtn.addEventListener('click', () => {
    if (!SR) return;
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    micBtn.setAttribute('aria-pressed', 'true');
    rec.onresult = e => { const t = e.results[0][0].transcript; state.voice = true; voiceBtn.setAttribute('aria-pressed', 'true'); send(t, 'voice'); };
    rec.onend = rec.onerror = () => { rec = null; micBtn.setAttribute('aria-pressed', 'false'); };
    rec.start();
  });
  if (!('speechSynthesis' in window)) voiceBtn.hidden = true;
  voiceBtn.setAttribute('aria-pressed', String(state.voice));
  voiceBtn.addEventListener('click', () => {
    state.voice = !state.voice;
    voiceBtn.setAttribute('aria-pressed', String(state.voice));
    if (!state.voice) speechSynthesis.cancel();
    save();
  });

  // ---------- wiring ----------
  launcher.addEventListener('click', () => setOpen(!state.open, 'launcher'));
  root.querySelector('[data-g-close]')?.addEventListener('click', () => setOpen(false));
  root.querySelectorAll('[data-g-back]').forEach(b => b.addEventListener('click', () => { state.view = 'chat'; renderView(); save(); }));
  peek.querySelector('[data-g-peek-open]')?.addEventListener('click', () => setOpen(true, 'peek'));
  peek.querySelector('[data-g-peek-x]')?.addEventListener('click', () => { state.dismissed = true; peek.hidden = true; save(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.open) setOpen(false); });

  // Any element on the site can open the guide or jump straight to booking.
  document.addEventListener('click', e => {
    const t = (e.target as HTMLElement)?.closest?.('[data-guide-open],[data-guide-book],[data-guide-ask]') as HTMLElement | null;
    if (!t) return;
    e.preventDefault();
    if (t.hasAttribute('data-guide-book')) { state.view = 'book'; setOpen(true, 'cta_book'); renderView(); track('guide_book_open', { from: 'cta' }); }
    else if (t.dataset.guideAsk) send(t.dataset.guideAsk, 'chip');
    else setOpen(true, 'cta');
  });
  window.addEventListener('guide:open', () => setOpen(true, 'duck'));

  // Know which chapter they're reading, and nudge once at the good moments.
  const sections = document.querySelectorAll<HTMLElement>('[data-guide-section]');
  const nudges: Record<string, string> = {
    proof: 'Want the short version of what Long could build for you? Ask me.',
    process: "This is where it gets easy: a free call, he reads your notes first. Want his calendar?",
  };
  if (sections.length) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        currentSection = e.target.getAttribute('data-guide-section');
        const msg = currentSection && nudges[currentSection];
        if (msg && !state.open && !state.nudged.includes(currentSection!) && state.turns.length < 3) {
          state.nudged.push(currentSection!);
          state.dismissed = false;
          peek.hidden = false;
          const pt = peek.querySelector('[data-g-peek-text]');
          if (pt) pt.textContent = msg;
          save();
        }
      }
    }, { threshold: 0.35 });
    sections.forEach(s => io.observe(s));
  }

  // ---------- boot: agent first ----------
  renderLog();
  renderChips();
  renderView();
  const peekText = peek.querySelector('[data-g-peek-text]');
  if (peekText) peekText.textContent = state.turns[state.turns.length - 1]?.content ?? GREETING.message;
  root.dataset.ready = 'true';
  if (state.open) setOpen(true, 'restore');
  else if (firstVisit) {
    // Desktop: open the panel. Phones: a greeting bubble that doesn't cover the page.
    const greet = () => {
      if (window.innerWidth >= 1024) setOpen(true, 'auto');
      else { peek.hidden = false; }
      say(GREETING.message);
    };
    // On the homepage the opening shot plays first; the guide opens once the headline has landed.
    if (document.documentElement.classList.contains('intro')) {
      let done = false;
      const go = () => { if (done) return; done = true; setTimeout(greet, 900); };
      window.addEventListener('scene:intro-done', go, { once: true });
      setTimeout(go, 7000);
    } else setTimeout(greet, 1400);
  } else {
    peek.hidden = state.dismissed;
  }
}
