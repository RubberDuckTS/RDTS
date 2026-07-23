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
