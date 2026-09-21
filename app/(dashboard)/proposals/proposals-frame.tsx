import type { ReactNode } from 'react';

/**
 * The gutter every `/proposals` route pads its content with - moved out of
 * `layout.tsx` (Proposal Layout v2 Phase 2 Task 14) so the template editor
 * route (`templates/[id]`) can opt out and use the full width; every other
 * `/proposals` page renders its content through this instead.
 *
 * @module app/(dashboard)/proposals/proposals-frame
 */
export function ProposalsFrame({ children }: { children: ReactNode }) {
  return <div className="px-6 sm:px-[3.75rem] pt-6 pb-28">{children}</div>;
}
