import { Avatar } from '@/components/ui-v2/avatar';
import { TextLink } from '@/components/ui-v2/text-link';

import { EarlyAccessForm } from './early-access-form';
import { PERKS } from './founding-offer';
import { EARLY_ACCESS_ID } from './jump-button';
import { Reveal } from './reveal';

/**
 * The close, the page's single conversion point (every "Join the
 * waitlist" scrolls here), the way Stripe closes its pages (founder,
 * 2026-10-19). Left, the waitlist: how it works, the email capture and
 * the founder, who sends the invites; right, what a founding member
 * gets, as one quiet column.
 *
 * No count of who is on the list (founder, 2026-10-19): in a market this
 * small a big number reads as made up, and a small one is not taken
 * seriously. The done view shows no place in line for the same reason.
 *
 * A waitlist rather than open sign-ups (founder, 2026-10-19): people are
 * let in a few at a time, which builds the queue and gives the old Zebri
 * time to move onto this one. Everyone in before the public launch is a
 * founding member, so the place in line decides when, never whether.
 *
 * The founder appears here once, beside the form, because Celebrants buy
 * from people (2026-10-19 review: the page said "email the founder"
 * three times and never showed who that was). `headshot.jpeg` is the
 * founder's photo, as the app's onboarding founder step shows it.
 *
 * @module app/design-system/v2/pages/website/site-founding
 */

/** The waitlist and the founding offer. */
export function SiteFounding() {
  return (
    <section
      id={EARLY_ACCESS_ID}
      aria-labelledby={`${EARLY_ACCESS_ID}-title`}
      className="scroll-mt-16 border-t border-hairline px-5 py-24 sm:px-8 sm:py-32"
    >
      <Reveal>
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="type-label text-grass-700">Waitlist</p>
            <h2 id={`${EARLY_ACCESS_ID}-title`} className="mt-3 text-balance type-site-title text-zebra-950">
              Get on the list.
            </h2>
            <p className="mt-4 max-w-md text-pretty type-lead text-zebra-500">
              We’re letting MCs and Celebrants in a few at a time, so everyone gets set up properly.
              Everyone in before the public launch is a founding member.
            </p>
            <div className="mt-8">
              <EarlyAccessForm />
            </div>
            <div className="mt-10 flex max-w-md items-start gap-3 border-t border-hairline pt-6">
              <Avatar name="Arjun Punekar" src="/headshot.jpeg" />
              <p className="text-pretty type-body text-zebra-500">
                <span className="block type-label text-zebra-950">Arjun, founder of Zebri</span>
                I send the invites myself, a few each week. Want to talk first?{' '}
                <TextLink href="mailto:arjun@zebri.com.au">Email me</TextLink>
              </p>
            </div>
          </div>
          <div className="lg:pt-8">
            <h3 className="type-label text-zebra-950">Founding members get</h3>
            {/* One column: in a two-column grid the last perk sat alone on its row. */}
            <ul className="mt-6 space-y-6">
              {PERKS.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex items-start gap-4">
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-grass-700" />
                  <p className="type-body">
                    <span className="block type-label text-zebra-950">{title}</span>
                    <span className="block text-pretty text-zebra-500">{detail}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
