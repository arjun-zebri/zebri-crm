'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import { download, gstCsv, paymentsCsv } from '../export-csv';
import type { Invoice } from '../payments-data';
import type { Range } from '../reports-data';

/**
 * Export on the Overview: a glass button opening a short menu of
 * what to download for the period on screen. Two files, the payments
 * received and GST by BAS quarter, which are the two things an
 * accountant asks an MC for.
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/export-menu
 */

/** The Export menu. */
export function ExportMenu({ invoices, range }: { invoices: Invoice[]; range: Range }) {
  const [open, setOpen] = useState(false);
  // A pick downloads and closes the menu, as a native menu would.
  const pick = (text: string, report: string) => {
    download(text, report, range);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="glass">
          <Download aria-hidden="true" strokeWidth={1.5} className="size-4" />
          Export
        </Button>
      </PopoverTrigger>
      <PopoverContent size="menu" align="end" role="menu" aria-label="Export">
        <MenuOption onSelect={() => pick(paymentsCsv(invoices, range), 'payments')}>
          Payments received (CSV)
        </MenuOption>
        <MenuOption onSelect={() => pick(gstCsv(invoices, range), 'gst')}>
          GST by quarter (CSV)
        </MenuOption>
      </PopoverContent>
    </Popover>
  );
}
