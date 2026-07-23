# Design — Cline in-depth guide + page-aware answer-duck (Phase 1)

**Date:** 2026-07-23
**Status:** Draft for review
**Owner:** Long Nguyen (RDTS)
**Scope:** Phase 1 of the "content program." Proves the reusable guide-template + answer-duck pattern on ONE page (`/solutions/cline-setup/` — the site's 304-impression breakout). Later phases (roll-out, daily content pipeline, video) are out of scope here and get their own specs.

---

## 1. Why this, why now (evidence)

Google Search Console (rubberduck domain property, last 3 months): 728 impressions, 4 clicks, avg position 26.6. `/solutions/cline-setup/` alone pulls **304 impressions (42% of the whole site)** but sits at **position 30.1** with **0.3% CTR**. Google already matches it to ~25 distinct Cline queries (`cline configuration`, `cline ignore`, `cline temperature setting`, `cline model id`, `cline modes`, `cline mcp config`, `cline auto approve`, `how to use cline`, `install cline`, …). The page is a proven demand magnet that isn't deep or authoritative enough to reach page 1.

Microsoft Clarity (project `xo1s5hy087`, 30 days): 11 human sessions, no rage/dead clicks, 2.1 min active, 37% scroll. No UX problem — the constraint is search positioning and click volume, not the site itself.

**Conclusion:** add the how-to depth Google rewards to the page Google already favors, and put a grounded assistant on it that answers the long-tail the page can't fully cover — and routes warm buyers to Long.

## 2. Goals / non-goals

**Goals**
- Turn `/solutions/cline-setup/` into an in-depth guide that credibly answers the Cline config cluster, without gutting its existing sales content (additive depth, not a makeover).
- Ship a page-aware "answer-duck": an inline, grounded Q&A assistant that answers Cline questions from vetted content and hands off to Long when the conversation signals real work.
- Extract both as **reusable patterns** (a guide shape + an `<AskDuck>` component + a per-tool knowledge module) so Phase 2 pages are cheap to add.

**Non-goals (YAGNI for Phase 1)**
- No vector DB / embeddings. No streaming responses. No conversation persistence beyond the lead email. No auth/accounts. No roll-out to other pages. No automated content pipeline. No video production (leave a slot only).

## 3. Grounding architecture — "better than RAG" at this scale

The corpus is a dozen tools' worth of vetted facts. A vector database would add infra, retrieval-miss risk, and maintenance for zero benefit at this size. Instead:

- **Single source per tool:** `site/src/lib/duck-knowledge/cline.ts` (a typed module — kept in `src/lib/`, not `src/content/`, which Astro reserves for schema-validated content collections). Matches the existing `faqs`-array convention already in the page. It exports:
  ```ts
  export const cline = {
    tool: 'Cline',
    aliases: ['cline', 'claude dev'],
    intro: '…one-paragraph what-it-is…',
    reference: [ { heading: 'Model routing per task', body: '…' }, … ],
    faqs: [ { q: 'What is a .clineignore file?', a: '…' }, … ],
  }
  ```
- **Two consumers of that one module** (write once, use in both):
  1. **The page** imports it → renders `reference` sections + `faqs` accordions + builds `faqSchema` (exactly the mechanism the page uses today). Crawlable, schema'd depth for the 25-query cluster.
  2. **`/api/ask`** imports it → serializes to text → injects as the vetted knowledge in the system prompt, cached as a stable prefix (Anthropic prompt caching → cheap + fast).
- **Future-proofing:** if the KB ever outgrows the context window, retrieval slots in behind `/api/ask` with no change to the page or the component contract.

**Content-production workflow (the "vetted" in vetted-first):**
1. **Claude drafts** `cline.ts` from the current page + tool knowledge.
2. **Codex peer-reviews** it for factual accuracy — every config claim (flag names, defaults, file names like `.clineignore`, model-routing behavior) checked against reality; flags anything unverifiable or wrong.
3. **Claude reconciles** Codex's findings (and cross-reviews Codex-authored content the same way — the review runs both directions). Disagreements are resolved to the conservative reading or cut.
4. **Long signs off** — final gate. Nothing ships he hasn't approved.

This Claude↔Codex cross-check is deliberately reusable: it's the quality gate that lets the later daily-content pipeline (Phase 3) produce depth at cadence without hallucinated errors. Exact Codex invocation (headless `codex exec` vs. relay) is settled at build time.

## 4. The answer-duck endpoint — `POST /api/ask`

Mirrors `/api/scope.ts` (Astro serverless, `prerender = false`, Anthropic SDK, Haiku `claude-haiku-4-5-20251001`).

**Request:** `{ topic: 'cline', messages: [{role, content}, …] }`
**Response:** `{ message: string, wants_handoff: boolean, session_complete: boolean }`
(Simpler than the scope endpoint — no `spec` sheet; this duck educates, it doesn't run intake.)

**System prompt** = shared persona (§6) + a job block:
- "You answer questions about **{tool}**. Ground every answer in the KNOWLEDGE below."
- Vetted-first rule: answer from `reference`/`faqs`; general knowledge only for well-established basics; **when unsure or uncovered → say so plainly and offer Long** (`wants_handoff: true`).
- Handoff detection: when the visitor shifts from "how do I…" to buying signals ("can you set this up for us", "we're a team drowning in this", "do you do this for people", asks about working together) → name it in one line and set `wants_handoff: true`.
- Output: strict JSON via assistant `{` prefill (same technique as scope.ts), one-retry-on-parse-fail, soft fallback that keeps the chat alive.

**Guardrails (reuse scope.ts patterns):** per-message `content.slice(0, 4000)`, `MAX_TOKENS` ~600, `MAX_USER_TURNS` ~8 (support conversations are shorter than intake), missing-API-key → 503.

**Rate limiting (in v1 — decided):** per-IP + per-day limit via **Upstash Redis free tier** (`@upstash/ratelimit` + `@upstash/redis`), the standard Vercel pattern. This is the only guard that caps cost-abuse — the turn cap limits a single conversation, but nothing stops a script opening unlimited fresh conversations against a public, paid endpoint. One-time setup: provision an Upstash Redis DB (Vercel Marketplace or direct), add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to Vercel env. On limit exceeded → 429 with a "you've hit the limit, email Long directly" message. If the limiter can't reach Redis, fail **open** (don't block real visitors over an infra blip) but log it. The same limiter is reused by `/api/scope` while we're here.

## 5. Handoff — reuse, don't rebuild

When `wants_handoff` is true, the `<AskDuck>` UI reveals the **same name + email lead form** used by `/talk`, and submission uses the **existing `sendChatLeadToLong` path** (`lib/email.ts`). Visitors who volunteer an email in-chat are forwarded via the same mechanism scope.ts already implements. No new lead plumbing; Long receives leads through the channel he already has.

## 6. Shared persona (targeted refactor)

Extract the persona/voice/BANNED-words/never-invent spine from `SCOPING_SYSTEM_PROMPT` into `lib/duck-persona.ts`, imported by both the scope prompt and the ask prompt. This keeps one duck voice and prevents drift. The scope prompt keeps its intake-specific sections; the ask prompt adds its answer/handoff sections. (Improvement to code we're already touching — not unrelated refactoring.)

## 7. Frontend — `<AskDuck topic="cline" toolName="Cline" />`

- Inline Astro component dropped into the guide (e.g., after the reference sections, before the FAQ). Renders a styled "Ask the duck about Cline →" box in the existing dark/cream/saffron system (`card-cream`, `btn`, `status-pill`, Geist).
- On open, expands **in place** into a chat (reuse the chat client + form markup from `talk.astro` / `Duck.astro`; extract shared bits so `/talk` and `<AskDuck>` don't diverge).
- Calls `POST /api/ask` with the page topic; renders replies; on `wants_handoff`, reveals the lead form inline.
- Progressive enhancement: the box is a static styled section; JS handles the fetch loop. Explicit height/reserved space so there's **no layout shift** (protects Core Web Vitals).

## 8. Guide template v2 (the reusable shape)

Not a rebuild of the Cline page — an **additive** structure that other guides copy:

1. Hero (what it is, who it's for) — *exists.*
2. **Deep reference / how-to sections** — rendered from `cline.ts` `reference[]`. *New depth: the actual config answers.*
3. **Video slot** — a reserved, optional embed block (empty for v1; filled in Phase 4). Renders nothing if no video, no layout shift.
4. **`<AskDuck>`** — inline grounded Q&A. *New.*
5. **Expanded FAQ** — from `cline.ts` `faqs[]`, rendered as today's `<details>` accordions + `faqSchema`. *Deeper than the current 6 Qs; covers the config cluster.*
6. Conversion layer (shapes / CTA / duck handoff) — *exists, kept.*

The existing sales sections stay; we insert genuine how-to depth + the duck above the conversion layer. Educational-first ordering, sales second.

## 9. Data flow

```
Visitor on /solutions/cline-setup/
  ├─ reads reference sections + FAQ  ← rendered from cline.ts (crawlable, schema'd)
  └─ opens <AskDuck topic="cline">
        └─ POST /api/ask { topic:'cline', messages }
              └─ system = duck-persona + serialize(cline.ts) + ask-rules
              └─ Haiku → { message, wants_handoff, session_complete }
        └─ if wants_handoff → reveal lead form → sendChatLeadToLong() → Long's inbox
```

## 10. Testing / verification (evidence before "done")

- `astro dev`; on the Cline page: reference sections + expanded FAQ render; `faqSchema` present and valid (view-source / Rich Results test).
- Duck answers a covered question correctly from `cline.ts` (e.g. ".clineignore", "auto-approve") and, for an uncovered/ambiguous ask, says so and sets `wants_handoff`.
- Buying-signal message ("can you set this up for our team") → `wants_handoff: true` → lead form appears → submit → `sendChatLeadToLong` fires (verified via test/stub, not sent to a real inbox in dev).
- JSON-parse retry + soft fallback exercised (malformed model output path).
- No layout shift when the duck opens; Lighthouse SEO stays 100.
- Guardrails: over-length input truncated; turn cap returns the limit response.

## 11. Rollout

Cline only. Once proven, Phase 2 adds a guide by writing `duck-knowledge/<tool>.ts` and dropping `<AskDuck topic="<tool>">` into the page — no new endpoint or component work.

## 12. Judgment calls made (flag for review)

- **Additive depth, not a makeover** of the Cline page — sales content stays, how-to depth + duck inserted above it. (Respects "refine, don't makeover.")
- **`cline.ts` as single source** feeding both page and duck (DRY, matches existing `faqs` convention).
- **Separate `/api/ask` endpoint** rather than extending `/api/scope` — different job, avoids destabilizing the tuned intake flow.
- **Handoff reuses the existing lead form + email path** (not a deep-link to `/talk`).
- **Haiku, request/response (no streaming), rate-limiting possibly a fast-follow.**

## 13. Decisions (resolved 2026-07-23)

1. **`cline.ts` content:** Claude drafts → Codex peer-reviews for factual accuracy → reconcile (both directions) → Long signs off. See §3 workflow.
2. **Rate-limiting:** in v1, Upstash Redis free-tier per-IP/day limiter, reused by `/api/scope`. See §4.
3. **Doc location:** specs live under `site/docs/superpowers/specs/` (inside the git repo), versioned with the code. This file moved there.
