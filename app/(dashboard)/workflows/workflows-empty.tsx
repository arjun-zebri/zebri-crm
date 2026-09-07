/**
 * The one empty state both Workflows tabs use.
 *
 * Upcoming renders inside a bordered card and Templates renders a bare
 * grid, so left to themselves the two tabs put their "nothing here yet"
 * message in visibly different places: one centred in a card that runs
 * to the bottom of the screen, the other tucked under the toolbar.
 * Switching tabs then looked like switching apps.
 *
 * Fixed box rather than the full remaining height: an empty state
 * centred in a tall container sits well below the middle of the screen
 * once the page header, tabs and toolbar are counted, and reads as
 * something that fell down the page.
 *
 * @module app/(dashboard)/workflows/workflows-empty
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Empty } from '@/components/ui/empty';

export interface WorkflowsEmptyProps {
  /** Icon above the title. */
  icon: LucideIcon;
  /** Short heading. */
  title: string;
  /** One or two sentences on what to do next. */
  description: ReactNode;
  /** Optional call to action, typically "Clear filters". */
  action?: ReactNode;
}

/** Shared empty state for the Workflows tabs. See {@link WorkflowsEmptyProps}. */
export function WorkflowsEmpty({ icon, title, description, action }: WorkflowsEmptyProps) {
  return (
    <div className="flex min-h-96 shrink-0 items-center justify-center px-4 py-8">
      <Empty
        icon={icon}
        title={title}
        description={description}
        size="sm"
        {...(action ? { action } : {})}
      />
    </div>
  );
}
