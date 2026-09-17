/**
 * Date-range state for the Payments Reports tab: a preset (this/last FY,
 * this BAS quarter) or a custom `[start, end]`.
 *
 * Lives at the page level (like `useInvoiceSort`) so `page.tsx` can pass
 * the resulting range to both the header's period-select toolbar and the
 * report body without either one owning the other's state.
 *
 * @module app/(dashboard)/payments/use-report-range
 */
'use client';

import { useMemo, useState } from 'react';

import {
  getCurrentQuarter,
  getCustomRange,
  getFinancialYear,
  type DateRange,
} from '@/lib/payments/financial-year';

export type ReportRangePreset = 'this_fy' | 'last_fy' | 'this_quarter' | 'custom';

export const REPORT_RANGE_OPTIONS: { value: ReportRangePreset; label: string }[] = [
  { value: 'this_fy', label: 'This financial year' },
  { value: 'last_fy', label: 'Last financial year' },
  { value: 'this_quarter', label: 'This BAS quarter' },
  { value: 'custom', label: 'Custom range' },
];

export function useReportRange() {
  const [preset, setPreset] = useState<ReportRangePreset>('this_fy');
  // Seeded from the current FY so the date pickers never start empty.
  const defaultCustom = useMemo(() => getFinancialYear(new Date()), []);
  const [customStart, setCustomStart] = useState(defaultCustom.start);
  const [customEnd, setCustomEnd] = useState(defaultCustom.end);

  const range = useMemo<DateRange>(() => {
    const now = new Date();
    if (preset === 'last_fy') return getFinancialYear(now, 1);
    if (preset === 'this_quarter') return getCurrentQuarter(now);
    if (preset === 'custom') return getCustomRange(customStart, customEnd);
    return getFinancialYear(now);
  }, [preset, customStart, customEnd]);

  return { preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd, range };
}
