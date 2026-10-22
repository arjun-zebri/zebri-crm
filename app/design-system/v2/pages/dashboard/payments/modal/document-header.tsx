'use client';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { DialogHeader } from '@/components/ui-v2/dialog-parts';
import { ContractIcon, InvoiceIcon } from '@/components/ui-v2/icons';

import { coupleName, money, signedLine, type Contract, type Invoice } from '../payments-data';

import { MoreMenu, type MoreItem } from './more-menu';

/**
 * The document modal's header, on the v2 dialog anatomy: the
 * `DialogHeader` row (the document's icon and name, quiet, and Close),
 * then the couple large with where it stands as a badge, over which
 * payment and how much. Its actions sit on the header row before Close:
 * More, Copy link, Mark paid, then the next step as the one primary (Send reminder while money
 * or a signature is owed), last, nearest the hand. A settled document
 * has no primary at all. Mark paid is for money that came in outside
 * Zebri, such as cash on the day. No rules: the header is a row on the
 * white.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/document-header
 */

const none = () => undefined;

export interface DocumentHeaderProps {
  kind: 'invoice' | 'contract';
  /** The open invoice or contract; neither for a new one. */
  invoice?: Invoice | undefined;
  contract?: Contract | undefined;
  onRemind: () => void;
  onMarkPaid: () => void;
  onClose: () => void;
}

/** The header. See {@link DocumentHeaderProps}. */
export function DocumentHeader({ kind, invoice: i, contract: c, onRemind, onMarkPaid, onClose }: DocumentHeaderProps) {
  const title = i ? `Invoice #${i.number}` : c ? c.title : `New ${kind}`;
  const names = i?.names ?? c?.names;
  const sub = i ? `${i.label} · ${money(i.amount)}` : c ? c.item : null;
  const owed = (i && !i.paidOn) || c?.group === 'waiting';
  const state = i ? i.when : c ? (c.group === 'waiting' ? signedLine(c) : c.when) : null;
  const more: MoreItem[] = [
    { label: 'Download PDF', run: none },
    { label: 'Edit', run: none },
    i ? { label: 'Void invoice', run: none, danger: true } : { label: 'Delete contract', run: none, danger: true },
  ];
  return (
    <>
      <DialogHeader
        id="doc-title"
        icon={kind === 'invoice' ? InvoiceIcon : ContractIcon}
        title={title}
        onClose={onClose}
        actions={
          i || c ? (
            <>
              <MoreMenu items={more} />
              <CopyButton value={`https://zebri.app/${i ? 'pay' : 'sign'}/${(i ?? c)!.id}`} label={i ? 'Copy pay link' : 'Copy signing link'} />
              {i && !i.paidOn ? (
                <Button variant="secondary" onClick={onMarkPaid}>
                  Mark paid
                </Button>
              ) : null}
              {owed ? <Button onClick={onRemind}>Send reminder</Button> : null}
            </>
          ) : null
        }
      />
      <div className="shrink-0 space-y-1 px-6 pb-6 pt-2 sm:px-10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p id="doc-couple" className="type-title text-zebra-950">{names ? coupleName(names) : title}</p>
          {state ? (
            <Badge dot tone={i?.group === 'overdue' ? 'danger' : 'neutral'}>
              {state}
            </Badge>
          ) : null}
        </div>
        {sub ? <p className="type-body text-zebra-500">{sub}</p> : null}
      </div>
    </>
  );
}
