# Cline Guide + Answer-Duck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a page-aware, vetted-first "answer-duck" on `/solutions/cline-setup/`, backed by a single per-tool knowledge module that also deepens the crawlable page — proving a template that later guides reuse.

**Architecture:** A new `POST /api/ask` serverless route mirrors the existing `/api/scope` (Haiku, strict-JSON-via-prefill, same response shape) but grounds its system prompt in a typed per-tool knowledge module (`src/lib/duck-knowledge/cline.ts`) via context injection — no vector DB. That same module renders the page's reference sections + expanded FAQ. An `<AskDuck>` component adapts the `/talk` chat client; on a buying signal it reuses the existing lead form → `/api/lead` → Resend path unchanged. A shared `duck-persona.ts` keeps one voice across both prompts. Upstash Redis rate-limits both public endpoints.

**Tech Stack:** Astro 5 (static + `@astrojs/vercel`, `prerender = false` routes), `@anthropic-ai/sdk`, Resend, `@upstash/ratelimit` + `@upstash/redis` (new), Vitest (new, dev), Tailwind.

## Global Constraints

- Model is `claude-haiku-4-5-20251001` (copy from existing routes; never hardcode a different id).
- All API routes: `export const prerender = false;`.
- `trailingSlash: 'always'` — every internal fetch/link URL MUST end with `/` (e.g. `fetch('/api/ask/')`).
- Duck copy obeys the persona: BANNED words — `leverage, synergy, AI-powered, transformation, journey, unlock, empower, revolutionize`; BANNED SaaS tropes — "trusted by leading teams", "get started in minutes", "the future of X". One question per turn; 1–3 sentences; second person; active voice.
- **Never invent facts.** Vetted content ships only after Claude↔Codex peer review + Long's sign-off (Task 3).
- Design system only (no new colors): `card-cream`, `cream-border`, `cream-light`, `coal`/`coal-dim`/`coal-mute`, `saffron`/`saffron-shadow`, `bone`/`bone-dim`, `btn btn-primary`/`btn-dark`/`btn-outline-dark`, `status-pill`/`status-pill__dot`, `font-mono`, `tracking-spec`, `rounded-soft`, `display-h2`/`display-h3`, `prose-rdts`, `Section` component.
- Do not modify `/api/lead.ts`, `email.ts`, or the `/talk` page's behavior. Reuse them.
- Env (existing): `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RDTS_INBOX`, `RDTS_FROM`. Env (new): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Commit after every task. Work in `site/` (the git repo). Nothing deploys without Long's OK.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/duck-persona.ts` (new) | Shared persona/voice/BANNED/Long-facts string, imported by both prompts |
| `src/lib/prompts.ts` (modify) | Recompose `SCOPING_SYSTEM_PROMPT` to interpolate `DUCK_PERSONA` (no behavioral change) |
| `src/lib/duck-knowledge/types.ts` (new) | `ToolKnowledge` interface + `serializeKnowledge()` |
| `src/lib/duck-knowledge/cline.ts` (new) | Vetted Cline knowledge (reference + faqs) — the single source |
| `src/lib/duck-knowledge/index.ts` (new) | `getKnowledge(topic)` registry |
| `src/lib/ask-prompt.ts` (new) | `buildAskSystemPrompt(knowledge)` + answer/handoff rules + `tryParseAsk()` |
| `src/lib/ratelimit.ts` (new) | `checkRateLimit(ip)` Upstash wrapper, fail-open |
| `src/pages/api/ask.ts` (new) | The answer-duck endpoint |
| `src/pages/api/scope.ts` (modify) | Add the shared rate-limit guard |
| `src/components/AskDuck.astro` (new) | Inline box + chat client + lead-form handoff |
| `src/pages/solutions/cline-setup.astro` (modify) | Render reference+FAQ from `cline.ts`, add video slot, drop in `<AskDuck>` |
| `package.json` (modify) | Add deps + `test` script |
| `vitest.config.ts` (new) | Vitest config |
| `src/lib/**/*.test.ts` (new) | Unit tests for the pure logic |

**Verification model:** pure logic (serializer, prompt builder, parser, rate-limit) → Vitest. Model-driven behavior (answers, handoff decisions) and UI → browser preview (`preview_start` name `dev`), because they aren't deterministic unit tests. Every task that changes shipped code ends with `npm run build` passing.

---

### Task 1: Shared persona module

Extract the cleanly-separable shared blocks from `SCOPING_SYSTEM_PROMPT` into a reusable constant, and recompose the scope prompt from it. A characterization test proves the scope prompt's invariants are unchanged.

**Files:**
- Create: `src/lib/duck-persona.ts`
- Modify: `src/lib/prompts.ts` (the persona/voice/BANNED/vocabulary blocks of `SCOPING_SYSTEM_PROMPT`)
- Create: `package.json` test script + `vitest.config.ts`
- Test: `src/lib/duck-persona.test.ts`

**Interfaces:**
- Produces: `export const DUCK_PERSONA: string` — contains the Long/RDTS description, the 5 persona rules, voice rules, BANNED words, BANNED SaaS tropes, and the vocabulary-mirror rule. `SCOPING_SYSTEM_PROMPT` unchanged in externally-observable content.

- [ ] **Step 1: Add Vitest + test script**

Modify `package.json` — add to `scripts` and `devDependencies`:
```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "astro": "astro",
  "test": "vitest run"
},
```
Then: `cd site && npm i -D vitest@^2`

