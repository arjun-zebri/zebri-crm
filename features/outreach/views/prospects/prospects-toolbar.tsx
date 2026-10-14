'use client';

/**
 * The Prospects toolbar: the Table / Board layout switch on the left and
 * the page actions on the right. Only rendered once there is at least
 * one prospect; on an empty workspace the page shows a single "Import" call
 * instead.
 *
 * @module features/outreach/views/prospects/prospects-toolbar
 */
import { Button } from '@/components/ui/button';
import { UnderlineTabs, type UnderlineTab } from '@/components/ui/underline-tabs';

/** The two layouts. Same tab row as Couples' Board / List, so the pattern reads the same across the app. */
const LAYOUTS: UnderlineTab<'table' | 'board'>[] = [
  { id: 'table', label: 'Table' },
  { id: 'board', label: 'Board' },
];

/** Props for {@link ProspectsToolbar}. */
export interface ProspectsToolbarProps {
  board: boolean;
  onLayout: (layout: 'table' | 'board') => void;
  onImport: () => void;
  /** Opens the Add prospect form. */
  onAdd: () => void;
  onCheck: () => void;
  /** Prospects not yet checked. At zero the check has nothing to do, so it is disabled. */
  unchecked: number;
}

/** Layout switch and the Add / Import / Run activity check actions. */
export function ProspectsToolbar({ board, onLayout, onImport, onAdd, onCheck, unchecked }: ProspectsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="w-44 max-w-full">
        <UnderlineTabs tabs={LAYOUTS} active={board ? 'board' : 'table'} onChange={onLayout} ariaLabel="Prospects layout" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onAdd}>
          Add prospect
        </Button>
        <Button variant="outline" onClick={onImport}>
          Import sheet
        </Button>
        <Button disabled={unchecked === 0} onClick={onCheck}>
          Run activity check
        </Button>
      </div>
      {/* Why: a disabled button explains nothing on touch screens, so the reason is written out beside it. */}
      {unchecked === 0 && <p className="w-full text-right text-body text-text-subtle">Every prospect is already checked.</p>}
    </div>
  );
}
