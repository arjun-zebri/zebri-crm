import { useState } from 'react';

/**
 * What happens to enquiries after the popover: which one is open in the
 * enquiry modal, and which have been replied to or archived. Held by
 * `TopActions`, beside its unread state, so the rows, the modal and the icon's dot stay in step.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/use-enquiries
 */
export function useEnquiries() {
  const [open, setOpen] = useState<string | null>(null);
  const [replied, setReplied] = useState<ReadonlySet<string>>(() => new Set());
  const [archived, setArchived] = useState<ReadonlySet<string>>(() => new Set());
  return {
    /** The enquiry open in the modal. */
    open,
    setOpen,
    replied,
    archived,
    reply: (id: string) => setReplied((s) => new Set([...s, id])),
    archive: (id: string) => setArchived((s) => new Set([...s, id])),
  };
}

/** What {@link useEnquiries} returns. */
export type EnquiriesState = ReturnType<typeof useEnquiries>;
