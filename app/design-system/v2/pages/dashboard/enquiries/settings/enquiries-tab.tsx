'use client';

import { MessagesSection } from './account-sections';
import { useEnquirySettings } from './use-enquiry-settings';

/**
 * The Enquiries tab of Settings: where enquiries come from. Today that
 * is one section, the inboxes and Instagram; website forms and
 * directories come in through the inbox. No heading of its own: the
 * tab already names it. Owned by the Enquiries feature; the Settings shell only lists it.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/settings/enquiries-tab
 */
export function EnquiriesTab() {
  const s = useEnquirySettings();
  return (
    <MessagesSection settings={s} />
  );
}
