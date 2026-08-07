'use client';

import { Select } from '@/components/ui/select';
import {
  CSV_TEMPLATE_HEADERS,
  type ColumnMapping,
  type CsvGrid,
  type CsvHeader,
} from '@/lib/utils/csv-import';

/** Sentinel for the "don't map this field" option — the shared Select
 *  crashes on an empty-string value, so we never use `''`. */
const SKIP = '__skip__';

const REQUIRED: CsvHeader[] = ['couple_name', 'primary_name'];

const FIELD_LABELS: Record<CsvHeader, string> = {
  couple_name: 'Couple name',
  primary_name: 'Primary contact name',
  primary_email: 'Primary email',
  primary_phone: 'Primary phone',
  secondary_name: 'Secondary contact name',
  secondary_email: 'Secondary email',
  secondary_phone: 'Secondary phone',
  event_date: 'Wedding date',
  venue: 'Venue',
  status: 'Status',
};

interface CouplesImportMappingProps {
  grid: CsvGrid;
  mapping: ColumnMapping;
  firstRowIsHeader: boolean;
  onToggleHeader: (value: boolean) => void;
  onChange: (mapping: ColumnMapping) => void;
}

/**
 * Step two of the CSV import: map each Zebri field to a column in the
 * uploaded file. Auto-guessed from the headers (or by position when
 * there are none); the user can reassign any field or skip it. A
 * "first row is column names" toggle handles files whose header row is
 * missing or garbage. Couple name + primary name are required.
 *
 * @module app/(dashboard)/couples/couples-import-mapping
 */
export function CouplesImportMapping({
  grid,
  mapping,
  firstRowIsHeader,
  onToggleHeader,
  onChange,
}: CouplesImportMappingProps) {
  const sample = grid.rows[0] ?? [];
  const columnOptions = Array.from({ length: grid.columnCount }, (_, i) => {
    const header = grid.headers?.[i]?.trim();
    const label = header && header !== '' ? header : `Column ${i + 1}`;
    const cell = sample[i]?.trim();
    return { value: String(i), label: cell ? `${label} · ${cell}` : label };
  });
  const options = [{ value: SKIP, label: 'Skip this field' }, ...columnOptions];

  function setField(field: CsvHeader, value: string) {
    onChange({ ...mapping, [field]: value === SKIP ? null : Number(value) });
  }

  return (
    <div className="space-y-4">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-body text-gray-600">
        <input
          type="checkbox"
          checked={firstRowIsHeader}
          onChange={(e) => onToggleHeader(e.target.checked)}
          className="h-4 w-4 accent-gray-900"
        />
        First row contains column names
      </label>

      <div className="space-y-2.5">
        {CSV_TEMPLATE_HEADERS.map((field) => (
          <div
            key={field}
            className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:items-center sm:gap-3"
          >
            <span className="text-body text-gray-700">
              {FIELD_LABELS[field]}
              {REQUIRED.includes(field) && (
                <span className="text-red-500"> *</span>
              )}
            </span>
            <Select
              options={options}
              value={mapping[field] === null ? SKIP : String(mapping[field])}
              onValueChange={(value) => setField(field, value)}
              // Lift above the modal panel (z-[60]) so the menu is visible.
              contentClassName="z-[90]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
