'use client';

import type { Enquiry } from '../demo-activity';

import { EnquiryDialog } from './enquiry-dialog';
import type { EnquiriesState } from './use-enquiries';

/**
 * The dialog an Enquiries popover row leads to: the open enquiry
 * (Settings is its own dialog, `settings/settings-dialog.tsx`). Rendered by `TopActions` beside its popover, so
 * they outlive the popover closing. Sending marks the enquiry replied
 * and archiving takes it off the list; both close the dialog.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/enquiry-modals
 */
export function EnquiryModals({ items, state: enq }: { items: readonly Enquiry[]; state: EnquiriesState }) {
  return (
    <EnquiryDialog
        enquiry={items.find((e) => e.id === enq.open)}
        onSent={(id) => {
          enq.reply(id);
          enq.setOpen(null);
        }}
        onArchive={(id) => {
          enq.archive(id);
          enq.setOpen(null);
        }}
        onClose={() => enq.setOpen(null)}
      />
  );
}
