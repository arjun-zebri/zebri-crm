'use client';

import { Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { COLLAPSE_MS } from '@/components/ui-v2/collapse';
import { InlineInput } from '@/components/ui-v2/inline-input';

import { PackageRow, type PackageDraft } from './package-row';
import type { DemoPackage } from './packages';

/**
 * Step 3, What you sell: a price list the MC types straight into, and
 * the deposit that holds a date, set inside a sentence. Zero packages
 * is fine: a blank row is ignored. Rows grow in when added and fold
 * away when removed, by height, so "Add another package" and the deposit line
 * below move with the layout in one continuous motion. Comes before the brand step so the
 * brand preview and the replay show the MC's own packages and prices;
 * the flow owns the data, this step only edits it.
 *
 * @module app/design-system/v2/pages/onboarding/step-packages
 */

/** Always one row, so a skipped step still has somewhere to type. */
const MIN_ROWS = 1;
const MAX_ROWS = 8;

export interface StepPackagesProps {
  packages: DemoPackage[];
  deposit: number;
  onPackages: (packages: DemoPackage[]) => void;
  onDeposit: (percent: number) => void;
}

const blank = (id: number): PackageDraft => ({ id, name: '', price: '', lines: [] });

function toRows(packages: DemoPackage[]): PackageDraft[] {
  const rows = packages.map((p, id) => ({ id, name: p.name, price: p.price ? String(p.price) : '', lines: p.lines }));
  while (rows.length < MIN_ROWS) rows.push(blank(rows.length));
  return rows;
}

/** Named rows become packages. A repeated name keeps its first row only. */
function toPackages(rows: PackageDraft[]): DemoPackage[] {
  const seen = new Set<string>();
  return rows.flatMap((r) => {
    const name = r.name.trim();
    if (!name || seen.has(name)) return [];
    seen.add(name);
    return [{ name, price: Number(r.price) || 0, lines: r.lines }];
  });
}

export function StepPackages({ packages, deposit, onPackages, onDeposit }: StepPackagesProps) {
  // The rows hold blanks and half-typed names the flow never sees.
  const [rows, setRows] = useState(() => toRows(packages));
  // Rows folding away: still rendered until their collapse finishes,
  // but already gone from the packages the flow sees.
  const [leaving, setLeaving] = useState<number[]>([]);
  // Rows added here grow in; the ones there at first just are.
  const [added, setAdded] = useState<number[]>([]);
  const [percent, setPercent] = useState(String(deposit));
  const nextId = useRef(rows.length);
  const errorId = useId();
  const depositValid = Number(percent) >= 1 && Number(percent) <= 99;

  const visible = rows.filter((r) => !leaving.includes(r.id));

  function update(next: PackageDraft[]) {
    setRows(next);
    onPackages(toPackages(next.filter((r) => !leaving.includes(r.id))));
  }
  function newRow() {
    const row = blank(nextId.current++);
    setAdded((a) => [...a, row.id]);
    return row;
  }
  function addRow() {
    const row = newRow();
    update([...rows, row]);
    // Straight into the new row's name, once it has rendered.
    setTimeout(() => document.getElementById(`package-${row.id}-name`)?.focus());
  }
  function removeRow(id: number) {
    const left = visible.filter((r) => r.id !== id);
    // Never an empty list: the last row out leaves a blank one to type in.
    const next = left.length ? rows : [...rows, newRow()];
    setRows(next);
    setLeaving((l) => [...l, id]);
    onPackages(toPackages(next.filter((r) => r.id !== id && !leaving.includes(r.id))));
    setTimeout(() => {
      setRows((rs) => rs.filter((r) => r.id !== id));
      setLeaving((l) => l.filter((x) => x !== id));
    }, COLLAPSE_MS);
  }

  return (
    <div className="max-w-3xl">
      <ul aria-label="Your packages">
        {rows.map((row) => (
          <PackageRow
            key={row.id}
            row={row}
            // Numbered among the rows staying; a leaving row keeps a spare.
            number={visible.indexOf(row) + 1 || rows.length + 1}
            shown={!leaving.includes(row.id)}
            appear={added.includes(row.id)}
            onChange={(r) => update(rows.map((x) => (x.id === r.id ? r : x)))}
            onRemove={() => removeRow(row.id)}
          />
        ))}
      </ul>
      {visible.length < MAX_ROWS ? (
        <Button variant="plain" className="mt-3" onClick={addRow}>
          <Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />
          Add another package
        </Button>
      ) : null}
      <div className="mt-10 space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 type-lead text-zebra-700">
          Couples pay
          <InlineInput
            aria-label="Deposit percent"
            aria-invalid={depositValid ? undefined : true}
            aria-describedby={depositValid ? undefined : errorId}
            underline
            suffix="%"
            inputMode="numeric"
            value={percent}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 2);
              setPercent(v);
              if (Number(v) >= 1) onDeposit(Number(v));
            }}
            className="type-subheading text-zebra-950 tabular-nums"
          />
          to lock in their date.
        </p>
        {depositValid ? null : (
          <p id={errorId} className="type-body text-danger">
            Enter a deposit between 1% and 99%.
          </p>
        )}
      </div>
    </div>
  );
}