Create `site/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/duck-persona.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DUCK_PERSONA } from './duck-persona';
import { SCOPING_SYSTEM_PROMPT } from './prompts';

const BANNED = ['leverage', 'synergy', 'AI-powered', 'transformation', 'journey', 'unlock', 'empower', 'revolutionize'];

describe('DUCK_PERSONA', () => {
  it('carries the shared voice invariants', () => {
    expect(DUCK_PERSONA).toContain('long@rubberducktechsolutions.com');
    expect(DUCK_PERSONA).toContain('Mirror the buyer');
    expect(DUCK_PERSONA).toMatch(/One question per turn|One question/);
    for (const w of BANNED) expect(DUCK_PERSONA).toContain(w);
  });

  it('the scope prompt still contains every persona invariant (no drift)', () => {
    expect(SCOPING_SYSTEM_PROMPT).toContain('long@rubberducktechsolutions.com');
    expect(SCOPING_SYSTEM_PROMPT).toContain('Mirror the buyer');
    for (const w of BANNED) expect(SCOPING_SYSTEM_PROMPT).toContain(w);
    // Intake-specific content that must survive the refactor:
    expect(SCOPING_SYSTEM_PROMPT).toContain('ready_for_lead');
    expect(SCOPING_SYSTEM_PROMPT).toContain('hard_no_triggered');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd site && npx vitest run src/lib/duck-persona.test.ts`
Expected: FAIL — cannot resolve `./duck-persona`.

- [ ] **Step 4: Create the persona module**

Create `src/lib/duck-persona.ts`. Copy the shared blocks **verbatim** from the current `SCOPING_SYSTEM_PROMPT` (the opening Long/RDTS description paragraph, `# Persona / voice (FIVE RULES)`, `# Voice rules`, `# BANNED words`, `# BANNED SaaS tropes`, `# BANNED phrases / anti-patterns`, `# Vocabulary rule (CRITICAL)`), plus the `long@rubberducktechsolutions.com` fact:
```ts
/** Shared duck persona — voice, banned words, vocabulary rule, core RDTS facts.
 *  Imported by both the scoping prompt (prompts.ts) and the answer prompt (ask-prompt.ts)
 *  so the two ducks never drift in voice. */
export const DUCK_PERSONA = `You are "the duck" for Rubber Duck Tech Solutions (RDTS), run solo by Long Nguyen. Long is an AI-focused developer and consultant: he builds custom software/websites (increasingly AI-infused), wires AI into how teams work, consults and trains technical AND creative teams, and for some teams embeds as their ongoing senior AI person.

# Core facts (DO NOT INVENT)
- Long's email: long@rubberducktechsolutions.com (full domain — NEVER shorten).
- Studio site: rubberducktechsolutions.com
- If you don't know a fact, say so and point at long@rubberducktechsolutions.com. Never invent.
- NEVER invent client results, case studies, metrics, timelines, or specific outcomes.

# Persona / voice (FIVE RULES)
1. Direct and opinionated. No filler.
2. Read shape before asking shape. Infer from the buyer's language; never ask them to classify.
3. Say "no" without apology.
4. Be honest about what fits.
5. Duck identity is light-touch. Introduce as duck once or twice, then drop it. No quacking.

# Voice rules
- Second person ("your team"), never "we".
- One question per turn — NEVER two.
- Replies are 1–3 sentences max. Active voice. Numbers when honest.

# BANNED words (never use)
leverage, synergy, AI-powered, transformation, journey, unlock, empower, revolutionize.

# BANNED SaaS tropes
"trusted by leading teams", "get started in minutes", "the future of X".

# BANNED phrases / anti-patterns
"I'd recommend...", "I'd love to...", "Happy to help!", "Great question.", "Let me know if...", hedging, quacking, two questions in one turn.

# Vocabulary rule (CRITICAL)
Mirror the buyer's words. NEVER introduce "MCP server", "CLI", "skill", "harness", "agent stack" unless the buyer uses it first. If they say "AI tools" or "Claude", use those words back.`;
```

- [ ] **Step 5: Recompose the scope prompt**

Modify `src/lib/prompts.ts`: `import { DUCK_PERSONA } from './duck-persona';` at top, and interpolate it where the persona blocks were, keeping ALL intake-specific sections (Hard facts about lead handoff, Engagement shapes, Fit signals, Conversation flow, Fast-track, Handing off, Fit assessment, Hard-no list, Wrapping up, Output format). The result must still contain the strings the test asserts. Convert the export to a template literal:
```ts
export const SCOPING_SYSTEM_PROMPT = `${DUCK_PERSONA}

# Duck job (intake mode)
Your job is to understand what the visitor needs and capture the lead. You are NOT a gatekeeper — you route almost everyone to the form.

# Hard facts (DO NOT INVENT)
- YOU CANNOT CONTACT LONG YOURSELF. ...(keep the full existing lead-handoff facts verbatim)...
...(keep every remaining intake-specific section of the current prompt verbatim: Engagement shapes, Fit signals, Conversation flow, Fast-track, Handing off to the form, Fit assessment logic, Honesty/anti-upsell, Hard-no list, Wrapping up, Closing line, Output format — STRICT + all JSON rules)...`;
```
Leave `INTAKE_BRIEF_SYSTEM_PROMPT` untouched.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd site && npx vitest run src/lib/duck-persona.test.ts`
Expected: PASS (both tests).

