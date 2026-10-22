'use client';

/**
 * Settings > Mailbox: connect, inspect or disconnect the Gmail account
 * that sends and reads outreach email.
 *
 * Reads the `?mailbox=` result of the OAuth round trip once, toasts it,
 * then strips the param so a refresh does not toast again.
 *
 * @module features/outreach/views/settings/mailbox-section
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { disconnectMailboxAction } from '@/features/outreach/actions';
import { useOutreachMutation } from '@/features/outreach/hooks';
import { formatDay, formatWhen } from '@/features/outreach/views/checks/format';
import type { MailboxInfo } from '@/lib/outreach/services/settings';

import { mailboxMessage } from './mailbox-messages';
import { SectionHeading } from './section-heading';

/**
 * @param props.mailbox - The connected account, or null.
 * @param props.oauthConfigured - False when the Google OAuth env vars are missing.
 */
export function MailboxSection({ mailbox, oauthConfigured }: { mailbox: MailboxInfo | null; oauthConfigured: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const handled = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const disconnect = useOutreachMutation(disconnectMailboxAction, 'Gmail disconnected');

  useEffect(() => {
    const code = params.get('mailbox');
    if (!code || handled.current) return;
    handled.current = true;
    const msg = mailboxMessage(code);
    if (msg) toast(msg.message, msg.type);
    router.replace('/admin/outreach?view=settings');
  }, [params, router, toast]);

  return (
    <section id="mailbox" className="space-y-6 scroll-mt-6">
      <SectionHeading title="Mailbox" description="The Gmail account that sends outreach and reads replies." />
      {mailbox ? (
        <div className="space-y-3">
          <p className="text-body font-medium text-text">{mailbox.email}</p>
          <p className="text-body text-text-muted">
            Connected {formatDay(mailbox.connectedAt)} ·{' '}
            {mailbox.lastPolledAt ? `Last checked ${formatWhen(mailbox.lastPolledAt)}` : 'Not checked yet'}
          </p>
          {mailbox.lastError && <p className="text-body text-danger">{mailbox.lastError}</p>}
          <div>
            <Button variant="outline" onClick={() => setConfirming(true)}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : oauthConfigured ? (
        <div className="space-y-3">
          <p className="text-body text-text-muted">No Gmail account connected. Sending and replies need one.</p>
          <div>
            <Button onClick={() => (window.location.href = '/api/admin/outreach/gmail/connect')}>Connect Gmail</Button>
          </div>
        </div>
      ) : (
        // Why: one card and no disabled button. A button that cannot work is worse than saying what is missing.
        <Card padding="md" className="space-y-2">
          <p className="text-body font-medium text-text">Gmail isn&apos;t set up on the server yet</p>
          <p className="text-body text-text-muted">
            Add the Google OAuth client in Vercel. Setup steps are in docs/outreach-guide.md.
          </p>
        </Card>
      )}
      <ConfirmDialog
        open={confirming}
        title="Disconnect Gmail?"
        description="No emails send and replies stop being read. Reconnecting does not restart sending: press Resume sending in Today."
        confirmLabel="Disconnect"
        loading={disconnect.isPending}
        onConfirm={() => disconnect.mutate(undefined, { onSuccess: () => setConfirming(false) })}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
