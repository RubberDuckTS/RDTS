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
