'use client';

import { AlertCircle, CopyCheck } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import {
  CSV_TEMPLATE_HEADERS,
  type CsvHeader,
  type ImportCoupleValues,
  type PreviewEntry,
} from '@/lib/utils/csv-import';

interface CouplesImportPreviewProps {
  entries: PreviewEntry[];
  /** Positions (entry indices) currently checked for import. */
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}

/** Which validated field a CSV column maps to — used to tell whether a
 *  cell's value was dropped (raw present but parsed value empty). */
const HEADER_TO_FIELD: Record<CsvHeader, keyof ImportCoupleValues> = {
  couple_name: 'name',
  primary_name: 'primary_name',
  primary_email: 'primary_email',
  primary_phone: 'primary_phone',
  secondary_name: 'secondary_name',
  secondary_email: 'secondary_email',
  secondary_phone: 'secondary_phone',
  event_date: 'event_date',
  venue: 'venue',
  status: 'status',
};

/** True when a column's raw cell had a value but it was dropped as
 *  unreadable (e.g. a bad date or malformed email). */
function isDropped(entry: PreviewEntry, header: CsvHeader): boolean {
  if (!entry.value) return false;
  if (entry.raw[header].trim() === '') return false;
  const value = entry.value[HEADER_TO_FIELD[header]];
  return value === null || value === '';
}

/** Right-hand status chip for a preview row. */
function KindBadge({ entry }: { entry: PreviewEntry }) {
  if (entry.kind === 'invalid') {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-red-600">
        <AlertCircle size={12} strokeWidth={1.5} />
        {entry.reason ?? 'Invalid row'}
      </span>
    );
  }
  if (entry.kind === 'duplicate') {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
        <CopyCheck size={12} strokeWidth={1.5} />
        Possible duplicate
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-600">
      Ready
    </span>
  );
}

/**
 * The import preview: a scrollable table showing every CSV column and
 * cell value, one row per parsed line, with a per-row checkbox. Valid
 * and duplicate rows are selectable (duplicates start unchecked);
 * invalid rows show their reason and can't be selected. A cell whose
 * value was dropped as unreadable (e.g. a bad date) is shown in red so
 * the loss is visible. The header checkbox toggles all selectable rows.
 *
 * @module app/(dashboard)/couples/couples-import-preview
 */
export function CouplesImportPreview({
  entries,
  selected,
  onChange,
}: CouplesImportPreviewProps) {
  const selectablePositions = useMemo(
    () =>
      entries.reduce<number[]>((acc, entry, i) => {
        if (entry.kind !== 'invalid') acc.push(i);
        return acc;
      }, []),
    [entries],
  );

  const allSelected =
    selectablePositions.length > 0 &&
    selectablePositions.every((i) => selected.has(i));
  const someSelected = selectablePositions.some((i) => selected.has(i));

  // Native checkboxes have no `indeterminate` attribute — set it via ref.
  const headRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  function toggle(position: number) {
    const next = new Set(selected);
    if (next.has(position)) next.delete(position);
    else next.add(position);
    onChange(next);
  }

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(selectablePositions));
  }

  const th = 'whitespace-nowrap px-2 py-2 text-xs font-normal text-gray-400';

  return (
    <div className="max-h-[55vh] overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-gray-200 text-left">
            <th className="sticky left-0 z-20 bg-white px-1 py-2">
              <input
                ref={headRef}
                type="checkbox"
                checked={allSelected}
                disabled={selectablePositions.length === 0}
                onChange={toggleAll}
                className="h-4 w-4 accent-gray-900 disabled:opacity-40"
                aria-label="Select all rows"
              />
            </th>
            <th className={th}>#</th>
            <th className={th}>Status</th>
            {CSV_TEMPLATE_HEADERS.map((header) => (
              <th key={header} className={th}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry, position) => {
            const selectable = entry.kind !== 'invalid';
            return (
              <tr key={entry.rowNumber} className={selectable ? '' : 'opacity-60'}>
                <td className="sticky left-0 bg-white px-1 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(position)}
                    disabled={!selectable}
                    onChange={() => toggle(position)}
                    className="h-4 w-4 accent-gray-900 disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-2 text-xs text-gray-400">
                  {entry.rowNumber}
                </td>
                <td className="px-2 py-2">
                  <KindBadge entry={entry} />
                </td>
                {CSV_TEMPLATE_HEADERS.map((header) => {
                  const text = entry.raw[header];
                  return (
                    <td
                      key={header}
                      className={`whitespace-nowrap px-2 py-2 ${
                        isDropped(entry, header)
                          ? 'text-red-500'
                          : 'text-gray-700'
                      }`}
                    >
                      {text || <span className="text-gray-300">·</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
