import { IdCardIcon, LandmarkIcon, LockIcon, SparklesIcon, UserIcon, VenueIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

/**
 * The Security row's commitments, one tile each (founder, 2026-10-18:
 * "how does this provide any detail on security"). Launch commitments:
 * each says only what the FAQ (`faq-data.ts`) or the codebase backs
 * (row-level security on every owned table), so change them with the
 * product, never for the copy. Deliberately no "nothing leaves
 * Australia": processors named in the privacy policy may be overseas.
 * Checked against the code (2026-10-19): the database and files are in
 * Supabase's Sydney region, but email (Resend), payments (Stripe) and
 * the app's server code (Vercel, no region set) are not, so it says
 * "records and files", never "everything". The AI calls Anthropic's API
 * directly, which is not in Australia and keeps data for a time unless
 * a zero-retention agreement is in place, so it claims neither.
 *
 * @module app/design-system/v2/pages/website/security-points
 */

export interface SecurityPoint {
  icon: ZebriIcon;
  title: string;
  detail: string;
}

export const SECURITY_POINTS: readonly SecurityPoint[] = [
  {
    icon: VenueIcon,
    title: 'Stored in Sydney',
    detail: 'Your couples’ records and files are stored in a Sydney data centre.',
  },
  {
    icon: LockIcon,
    title: 'Encrypted',
    detail: 'In transit and at rest. Every connection to Zebri is encrypted.',
  },
  {
    icon: SparklesIcon,
    title: 'Never trains AI',
    detail:
      'Your couples’ details are never used to train any AI model, ours or anyone else’s.',
  },
  {
    icon: UserIcon,
    title: 'Your account only',
    detail:
      'Each account is walled off in the database itself, so no other Zebri user can read your couples.',
  },
  {
    icon: IdCardIcon,
    title: 'Marriage paperwork',
    detail:
      'ID documents never go to an AI model, and ID images are never stored. Your eRegistry password goes to BDM and is never stored.',
  },
  {
    icon: LandmarkIcon,
    title: 'Australian privacy law',
    detail:
      'Bound by the Privacy Act 1988 and the Australian Privacy Principles. Every company that handles data for us is named in our privacy policy.',
  },
];
