/**
 * The profile's three sections, in sidebar order. Overview is the
 * working view (what needs doing today, what is coming, and the client's
 * details beside it); Activity is every message and event; Documents is
 * every proposal, contract, invoice, questionnaire, event document and
 * file; Calls is every video call with the client, live and after, with
 * Zebri's notes. The links are text only.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/sections
 */

export type Section = 'overview' | 'activity' | 'documents' | 'calls';

export const SECTIONS: { value: Section; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity' },
  { value: 'documents', label: 'Documents' },
  { value: 'calls', label: 'Calls' },
];
