/**
 * One line under the prospect modal's title: where they are and where
 * they stand, with the "more" menu on the right. Pills only for states
 * that need attention (not active, do not contact); a healthy prospect
 * shows none.
 *
 * @module features/outreach/views/prospects/prospect-header
 */
import { StatePill } from '@/components/ui/state-pill';
import type { Prospect } from '@/lib/outreach/types';

import { DrawerActions } from './drawer-actions';
import { stageLabel } from './labels';
import { VerdictPill } from './verdict-pill';

/** Props for {@link ProspectHeader}. */
export interface ProspectHeaderProps {
  prospect: Prospect;
}

/** "Bondi, NSW · Replied", warnings if any, and the actions menu. */
export function ProspectHeader({ prospect: p }: ProspectHeaderProps) {
  const place = [p.suburb, p.state].filter(Boolean).join(', ');
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-body text-text-muted">{[place, stageLabel(p.stage)].filter(Boolean).join(' · ')}</p>
        {p.verdict !== 'active' && <VerdictPill verdict={p.verdict} />}
        {p.do_not_contact && <StatePill label="Do not contact" tone="danger" />}
      </div>
      <DrawerActions prospectId={p.id} name={p.full_name} />
    </div>
  );
}
