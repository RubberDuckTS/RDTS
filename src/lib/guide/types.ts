import type { GuideSection } from './kb';

export type GuideAction =
  | { type: 'scroll'; target: GuideSection }
  | { type: 'navigate'; href: string }
  | { type: 'book' }
  | { type: 'lead_form' };

export type GuideStage = 'greet' | 'discover' | 'qualify' | 'book' | 'done';

export interface GuideLeadNotes {
  need: string | null;      // what they want, in their words
  business: string | null;  // who they are / company / team size
  timeline: string | null;
  shape: string;            // Software build | Website | AI integration | AI agent | Consulting | Training | Retainer | unsure
}

export interface GuideReply {
  message: string;
  actions: GuideAction[];
  chips: string[];
  stage: GuideStage;
  notes: GuideLeadNotes;
  /** Where the reply came from, for the client's debug overlay and analytics. */
  source: 'model' | 'scripted';
  /** Set when the grounding check rewrote or dropped part of the model's draft. */
  grounded?: string[];
}

export interface GuideTurn {
  role: 'user' | 'assistant';
  content: string;
}
