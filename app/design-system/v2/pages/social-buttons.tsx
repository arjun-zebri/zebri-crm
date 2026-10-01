import { Button } from '@/components/ui-v2/button';

/**
 * "Continue with Google / Outlook" buttons for the v2 auth page designs.
 * Visual only: the live app has no Google or Microsoft sign-in configured
 * yet, so these do nothing when pressed.
 *
 * The marks are inline SVG because Lucide has no brand logos. Google's
 * "G" and the Microsoft four-square mark (shown for Outlook, which
 * signs in through a Microsoft account) keep their brand colours, as
 * both providers' sign-in guidelines require.
 *
 * @module app/design-system/v2/pages/social-buttons
 */

/** The two buttons, stacked. `verb` is "Continue" or "Sign up". */
export function SocialButtons({ verb = 'Continue' }: { verb?: string }) {
  return (
    // The hairline separates "use your email" from "use another account".
    // The card's 24px gap sits above it and pt-6 below, so it lands
    // exactly halfway between the submit button and the first option.
    <div className="space-y-2 border-t border-zebra-200 pt-6">
      <Button variant="secondary" className="w-full">
        <GoogleMark />
        {verb} with Google
      </Button>
      <Button variant="secondary" className="w-full">
        <MicrosoftMark />
        {verb} with Outlook
      </Button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.97 10.97 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}
