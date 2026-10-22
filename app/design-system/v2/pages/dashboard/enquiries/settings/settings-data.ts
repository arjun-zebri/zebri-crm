import { PiMicrosoftOutlookLogoFill } from 'react-icons/pi';
import { SiGmail, SiInstagram } from 'react-icons/si';

import type { Mark } from '@/app/design-system/v2/pages/onboarding/connections';

/**
 * What the Enquiries tab of Settings offers: the inboxes and Instagram
 * that can be connected. Website forms and directories send email, so
 * the inboxes bring their enquiries in too. Nothing here talks to a real
 * provider; connecting is simulated in `use-enquiry-settings.ts`.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/settings/settings-data
 */

/** Something that can be connected: an inbox or Instagram. */
export interface Account {
  id: string;
  name: string;
  icon: Mark;
  /** Brand colour for the mark; omit for a neutral glyph. */
  color?: string | undefined;
  /** The account it connects as, shown once connected. */
  as: string;
}

export const INBOXES: Account[] = [
  { id: 'gmail', name: 'Gmail', icon: SiGmail, color: '#EA4335', as: 'hello@arjunpunekarmc.com.au' },
  { id: 'outlook', name: 'Outlook', icon: PiMicrosoftOutlookLogoFill, color: '#0078D4', as: 'arjun.punekar@outlook.com' },
];

export const INSTAGRAM: Account = { id: 'instagram', name: 'Instagram', icon: SiInstagram, color: '#E4405F', as: '@arjunpunekarmc' };
