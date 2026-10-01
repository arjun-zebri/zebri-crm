'use client';

import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Checkbox } from '@/components/ui-v2/checkbox';
import { Input } from '@/components/ui-v2/input';

import type { RunSheetItem } from '../demo-activity';

/**
 * A run sheet as rows to edit: each moment's time and name as fields, a
 * tick for the ones confirmed with the couple, and a remove button,
 * then Add a moment at the foot. Every change goes straight back to the
 * caller; saving is the dialog's job.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-editor
 */

/** A row being edited: the item plus a key that survives edits and removals. */
export type EditRow = RunSheetItem & { key: number };

export interface RunSheetEditorProps {
  rows: EditRow[];
  onChange: (rows: EditRow[]) => void;
  disabled?: boolean | undefined;
}

/** The run sheet rows. See {@link RunSheetEditorProps}. */
export function RunSheetEditor({ rows, onChange, disabled }: RunSheetEditorProps) {
  const set = (key: number, patch: Partial<RunSheetItem>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () =>
    onChange([
      ...rows,
      { key: Math.max(0, ...rows.map((r) => r.key)) + 1, time: '', moment: '', done: false },
    ]);
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-2">
            <div className="w-24 shrink-0">
              <Input
                aria-label={`Time of moment ${i + 1}`}
                placeholder="6:00pm"
                value={r.time}
                onChange={(e) => set(r.key, { time: e.target.value })}
                disabled={disabled}
                className="tabular-nums"
              />
            </div>
            <div className="min-w-0 flex-1">
              <Input
                aria-label={`Moment ${i + 1}`}
                placeholder="What happens"
                value={r.moment}
                onChange={(e) => set(r.key, { moment: e.target.value })}
                disabled={disabled}
              />
            </div>
            <Checkbox
              label={<span className="max-sm:sr-only">Confirmed</span>}
              checked={r.done}
              onChange={(e) => set(r.key, { done: e.target.checked })}
              disabled={disabled}
            />
            <Button
              variant="ghost"
              square
              aria-label={`Remove ${r.moment || `moment ${i + 1}`}`}
              onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
              disabled={disabled}
            >
              <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Button>
          </li>
        ))}
      </ol>
      <Button variant="ghost" onClick={add} disabled={disabled}>
        <Plus aria-hidden="true" strokeWidth={1.5} className="size-4 text-zebra-400" />
        Add a moment
      </Button>
    </div>
  );
}
