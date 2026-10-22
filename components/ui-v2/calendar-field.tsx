'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CalendarIcon } from '@/components/ui-v2/icons';

import { BoxedLabel } from './boxed-label';
import { boxedControl } from './control-styles';
import { DatePanel, type DatePanelProps } from './date-panel';
import { DateSegments } from './date-segments';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './popover';

/**
 * Design system v2 calendar field (preview): a boxed date for the forms
 * a stranger fills in. Typed first, as the premium date fields are
 * (Apple's, React Aria's): the box is DD / MM / YYYY, each part its own
 * stop (`DateSegments`), so a birthday is eight keystrokes (user,
 * 2026-10-15). The calendar button at the box's right opens Zebri's
 * calendar (`DatePanel`), month and year as menus in its header, for
 * anyone who would rather pick. `max` (today, for a birthday) caps both.
 *
 * @example
 * ```tsx
 * <CalendarField label="Date of birth" value={dob} onChange={setDob} openYear={1990} max={today} />
 * ```
 *
 * @module components/ui-v2/calendar-field
 */

export interface CalendarFieldProps extends Pick<DatePanelProps, 'openYear' | 'max' | 'minYear'> {
  label: string;
  /** "YYYY-MM-DD", or "" for none. */
  value: string;
  onChange: (iso: string) => void;
  optional?: boolean | undefined;
  help?: string | undefined;
  /** A rule the date breaks, from outside; shown when the box has no problem of its own. */
  error?: string | undefined;
}

/** v2 calendar field. See {@link CalendarFieldProps}. */
export function CalendarField({ label, value, onChange, optional = false, help, error: outside, ...panel }: CalendarFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const error = problem ?? outside;
  const describedBy = [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const maxYear = panel.max ? Number(panel.max.slice(0, 4)) : new Date().getFullYear() + 10;
  return (
    <div>
      <BoxedLabel htmlFor={id} optional={optional}>
        {label}
      </BoxedLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          {/* The box takes the focus look while any part has focus, as one field. */}
          <div
            className={`${boxedControl(Boolean(error))} flex items-center justify-between gap-2 pr-1 focus-within:ring-4 focus-within:ring-zebra-950/[0.06]${error ? '' : ' focus-within:border-zebra-400'}`}
          >
            <DateSegments id={id} value={value} onChange={onChange} onProblem={setProblem} maxYear={maxYear} describedBy={describedBy} invalid={Boolean(error)} />
            <PopoverTrigger asChild>
              <Button variant="ghost" square tooltip="Calendar" aria-label={`Pick ${label.toLowerCase()} on a calendar`}>
                <CalendarIcon aria-hidden="true" className="size-4" />
              </Button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
        <PopoverContent size="card" align="start">
          <DatePanel
            value={value}
            onPick={(iso) => {
              onChange(iso);
              setProblem(null);
              setOpen(false);
            }}
            {...panel}
          />
        </PopoverContent>
      </Popover>
      {help ? (
        <p id={`${id}-help`} className={error ? 'sr-only' : 'mt-1.5 type-body text-zebra-500'}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 type-body text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