- [ ] **Step 7: Verify build + scope route still compiles**

Run: `cd site && npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 8: Commit**
```bash
cd site && git add package.json vitest.config.ts src/lib/duck-persona.ts src/lib/duck-persona.test.ts src/lib/prompts.ts
git commit -m "refactor: extract shared DUCK_PERSONA; add vitest"
```

---

### Task 2: Knowledge module — types, serializer, registry

**Files:**
- Create: `src/lib/duck-knowledge/types.ts`
- Create: `src/lib/duck-knowledge/cline.ts` (skeleton; real content in Task 3)
- Create: `src/lib/duck-knowledge/index.ts`
- Test: `src/lib/duck-knowledge/duck-knowledge.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface KnowledgeQA { q: string; a: string }
  interface KnowledgeSection { heading: string; body: string }
  interface ToolKnowledge {
    tool: string;            // "Cline"
    slug: string;            // "cline"
    aliases: string[];       // ["cline", "claude dev"]
    intro: string;
    reference: KnowledgeSection[];
    faqs: KnowledgeQA[];
  }
  function serializeKnowledge(k: ToolKnowledge): string
  function getKnowledge(topic: string): ToolKnowledge | null
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/duck-knowledge/duck-knowledge.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { serializeKnowledge } from './types';
import { getKnowledge } from './index';

