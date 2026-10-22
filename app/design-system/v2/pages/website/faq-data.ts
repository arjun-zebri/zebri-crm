/**
 * The marketing page's FAQ, rewritten around what a busy MC or celebrant
 * asks before switching: the waitlist, BDM, AI and their couples' data,
 * moving over, and getting out. Answers match the Security band
 * (`security-points.ts`), the plan sheet's pricing and the waitlist's
 * referral jump (`REFERRAL_JUMP` in `founding-offer.ts`); change them
 * together.
 *
 * @module app/design-system/v2/pages/website/faq-data
 */

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  // First: the waitlist is new to most visitors, and every button on the page leads to it.
  {
    q: 'How does the waitlist work?',
    a: 'Join with your email and you get a place in line. We let MCs and Celebrants in a few at a time, so everyone gets set up properly, and email you when your invite is ready. Share your link and you move up 10 places for every MC or Celebrant who joins with it.',
  },
  {
    q: 'What is a founding member?',
    a: 'Everyone we let in before the public launch. Founding members get Max for the price of Pro for their first 12 months, a free onboarding call, a dedicated account manager and a vote on what gets built next.',
  },
  {
    q: 'Which states can I lodge with?',
    a: 'NSW at launch, through your own eRegistry login. Other states follow, and founding members hear first. Until your state is live, Zebri still collects and checks your couple’s details and prepares the paperwork.',
  },
  {
    q: 'Does the AI see my couples’ IDs?',
    a: 'No. ID documents are never sent to an AI model, and ID images are never stored. The AI works from your bookings, notes and messages, and only yours.',
  },
  {
    q: 'Is my couples’ data used to train AI?',
    a: 'Never. Your couples’ details are not used to train any AI model, ours or anyone else’s.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Your couples’ records and files are stored in a Sydney data centre, encrypted in transit and at rest. We are bound by the Privacy Act 1988 and the Australian Privacy Principles. Every company that processes data for us is named in our privacy policy.',
  },
  {
    q: 'I do both MC and Celebrant work. Is it one account?',
    a: 'Yes. Add the blocks for both: run sheets and scripts for the reception, BDM lodgement for the ceremony. They sit on the same couple.',
  },
  {
    q: 'How do I move my couples across?',
    a: 'Founding members don’t have to. Send us a spreadsheet or an export from your current tool, and a person on our team sets everything up for you.',
  },
  {
    q: 'Do my couples need to make an account?',
    a: 'No. Couples and suppliers open a link. Nothing to download, no password to remember.',
  },
  {
    q: 'Is there a free plan?',
    a: 'No free plan, but every plan starts with a 7-day free trial. Founding members get Max for the price of Pro for their first 12 months.',
  },
  {
    q: 'What if I want to leave?',
    a: 'Cancel in your settings any time. Export everything whenever you like. After you cancel, your data is deleted within 30 days and from backups within 90.',
  },
  {
    q: 'Does Zebri take a cut of my bookings?',
    a: 'No. Card payments go through Stripe at Stripe’s standard rates, straight to your bank.',
  },
];
