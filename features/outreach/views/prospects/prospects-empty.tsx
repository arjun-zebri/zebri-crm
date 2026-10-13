'use client';

/**
 * First-run state for Prospects: no people yet, so import or add one.
 * The toolbar, stats, filters and check button are all hidden, since none
 * of them does anything until there is someone to act on.
 *
 * @module features/outreach/views/prospects/prospects-empty
 */
import { Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';

/** Props for {@link ProspectsEmpty}. */
export interface ProspectsEmptyProps {
  /** Opens the import wizard. */
  onImport: () => void;
  /** Opens the Add prospect form. */
  onAdd: () => void;
}

/** "No prospects yet", with import first and a hand-added person as the alternative. */
export function ProspectsEmpty({ onImport, onAdd }: ProspectsEmptyProps) {
  return (
    <Empty
      icon={Users}
      title="No prospects yet"
      description="Import your celebrant sheet, or add someone by hand."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onImport}>Import sheet</Button>
          <Button variant="outline" onClick={onAdd}>Add prospect</Button>
        </div>
      }
    />
  );
}