describe('duck-knowledge', () => {
  it('getKnowledge resolves cline by slug and alias, null otherwise', () => {
    expect(getKnowledge('cline')?.tool).toBe('Cline');
    expect(getKnowledge('Cline')?.slug).toBe('cline');
    expect(getKnowledge('nope')).toBeNull();
  });

  it('serializeKnowledge includes intro, every reference heading, and every FAQ', () => {
    const k = getKnowledge('cline')!;
    const text = serializeKnowledge(k);
    expect(text).toContain(k.intro);
    for (const s of k.reference) expect(text).toContain(s.heading);
    for (const f of k.faqs) { expect(text).toContain(f.q); expect(text).toContain(f.a); }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd site && npx vitest run src/lib/duck-knowledge/duck-knowledge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create types + serializer**

Create `src/lib/duck-knowledge/types.ts`:
```ts
export interface KnowledgeQA { q: string; a: string }
export interface KnowledgeSection { heading: string; body: string }
export interface ToolKnowledge {
  tool: string;
  slug: string;
  aliases: string[];
  intro: string;
  reference: KnowledgeSection[];
  faqs: KnowledgeQA[];
}

/** Flatten a knowledge module into the text block injected as the duck's grounding. */
export function serializeKnowledge(k: ToolKnowledge): string {
  const ref = k.reference.map(s => `## ${s.heading}\n${s.body}`).join('\n\n');
  const faq = k.faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
  return `# ${k.tool} — vetted knowledge\n\n${k.intro}\n\n# Reference\n\n${ref}\n\n# FAQ\n\n${faq}`;
}
```

- [ ] **Step 4: Create the cline skeleton**

Create `src/lib/duck-knowledge/cline.ts` (placeholder content filled in Task 3 — enough to pass structure tests now):
```ts
import type { ToolKnowledge } from './types';

export const cline: ToolKnowledge = {
  tool: 'Cline',
  slug: 'cline',
  aliases: ['cline', 'claude dev'],
  intro: 'Cline is an open-source, model-agnostic AI coding assistant that runs as a VS Code extension: you bring your own API key and it drives the editor through tool calls you approve.',
  reference: [
    { heading: 'Model routing per task type', body: 'PLACEHOLDER — filled and vetted in Task 3.' },
  ],
  faqs: [
    { q: 'What is a .clineignore file?', a: 'PLACEHOLDER — filled and vetted in Task 3.' },
  ],
};
```

- [ ] **Step 5: Create the registry**

Create `src/lib/duck-knowledge/index.ts`:
```ts
import type { ToolKnowledge } from './types';
import { cline } from './cline';

const REGISTRY: ToolKnowledge[] = [cline];

/** Resolve a topic string (slug or alias, case-insensitive) to its knowledge module. */
export function getKnowledge(topic: string): ToolKnowledge | null {
  const t = (topic || '').trim().toLowerCase();
  return REGISTRY.find(k => k.slug === t || k.aliases.includes(t)) ?? null;
}

export type { ToolKnowledge } from './types';
export { serializeKnowledge } from './types';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd site && npx vitest run src/lib/duck-knowledge/duck-knowledge.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
cd site && git add src/lib/duck-knowledge/
git commit -m "feat: duck-knowledge types, serializer, registry (cline skeleton)"
```

---

### Task 3: Vetted Cline knowledge content (Claude drafts → Codex peer-review → Long sign-off)

This is a **content + review** task, not a code task. Its deliverable is a fully-populated, fact-checked `src/lib/duck-knowledge/cline.ts`. The "test" is the peer-review gate, not an assertion.

**Files:**
- Modify: `src/lib/duck-knowledge/cline.ts` (fill `reference` + `faqs`)

- [ ] **Step 1: Claude drafts the content**

Fill `reference[]` and `faqs[]` covering the GSC query cluster, each answer in Long's voice (persona rules apply), each a real answer:
- Reference sections: Model routing per task type; Workspace context & `.clineignore`; File/command approval policy (auto-approve); MCP server configuration; Running Cline (install, VS Code extension, no-account/local models via Ollama/LM Studio); Model selection & IDs; Modes / custom modes; Temperature & other model settings; Cost control.
- FAQs (mirror real queries): "What is a `.clineignore` file?", "How do I stop Cline from auto-approving changes?", "Which model should Cline use for which task?", "How do I set the temperature / model settings?", "Can I run Cline without an account?", "How do I configure an MCP server in Cline?", "Cline vs Cursor vs Claude Code?", "Why is Cline slow / burning credits?", "What are Cline modes?".

- [ ] **Step 2: Codex peer-review for factual accuracy**

Run the draft through Codex as an accuracy reviewer. Determine the invocation at execution time — check availability first: `command -v codex`. If headless review is supported (`codex exec "<review prompt>"`), pipe the file and a prompt like: *"You are fact-checking a knowledge file about the Cline VS Code extension. For every config claim (flag names, file names like .clineignore, default values, model-routing behavior, MCP setup steps, how to run without an account), confirm it is accurate against the current Cline, or flag it as wrong/unverifiable. Be specific."* If headless isn't available, Long relays the file to Codex manually. Capture Codex's findings.

- [ ] **Step 3: Reconcile**

Address every Codex flag: correct it, or cut the claim if it can't be verified (conservative reading wins — a "not sure" answer that routes to Long is better than a wrong config). Where Codex and Claude disagree, prefer the verifiable/official-docs reading. (If any Codex-authored knowledge is added later, Claude reviews it the same way — the gate runs both directions.)

- [ ] **Step 4: Long signs off**

Present the reconciled `cline.ts` to Long for final approval. Nothing proceeds past this step without it. Note any answers Long wants softened to "email me for the specifics."

- [ ] **Step 5: Verify structure still passes + build**

Run: `cd site && npx vitest run src/lib/duck-knowledge/ && npm run build`
Expected: PASS + build succeeds (no PLACEHOLDER strings remain).

- [ ] **Step 6: Commit**
```bash
cd site && git add src/lib/duck-knowledge/cline.ts
git commit -m "content: vetted Cline knowledge (Claude draft + Codex review + Long sign-off)"
```

---

### Task 4: Ask-prompt builder + parser

**Files:**
- Create: `src/lib/ask-prompt.ts`
- Test: `src/lib/ask-prompt.test.ts`

**Interfaces:**
- Consumes: `DUCK_PERSONA` (Task 1), `serializeKnowledge` + `ToolKnowledge` (Task 2).
- Produces:
  ```ts
  function buildAskSystemPrompt(k: ToolKnowledge): string
  interface AskResponse { message: string; spec: Record<string, unknown> | null; ready_for_lead: boolean; session_complete?: boolean; turn_count: number }
  function tryParseAsk(raw: string): AskResponse | null   // same JSON contract as scope
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/ask-prompt.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildAskSystemPrompt, tryParseAsk } from './ask-prompt';
import { getKnowledge } from './duck-knowledge';

describe('ask-prompt', () => {
  const k = getKnowledge('cline')!;

  it('embeds persona, the tool name, the knowledge, and the vetted-first rule', () => {
    const p = buildAskSystemPrompt(k);
    expect(p).toContain('leverage');            // persona present
    expect(p).toContain('Cline');               // tool
    expect(p).toContain(k.faqs[0].q);           // grounding present
    expect(p.toLowerCase()).toContain('not sure'); // vetted-first / route-when-unsure
    expect(p).toContain('ready_for_lead');      // JSON contract
  });

  it('tryParseAsk parses a valid object and rejects junk', () => {
    const ok = tryParseAsk('"message":"hi","spec":null,"ready_for_lead":false,"turn_count":1}');
    expect(ok?.message).toBe('hi');
    expect(tryParseAsk('not json')).toBeNull();
  });
});
```
(Note: `tryParseAsk` re-attaches a leading `{` like `scope.ts`'s `tryParseScope`, so the test input omits it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd site && npx vitest run src/lib/ask-prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/ask-prompt.ts`:
```ts
import { DUCK_PERSONA } from './duck-persona';
import { serializeKnowledge, type ToolKnowledge } from './duck-knowledge';

export interface AskResponse {
  message: string;
  spec: Record<string, unknown> | null;
  ready_for_lead: boolean;
  session_complete?: boolean;
  turn_count: number;
}

export function buildAskSystemPrompt(k: ToolKnowledge): string {
  return `${DUCK_PERSONA}

# Duck job (answer mode)
You are answering a visitor's questions about ${k.tool} on its guide page. Teach first; you are not running sales intake. Help them get unstuck.

# Grounding (authoritative)
Answer from the KNOWLEDGE below. For well-established basics you may use general knowledge, but when you are NOT SURE, when the knowledge doesn't cover it, or when a wrong detail would cost them, say so plainly and offer Long — do not guess a config flag or default.

<knowledge>
${serializeKnowledge(k)}
</knowledge>

# Handoff (route to Long when it outgrows a chat)
Help-first, never pushy. When the visitor shifts from "how do I…" to a real-work signal — "can you set this up for us", "we're a team drowning in this", "do you do this for people", asks about working with Long, or you've answered a couple of substantive questions and they clearly want it done for them — name it in one line and set ready_for_lead: true. When ready_for_lead is true, a name + email form appears; point them there. NEVER ask for name/email in chat.

# Output format — STRICT
Single JSON object, first character "{". No markdown fences.
{
  "message": "your reply, plain English",
  "spec": {
    "shape": "Software build | Maintenance | AI integration | Consulting | Training | Retainer | Custom | unsure",
    "team_size": null, "budget_range": null, "budget_flex": "unknown",
    "current_stack": "string or null — tools they mention",
    "current_pain": "string or null — what they're trying to do with ${k.tool}, in their words",
    "urgency": null,
    "scope_proposed": "string or null — one line on what Long would do for them, set only at handoff",
    "hard_no_triggered": false, "name": null, "email": null
  },
  "ready_for_lead": false,
  "session_complete": false,
  "turn_count": 1
}
Rules: default shape "unsure"; a tool-setup ask is usually "Software build". Fill current_pain from what they ask. Set ready_for_lead true only on a real-work signal (once true, stays true). turn_count is your turn number. "message" is NEVER empty. Never break out of JSON.`;
}

export function tryParseAsk(raw: string): AskResponse | null {
  const reattached = raw.startsWith('{') ? raw : '{' + raw;
  const cleaned = reattached.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.message === 'string') return parsed as AskResponse;
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd site && npx vitest run src/lib/ask-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
cd site && git add src/lib/ask-prompt.ts src/lib/ask-prompt.test.ts
git commit -m "feat: answer-duck system prompt builder + parser"
```

---

### Task 5: Rate limiter (Upstash, fail-open)

**Files:**
- Create: `src/lib/ratelimit.ts`
- Modify: `package.json` (deps)
- Test: `src/lib/ratelimit.test.ts`

**Interfaces:**
- Produces: `function checkRateLimit(ip: string): Promise<{ ok: boolean }>` — allows when under limit; blocks when over; **fails open** (returns `{ ok: true }`) if Redis is unreachable or unconfigured, logging a warning.

- [ ] **Step 1: Add deps**

`cd site && npm i @upstash/ratelimit @upstash/redis`

- [ ] **Step 2: Write the failing test**

Create `src/lib/ratelimit.test.ts` (inject a fake limiter so no network/env needed):
```ts
import { describe, it, expect, vi } from 'vitest';
import { makeRateLimiter } from './ratelimit';

describe('rate limiter', () => {
  it('allows under the limit', async () => {
    const check = makeRateLimiter({ limit: async () => ({ success: true }) } as any);
    expect(await check('1.2.3.4')).toEqual({ ok: true });
  });
  it('blocks over the limit', async () => {
    const check = makeRateLimiter({ limit: async () => ({ success: false }) } as any);
    expect(await check('1.2.3.4')).toEqual({ ok: false });
  });
  it('fails open when the limiter throws', async () => {
    const check = makeRateLimiter({ limit: async () => { throw new Error('redis down'); } } as any);
    expect(await check('1.2.3.4')).toEqual({ ok: true });
  });
  it('fails open when no limiter is configured', async () => {
    const check = makeRateLimiter(null);
    expect(await check('1.2.3.4')).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd site && npx vitest run src/lib/ratelimit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/lib/ratelimit.ts`:
```ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Limiter = Pick<Ratelimit, 'limit'> | null;

/** Build the check fn from any limiter-like object (real or fake). Fail-open. */
export function makeRateLimiter(limiter: Limiter) {
  return async function check(ip: string): Promise<{ ok: boolean }> {
    if (!limiter) return { ok: true };
    try {
      const { success } = await limiter.limit(ip);
      return { ok: success };
    } catch (err) {
      console.warn('[ratelimit] limiter error — failing open:', err);
      return { ok: true };
    }
  };
}

const url = import.meta.env.UPSTASH_REDIS_REST_URL;
const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN;

const realLimiter: Limiter =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        // 30 requests / 10 minutes per IP — generous for a human, caps a script.
        limiter: Ratelimit.slidingWindow(30, '10 m'),
        prefix: 'rdts-duck',
      })
    : null;

export const checkRateLimit = makeRateLimiter(realLimiter);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd site && npx vitest run src/lib/ratelimit.test.ts`
Expected: PASS (all 4).

- [ ] **Step 6: Commit**
```bash
cd site && git add package.json package-lock.json src/lib/ratelimit.ts src/lib/ratelimit.test.ts
git commit -m "feat: Upstash rate limiter (fail-open)"
```

---

### Task 6: `/api/ask` endpoint

**Files:**
- Create: `src/pages/api/ask.ts`

**Interfaces:**
- Consumes: `buildAskSystemPrompt`, `tryParseAsk`, `type AskResponse` (Task 4); `getKnowledge` (Task 2); `checkRateLimit` (Task 5).
- Produces: `POST /api/ask` — body `{ topic: string, messages: ChatMessage[] }`, response `AskResponse`.

- [ ] **Step 1: Implement (mirrors `scope.ts`)**

Create `src/pages/api/ask.ts`:
```ts
import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { buildAskSystemPrompt, tryParseAsk, type AskResponse } from '../../lib/ask-prompt';
import { getKnowledge } from '../../lib/duck-knowledge';
import { checkRateLimit } from '../../lib/ratelimit';

export const prerender = false;

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;
const MAX_USER_TURNS = 8;

interface ChatMessage { role: 'user' | 'assistant'; content: string }

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : '') || request.headers.get('x-real-ip') || 'unknown';
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

  const knowledge = getKnowledge(body.topic || '');
  if (!knowledge) return jsonResponse({ error: 'Unknown topic' }, 400);

  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) return jsonResponse({ error: 'messages required' }, 400);
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
```

- [ ] **Step 2: Verify build**

Run: `cd site && npm run build`
Expected: build succeeds; `/api/ask` compiles.

- [ ] **Step 3: Smoke-test the endpoint against the dev server**

Start the dev server via the preview tool (`preview_start` name `dev`, or `npm run dev`), then:
```bash
curl -s -X POST http://localhost:4321/api/ask/ -H 'Content-Type: application/json' \
  -d '{"topic":"cline","messages":[{"role":"user","content":"what is a .clineignore file?"}]}' | head -c 400
```
Expected: a JSON object with a non-empty `message` grounded in the vetted answer, `ready_for_lead:false`. (Requires `ANTHROPIC_API_KEY` in `site/.env`.)

- [ ] **Step 4: Commit**
```bash
cd site && git add src/pages/api/ask.ts
git commit -m "feat: /api/ask answer-duck endpoint"
```

---

### Task 7: Rate-limit `/api/scope`

**Files:**
- Modify: `src/pages/api/scope.ts`

- [ ] **Step 1: Add the guard**

In `src/pages/api/scope.ts`, add `import { checkRateLimit } from '../../lib/ratelimit';`, add the `clientIp` helper (copy from `ask.ts`), and immediately after the API-key check in `POST`:
```ts
  const { ok } = await checkRateLimit(clientIp(request));
  if (!ok) return jsonResponse({ error: "You've hit the limit. Email long@rubberducktechsolutions.com directly." }, 429);
```

- [ ] **Step 2: Verify build**

Run: `cd site && npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**
```bash
cd site && git add src/pages/api/scope.ts
git commit -m "feat: rate-limit /api/scope with shared limiter"
```

---

### Task 8: `<AskDuck>` component

Adapts the `/talk` client (thread + composer + lead form) into a self-contained inline component scoped to one topic, POSTing to `/api/ask/` and reusing `/api/lead/` on handoff.

**Files:**
- Create: `src/components/AskDuck.astro`

**Interfaces:**
- Consumes: `POST /api/ask/` (`AskResponse` shape), `POST /api/lead/` (existing).
- Props: `topic: string` (knowledge slug), `toolName: string` (display).

- [ ] **Step 1: Build the component**

Create `src/components/AskDuck.astro`. Markup uses the design system; the `is:inline` script adapts `talk.astro`'s logic (scoped by a root id so multiple could coexist, though v1 has one). Send `{ topic, messages }` to `/api/ask/`; on `ready_for_lead`, reveal the form; on submit, POST `{ name, email, company, honeypot, spec, transcript }` to `/api/lead/`.
```astro
---
interface Props { topic: string; toolName: string }
const { topic, toolName } = Astro.props;
---
<div class="card-cream overflow-hidden flex flex-col max-w-3xl" data-askduck data-topic={topic}>
  <div class="border-b border-cream-border px-5 py-3 flex items-center gap-3 bg-cream-light">
    <span class="status-pill__dot"></span>
    <span class="font-mono text-[11px] tracking-spec uppercase text-coal-dim">Ask the duck about {toolName}</span>
  </div>
  <div class="p-6 lg:p-7 flex flex-col">
    <div data-thread role="log" aria-live="polite" aria-label={`Questions about ${toolName}`} class="flex flex-col space-y-5 mb-5 max-h-[420px] overflow-y-auto">
      <div class="flex gap-3 text-[15px] leading-[1.65] text-coal-dim">
        <span class="font-mono text-[10px] tracking-spec uppercase text-saffron-shadow shrink-0 mt-0.5">Duck</span>
        <span>Ask me anything about {toolName} — config, models, MCP, what breaks. If it needs Long, I'll say so.</span>
      </div>
    </div>
    <form data-composer class="border-t border-cream-border pt-4">
      <label class="sr-only" for={`ask-input-${topic}`}>Ask about {toolName}</label>
      <textarea id={`ask-input-${topic}`} data-input required maxlength="4000"
        class="w-full min-h-[84px] bg-cream-light border border-cream-border p-4 text-[15px] text-coal font-sans resize-y focus:outline-none focus:border-saffron-shadow rounded-soft placeholder:text-coal-mute/70"
        placeholder={`e.g. how do I stop ${toolName} from auto-approving edits?`}></textarea>
      <div class="flex items-center justify-between gap-3 pt-3">
        <span data-status class="font-mono text-[11px] tracking-[0.06em] text-coal-mute">⌘ + Enter to send</span>
        <button data-send type="submit" class="btn btn-dark text-[14px] py-3 px-5">Send →</button>
      </div>
    </form>
    <!-- Lead form (hidden until handoff) -->
    <form data-lead-form class="hidden flex-col gap-3 border-t border-cream-border pt-4 mt-4">
      <p class="text-[13px] text-coal-dim">Sounds like one for Long. Drop your name + email and he'll follow up within 24 hours.</p>
      <input data-lead-name name="name" type="text" required maxlength="200" placeholder="Name"
        class="w-full bg-cream-light border border-cream-border px-3 py-2 text-[14px] text-coal rounded-soft focus:outline-none focus:border-saffron-shadow"/>
      <input data-lead-email name="email" type="email" required maxlength="200" placeholder="Email"
        class="w-full bg-cream-light border border-cream-border px-3 py-2 text-[14px] text-coal rounded-soft focus:outline-none focus:border-saffron-shadow"/>
      <input data-lead-honeypot name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" class="absolute left-[-9999px] opacity-0 pointer-events-none"/>
      <button data-lead-submit type="submit" class="btn btn-primary text-[13px]">Send to Long</button>
      <p data-lead-error class="hidden text-[12px] text-red-700 font-mono"></p>
    </form>
    <div data-lead-success class="hidden border-t border-cream-border pt-4 mt-4">
      <p class="text-[14px] text-coal-dim leading-[1.6]">Sent — Long replies within 24 hours. Meanwhile, keep asking here or email <a class="link-coal" href="mailto:long@rubberducktechsolutions.com">long@rubberducktechsolutions.com</a>.</p>
    </div>
  </div>
</div>

<script>
  document.querySelectorAll('[data-askduck]').forEach((root) => {
    const topic = root.getAttribute('data-topic');
    const messages = [];        // { role, content }
    const transcript = [];      // { role: 'duck'|'visitor', text }
    let currentSpec = null, readyForLead = false;

    const $ = (s) => root.querySelector(s);
    const thread = $('[data-thread]'), composer = $('[data-composer]'), input = $('[data-input]');
    const sendBtn = $('[data-send]'), status = $('[data-status]');
    const leadForm = $('[data-lead-form]'), leadError = $('[data-lead-error]'),
          leadSubmit = $('[data-lead-submit]'), leadSuccess = $('[data-lead-success]');

    function append(role, text) {
      const wrap = document.createElement('div');
      wrap.className = 'flex gap-3 text-[15px] leading-[1.65]';
      const tag = document.createElement('span');
      tag.className = 'font-mono text-[10px] tracking-spec uppercase shrink-0 mt-0.5 ' + (role === 'duck' ? 'text-saffron-shadow' : 'text-coal-mute');
      tag.textContent = role === 'duck' ? 'Duck' : 'You';
      const body = document.createElement('span');
      body.className = role === 'duck' ? 'text-coal-dim' : 'text-coal';
      body.textContent = text;
      wrap.append(tag, body);
      thread.append(wrap);
      thread.scrollTop = thread.scrollHeight;
    }
    function setBusy(b) { sendBtn.disabled = b; input.disabled = b; sendBtn.classList.toggle('opacity-50', b); status.textContent = b ? 'duck is thinking…' : '⌘ + Enter to send'; }
    function showLeadForm() { if (leadForm.classList.contains('hidden')) { leadForm.classList.remove('hidden'); leadForm.classList.add('flex'); } }

    async function send(text) {
      messages.push({ role: 'user', content: text });
      transcript.push({ role: 'visitor', text });
      append('visitor', text); input.value = ''; setBusy(true);
      try {
        const res = await fetch('/api/ask/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, messages }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || ('Server error ' + res.status)); }
        const data = await res.json();
        messages.push({ role: 'assistant', content: JSON.stringify(data) });
        const msg = (data.message || '').trim();
        if (msg) { transcript.push({ role: 'duck', text: msg }); append('duck', msg); }
        if (data.spec) currentSpec = data.spec;
        readyForLead = readyForLead || !!data.ready_for_lead;
        if (readyForLead) showLeadForm();
      } catch (err) {
        append('duck', 'Hit a snag (' + err.message + '). Try again, or email long@rubberducktechsolutions.com.');
      } finally { setBusy(false); input.focus(); }
    }

    composer.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value.trim(); if (t && !sendBtn.disabled) send(t); });
    input.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); composer.requestSubmit(); } });

    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault(); leadError.classList.add('hidden');
      const honeypot = root.querySelector('[data-lead-honeypot]').value;
      const name = root.querySelector('[data-lead-name]').value.trim();
      const email = root.querySelector('[data-lead-email]').value.trim();
      if (!name || !email || !currentSpec) return;
      leadSubmit.disabled = true; leadSubmit.textContent = 'Sending…';
      try {
        const res = await fetch('/api/lead/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, honeypot, spec: currentSpec, transcript }) });
        if (!res.ok) { const er = await res.json().catch(() => ({})); throw new Error(er.error || ('Server error ' + res.status)); }
        leadForm.classList.add('hidden'); leadSuccess.classList.remove('hidden');
      } catch (err) {
        leadError.textContent = 'Send failed: ' + err.message; leadError.classList.remove('hidden');
        leadSubmit.disabled = false; leadSubmit.textContent = 'Send to Long';
      }
    });
  });
