/**
 * Footer row: share-link readout + Save + primary "Send to couple" CTA.
 *
 * The primary CTA bundles three things into one click for a draft:
 * 1. Save any pending changes (via `onSave`).
 * 2. Enable the share token (parent flips `shareEnabled` to true).
 * 3. Fire the templated email (via `onSend`).
 *
 * After first send, the CTA flips to "Resend" + a small "Sent {date}"
 * timestamp underneath. The share link is **always visible** once
 * the document has been sent — no toggle / dropdown to find it.
 *
 * @module components/builders/parts/share-and-send
 */
'use client';

import { Check, Copy, Link2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export interface ShareAndSendProps {
  /** Whether anything has been edited since the last save. */
  dirty: boolean;
  /** Whether the share-link toggle is on (the public page is live). */
  shareEnabled: boolean;
  /** The full URL the share token resolves to. Only used once
   *  `shareEnabled` is true. */
  shareUrl: string | null;
  /** When this is set, the CTA flips to "Resend". */
  lastSentAt: string | null;
  /** Disables every control (e.g. paid invoice, cancelled, accepted). */
  locked: boolean;
  /** Whether a save / send is in-flight. */
  saving: boolean;
  sending: boolean;
  /** Whether a coupleId is selected — required before sending. */
  hasCouple: boolean;
  /** Save without sending. */
  onSave: () => void;
  /** First click on a draft: enable share + save + send email. */
  onSend: () => void;
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}

export function ShareAndSend({
  dirty,
  shareEnabled,
  shareUrl,
  lastSentAt,
  locked,
  saving,
  sending,
  hasCouple,
  onSave,
  onSend,
}: ShareAndSendProps) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  // The Send button is the primary CTA. Its label depends on whether
  // the document has been sent before.
  const sendLabel = lastSentAt ? 'Resend' : 'Send to couple';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Share link (left) — always visible once enabled */}
      <div className="flex flex-col gap-1 min-w-0 sm:max-w-md flex-1">
        {shareEnabled && shareUrl ? (
          <>
            <div className="flex items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1">
              <Link2 size={12} strokeWidth={1.5} className="text-text-subtle shrink-0" />
              <input
                readOnly
                value={shareUrl}
                className="flex-1 min-w-0 bg-transparent text-caption text-text-muted focus:outline-none"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex shrink-0 items-center gap-1 rounded-control px-1.5 py-0.5 text-caption text-text-muted hover:text-text hover:bg-surface-muted cursor-pointer"
                aria-label="Copy share link"
              >
                {copied ? (
                  <>
                    <Check size={11} strokeWidth={1.5} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={11} strokeWidth={1.5} /> Copy
                  </>
                )}
              </button>
            </div>
            {lastSentAt ? (
              <span className="text-caption text-text-muted">
                Sent {formatDateShort(lastSentAt)}
              </span>
            ) : null}
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-caption text-text-subtle">
            <Link2 size={12} strokeWidth={1.5} />
            Send to enable share link
          </span>
        )}
      </div>

      {/* Save + Send (right) */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="secondary"
          onClick={onSave}
          disabled={!dirty || saving || sending || locked}
          loading={saving}
        >
          Save changes
        </Button>
        <Button
          variant="primary"
          onClick={onSend}
          disabled={!hasCouple || sending || saving || locked}
          loading={sending}
        >
          {sendLabel}
        </Button>
      </div>
    </div>
  );
}
