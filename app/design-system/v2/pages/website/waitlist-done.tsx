import { CopyButton } from '@/components/ui-v2/copy-button';
import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Input } from '@/components/ui-v2/input';

import { REFERRAL_JUMP } from './founding-offer';

/**
 * The end of the waitlist sign-up: they are on the list, and a link of
 * their own moves them up when other MCs and Celebrants join with it
 * (Kinso's waitlist carries a referral code on every sign-up link). The
 * referral link is the one thing a happy sign-up can do next, so it gets
 * the copy button.
 *
 * No place in line (founder, 2026-10-19): "#341" says how long the list
 * is, and in a market this small any count reads as too big to be true
 * or too small to take seriously.
 *
 * A demo: the link is made from the email. The real waitlist must issue
 * it, and must move people up by `REFERRAL_JUMP` places, before this
 * ships.
 *
 * @module app/design-system/v2/pages/website/waitlist-done
 */

/** A demo referral code from the email's local part ("jess.taylor" → "jesstaylor"). */
const referralCode = (email: string) =>
  (email.split('@')[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'friend';

/** Confirmation and the visitor's referral link. */
export function WaitlistDone({ email }: { email: string }) {
  const link = `https://zebri.com.au/?ref=${referralCode(email)}`;
  return (
    <div role="status" className="flex flex-col items-center gap-3 px-2 py-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-pill bg-grass-100 text-grass-800">
        <DrawnCheck className="size-6" />
      </span>
      <p className="type-subheading text-zebra-950">Welcome to Zebri</p>
      <p className="max-w-sm text-balance type-body text-zebra-500">
        We let people in a few at a time. We&rsquo;ll email {email} when your invite is ready.
      </p>
      <div className="mt-4 w-full border-t border-hairline pt-5 text-left">
        <p className="type-label text-zebra-950">Move up the list</p>
        <p className="mt-1 text-pretty type-body text-zebra-500">
          Every MC or Celebrant who joins with your link moves you up {REFERRAL_JUMP} places.
        </p>
        <div className="mt-3 flex items-center gap-2">
          {/* The link in a read-only field, so it can be read and selected; the button beside it copies it. */}
          <div className="min-w-0 flex-1">
            <Input raised readOnly labelHidden label="Your link" name="referral" value={link} />
          </div>
          <CopyButton value={link} />
        </div>
      </div>
    </div>
  );
}