</script>
```

- [ ] **Step 2: Verify build**

Run: `cd site && npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**
```bash
cd site && git add src/components/AskDuck.astro
git commit -m "feat: <AskDuck> inline answer-duck component"
```

---

### Task 9: Cline page integration (depth + video slot + duck)

Render the reference sections and expanded FAQ from `cline.ts` (single source), add an optional video slot, and drop in `<AskDuck>` — **additively**, keeping the existing sales sections.

**Files:**
- Modify: `src/pages/solutions/cline-setup.astro`

- [ ] **Step 1: Wire the knowledge module into the page**

In the frontmatter, `import AskDuck from '../../components/AskDuck.astro';` and `import { cline } from '../../lib/duck-knowledge/cline';`. Replace the hand-written `faqs` array with `const faqs = cline.faqs;` (the `faqSchema` builder already maps `faqs` → schema — leave it). The existing `<details>` FAQ block already maps over `faqs`, so it now renders the expanded, vetted set automatically.

- [ ] **Step 2: Add a reference section rendered from `cline.reference`**

Insert a new `<Section tone="cream" label="Cline reference">` before the existing FAQ section, rendering the vetted how-to depth:
```astro
  <Section tone="cream" label="Cline, configured — the reference">
    <div class="prose-rdts max-w-3xl">
      <h2 class="display-h2 mb-8">How each part of Cline actually gets set up</h2>
      {cline.reference.map((s) => (
        <div class="mb-8">
          <h3 class="display-h3 text-coal mb-3">{s.heading}</h3>
          <p class="text-coal-dim leading-relaxed">{s.body}</p>
        </div>
      ))}
    </div>
  </Section>
```

