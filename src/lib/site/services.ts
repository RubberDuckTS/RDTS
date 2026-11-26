/**
 * The five services. Each page leads with a direct answer to the buyer's
 * question (the pattern AI answer engines quote most), then who it's for,
 * what they get, how it runs, proof and FAQ. Only claims Long can stand
 * behind: no prices, no promised results, no invented clients.
 */
export interface Service {
  slug: string;
  name: string;            // nav / card name
  title: string;           // <title>
  description: string;     // meta description
  question: string;        // the buyer question the page answers (H1 lead-in)
  h1: string;
  answer: string;          // first paragraph: the direct answer
  forWho: string[];
  deliverables: { head: string; body: string }[];
  steps: { head: string; body: string }[];
  proof: string[];         // work slugs
  faqs: { q: string; a: string }[];
  related: string[];       // service slugs
  icon: 'compass' | 'agent' | 'code' | 'web' | 'gauge' | 'chip';
  ask: string;             // what the guide hears when they tap "ask about this"
}

export const SERVICES: Service[] = [
  {
    slug: 'ai-consulting',
    name: 'AI consulting & strategy',
    title: 'AI Consultant for Small Business: Which AI Tools to Use | Rubber Duck Tech Solutions',
    description: 'Not sure which AI tools fit your business? Long Nguyen tests the tools hands-on and tells you what to use, what to skip and what to build first. Book a free call.',
    question: 'Which AI tools should my business actually use?',
    h1: 'AI consulting that tells you what to use, and what to skip.',
    answer:
      'An AI consultant should hand you decisions, not a list of options. Long Nguyen tests AI tools hands-on every week (chat assistants, coding agents, automation platforms, local and frontier models) and maps them to how your business actually runs: which tasks AI should take over, which tools to pay for, which to drop, and what to build first. You leave the engagement with a short written plan and the setup to start using it.',
    forWho: [
      'Owners who know they should be using AI but don\'t know where to start',
      'Teams paying for several AI subscriptions that nobody really uses',
      'Companies deciding between ChatGPT, Claude, Gemini, Copilot or a custom build',
      'Leaders who want a straight second opinion before signing a vendor contract',
    ],
    deliverables: [
      { head: 'AI audit of how you work today', body: 'Where the repeated work, the hand-offs and the copy-paste live, and which of it AI can realistically take on now.' },
      { head: 'Tool and model picks', body: 'Which assistant, which automation platform, which model for which job, with the reasoning, based on tools Long has actually used.' },
      { head: 'A first-90-days plan', body: 'What to set up first, what it costs to run, and what to leave alone. Short, written, yours to keep.' },
      { head: 'Team training', body: 'Role-specific setups and walkthroughs so people keep using it after the first week.' },
    ],
    steps: [
      { head: 'Free call', body: 'You walk through the business and where time goes. Long asks the questions a buyer of AI tools forgets to.' },
      { head: 'Audit and plan', body: 'He reviews your tools and workflows and writes the plan. Scope and price are agreed before any of it starts.' },
      { head: 'Set up and train', body: 'He sets up the first wins with your team, or stays on as your AI partner on a monthly retainer.' },
    ],
    proof: ['ai-support-agent', 'game-plan-ai'],
    faqs: [
      { q: 'Do I need a big budget to start using AI?', a: 'No. Most small businesses get the first real wins from tools they can already afford, set up properly. The plan says what is worth paying for and what is not.' },
      { q: 'Is ChatGPT or Claude better for my business?', a: 'It depends on the work. Long uses both daily, plus Gemini, local open models and coding agents, and recommends per task rather than per brand.' },
      { q: 'Will you sell me software I don\'t need?', a: 'No. Long is tool-agnostic and has no reseller deals. If an off-the-shelf tool does the job, that is the recommendation.' },
      { q: 'Can you train my team?', a: 'Yes. Training is role by role, with configs and a written playbook, so the team keeps using it past month one.' },
    ],
    related: ['ai-automation-agency', 'ai-developer-for-hire'],
    icon: 'compass',
    ask: 'Which AI tools should my business use?',
  },
  {
    slug: 'ai-automation-agency',
    name: 'AI agents & automation',
    title: 'AI Agents & Automation for Small Business | Rubber Duck Tech Solutions',
    description: 'AI agents and automations that do real work inside the tools you already use: lead follow-up, support, intake, reporting. Built and maintained by one senior engineer.',
    question: 'Can AI take repetitive work off my team?',
    h1: 'AI agents that do real work inside your tools.',
    answer:
      'Yes, when the agent is wired into the systems the work already lives in. Long Nguyen builds AI agents and automations that connect to your inbox, CRM, calendar, support desk, spreadsheets and files, then answer, draft, sort, follow up and report on their own, with a person approving anything that matters. Every agent is grounded in your own data, logs what it does, and has a fallback when a model is down.',
    forWho: [
      'Businesses where leads wait hours for a reply',
      'Teams answering the same customer questions every day',
      'Owners copying data between apps by hand',
      'Anyone who wants an assistant on their website that books calls, like the duck on this one',
    ],
    deliverables: [
      { head: 'Website and sales agents', body: 'A guide on your site that answers from your real information, qualifies visitors and books them, without inventing prices or promises.' },
      { head: 'Support agents', body: 'Chat or voice agents grounded in your docs and policies, with a check that withholds any answer the docs do not support.' },
      { head: 'Back-office automations', body: 'Lead follow-up, intake forms, reporting and data entry across tools like Gmail, HubSpot, Slack, Sheets, Supabase, Zapier, Make or n8n.' },
      { head: 'Integrations', body: 'MCP servers and API connections so agents can act in your real systems, not a demo sandbox.' },
    ],
    steps: [
      { head: 'Pick one workflow', body: 'On a free call you choose the one repeated task that costs the most time. That becomes the first agent.' },
      { head: 'Build it in your stack', body: 'Long builds it against your real tools and data, with approvals where a mistake would matter.' },
      { head: 'Run, watch, extend', body: 'It runs with logs and fallbacks. Then the next workflow, or a monthly retainer to keep it all current.' },
    ],
    proof: ['ai-support-agent', 'post2site', 'game-plan-ai'],
    faqs: [
      { q: 'What can an AI agent do for a small business?', a: 'Answer customer questions from your own information, follow up with new leads, book appointments, sort and draft email, move data between apps and produce reports, with a person approving anything important.' },
      { q: 'Will the agent make things up?', a: 'Long builds agents to answer only from your data and to say "I don\'t know" otherwise. His agents include a grounding check that blocks unsupported answers, prices and promises.' },
      { q: 'Do I need Zapier or n8n?', a: 'Sometimes. Simple flows fit Zapier, Make or n8n; anything that needs judgment or your own data usually needs a custom agent. Long builds whichever fits.' },
      { q: 'Who owns the agent?', a: 'You do. Code, prompts and integrations ship into your accounts and repos.' },
    ],
    related: ['ai-consulting', 'ai-developer-for-hire'],
    icon: 'agent',
    ask: 'I want an AI agent for my business',
  },
  {
    slug: 'ai-developer-for-hire',
    name: 'Custom software & AI apps',
    title: 'Custom Software & AI App Developer for Hire | Rubber Duck Tech Solutions',
    description: 'Hire a senior full-stack developer for custom web apps, internal tools and AI features. Long Nguyen scopes, builds and maintains it end to end.',
    question: 'Who can build our app or internal tool, with AI inside?',
    h1: 'Custom software and AI apps, built by the person you talk to.',
    answer:
      'Long Nguyen is a full-stack engineer who has shipped production software since 2018. He builds custom web apps, mobile-ready products, internal tools, dashboards and integrations, with AI features where they earn their place, and he maintains what he builds. You work with one senior person from first call to launch: no agency layers, no hand-off to juniors.',
    forWho: [
      'Founders who need a first version built properly',
      'Businesses outgrowing spreadsheets and want an internal tool',
      'Products that need an AI feature: chat, search over documents, voice, or an agent',
      'Teams with an existing app that needs a reliable developer to maintain it',
    ],
    deliverables: [
      { head: 'Web apps and MVPs', body: 'Next.js, Astro, React and TypeScript front ends on Supabase or Postgres, deployed on Vercel or your cloud.' },
      { head: 'AI features', body: 'Chat and voice assistants, retrieval over your documents, agents with tools, model routing for cost and quality.' },
      { head: 'Internal tools and dashboards', body: 'The admin panel, tracker or report your team keeps rebuilding in spreadsheets.' },
      { head: 'Maintenance', body: 'Fixes, upgrades and new features for software you already have, his or someone else\'s.' },
    ],
    steps: [
      { head: 'Scope call', body: 'Free call to agree what version one must do and what it must not. Price comes from that scope.' },
      { head: 'Build in the open', body: 'Working previews early and often, code in your repo from day one.' },
      { head: 'Launch and maintain', body: 'He ships it and stays on for fixes and the next version.' },
    ],
    proof: ['game-plan-ai', 'post2site', 'wonderglot'],
    faqs: [
      { q: 'What do you build with?', a: 'Mostly TypeScript: Next.js, Astro, React and Node, with Supabase or Postgres, deployed on Vercel. He also works in PHP and WordPress, and with the Claude, OpenAI and Gemini APIs.' },
      { q: 'Do I own the code?', a: 'Yes. It lives in your repository and accounts from the start.' },
      { q: 'Can you take over an app someone else built?', a: 'Yes. Maintenance and rescue of existing apps is regular work.' },
      { q: 'How long does a first version take?', a: 'It depends on scope, which is set on the first call. Long gives you a realistic timeline then, not a guess on a website.' },
    ],
    related: ['ai-automation-agency', 'websites-wordpress'],
    icon: 'code',
    ask: 'I need a custom app built',
  },
  {
    slug: 'websites-wordpress',
    name: 'Websites & WordPress',
    title: 'Website Design & WordPress Developer, Kansas City and Remote | Rubber Duck Tech Solutions',
    description: 'Fast, modern websites and WordPress builds that turn visitors into calls and bookings. Custom WordPress and PHP, Astro and Next.js sites, maintenance and fixes.',
    question: 'Who can build or fix our website so it brings in customers?',
    h1: 'Websites built to make the phone ring.',
    answer:
      'A business website has one job: turn the right visitors into calls, bookings or orders. Long Nguyen builds fast, modern sites and custom WordPress themes and plugins, and fixes the ones that already exist. He spent years as the in-house web developer at two digital marketing agencies, so tracking, local SEO and conversion are built in from the start, not bolted on later.',
    forWho: [
      'Local businesses with an outdated or slow site',
      'WordPress sites that break after every plugin update',
      'Businesses moving off Wix or Squarespace to something they own',
      'Anyone who wants an AI assistant on their site that answers and books',
    ],
    deliverables: [
      { head: 'New sites', body: 'Custom WordPress, or Astro and Next.js sites when speed matters most, designed around one clear call to action.' },
      { head: 'WordPress development', body: 'Custom themes and plugins in PHP, cleanup of plugin bloat, and safe updates.' },
      { head: 'Tracking that works', body: 'Google Analytics 4 and Google Tag Manager set up so you can see which pages bring calls.' },
      { head: 'Care and fixes', body: 'Ongoing updates, backups, fixes and small changes, from the person who knows the code.' },
    ],
    steps: [
      { head: 'Free call', body: 'What the site needs to do for the business, and what is in the way today.' },
      { head: 'Design and build', body: 'A preview link early, real content, and your feedback before anything goes live.' },
      { head: 'Launch and care', body: 'Launch with tracking in place, then optional ongoing care.' },
    ],
    proof: ['post2site', 'game-plan-ai'],
    faqs: [
      { q: 'Do you still build on WordPress?', a: 'Yes. Long has built custom WordPress themes and plugins professionally and still maintains WordPress sites. For sites that need maximum speed he may suggest Astro or Next.js instead.' },
      { q: 'Do you work with businesses outside Kansas City?', a: 'Yes. Long is based in Kansas City, Missouri, and works fully remote with businesses across the US.' },
      { q: 'Can you fix my existing site instead of rebuilding it?', a: 'Often, yes. A fix is recommended over a rebuild whenever it does the job.' },
      { q: 'Can my website have an AI assistant like this one?', a: 'Yes. Long builds website guides that answer from your real information and book appointments.' },
    ],
    related: ['page-speed-local-seo', 'ai-automation-agency'],
    icon: 'web',
    ask: 'I need a new website or my site fixed',
  },
  {
    slug: 'page-speed-local-seo',
    name: 'Page speed, SEO & AI search',
    title: 'Page Speed, Local SEO & AI Search Optimization (AEO/GEO) | Rubber Duck Tech Solutions',
    description: 'Get found on Google and in AI answers. Page speed and Core Web Vitals fixes, local SEO, schema markup and AI search optimization (AEO and GEO) for small businesses.',
    question: 'Why can\'t customers find us on Google, or in ChatGPT?',
    h1: 'Get found on Google, and in the AI answers people now ask.',
    answer:
      'Usually it is a mix of a slow site, missing structure and nothing for search engines or AI tools to quote. Long Nguyen fixes all three: page speed and Core Web Vitals, local SEO (Google Business Profile, citations, location pages), schema markup that tells search engines exactly what you do, and content written to be cited by ChatGPT, Perplexity and Google\'s AI answers. That last part is often called AEO or GEO.',
    forWho: [
      'Local businesses that don\'t show up for "near me" searches',
      'Sites that fail Core Web Vitals or feel slow on phones',
      'Businesses that never appear when someone asks an AI tool for a recommendation',
      'Owners who want to know which pages actually bring customers',
    ],
    deliverables: [
      { head: 'Speed fixes', body: 'Image, script and hosting fixes that make pages load fast on a phone, measured before and after.' },
      { head: 'Local SEO', body: 'Google Business Profile, Bing Places, consistent citations and location or service-area pages.' },
      { head: 'Schema and structure', body: 'Organization, LocalBusiness, Service and FAQ structured data, clean headings, sitemaps and llms.txt.' },
      { head: 'AI search (AEO / GEO)', body: 'Pages that answer buyer questions directly so AI assistants can quote and cite you.' },
    ],
    steps: [
      { head: 'Free audit call', body: 'Long looks at your site, your listings and what AI tools say about you today.' },
      { head: 'Fix list', body: 'A ranked list of fixes, biggest impact first. Scope and price agreed before work starts.' },
      { head: 'Fix and track', body: 'He makes the fixes and sets up tracking so you can see what moved.' },
    ],
    proof: ['post2site'],
    faqs: [
      { q: 'What is AEO or GEO?', a: 'Answer engine optimization and generative engine optimization: structuring your site so AI assistants like ChatGPT, Perplexity and Google\'s AI answers can understand it and cite it when people ask for a recommendation.' },
      { q: 'Does page speed really affect rankings?', a: 'Speed is one of Google\'s page experience signals, and slow pages lose visitors before they ever see your offer. It is usually one of the cheapest fixes with the clearest payoff.' },
      { q: 'Can you guarantee first place on Google?', a: 'No one honestly can. Long fixes what holds you back and tracks the results, and is upfront about what moved.' },
      { q: 'Do you do local SEO for Kansas City businesses?', a: 'Yes, and for local businesses anywhere in the US. Long has done local SEO professionally at a digital marketing agency.' },
    ],
    related: ['websites-wordpress', 'ai-consulting'],
    icon: 'gauge',
    ask: 'I want to show up on Google and in AI search',
  },
  {
    slug: 'ai-operating-system',
    name: 'Custom AI operating system',
    title: 'Custom AI Operating System for Your Business | Rubber Duck Tech Solutions',
    description: 'One AI system that connects your computers, tools and agents, runs work remotely and adds new abilities over time. Designed and built by Long Nguyen, who runs his own.',
    question: 'Can we run the whole business from one AI system?',
    h1: 'One AI system that runs your machines, tools and agents.',
    answer:
      'A custom AI operating system ties everything together: your computers, your apps, your data and a team of AI agents, operated from one place. Long Nguyen runs his own: it connects his PCs, does remote work on them, routes each job to the right model, and updates itself with new abilities as he needs them. He designs and builds the same kind of system for a business, sized to its infrastructure: the bigger the setup, the bigger the plan, built from small parts that each work on their own.',
    forWho: [
      'Businesses juggling many AI tools, logins and scripts that don\'t talk to each other',
      'Teams with several machines or locations that want one place to run work',
      'Owners who want AI that keeps getting more capable without a rebuild each time',
      'Companies that want private, self-hosted AI wired into their own systems',
    ],
    deliverables: [
      { head: 'One control centre', body: 'A single app where you and your team ask for work and see what every agent and machine is doing.' },
      { head: 'Connected machines and tools', body: 'Your computers, servers and apps linked securely so jobs can run remotely, wherever the right hardware is.' },
      { head: 'A team of agents', body: 'Specialist agents for each kind of job, each routed to the model that does it best, local or cloud.' },
      { head: 'Built to grow', body: 'New abilities get added as modules, so the system gains skills over time instead of being rebuilt.' },
    ],
    steps: [
      { head: 'Map the business', body: 'A paid discovery maps your machines, tools, data and the work you want the system to run.' },
      { head: 'Start with one module', body: 'The first module ships and earns its keep before the next one is built.' },
      { head: 'Grow it', body: 'Module by module, the system takes on more, with Long on retainer to extend and maintain it.' },
    ],
    proof: ['clover-ai-os', 'local-ai-lab', 'ai-support-agent'],
    faqs: [
      { q: 'What is an AI operating system?', a: 'A single system that connects your computers, apps and data to a set of AI agents, so work can be asked for, routed and done from one place instead of across a dozen tools.' },
      { q: 'Is this only for big companies?', a: 'No. It is sized to the business. A small team might start with one machine and two agents; a larger one with several sites and many tools. Both start with one module.' },
      { q: 'Can it run on our own hardware?', a: 'Yes. It can use local models on your own machines, cloud models, or both, depending on cost, speed and privacy.' },
      { q: 'How much does it cost?', a: 'It is a custom build scoped to your infrastructure, so it is priced after discovery. The first call is free.' },
    ],
    related: ['ai-automation-agency', 'ai-consulting'],
    icon: 'chip',
    ask: 'Tell me about a custom AI operating system',
  },
];

export const SERVICE_BY_SLUG = Object.fromEntries(SERVICES.map(s => [s.slug, s]));
