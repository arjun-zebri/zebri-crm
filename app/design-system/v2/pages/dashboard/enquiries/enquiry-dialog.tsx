'use client';

import { Avatar } from '@/components/ui-v2/avatar';
import { Dialog } from '@/components/ui-v2/dialog';

import type { Enquiry } from '../demo-activity';

import { availability } from './enquiries-data';
import { EnquiryFacts } from './enquiry-facts';
import { EnquiryHeader } from './enquiry-header';
import { ReplyComposer } from './reply-composer';

/**
 * An enquiry opened from the Enquiries popover: an `xl` v2 dialog (full
 * screen on phones) in the house dialog anatomy (`DialogHeader`, the
 * couple below it as the big content; no bars, no rules). On the left, their
 * message and the reply Zebri drafted, sent on the channel it came in
 * on; on the right, the facts and whether the MC is free that day. The
 * composer is keyed by the enquiry, so each opens on a fresh draft.
 *
 * @module app/design-system/v2/pages/dashboard/enquiries/enquiry-dialog
 */

export interface EnquiryDialogProps {
  /** The open enquiry; closed while undefined. */
  enquiry: Enquiry | undefined;
  onSent: (id: string) => void;
  onArchive: (id: string) => void;
  onClose: () => void;
}

/** The enquiry dialog. See {@link EnquiryDialogProps}. */
export function EnquiryDialog({ enquiry: e, onSent, onArchive, onClose }: EnquiryDialogProps) {
  const date = e ? availability(e) : null;
  return (
    <Dialog open={e !== undefined} onClose={onClose} size="xl" aria-labelledby="enquiry-title">
      {e && date ? (
        <>
          <EnquiryHeader enquiry={e} onArchive={() => onArchive(e.id)} onClose={onClose} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:overflow-hidden">
            <div className="flex min-h-[32rem] flex-col gap-6 p-6 sm:p-10 lg:min-h-0 lg:overflow-y-auto">
              <div className="flex items-start gap-3">
                <Avatar name={e.client.replace(' & ', ' ')} tone="muted" />
                <p className="type-body">
                  <span className="type-label text-zebra-950">{e.client}</span>
                  <span className="block text-zebra-700">{e.message}</span>
                </p>
              </div>
              <ReplyComposer key={e.id} enquiry={e} free={date.free} onSent={() => onSent(e.id)} />
            </div>
            <div className="p-6 max-lg:order-first max-lg:pb-0 sm:p-10 lg:overflow-y-auto lg:pl-0">
              <EnquiryFacts enquiry={e} date={date} />
            </div>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
