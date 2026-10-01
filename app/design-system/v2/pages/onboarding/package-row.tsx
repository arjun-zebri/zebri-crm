'use client';

import { Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Collapse } from '@/components/ui-v2/collapse';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { TagList } from '@/components/ui-v2/tag-list';

/**
 * One line of step 3's price list: the package name and its price as
 * the row itself, and under them what it includes, as removable tags
 * with "Add an inclusion" to write more. Nothing is suggested: every
 * MC's list is their own. The row grows in when added and folds away
 * when removed.
 *
 * @module app/design-system/v2/pages/onboarding/package-row
 */

/** A row as typed, before it becomes a package. Blank rows are allowed. */
export interface PackageDraft {
  id: number;
  name: string;
  /** Digits only, as typed; empty until a price is entered. */
  price: string;
  lines: string[];
}

export interface PackageRowProps {
  row: PackageDraft;
  /** 1-based, for the fields' names ("Package 2 price"). */
  number: number;
  onChange: (row: PackageDraft) => void;
  onRemove: () => void;
  /** False while the row is leaving: it folds away before it unmounts. */
  shown: boolean;
  /** Grow in on mount (a row just added), rather than be there already. */
  appear: boolean;
}

export function PackageRow({ row, number, onChange, onRemove, shown, appear }: PackageRowProps) {
  const [adding, setAdding] = useState(false);
  const [own, setOwn] = useState('');
  const title = row.name.trim() || `package ${number}`;

  function addOwn() {
    const line = own.trim();
    if (line && !row.lines.includes(line)) onChange({ ...row, lines: [...row.lines, line] });
    setOwn('');
  }
  function onOwnKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOwn();
    } else if (e.key === 'Escape') {
      setOwn('');
      setAdding(false);
    }
  }

  return (
    <li>
      {/* The row grows in and folds away by height, so everything under
          the list moves with it in one continuous motion. */}
      <Collapse open={shown} appear={appear}>
        <div className="group/row border-b border-zebra-200 py-5">
          <div className="flex items-center gap-4">
            <InlineInput
              id={`package-${row.id}-name`}
              aria-label={`Package ${number} name`}
              placeholder="Package name"
              maxLength={60}
              value={row.name}
              onChange={(e) => onChange({ ...row, name: e.target.value })}
              className="flex-1 type-heading font-medium"
            />
            <span aria-hidden="true" className="type-heading font-normal text-zebra-300">
              $
            </span>
            <InlineInput
              aria-label={`Package ${number} price in dollars`}
              inputMode="numeric"
              placeholder="0"
              value={row.price}
              // Whole dollars under 100,000: a rough price, not an invoice.
              onChange={(e) =>
                onChange({ ...row, price: e.target.value.replace(/\D/g, '').slice(0, 5) })
              }
              className="w-24 text-right type-heading font-normal tabular-nums"
            />
            {/* With a mouse, the remove X shows on hover, or when it has
                keyboard focus itself; not while typing in the row, or it
                would fade on the row above whenever a package is added.
                Phones always show it. */}
            <span className="transition-opacity duration-150 motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-within:opacity-100">
              <Button variant="ghost" square aria-label={`Remove ${title}`} onClick={onRemove}>
                <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </span>
          </div>
          {/* Always shown, on every row: swapping it for a summary on
              rows without focus made the row above flash each time a
              package was added. */}
          <div className="mt-2">
            <TagList
              label={`What ${title} includes`}
              items={row.lines}
              onRemove={(line) => onChange({ ...row, lines: row.lines.filter((l) => l !== line) })}
              after={
                adding ? (
                  <InlineInput
                    aria-label="New inclusion"
                    ref={(el) => el?.focus()}
                    maxLength={60}
                    value={own}
                    onChange={(e) => setOwn(e.target.value)}
                    onKeyDown={onOwnKey}
                    onBlur={() => (addOwn(), setAdding(false))}
                    className="h-8 w-44 type-label"
                  />
                ) : (
                  <Button variant="plain" onClick={() => setAdding(true)}>
                    <Plus aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
                    Add an inclusion
                  </Button>
                )
              }
            />
          </div>
        </div>
      </Collapse>
    </li>
  );
}