- [ ] **Step 3: Add an optional video slot (renders nothing if unset — no layout shift)**

Add near the top of the body a const `const videoUrl: string | null = null;` in frontmatter, and where a walkthrough belongs (after the hero/intro), render only when present:
```astro
  {videoUrl && (
    <Section tone="dark" label="Watch the setup">
      <div class="max-w-3xl aspect-video">
        <iframe src={videoUrl} title="Cline setup walkthrough" loading="lazy" class="w-full h-full rounded-soft border border-cream-border" allowfullscreen></iframe>
      </div>
    </Section>
  )}
```

- [ ] **Step 4: Drop in the answer-duck**

Insert before the FAQ section:
```astro
  <Section tone="dark" label="Ask the duck">
    <div class="max-w-3xl">
      <h2 class="display-h2 text-bone mb-8">Stuck on something specific? Ask.</h2>
      <AskDuck topic="cline" toolName="Cline" />
    </div>
  </Section>
```

- [ ] **Step 5: Verify build + schema**

Run: `cd site && npm run build`
Expected: succeeds. Then grep the built page for the expanded FAQ + FAQPage schema:
```bash
grep -c '"@type":"Question"' dist/solutions/cline-setup/index.html
```
Expected: equals `cline.faqs.length` (the FAQPage schema now covers the full vetted set).

