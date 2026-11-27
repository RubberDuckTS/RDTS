/**
 * The guide's knowledge base. Every fact the guide may state lives here or in
 * the site data it is built from (services, work, contact), and nowhere else.
 * If a fact isn't here, the guide says it doesn't know and offers a call.
 */
import { SERVICES } from '../site/services';
import { WORK } from '../site/work';
import { CONTACT } from '../site/contact';

export interface KbChunk {
  id: string;
  title: string;
  text: string;
  section?: GuideSection;
  href?: string;
}

export const SECTIONS = ['hero', 'overpay', 'offers', 'services', 'range', 'proof', 'process', 'faq', 'book'] as const;
export type GuideSection = (typeof SECTIONS)[number];

/** Pages the guide may send a visitor to. Anything else is dropped. */
export const ALLOWED_PAGES: readonly string[] = [
  '/', '/services/', ...SERVICES.map(s => `/services/${s.slug}/`),
  '/work/', ...WORK.map(w => `/work/${w.slug}/`),
  '/about/', '/contact/', '/learn/', '/solutions/', '/talk/',
  '/solutions/claude-code-setup/', '/solutions/cursor-setup/', '/solutions/codex-setup/',
  '/solutions/openclaw-setup/', '/solutions/n8n-alternative/', '/solutions/zapier-alternative/',
  '/learn/what-is-mcp/', '/learn/chatgpt-for-business/',
];

export const BOOKING_URL = CONTACT.booking;
export const CONTACT_EMAIL = CONTACT.email;

const fixed: KbChunk[] = [
  {
    id: 'who', title: 'Who runs Rubber Duck Tech Solutions', section: 'hero', href: '/about/',
    text: 'Rubber Duck Tech Solutions is run solo by Long Nguyen, an AI consultant and full-stack software engineer who has shipped production software since 2018. He started as the in-house web developer at two digital marketing agencies (custom WordPress and PHP, HubSpot, local SEO, GA4 and Tag Manager). He works hands-on with every kind of AI model: language, voice, video, motion, image and 3D, running and fine-tuning open models on in-house RTX 4090 GPUs. One senior person scopes, builds and maintains the work. He is based in Kansas City, Missouri and works remote with businesses across the US. RDTS is a trade name of Long Win LLC.',
  },
  {
    id: 'overpay', title: 'Are you overpaying for AI?', section: 'overpay', href: '/services/ai-consulting/',
    text: 'Many AI products are a thin layer over the same few models and open-source tools. Long checks what a business pays for and uses, and tells them when a subscription is worth it and when the same thing can be built once and owned for less, or run privately on their own hardware. Visitors can ask for a free AI tools check on a call.',
  },
  {
    id: 'offers', title: 'Ways to start', section: 'offers',
    text: 'Three ways to start, smallest first: (1) an AI tools check: a consult on what you use, what you pay and what to change; (2) one agent or automation set up for the single most time-consuming task; (3) a custom AI operating system for the whole business, scoped to its infrastructure and built module by module. Prices are set on the call; the first call is free.',
  },
  {
    id: 'range', title: 'Every kind of AI', section: 'range',
    text: 'Long works with language models (Claude, GPT, Gemini, and open models like Qwen running locally), agents and automation, search over your own data (RAG), voice (cloning and natural text-to-speech with emotional cues: Drama 3, Zonos 3, ElevenLabs), video, lip-sync and motion models, image models and 3D (Tripo, VRoid). Most people only use chat; he has built a working system across all of them.',
  },
  {
    id: 'process', title: 'How working together starts', section: 'process',
    text: 'Step 1: a free call (15, 30 or 45 minutes on Google Meet) or a chat with this guide. Step 2: a plain-English plan with what to use, what to build and what to stop paying for; scope and price are set on the call. Step 3: Long builds it, sets it up with the team and maintains it, or stays on as an AI partner on a monthly retainer. Code and integrations ship into the client\'s own accounts.',
  },
  {
    id: 'pricing', title: 'Pricing', section: 'process',
    text: 'Pricing depends on scope. Long sets real numbers on the first call once he understands the work. The first call is free. There are no published prices, ranges or packages, and the guide never quotes one.',
  },
  {
    id: 'booking', title: 'Booking and contact', section: 'book', href: '/contact/',
    text: `You can book a free call with Long right here in this panel. Before the call he reviews what you shared. You can also leave your name and email and he follows up within 24 hours, or email ${CONTACT.email}.`,
  },
  {
    id: 'hard-no', title: 'What Long does not take on',
    text: 'Only two things are out: pre-training foundation models from scratch, and work that needs a government clearance or special licence. Fine-tuning, local models and RAG are in.',
  },
  {
    id: 'beginners', title: 'Beginner friendly',
    text: 'You do not need to be technical. Long explains things in plain English, recommends one option instead of ten, and sets tools up so a team can use them without becoming engineers.',
  },
];

const serviceChunks: KbChunk[] = SERVICES.map(s => ({
  id: `svc-${s.slug}`, title: s.name, section: 'services', href: `/services/${s.slug}/`,
  text: `${s.answer} Good fit for: ${s.forWho.join('; ')}. Includes: ${s.deliverables.map(d => `${d.head} (${d.body})`).join(' ')}`,
}));
const workChunks: KbChunk[] = WORK.map(w => ({
  id: `work-${w.slug}`, title: `Case study: ${w.name}`, section: 'proof', href: `/work/${w.slug}/`,
  text: `${w.name} (${w.kind}). ${w.summary} ${w.built.join(' ')} Status: ${w.result}${w.numbers ? ' Numbers (Long\'s own measurements): ' + w.numbers.map(n => `${n.value} ${n.label}`).join('; ') + '.' : ''}`,
}));

export const KB: KbChunk[] = [...fixed, ...serviceChunks, ...workChunks];
