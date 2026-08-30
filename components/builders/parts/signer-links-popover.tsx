/**
 * "Copy link" for a multi-signer contract.
 *
 * Opens a popover with one row per contact (primary, secondary), each with its
 * own signing link. A contact who does not exist on the couple is shown greyed
 * out with a tooltip saying why, rather than hidden: the MC then sees at a
 * glance that only one partner will be asked to sign.
 *
 * @module components/builders/parts/signer-links-popover
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { Link2 } from 'lucide-react';

import { CopyButton } from '@/components/ui/copy-button';
import { Tooltip } from '@/components/ui/tooltip';
import type { SignerLink } from '@/lib/contracts/signer-links';

export interface SignerLinksPopoverProps {
  /** Rows from {@link signerLinks}, primary first. */
  links: SignerLink[];
  /** Shown under the rows; used on a draft to say the links go live on send. */
  note?: string;
  /** Fired when the popover opens. The contract footer saves an unsaved
   *  draft here so the links exist by the time the MC reads them. */
  onOpen?: () => void;
}

function Row({ link }: { link: SignerLink }) {
  const row = (
    <div
      className={`flex w-full items-center justify-between gap-4 ${
        link.url ? '' : 'opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="min-w-0">
        <p className="text-body text-text-subtle">{link.label}</p>
        <p className="text-body text-text truncate">{link.name ?? 'Not set'}</p>
      </div>
      <CopyButton
        plain
        value={link.url ?? ''}
        label="Copy"
        copiedLabel="Copied"
        aria-label={`Copy link for ${link.label.toLowerCase()}`}
        disabled={!link.url}
      />
    </div>
  );
  if (link.url || !link.unavailableReason) return row;
  return (
    <Tooltip label={link.unavailableReason} multiline className="w-full">
      {row}
    </Tooltip>
  );
}

export function SignerLinksPopover({ links, note, onOpen }: SignerLinksPopoverProps) {
  return (
    <Popover.Root onOpenChange={(open) => open && onOpen?.()}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-text transition-colors"
        >
          <Link2 size={12} strokeWidth={1.5} />
          Copy link
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        {/* z-[90]: the popover tier, above the modal panel this sits in. */}
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[90] w-[300px] bg-surface border border-border rounded-control shadow-xl p-3 space-y-3 text-body animate-modal-in"
        >
          {links.map((link) => (
            <Row key={link.label} link={link} />
          ))}
          {note ? <p className="text-body text-text-subtle">{note}</p> : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
