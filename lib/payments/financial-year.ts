/**
 * Australian financial-year and BAS-quarter date ranges, for the
 * payments reports date filter.
 *
 * The ATO financial year runs 1 July - 30 June, and quarterly BAS
 * periods align to calendar quarters (Jul-Sep, Oct-Dec, Jan-Mar,
 * Apr-Jun). Every range is inclusive of both ends, as `YYYY-MM-DD`
 * strings so they compare and serialise the same way `invoices
 * .due_date` / stage `due_date` columns do.
 *
 * @module lib/payments/financial-year
 */

/** An inclusive `[start, end]` date range with a display label. */
export interface DateRange {
  start: string
  end: string
  label: string
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Fixed 3-letter abbreviations rather than `Intl`'s locale month names:
// `en-AU` renders `{ month: 'short' }` as "Sept"/"July" in this runtime's
// ICU data, not the 3-letter form — the same reason `DatePicker` keeps
// its own `MONTH_ABBR` table instead of relying on it.
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "1 Jul 2026" — the one short-date format every range label uses. */
function formatShort(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return `${d} ${MONTH_ABBR[m - 1]} ${y}`
}

/** `"<prefix> (<start> - <end>)"`, both dates in the same short format. */
function label(prefix: string, start: string, end: string): string {
  return `${prefix} (${formatShort(start)} - ${formatShort(end)})`
}

/**
 * The financial year containing `reference` (Jul 1 - Jun 30).
 *
 * @param yearsAgo - 0 for the current FY, 1 for the previous one, etc.
 */
export function getFinancialYear(reference: Date, yearsAgo = 0): DateRange {
  // Jan-Jun belongs to the FY that started the previous July.
  const fyStartYear = (reference.getMonth() >= 6 ? reference.getFullYear() : reference.getFullYear() - 1) - yearsAgo
  const start = ymd(fyStartYear, 7, 1)
  const end = ymd(fyStartYear + 1, 6, 30)
  return { start, end, label: label(`FY${String(fyStartYear + 1).slice(-2)}`, start, end) }
}

/**
 * The calendar-quarter BAS period containing `reference`, numbered as
 * the ATO does: Q1 = Jul-Sep, Q2 = Oct-Dec, Q3 = Jan-Mar, Q4 = Apr-Jun.
 */
export function getCurrentQuarter(reference: Date): DateRange {
  const month = reference.getMonth() // 0-11
  const quarterStartMonth = Math.floor(month / 3) * 3
  const year = reference.getFullYear()
  const startMonth = quarterStartMonth + 1 // 1-12
  const endMonth = quarterStartMonth + 3
  const endDay = new Date(year, endMonth, 0).getDate()
  // Calendar quarters (0, 3, 6, 9) map to BAS quarters (Q3, Q4, Q1, Q2).
  const basQuarter = [3, 4, 1, 2][quarterStartMonth / 3] as number
  const start = ymd(year, startMonth, 1)
  const end = ymd(year, endMonth, endDay)
  return { start, end, label: label(`Q${basQuarter} BAS`, start, end) }
}

/** A user-picked `[start, end]`, for the Reports tab's "Custom range" option. */
export function getCustomRange(start: string, end: string): DateRange {
  return { start, end, label: label('Custom', start, end) }
}
