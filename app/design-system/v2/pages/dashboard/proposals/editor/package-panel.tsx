'use client';

import { useState, type KeyboardEvent } from 'react';

import { Input } from '@/components/ui-v2/input';
import { TagList } from '@/components/ui-v2/tag-list';

import type { DemoPackage } from '../../../onboarding/packages';

/**
 * The proposal editor's Package tab: what the couple is offered, what it
 * costs, what it includes, and the deposit that holds their date. Saved
 * as the MC's package on send, so the next proposal starts from it.
 * Prefilled with a starter for what the MC does, so most people only
 * change the number.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/package-panel
 */

export interface PackagePanelProps {
  pkg: DemoPackage;
  onPkg: (pkg: DemoPackage) => void;
  deposit: number;
  onDeposit: (percent: number) => void;
}

/** Whole numbers only: prices here are whole dollars, the deposit a whole percent. */
const whole = (text: string) => Number(text.replace(/[^\d]/g, '')) || 0;

/** The Package tab. See {@link PackagePanelProps}. */
export function PackagePanel({ pkg, onPkg, deposit, onDeposit }: PackagePanelProps) {
  const [line, setLine] = useState('');
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const text = line.trim();
    if (text && !pkg.lines.includes(text)) onPkg({ ...pkg, lines: [...pkg.lines, text] });
    setLine('');
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <Input label="Package" placeholder="What you call it" value={pkg.name} onChange={(e) => onPkg({ ...pkg, name: e.target.value })} />
        <Input
          label="Price"
          inputMode="numeric"
          leading={<span className="type-body text-zebra-400">$</span>}
          value={pkg.price ? String(pkg.price) : ''}
          onChange={(e) => onPkg({ ...pkg, price: whole(e.target.value) })}
        />
      </div>
      <div className="space-y-2">
        <Input
          label="What it includes"
          help="Type one and press Enter."
          placeholder="Rehearsal, or a second microphone"
          maxLength={60}
          value={line}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={onKey}
        />
        <TagList label={`What ${pkg.name || 'the package'} includes`} items={pkg.lines} onRemove={(l) => onPkg({ ...pkg, lines: pkg.lines.filter((x) => x !== l) })} />
      </div>
      <div className="w-32">
        <Input
          label="Deposit"
          inputMode="numeric"
          help="Holds their date"
          trailing={<span className="type-body text-zebra-400">%</span>}
          value={deposit ? String(deposit) : ''}
          onChange={(e) => onDeposit(Math.min(100, whole(e.target.value)))}
        />
      </div>
    </div>
  );
}
