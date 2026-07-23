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
