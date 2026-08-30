/**
 * Footer row: status badge + Copy link / Open buttons + Save + Send.
 *
 * Layout (sent state):
 *   ✓ Sent 24 May   Copy link   Open ↗               [Save] [Resend]
 *
 * Layout (draft state — share link live by default since
 * `share_token_enabled` defaults to true on insert):
 *   🔗 Share link live  Copy link  Open ↗  Mark as sent  [Save] [Send]
 *
 * "Mark as sent" (shown only while `canMarkSent`) lets an MC who
 * shared the link out-of-band flip draft→sent without an email.
 *
 * Layout (no doc yet — `shareUrl === null`):
 *   (left side hidden)                               [Save] [Send to couple]
 *
 * No raw URL is rendered — the long share token used to dominate
 * the row. Click "Copy link" to copy; click "Open" to open in a
 * new tab.
 *
 * @module components/builders/parts/share-and-send
 */
'use client';

import { Check, CheckCheck, ExternalLink, Link2, Loader2, FileDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import type { SignerLink } from '@/lib/contracts/signer-links';

import { SignerLinksPopover } from './signer-links-popover';

export interface ShareAndSendProps {
  /** Whether anything has been edited since the last save. */
  dirty: boolean;
  /** Whether the share token is enabled (public page live). After
   *  the 2026-05-27 schema change this is `true` from creation;
   *  the prop stays so callers can express "this doc is
   *  explicitly disabled" if a future workflow needs it (e.g. an
   *  MC pausing public access without deleting). */
  shareEnabled: boolean;
  /** The full URL the share token resolves to. */
  shareUrl: string | null;
  /** When this is set, the status flips to "Sent {date}". */
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
  /** Send email to the couple. The share link is already live
   *  pre-send; this triggers the email + flips the status. */
  onSend: () => void;
  /**
   * When set, replaces the live-link status label ("Share link live" /
   * "Sent <date>") with a Download PDF action. Contracts pass this: an MC
   * looking at a live contract wants the file, not a status pill. Invoices
   * leave it unset and keep the labels.
   */
  onDownloadPdf?: () => void;
  /**
   * Per-contact signing links. When set, "Copy link" opens a popover with
   * one link per contact instead of copying the single share URL, in every
   * state (an MC lines up links before sending), and there is no "Open":
   * each link is one person's, and the MC opening it would log a 'viewed'
   * audit event in that person's name. Invoices have one link and leave
   * this unset.
   */
  signerLinks?: SignerLink[];
  /** A line under the per-contact links, e.g. that they go live on send. */
  signerLinksNote?: string;
  /** Fired when the per-contact popover opens (used to save an unsaved draft). */
  onSignerLinksOpen?: () => void;
  /** Whether the "Mark as sent" affordance applies — i.e. the doc is
   *  still a draft. Lets an MC who shared the link out-of-band (copied
   *  it, texted it) flip the status to "sent" without firing an email. */
  canMarkSent?: boolean;
  /** Whether a mark-as-sent is in-flight. */
  markingSent?: boolean;
  /** Flip the status to "sent" without sending an email. */
  onMarkSent?: () => void;
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
  canMarkSent = false,
  markingSent = false,
  onMarkSent,
  onDownloadPdf,
  signerLinks,
  signerLinksNote,
  onSignerLinksOpen,
}: ShareAndSendProps) {

  const sendLabel = lastSentAt ? 'Resend' : 'Send to couple';
  const isLive = shareEnabled && !!shareUrl;
  const perContact = !!signerLinks?.length;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Status + actions (left). `animate-fade-in` runs whenever
          the children re-render with a new conditional branch —
          smooths the draft→live transition the moment the first
          send lands. */}
      <div
        key={isLive ? 'live' : 'draft'}
        className="flex flex-wrap items-center gap-3 text-body text-text-muted animate-fade-in"
      >
        {/* Download PDF is about the document, not the link, so it is
            offered in every state, including a draft whose link is not
            live yet. */}
        {onDownloadPdf ? (
          <button
            type="button"
            onClick={onDownloadPdf}
            className="inline-flex items-center gap-1.5 text-text hover:opacity-70 transition"
          >
            <FileDown size={12} strokeWidth={1.5} className="text-text-subtle" />
            Download PDF
          </button>
        ) : null}
        {perContact ? (
          <>
            {onDownloadPdf ? (
              <span aria-hidden className="text-text-subtle">
                ·
              </span>
            ) : null}
            <SignerLinksPopover
              links={signerLinks!}
              {...(signerLinksNote ? { note: signerLinksNote } : {})}
              {...(onSignerLinksOpen ? { onOpen: onSignerLinksOpen } : {})}
            />
          </>
        ) : null}
        {isLive ? (
          <>
            {onDownloadPdf ? null : lastSentAt ? (
              <span className="inline-flex items-center gap-1.5 text-text">
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-pill bg-success/10"
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

            {perContact ? null : (
              <>
                <span aria-hidden className="text-text-subtle">
                  ·
                </span>

                <CopyButton
                  plain
                  value={shareUrl ?? ''}
                  label="Copy link"
                  copiedLabel="Copied"
                  aria-label="Copy share link"
                />

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
            )}

            {/* Out-of-band send: the MC copied the link and sent it
                themselves (text, their own email client). Lets them
                flip draft→sent without firing our templated email. */}
            {canMarkSent && onMarkSent ? (
              <>
                <span aria-hidden className="text-text-subtle">
                  ·
                </span>
                <button
                  type="button"
                  onClick={onMarkSent}
                  disabled={markingSent || locked}
                  className="inline-flex items-center gap-1 text-text-muted hover:text-text transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {markingSent ? (
                    <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                  ) : (
                    <CheckCheck size={12} strokeWidth={1.5} />
                  )}
                  Mark as sent
                </button>
              </>
            ) : null}
          </>
        ) : canMarkSent && onMarkSent && shareUrl ? (
          // Draft whose link isn't live yet (the token is disabled
          // until a send): the out-of-band path still needs to be
          // reachable — marking as sent enables the link.
          <button
            type="button"
            onClick={onMarkSent}
            disabled={markingSent || locked}
            className="inline-flex items-center gap-1 text-text-muted hover:text-text transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingSent ? (
              <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <CheckCheck size={12} strokeWidth={1.5} />
            )}
            Mark as sent
          </button>
        ) : null}
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
