import { Globe, Landmark } from 'lucide-react';
import type { ComponentType } from 'react';
import { PiMicrosoftOutlookLogoFill } from 'react-icons/pi';
import { SiApple, SiFacebook, SiGmail, SiGooglecalendar, SiInstagram, SiQuickbooks, SiXero } from 'react-icons/si';

/**
 * What step 2 (Plug Zebri in) offers to connect: groups, each with one
 * short reason, and the providers inside them with their real marks.
 *
 * Marks are Simple Icons in each brand's own colour; Outlook has no
 * Simple Icons mark, so it uses Phosphor's Outlook logo. The website
 * form and BDM are not brands, so they take a plain Lucide glyph in
 * neutral grey (no `color`).
 *
 * @module app/design-system/v2/pages/onboarding/connections
 */

/** How a connection row can be acted on. */
export type ConnectionKind = 'connect' | 'setup' | 'soon';

/** Any mark component: a react-icons brand icon or a Lucide glyph. */
export type Mark = ComponentType<{ className?: string; color?: string; 'aria-hidden'?: boolean }>;

/** One provider row. */
export interface Connection {
  name: string;
  kind: ConnectionKind;
  icon: Mark;
  /** Brand colour for the mark; omit for a neutral glyph. */
  color?: string;
}

/** A group of connections with its reason line. */
export interface ConnectionGroup {
  title: string;
  why: string;
  rows: Connection[];
}

export const CONNECTIONS: ConnectionGroup[] = [
  {
    title: 'Calendar',
    why: 'Your own Calendly. Couples book, your calendar fills.',
    rows: [
      { name: 'Google Calendar', kind: 'connect', icon: SiGooglecalendar, color: '#4285F4' },
      { name: 'Outlook Calendar', kind: 'connect', icon: PiMicrosoftOutlookLogoFill, color: '#0078D4' },
      { name: 'Apple Calendar', kind: 'soon', icon: SiApple, color: '#000000' },
    ],
  },
  {
    title: 'Email',
    why: 'Send from your address. Enquiries become leads.',
    rows: [
      { name: 'Gmail', kind: 'connect', icon: SiGmail, color: '#EA4335' },
      { name: 'Outlook mail', kind: 'connect', icon: PiMicrosoftOutlookLogoFill, color: '#0078D4' },
    ],
  },
  {
    title: 'Accounting',
    why: 'Invoice in Zebri. Your books stay in sync.',
    rows: [
      { name: 'Xero', kind: 'soon', icon: SiXero, color: '#13B5EA' },
      { name: 'QuickBooks', kind: 'soon', icon: SiQuickbooks, color: '#2CA01C' },
    ],
  },
  {
    title: 'Socials & website',
    why: 'DMs and form enquiries arrive as leads.',
    rows: [
      { name: 'Instagram DMs', kind: 'soon', icon: SiInstagram, color: '#E4405F' },
      { name: 'Facebook Page messages', kind: 'soon', icon: SiFacebook, color: '#0866FF' },
      { name: 'Website enquiry form', kind: 'setup', icon: Globe },
    ],
  },
  {
    title: 'Government',
    why: 'Lodge marriage paperwork straight to BDM.',
    rows: [{ name: 'Births, Deaths and Marriages', kind: 'soon', icon: Landmark }],
  },
];
