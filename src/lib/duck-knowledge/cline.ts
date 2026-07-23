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
