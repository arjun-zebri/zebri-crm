/**
 * The Reports tab's toolbar row content: period select + range label
 * (or a custom start/end pair) + Export CSV.
 *
 * Rendered inside `PaymentsHeader`'s toolbar row — the same row that
 * holds search/sort/New on the other tabs — so Reports fills that
 * space with its own real controls instead of leaving it empty.
 *
 * @module app/(dashboard)/payments/payments-report-toolbar
 */
'use client';

import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import type { DateRange } from '@/lib/payments/financial-year';

import { REPORT_RANGE_OPTIONS, type ReportRangePreset } from './use-report-range';

export interface PaymentsReportToolbarProps {
  preset: ReportRangePreset;
  onPresetChange: (preset: ReportRangePreset) => void;
  range: DateRange;
  customStart: string;
  onCustomStartChange: (value: string) => void;
  customEnd: string;
  onCustomEndChange: (value: string) => void;
  onExport: () => void;
  exportDisabled: boolean;
}

export function PaymentsReportToolbar({
  preset,
  onPresetChange,
  range,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange,
  onExport,
  exportDisabled,
}: PaymentsReportToolbarProps) {
  return (
    <>
      <Select
        ariaLabel="Report period"
        value={preset}
        onValueChange={(v) => onPresetChange(v as ReportRangePreset)}
        options={REPORT_RANGE_OPTIONS}
        className="w-full sm:w-56"
      />
      {preset === 'custom' ? (
        <div className="flex items-center gap-2">
          <DatePicker value={customStart} onChange={onCustomStartChange} placeholder="Start" />
          <span className="text-text-subtle">-</span>
          <DatePicker value={customEnd} onChange={onCustomEndChange} placeholder="End" />
        </div>
      ) : (
        <p className="text-body text-text-subtle">{range.label}</p>
      )}
      <Button variant="outline" onClick={onExport} disabled={exportDisabled} className="ml-auto">
        <Download size={11} strokeWidth={1.5} />
        Export CSV
      </Button>
    </>
  );
}
