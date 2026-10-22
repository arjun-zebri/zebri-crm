'use client';


import { Button } from '@/components/ui-v2/button';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { EmailIcon } from '@/components/ui-v2/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { MAILBOX } from './email-data';

/**
 * Which mailbox the MC's email sends from, always in view on the Email
 * page, because everything here depends on it: a glass button with the
 * address and a grass dot while it is connected, opening a card that
 * says what connecting does (sent from their own address, replies land
 * in their inbox and on the client) with Switch mailbox. Demo only:
 * Switch does nothing yet.
 *
 * @module app/design-system/v2/pages/dashboard/email/mailbox-button
 */

/** The mailbox button. */
export function MailboxButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="glass">
          <span aria-hidden="true" className="size-1.5 rounded-pill bg-grass-600" />
          {MAILBOX.address}
        </Button>
      </PopoverTrigger>
      <PopoverContent size="card" align="end" aria-label="Sending mailbox" className="space-y-3">
        <div className="flex items-center gap-3">
          <IconCircle icon={EmailIcon} />
          <div className="min-w-0">
            <p className="truncate type-label text-zebra-950">{MAILBOX.address}</p>
            <p className="type-body text-zebra-500">
              {MAILBOX.provider}, connected · synced {MAILBOX.synced}
            </p>
          </div>
        </div>
        <p className="type-body text-zebra-500">
          Every email goes from your own address. Replies land in your {MAILBOX.provider} and on the client, and
          Zebri pauses a journey when a couple writes back.
        </p>
        <Button variant="secondary">Switch mailbox</Button>
      </PopoverContent>
    </Popover>
  );
}
