import { ActivityIcon, CallIcon, DocumentsIcon, OverviewIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';


/**
 * The profile's four sections, in sidebar order: Overview, Documents,
 * Calls, then Activity. Overview is everything about the client as one
 * sheet of rows; Activity is every message and event; Documents is
 * every proposal, contract, invoice, questionnaire, event document and
 * file; Calls is every video call with the client, live and after, with
 * Zebri's notes. On a wide screen they are icons on a rail (2026-10-09
 * founder mockup); on a phone, text links.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/sections
 */

export type Section = 'overview' | 'activity' | 'documents' | 'calls';

export const SECTIONS: { value: Section; label: string; icon: ZebriIcon }[] = [
  { value: 'overview', label: 'Overview', icon: OverviewIcon },
  { value: 'documents', label: 'Documents', icon: DocumentsIcon },
  { value: 'calls', label: 'Calls', icon: CallIcon },
  // Last: a record to look back on, not where the MC starts (founder, 2026-10-09).
  { value: 'activity', label: 'Activity', icon: ActivityIcon },
];