- [ ] **Step 6: Commit**
```bash
cd site && git add src/pages/solutions/cline-setup.astro
git commit -m "feat: deepen Cline page from vetted knowledge + answer-duck + video slot"
```

---

### Task 10: End-to-end browser verification

No new code — prove the feature works in a real browser and capture evidence.

**Files:** none (verification only).

- [ ] **Step 1: Serve the site**

`preview_start` the `dev` server (create `.claude/launch.json` with `npm run dev` on port 4321 if absent). Navigate to `http://localhost:4321/solutions/cline-setup/`.

- [ ] **Step 2: Verify the page depth renders**

`read_page` — confirm the "Cline reference" section and the expanded FAQ accordions render, and there is no console error.

- [ ] **Step 3: Verify a grounded answer**

In the AskDuck box, type a covered question ("how do I stop Cline auto-approving edits?"), send. Expected: a concise, on-voice answer consistent with the vetted `cline.ts` content; `ready_for_lead` stays false; no lead form.

- [ ] **Step 4: Verify the handoff**

Send a buying-signal message ("can you set this up for our team?"). Expected: the duck names it in one line and the lead form appears. Fill name + a test email, submit. Expected: success state shows. (In dev, confirm `/api/lead/` returns 200 via `read_network_requests`; do not assert a real inbox delivery unless Long wants a live test.)

