/**
 * One place for how people reach Long. Every page, the guide, the schema and
 * llms.txt read from here, so a change (like the new business phone number)
 * is one edit.
 */
export const CONTACT = {
  email: 'long@rubberducktechsolutions.com',
  booking: 'https://calendly.com/nguy4227/let-s-connect-project-role-or-collaboration',
  /** Google Voice business line. Shown everywhere once set; hidden while null. */
  phone: null as null | { display: string; e164: string },
  city: 'Kansas City',
  region: 'MO',
  regionName: 'Missouri',
  country: 'US',
  linkedin: 'https://www.linkedin.com/in/long-nguyen-a3b6326a/',
  github: 'https://github.com/LongPNguyen',
  site: 'https://www.rubberducktechsolutions.com',
} as const;
