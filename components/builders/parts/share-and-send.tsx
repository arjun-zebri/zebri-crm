/**
 * Footer row: status badge + Copy link / Open buttons + Save + Send.
 *
 * Layout (sent state):
 *   ✓ Sent 24 May   Copy link   Open ↗               [Save] [Resend]
 *
 * Layout (draft state):
 *   Send to enable share link                        [Save] [Send to couple]
 *
 * No raw URL is rendered — the long share token used to dominate
 * the row. Click "Copy link" to copy; click "Open" to open in a
 * new tab.
 *
 * @module components/builders/parts/share-and-send
 */
'use client';

import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export interface ShareAndSendProps {
  /** Whether anything has been edited since the last save. */
  dirty: boolean;
  /** Whether the share token is enabled (public page live). */
  shareEnabled: boolean;
  /** The full URL the share token resolves to. */
  shareUrl: string | null;
  /** When this is set, the CTA flips to "Resend". */
  lastSentAt: string | null;
  /** Disables every control. */
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

  const sendLabel = lastSentAt ? 'Resend' : 'Send to couple';
  const isLive = shareEnabled && !!shareUrl;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Status + actions (left) */}
      <div className="flex flex-wrap items-center gap-3 text-caption text-text-muted">
        {isLive ? (
          <>
            {lastSentAt ? (
              <span className="inline-flex items-center gap-1.5 text-text">
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-success/10"
                  aria-hidden
                >
                  <Check size={10} strokeWidth={2} className="text-success" />
                </span>
                Sent {formatDateShort(lastSentAt)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-text">
                <Link2 size={12} strokeWidth={1.5} className="text-text-subtle" />
                Share link live
              </span>
            )}

            <span aria-hidden className="text-text-subtle">
              ·
            </span>

            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 text-text-muted hover:text-text transition-colors cursor-pointer"
              aria-label="Copy share link"
            >
              {copied ? (
                <>
                  <Check size={12} strokeWidth={1.5} className="text-success" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} strokeWidth={1.5} />
                  Copy link
                </>
              )}
            </button>

            <a
              href={shareUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-text-muted hover:text-text transition-colors"
            >
              <ExternalLink size={12} strokeWidth={1.5} />
              Open
            </a>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-text-subtle">
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
