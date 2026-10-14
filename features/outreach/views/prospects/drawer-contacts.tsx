/**
 * Contacts section of the prospect modal: the four ways to reach them.
 *
 * @module features/outreach/views/prospects/drawer-contacts
 */
import type { Prospect } from '@/lib/outreach/types';

import { ContactField } from './contact-field';
import { DrawerSection } from './drawer-parts';

/** Props for {@link ContactsSection}. */
export interface ContactsSectionProps {
  prospect: Prospect;
}

/** Email, Instagram, website and phone, each editable. */
export function ContactsSection({ prospect }: ContactsSectionProps) {
  return (
    <DrawerSection title="Contacts">
      <div className="space-y-4">
        <ContactField kind="email" prospectId={prospect.id} value={prospect.email} source={prospect.email_source} emailCheck={prospect.email_check} />
        <ContactField kind="instagram" prospectId={prospect.id} value={prospect.instagram_handle} source={prospect.instagram_source} />
        <ContactField kind="website" prospectId={prospect.id} value={prospect.website} source={prospect.website_source} />
        <ContactField kind="phone" prospectId={prospect.id} value={prospect.phone} source={null} />
      </div>
    </DrawerSection>
  );
}
