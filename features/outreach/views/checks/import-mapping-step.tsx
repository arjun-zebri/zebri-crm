'use client';

/**
 * Import wizard step 2: match each sheet field to a column.
 *
 * Every field gets a {@link Select} of the file's headers, prefilled by
 * the guessed mapping. Each select shows one real value from the file so
 * the founder can tell the columns apart without opening the CSV.
 *
 * @module features/outreach/views/checks/import-mapping-step
 */
import { Callout } from '@/components/ui/callout';
import { Select, type SelectOption } from '@/components/ui/select';
import { SHEET_FIELDS, type SheetField, type SheetMapping } from '@/lib/outreach/import/sheet';

import { hasNameMapping, SHEET_FIELD_LABELS } from './sheet-field-labels';

/** Sentinel for "Not in file". A Select option must never have value "". */
const NONE = '__none__';

/** First non-blank value in a column of the sample rows, if any. */
function exampleFor(sample: string[][], col: number | null): string | undefined {
  if (col == null) return undefined;
  return sample.map((row) => row[col]?.trim() ?? '').find((v) => v !== '');
}

/**
 * @param props.parsed - Headers, sample rows and row count from the parse action.
 * @param props.mapping - Current field to column mapping.
 * @param props.onChange - Receives the whole next mapping on every change.
 */
export function ImportMappingStep({
  parsed,
  mapping,
  onChange,
}: {
  parsed: { headers: string[]; sample: string[][]; rowCount: number };
  mapping: SheetMapping;
  onChange: (next: SheetMapping) => void;
}) {
  const options: SelectOption[] = [
    { value: NONE, label: 'Not in file' },
    ...parsed.headers.map((h, i) => ({ value: String(i), label: h || `Column ${i + 1}` })),
  ];

  function setField(field: SheetField, value: string) {
    onChange({ ...mapping, [field]: value === NONE ? null : Number(value) });
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="shrink-0 space-y-3">
        <p className="text-body text-text-muted">
          {parsed.rowCount} {parsed.rowCount === 1 ? 'row' : 'rows'} found. Match each field to a column in your sheet.
        </p>
        {!hasNameMapping(mapping) && (
          <Callout tone="warning">Match Full name, or both First name and Last name, before you continue.</Callout>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        {SHEET_FIELDS.map((field) => {
          const col = mapping[field];
          const example = exampleFor(parsed.sample, col);
          return (
            <Select
              key={field}
              label={SHEET_FIELD_LABELS[field]}
              options={options}
              value={col == null ? NONE : String(col)}
              onValueChange={(v) => setField(field, v)}
              {...(example ? { help: `For example: ${example}` } : {})}
              placeholder="Not in file"
            />
          );
        })}
      </div>
    </div>
  );
}
