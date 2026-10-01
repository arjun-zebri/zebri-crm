'use client';

import { MoreHorizontal, X } from 'lucide-react';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { CopyButton } from '@/components/ui-v2/copy-button';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { coupleName, money, signedLine, type Contract, type Invoice } from '../payments-data';

/**
 * The document modal's header, one row: the document's name and where
 * it stands on the left, over who it is for (and, for an invoice, which
 * payment and how much); its actions on the right, then More and Close
 * past a hairline. The next step is the one primary (Send reminder while
 * money or a signature is owed) and sits last, nearest the hand; a
 * settled document has no primary at all. Mark paid is for money that
 * came in outside Zebri, such as cash on the day. On phones the actions
 * wrap under the title.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/document-header
 */

const MORE: Record<'invoice' | 'contract', string[]> = {
  invoice: ['Download PDF', 'Edit', 'Void invoice'],
  contract: ['Download PDF', 'Edit', 'Delete contract'],
};

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
  const sub = i ? `${coupleName(i.names)} · ${i.label} · ${money(i.amount)}` : c ? `${coupleName(c.names)} · ${c.item}` : null;
  const owed = (i && !i.paidOn) || c?.group === 'waiting';
  const state = i ? i.when : c ? (c.group === 'waiting' ? signedLine(c) : c.when) : null;
  return (
    <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-zebra-950/5 px-5 pb-5 pt-6 md:px-8">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id="doc-title" className="type-title text-zebra-950">
            {title}
          </h2>
          {state ? <Badge tone={i?.group === 'overdue' ? 'danger' : 'neutral'}>{state}</Badge> : null}
        </div>
        {sub ? <p className="type-body text-zebra-500">{sub}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 max-sm:order-last max-sm:w-full">
        {i || c ? (
          <>
            <CopyButton value={`https://zebri.app/${i ? 'pay' : 'sign'}/${(i ?? c)!.id}`} label={i ? 'Copy pay link' : 'Copy signing link'} />
            {i && !i.paidOn ? (
              <Button variant="secondary" onClick={onMarkPaid}>
                Mark paid
              </Button>
            ) : null}
            {owed ? <Button onClick={onRemind}>Send reminder</Button> : null}
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-1 sm:border-l sm:border-zebra-950/5 sm:pl-4">
        {i || c ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" square aria-label="More">
                <MoreHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent size="menu" align="end" role="menu" aria-label="More">
              {MORE[kind].map((item, n) => (
                <MenuOption key={item} onSelect={() => undefined}>
                  <span className={n === 2 ? 'text-danger' : undefined}>{item}</span>
                </MenuOption>
              ))}
            </PopoverContent>
          </Popover>
        ) : null}
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
        </Button>
      </div>
    </header>
  );
}
