/**
 * Email-sending subsection of the Public Page settings.
 *
 * Lets an MC send couple-facing mail from the shared Zebri address
 * (default) or by connecting their own mailbox over OAuth (Gmail or
 * Outlook) — so mail goes out through their inbox (lands in their Sent
 * folder, replies come back to them). Connecting is the OAuth redirect
 * flow (`/api/oauth/authorize`); this component drives the mode toggle and
 * disconnect, and shows the post-redirect result. Available on every plan.
 *
 * @module app/(dashboard)/settings/public-page-email
 */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/toast';

import { disconnectMailboxAction, setEmailModeAction, type EmailMode } from './public/actions';
import type { PublicSettingsData } from './settings-body';

/** Friendly fallback address shown for the "Send from Zebri" option. */
const DEFAULT_FROM = 'no-reply@zebri.com.au';

const PROVIDER_LABEL: Record<NonNullable<PublicSettingsData['oauthProvider']>, string> = {
  google: 'Gmail',
  microsoft: 'Outlook',
};

interface PublicPageEmailProps {
  initial: PublicSettingsData | null;
}

export function PublicPageEmail({ initial }: PublicPageEmailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [emailMode, setEmailMode] = useState<EmailMode>(initial?.emailMode ?? 'zebri');
  const [status, setStatus] = useState<PublicSettingsData['oauthStatus']>(initial?.oauthStatus ?? 'none');
  const [provider] = useState(initial?.oauthProvider ?? null);
  const [email] = useState(initial?.oauthEmail ?? null);
  const [busy, setBusy] = useState(false);

  // Surface the result of the OAuth round-trip once, then strip the param
  // so a refresh doesn't re-toast.
  const toastedRef = useRef(false);
  useEffect(() => {
    const result = searchParams.get('oauth');
    if (!result || toastedRef.current) return;
    toastedRef.current = true;
    if (result === 'connected') toast('Mailbox connected.');
    else if (result === 'error') toast('Could not connect that mailbox. Please try again.', 'error');
    router.replace('/settings?tab=public');
  }, [searchParams, toast, router]);

  const selectZebri = async () => {
    setEmailMode('zebri');
    await setEmailModeAction({ mode: 'zebri' });
  };

  const selectOauth = async () => {
    setEmailMode('oauth');
    if (status === 'connected') await setEmailModeAction({ mode: 'oauth' });
  };

  const connect = (p: 'google' | 'microsoft') => {
    window.location.href = `/api/oauth/authorize?provider=${p}`;
  };

  const disconnect = async () => {
    setBusy(true);
    const result = await disconnectMailboxAction();
    setBusy(false);
    if (result.ok) {
      setEmailMode('zebri');
      setStatus('none');
    } else {
      toast(result.error, 'error');
    }
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-1">Email</h3>
      <p className="text-xs text-gray-400 mb-3">Where the emails you send to couples come from.</p>

      <div className="space-y-2 max-w-xl">
        <EmailOption
          selected={emailMode === 'zebri'}
          onSelect={selectZebri}
          title="Send from Zebri"
          description={`${DEFAULT_FROM}. Works instantly, no setup.`}
        />
        <EmailOption
          selected={emailMode === 'oauth'}
          onSelect={selectOauth}
          title="Connect your own email"
          description="Send through your own Gmail or Outlook so couples see your address and replies come to you."
        />
      </div>

      {emailMode === 'oauth' && status === 'connected' && (
        <div className="mt-4 pl-7 max-w-xl">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-gray-700">
              <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
              Connected{provider ? ` (${PROVIDER_LABEL[provider]})` : ''} — sending from {email}
            </span>
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              className="shrink-0 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {emailMode === 'oauth' && status !== 'connected' && (
        <div className="mt-4 pl-7 max-w-xl space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => connect('google')}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
            >
              Connect Gmail
            </button>
            <button
              type="button"
              onClick={() => connect('microsoft')}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
            >
              Connect Outlook
            </button>
          </div>
          <p className="text-xs text-gray-400">
            You&rsquo;ll be sent to Google or Microsoft to approve access, then brought back here.
          </p>
        </div>
      )}
    </div>
  );
}

interface EmailOptionProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}

/** A selectable radio-style row for choosing the email sending mode. */
function EmailOption({ selected, onSelect, title, description }: EmailOptionProps) {
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left cursor-pointer">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
          selected ? 'border-gray-900' : 'border-gray-300'
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-gray-900" />}
      </span>
      <span>
        <span className="block text-sm text-gray-900">{title}</span>
        <span className="block text-xs text-gray-400">{description}</span>
      </span>
    </button>
  );
}
