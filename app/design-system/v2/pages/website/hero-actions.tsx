import { AvatarStack } from '@/components/ui-v2/avatar-stack';
import { LockIcon, VenueIcon, type ZebriIcon } from '@/components/ui-v2/icons';

import { EARLY_ACCESS_ID, JumpButton } from './jump-button';
import { PROOF_MEMBERS, WEDDINGS_BEHIND } from './social-proof';

/**
 * The hero's lower half, laid out like the live zebri.com.au hero the
 * founder pointed to (2026-10-17: "this looks a little cleaner in terms
 * of the sizing and layout"): two buttons, the founding members' faces
 * with one line of proof, then two short promises with an icon each.
 *
 * Two buttons rather than an email box: Join the waitlist goes to the one
 * waitlist form (so nothing is asked twice), and See how it works is the
 * step for a visitor not ready to give an email yet. The faces
 * are placeholders until launch (`social-proof.ts`).
 *
 * @module app/design-system/v2/pages/website/hero-actions
 */

/** The promises under the proof, each one the security band backs up. (Who shaped Zebri is the proof line's job.) */
export const PROMISES: { icon: ZebriIcon; text: string }[] = [
  { icon: VenueIcon, text: 'Built and hosted in Australia.' },
  { icon: LockIcon, text: 'Your couples’ data stays yours.' },
];

/** The hero's buttons, proof and promises. */
export function HeroActions() {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <JumpButton to={EARLY_ACCESS_ID} arrow>
          Join the waitlist
        </JumpButton>
        <JumpButton to="journeys" variant="secondary">
          See how it works
        </JumpButton>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <AvatarStack people={PROOF_MEMBERS} />
        {/* "Shaped by", not "Backed by" (founder, 2026-10-18): backed read as investors.
            The number is the founding members' own weddings, so it says "between them". */}
        <p className="type-body text-zebra-500">
          Shaped by working MCs and Celebrants with{' '}
          <span className="text-zebra-950">{WEDDINGS_BEHIND} weddings between them</span>.
        </p>
      </div>
      <ul className="mt-8 space-y-2">
        {PROMISES.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 type-body text-zebra-500">
            <Icon aria-hidden="true" className="size-3.5 shrink-0 text-grass-700" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
