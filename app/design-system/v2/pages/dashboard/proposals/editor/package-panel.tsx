'use client';

import { useState, type KeyboardEvent } from 'react';

import { ListChecksIcon, PackageIcon, PaymentsIcon, ReceiptIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { TagList } from '@/components/ui-v2/tag-list';
import { ValuePicker } from '@/components/ui-v2/value-picker';

import type { DemoPackage } from '../../../onboarding/packages';
import { DEPOSITS, readPercent } from '../../payments/modal/invoice-terms';
import { SETTING_ROWS, SettingRow } from '../../payments/modal/setting-row';

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
    <div className="space-y-6">
      <div className="space-y-1">
        <Input icon={PackageIcon} label="Package" value={pkg.name} onChange={(e) => onPkg({ ...pkg, name: e.target.value })} />
        {/* The "$" rides on the value, since the icon now leads the line; `whole` reads past it. */}
        <Input
          icon={PaymentsIcon}
          label="Price"
          inputMode="numeric"
          value={pkg.price ? `$${pkg.price}` : ''}
          onChange={(e) => onPkg({ ...pkg, price: whole(e.target.value) })}
        />
        <div className={SETTING_ROWS}>
          <SettingRow label="Deposit" icon={ReceiptIcon}>
            <ValuePicker
              label="Deposit"
              value={{ n: deposit, unit: '%' as const }}
              presets={[{ n: 0, unit: '%' as const }, ...DEPOSITS]}
              show={({ n }) => (n ? `${n}%` : 'None')}
              read={(t) => readPercent(t, 0)}
              placeholder="Type a percent…"
              onPick={({ n }) => onDeposit(n)}
            />
          </SettingRow>
        </div>
      </div>
      <div className="space-y-2">
        <Input
          icon={ListChecksIcon}
          label="What it includes"
          maxLength={60}
          value={line}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={onKey}
        />
        <TagList label={`What ${pkg.name || 'the package'} includes`} items={pkg.lines} onRemove={(l) => onPkg({ ...pkg, lines: pkg.lines.filter((x) => x !== l) })} />
      </div>
    </div>
  );
}