- [ ] **Step 5: Verify no layout shift + SEO intact**

Reload; confirm the AskDuck box reserves its space (no CLS as it hydrates). Confirm `<script type="application/ld+json">` still includes Article + Service + FAQPage. Optionally run Lighthouse SEO (target 100).

- [ ] **Step 6: Capture evidence + final build**

Screenshot the working duck (grounded answer + handoff). Run `cd site && npm run build && npm test` — all green.

- [ ] **Step 7: Deployment gate**

Do NOT deploy. Summarize evidence for Long and confirm the two new Vercel env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are set before he approves a deploy. Deploy only on his explicit OK.

---

## Self-Review

**Spec coverage:**
- §3 grounding (knowledge module, single source, context injection) → Tasks 2, 3, 4, 9. ✓
- §4 `/api/ask` (mirror scope, guardrails, JSON) → Task 6. ✓
- §4 rate limiting (Upstash, fail-open, reused on scope) → Tasks 5, 7. ✓
- §5 handoff reuse (`/api/lead`, existing form/email) → Tasks 8, 10. ✓
- §6 shared persona → Task 1. ✓
- §7 `<AskDuck>` (inline, no layout shift) → Tasks 8, 10 (step 5). ✓
- §8 guide template v2 (additive depth, video slot, expanded FAQ) → Task 9. ✓
- §10 verification (grounding, handoff, build, schema) → Task 10. ✓
- Content-production Claude↔Codex gate → Task 3. ✓

**Placeholder scan:** `cline.ts` ships PLACEHOLDER strings only in Task 2 (skeleton) and they are explicitly replaced + gated against in Task 3 (Step 5 checks no PLACEHOLDER remains). No other placeholders.

**Type consistency:** `AskResponse` shape (`message/spec/ready_for_lead/session_complete/turn_count`) is identical across `ask-prompt.ts` (Task 4), `/api/ask` (Task 6), and the `<AskDuck>` client (Task 8), and matches what `/api/lead` consumes (`spec` = SpecSheet-shaped, `transcript` = `{role,text}[]`). `getKnowledge`/`serializeKnowledge`/`ToolKnowledge` names consistent across Tasks 2, 4, 6. `checkRateLimit`/`makeRateLimiter` consistent across Tasks 5, 6, 7.
