'use client';

/**
 * Outreach > Settings view: mailbox, sending pause, and the editable
 * sending, Instagram and booking settings.
 *
 * Setup progress lives on Today, so this page has no checklist. The
 * section ids (mailbox, sending, instagram-booking, sending-pause) stay
 * stable because the Today guide and the Campaigns setup link target them.
 *
 * @module features/outreach/views/settings-view
 */
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { useOutreachSettings, useReadiness } from '@/features/outreach/hooks';

import { MailboxSection } from './settings/mailbox-section';
import { SendingPause } from './settings/sending-pause';
import { SettingsForm } from './settings/settings-form';

/** The settings view. */
export function SettingsView() {
  const q = useOutreachSettings();
  // Why: readiness is read only for `usesBooking`, which decides whether the booking page warning shows.
  const readiness = useReadiness();

  if (q.isPending) return <Loading label="Loading settings" />;
  if (q.isError) {
    return (
      <ErrorState
        error={q.error}
        action={
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const data = q.data;
  // Why: the form column is capped for readable input widths. It is left-aligned, so its edge still lines up with the tabs.
  return (
    <div className="max-w-2xl space-y-10">
      <MailboxSection mailbox={data.mailbox} oauthConfigured={data.oauthConfigured} />
      <SendingPause paused={data.settings.sending_paused} reason={data.settings.paused_reason} />
      <SettingsForm data={data} usesBooking={readiness.data?.usesBooking ?? false} />
    </div>
  );
}
