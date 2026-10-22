import { gstOf, coupleName, type Invoice } from './payments-data';
import { gstByQuarter, rangeLabel, receivedIn, type Range } from './reports-data';

/**
 * The Overview's Export menu: the period's payments received (one row
 * each, the list an accountant asks for) or its GST by BAS quarter, as a
 * CSV named for the period. Amounts are plain numbers (no $ or commas)
 * so a spreadsheet or accounting import reads them as numbers.
 *
 * @module app/design-system/v2/pages/dashboard/payments/export-csv
 */

const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = (rows: (string | number)[][]) => rows.map((l) => l.map(cell).join(',')).join('\n');

/** The payments received in a range, as CSV text. */
export const paymentsCsv = (all: Invoice[], r: Range) =>
  csv([
    ['Date', 'Client', 'Invoice', 'Payment', 'Method', 'Amount', 'GST'],
    ...receivedIn(all, r).map((i) => [i.paidOn!, coupleName(i.names), i.number, i.label, i.method ?? '', i.amount.toFixed(2), gstOf(i.amount).toFixed(2)]),
  ]);

/** GST by BAS quarter for a range, as CSV text. */
export const gstCsv = (all: Invoice[], r: Range) =>
  csv([
    ['Quarter', 'Total sales (G1)', 'GST on sales (1A)'],
    ...gstByQuarter(all, r).map((q) => [q.quarter, q.sales.toFixed(2), q.gst.toFixed(2)]),
  ]);

/** Downloads CSV text in the browser, named for the report and period. */
export function download(text: string, report: string, r: Range) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `zebri-${report}-${rangeLabel(r).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
