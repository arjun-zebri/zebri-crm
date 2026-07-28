/**
 * Serialises celebrant rows to CSV.
 */

/** Column order of the generated CSV. */
export const COLUMNS = [
  'surname',
  'given_names',
  'title',
  'state',
  'status',
  'registration_date',
  'sub_status',
  'street',
  'suburb',
  'postcode',
  'phone_home',
  'phone_work',
  'mobile',
  'email',
  'ceremony_types',
  'source_page',
]

/**
 * Escapes a single CSV field per RFC 4180.
 *
 * Celebrant names and addresses contain commas and apostrophes routinely, so
 * quoting is applied whenever a delimiter, quote, or newline is present.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeField(value) {
  const raw = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

/**
 * Converts celebrant rows into a CSV document.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {string[]} [columns] - Column order. Defaults to the register's own fields.
 * @returns {string} CSV text including a header row.
 */
export function toCsv(rows, columns = COLUMNS) {
  const header = columns.join(',')
  const body = rows.map((row) => columns.map((column) => escapeField(row[column])).join(','))
  return [header, ...body].join('\n') + '\n'
}
