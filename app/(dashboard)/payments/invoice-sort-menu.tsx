/**
 * Sort dropdown for the Invoices tab of /payments.
 *
 * Split out of `PaymentsHeader` (component-size budget) — same
 * button + `MenuPanel` shape as the couples-list sort control
 * (`app/(dashboard)/couples/couples-header.tsx`).
 *
 * @module app/(dashboard)/payments/invoice-sort-menu
 */
'use client';

import { ArrowUpDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { MenuItem, MenuPanel } from '@/components/ui/menu';
import { isChromePress } from '@/components/ui/use-overlay';

import { INVOICE_SORT_OPTIONS, type InvoiceSortOption } from './use-invoice-sort';

export interface InvoiceSortMenuProps {
  value: InvoiceSortOption;
  onChange: (option: InvoiceSortOption) => void;
}

export function InvoiceSortMenu({ value, onChange }: InvoiceSortMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !isChromePress(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen(!open)} className="whitespace-nowrap">
        <ArrowUpDown size={11} strokeWidth={1.5} />
        <span>{value.label}</span>
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1">
          <MenuPanel>
            {INVOICE_SORT_OPTIONS.map((option) => (
              <MenuItem
                key={option.label}
                size="sm"
                selected={value.field === option.field && value.direction === option.direction}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {option.label}
              </MenuItem>
            ))}
          </MenuPanel>
        </div>
      )}
    </div>
  );
}
