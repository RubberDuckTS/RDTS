/**
 * Case studies. Deep AI engineering leads; small website jobs sit below as a
 * secondary portfolio. Numbers are Long's own measurements from his own
 * hardware and are labelled that way on the page. Nothing here names a
 * client or employer that hasn't agreed to be named.
 */
export interface CaseStudy {
  slug: string;
  name: string;
  kind: string;          // short label
  summary: string;       // one line for cards
  problem: string;
  built: string[];
  stack: string[];
  result: string;        // what's true today
  numbers?: { value: string; label: string }[];
  link?: { href: string; label: string };
  services: string[];    // service slugs this proves
  featured: boolean;
}

export const WORK: CaseStudy[] = [
  {
    slug: 'local-ai-lab',
    name: 'Private local AI lab',
    kind: 'Local models · fine-tuning · GPU optimization',
    summary: 'Open models for text, voice, video, motion, images and 3D, running, fine-tuned and sped up on in-house RTX 4090s, with no data leaving the building.',
    problem:
      'Cloud AI is fast to start with, but every request is a bill and every prompt leaves your network. Long wanted to know how far a business could get with AI it owns outright: models running on its own hardware, tuned to its own tasks, available around the clock and during a cloud outage.',
    built: [
      'A local model stack on RTX 4090 GPUs serving an open Qwen model for agent work, at around 100 tokens a second in his own tests.',
      'Fine-tuning and teacher-student training rounds on his own task set, each scored against a held-out test before it is kept. A round that missed its target was retired rather than shipped.',
      'Local voice cloning and text-to-speech (the Drama 3 voice pipeline), plus a script step that writes natural phrasing and emotional cues so voices don\'t sound robotic.',
      'Local video generation, lip-sync, motion and image models, and 3D asset generation for games and video, run end to end on the same machines.',
      'A real scaling call: local voice worked for his own content but could not serve every app user on in-house compute, so Game Plan\'s coach voices are moving to Zonos 3 instead.',
      'Pipeline optimization that cut one local video clip render from about 2 minutes to about 33 seconds on the 4090s, keeping output quality.',
    ],
    stack: ['Qwen', 'PyTorch', 'CUDA on RTX 4090', 'LoRA fine-tuning', 'Distillation', 'Drama 3', 'Zonos 3', 'Video and lip-sync models', 'Motion models', 'Tripo 3D', 'VRoid'],
    result: 'Running daily as Long\'s own AI back end. It is the reason he can tell a business, with numbers from his own tests, when a private local model beats paying per request and when it doesn\'t.',
    numbers: [
      { value: '~100', label: 'tokens / second, local Qwen' },
      { value: '2 min → 33 s', label: 'one local clip render' },
      { value: '0', label: 'prompts sent to the cloud' },
    ],
    services: ['ai-consulting', 'ai-automation-agency'],
    featured: true,
  },
  {
    slug: 'clover-ai-os',
    name: 'Clover AI OS',
    kind: 'Self-updating AI operating system',
    summary: 'Long\'s own AI operating system: one app that connects his PCs, runs work remotely on them and adds new abilities to itself.',
    problem:
      'Running dozens of AI models, agents and scripts across several computers turns into a mess of windows, logins and copy-paste. Long wanted one place to operate all of it.',
    built: [
      'A browser-based control app that connects his PCs into one system (two today, built to take more) over a private network.',
      'Remote execution: jobs are sent to whichever machine has the right hardware, such as the GPU box for video and voice.',
      'Self-extension: the system can add new abilities to itself as modules when a new kind of job comes up.',
      'On-device voice (Zonos 3) and routing of each job to the right local or cloud model.',
    ],
    stack: ['TypeScript', 'Browser app', 'Private networking', 'Local and cloud LLMs', 'Zonos 3', 'Agent orchestration'],
    result: 'Long\'s daily driver for his own work. It is the blueprint for the custom AI operating systems he builds for businesses.',
    services: ['ai-operating-system', 'ai-automation-agency'],
    featured: true,
  },
  {
    slug: 'ai-support-agent',
    name: 'Voice and chat support agent',
    kind: 'RAG · tool use · grounding · failover',
    summary: 'A support agent that speaks, looks up policy, takes actions with tools, and refuses to answer what the docs don\'t support.',
    problem:
      'Most support bots either hallucinate refunds or hand everything to a human. The goal was an agent a business could actually trust in front of customers: real answers from real policy, real actions, and honest hand-offs.',
    built: [
      'Streaming chat and voice: speech-to-text in, spoken replies out, with low time to first word.',
      'Retrieval over a policy knowledge base with hybrid keyword and vector search and confidence thresholds.',
      'Tool calls for account lookups and actions, with timeouts, retries and circuit breakers on every tool.',
      'A grounding judge that withholds any answer the retrieved policy doesn\'t support and escalates instead.',
      'Model failover across providers, so a rate limit or outage at one doesn\'t take the agent down.',
    ],
    stack: ['Next.js', 'TypeScript', 'Vercel AI Gateway', 'Claude Haiku', 'Gemini Flash', 'pgvector', 'ElevenLabs voice'],
    result: 'Built and documented end to end, with the build recorded for YouTube. The same patterns power the guide on this site.',
    services: ['ai-automation-agency', 'ai-developer-for-hire'],
    featured: true,
  },
  {
    slug: 'isekai-vr',
    name: 'Isekai VR',
    kind: 'AI-first VR game · local AI NPCs',
    summary: 'A VR game whose characters think with local AI models and live in a simulated world.',
    problem:
      'Game characters usually run on scripts. Long is building a VR world where characters hold real conversations and react to a living simulation, without a per-player cloud bill.',
    built: [
      'NPC "brains" driven by language models, designed to run locally rather than per request in the cloud.',
      'A world simulation the characters live in, with history and state that their behaviour draws on.',
      'Voiced characters and a story spine, built and shared with followers as it develops.',
    ],
    stack: ['Unity', 'VR', 'Local LLMs', 'Voice synthesis', 'Simulation'],
    result: 'In active development and shared in public as it is built.',
    services: ['ai-developer-for-hire'],
    featured: true,
  },
  {
    slug: 'game-plan-ai',
    name: 'Game Plan',
    kind: 'AI coach app · multi-model routing',
    summary: 'Tell the coach what you ate. It tracks calories and protein, plans meals from your fridge and builds workouts.',
    problem:
      'Fitness apps make you fill in forms. Game Plan replaces the forms with one coach you just talk to, which means the AI has to be cheap enough to run all day and good enough to trust with your diet.',
    built: [
      'A chat-first coach that logs food, plans meals from your pantry and builds workouts from your goals.',
      'Per-job model routing through OpenRouter: each task (chat, food photos, planning, background memory) goes to the model that does it best for the least cost, with a fallback provider.',
      'Voiced coach personalities, accounts, invite-based beta access and a phone-first web app.',
    ],
    stack: ['Next.js', 'Supabase', 'Vercel', 'OpenRouter', 'Gemini', 'Claude', 'Text-to-speech'],
    result: 'In invite-only beta at gameplancoach.app.',
    link: { href: 'https://gameplancoach.app', label: 'gameplancoach.app' },
    services: ['ai-developer-for-hire', 'ai-automation-agency'],
    featured: true,
  },
  {
    slug: 'post2site',
    name: 'Post2site',
    kind: 'AI website builder for local businesses',
    summary: 'Turns a local business\'s social posts into a fast website that keeps itself up to date.',
    problem:
      'Local businesses post on social every week but their websites go stale for years. Post2site makes the posts the content source.',
    built: [
      'An AI step that reads a business\'s posts and fills in a structured site plan: services, hours, offers, photos.',
      'One shared rendering engine that turns any plan into fast static pages, instead of hand-coding a site per customer.',
      'An updater that keeps the site in sync as new posts go up.',
    ],
    stack: ['TypeScript', 'Astro', 'Supabase', 'LLM structured output', 'Static hosting'],
    result: 'Version 2 in development, with sites built for real local businesses.',
    services: ['websites-wordpress', 'page-speed-local-seo', 'ai-automation-agency'],
    featured: true,
  },
  {
    slug: 'wonderglot',
    name: 'Wonderglot',
    kind: 'Language-learning app · iOS and Android',
    summary: 'A language-learning app shipped to the App Store with a partner team, with Android in review.',
    problem:
      'A small team needed a reliable engineer to keep releases moving across two app stores alongside the product\'s website and marketing.',
    built: [
      'Release builds and store submissions for iOS and Android.',
      'Fixes and features across the app and its website, including the "get the app" flow.',
      'CI fixes so the test suite keeps passing as the toolchain changes.',
    ],
    stack: ['React Native', 'Expo', 'App Store Connect', 'Google Play Console', 'GitHub Actions'],
    result: 'Version 1.3.0 approved on the App Store, Android in Google\'s review.',
    services: ['ai-developer-for-hire'],
    featured: false,
  },
  {
    slug: 'websites',
    name: 'Websites and earlier builds',
    kind: 'Sites · WordPress · content tooling',
    summary: 'Marketing sites, custom WordPress and the tooling behind them, including Dragon Wagon and Rumble of Ages.',
    problem:
      'Smaller builds where the job was a fast, reliable site or a piece of operations tooling behind one.',
    built: [
      'Dragon Wagon: a marketing site plus the content automation back end that feeds it.',
      'Rumble of Ages: a gachapon game built solo and put live in open beta.',
      'Years of custom WordPress themes and plugins, local SEO and GA4 / Tag Manager tracking at two digital marketing agencies.',
    ],
    stack: ['WordPress', 'PHP', 'Astro', 'Next.js', 'Supabase', 'GA4', 'Google Tag Manager'],
    result: 'Shipped and running.',
    services: ['websites-wordpress', 'page-speed-local-seo'],
    featured: false,
  },
];

export const WORK_BY_SLUG = Object.fromEntries(WORK.map(w => [w.slug, w]));
