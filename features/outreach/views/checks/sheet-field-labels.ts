/**
 * Plain-language labels for the import wizard's field mapping.
 *
 * The sheet field keys are database-ish (`registration_no`); the founder
 * sees these words instead. Kept in a plain module so tests and the
 * wizard share one source.
 *
 * @module features/outreach/views/checks/sheet-field-labels
 */
import type { SheetField } from '@/lib/outreach/import/sheet';

/** Label shown next to each column picker. */
export const SHEET_FIELD_LABELS: Record<SheetField, string> = {
  full_name: 'Full name',
  first_name: 'First name',
  last_name: 'Last name',
  registration_no: 'Registration number',
  state: 'State',
  suburb: 'Suburb',
  postcode: 'Postcode',
  email: 'Email',
  phone: 'Phone',
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
  notes: 'Your notes',
  status: 'Your status column',
};

/**
 * Whether a mapping has enough to create a prospect. A name is required
 * (the sheet's dedupe key and every email uses it), either as one column
 * or as first plus last.
 *
 * @param mapping - Field to column index, `null` when unmapped.
 * @returns True when the import can run.
 */
export function hasNameMapping(mapping: Partial<Record<SheetField, number | null>>): boolean {
  return mapping.full_name != null || (mapping.first_name != null && mapping.last_name != null);
}
