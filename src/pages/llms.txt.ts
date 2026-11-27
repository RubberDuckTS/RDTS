/** llms.txt: a plain summary for AI crawlers and answer engines, generated from the same data as the pages. */
import type { APIRoute } from 'astro';
import { SERVICES } from '../lib/site/services';
import { WORK } from '../lib/site/work';
import { CONTACT } from '../lib/site/contact';

export const prerender = true;

export const GET: APIRoute = () => {
  const S = CONTACT.site;
  const body = `# Rubber Duck Tech Solutions (RDTS)

> AI consultant and software developer for businesses. Long Nguyen picks the AI tools that fit a business, builds AI agents and automations that do real work inside its existing tools, and builds the custom software and websites around them. He works hands-on with language, voice, video, motion, image and 3D models, including open models run and fine-tuned on in-house GPUs. Based in ${CONTACT.city}, ${CONTACT.regionName}; works remote across the US. A trade name of Long Win LLC.

## Services
${SERVICES.map(s => `- [${s.name}](${S}/services/${s.slug}/): ${s.answer}`).join('\n')}

## Case studies
${WORK.map(w => `- [${w.name}](${S}/work/${w.slug}/) (${w.kind}): ${w.summary} ${w.result}`).join('\n')}

## Facts
- Founder: Long Nguyen, shipping production software since 2018; previously in-house web developer at Go Local Interactive and Jubilant Digital Marketing
- Works solo: the person you talk to builds it
- Pricing: set on the first call based on scope; the first call is free; no published prices
- Out of scope: pre-training foundation models; work requiring government clearance
- Clients own what is built: code and integrations ship into their accounts

## Contact
- Book a free call: ${CONTACT.booking}
- Email: ${CONTACT.email}${CONTACT.phone ? `\n- Phone: ${CONTACT.phone.display}` : ''}
- Site guide: the duck on every page of ${S}/

## More
- [About Long](${S}/about/)
- [Tool setup guides](${S}/solutions/)
- [Learn](${S}/learn/)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
