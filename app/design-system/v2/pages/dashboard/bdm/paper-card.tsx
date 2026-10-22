'use client';

import type { ReactNode } from 'react';

import { Avatar } from '@/components/ui-v2/avatar';
import { Badge } from '@/components/ui-v2/badge';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import type { ZebriIcon } from '@/components/ui-v2/icons';
import { ProgressBar } from '@/components/ui-v2/progress-bar';

/**
 * The one card every part of a couple's paperwork sits on in the
 * paperwork dialog: their answers a person, and the celebrant's own
 * checks a group (user, 2026-10-15: the checks were four looks in one
 * list and "not premium either"). A head with who or what it is (their
 * initials, or a glyph), how far it is ("3 of 5" and a short bar, or
 * Complete), anything to look at, and one action on the right; the body
 * below a hairline.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/paper-card
 */

export interface PaperCardProps {
  title: string;
  /** A glyph in place of the title's initials. */
  glyph?: ZebriIcon | undefined;
  done: number;
  of: number;
  /** How many answers have a problem or look wrong. */
  flagged?: number | undefined;
  /** The head's action ("Edit"). */
  action?: ReactNode;
  children: ReactNode;
}

/** The card. See {@link PaperCardProps}. */
export function PaperCard({ title, glyph, done, of, flagged = 0, action, children }: PaperCardProps) {
  return (
    <section aria-label={title} className="rounded-panel bg-field ring-1 ring-hairline">
      <header className="flex min-h-14 items-center gap-3 border-b border-hairline px-5 py-3">
        {glyph ? <IconCircle icon={glyph} /> : <Avatar name={title} tone="soft" />}
        <h4 className="min-w-0 truncate type-label text-zebra-950">{title}</h4>
        {flagged ? (
          <Badge dot tone="warning">
            {flagged} to look at
          </Badge>
        ) : null}
        <span className="flex-1" />
        {/* How far, on the right where the eye ends the row, by the action. */}
        {of > 0 && done >= of ? (
          <Badge dot tone="grass">
            Complete
          </Badge>
        ) : of > 0 ? (
          <span className="flex shrink-0 items-center gap-2 type-body tabular-nums text-zebra-500">
            {done} of {of}
            <span className="w-16 max-sm:hidden">
              <ProgressBar label={`${title}: done`} value={done} max={of} />
            </span>
          </span>
        ) : null}
        {action}
      </header>
      <div className="space-y-6 px-5 py-4">{children}</div>
    </section>
  );
}
