import type { ReactNode } from 'react';

/**
 * Shared frame for every `/proposals` route (list, detail, Templates,
 * Analytics, Settings).
 *
 * Other dashboard pages set the gutter (`px-6 sm:px-[3.75rem] pt-6`) and
 * their own scroll container inside the page file; the dashboard shell is
 * `overflow-hidden`, so a page without one neither pads nor scrolls. The
 * proposals routes share one frame here so each tab page stays a plain
 * `space-y-6` orchestrator.
 */
export default function ProposalsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-hover">
      <div className="px-6 sm:px-[3.75rem] pt-6 pb-28">{children}</div>
    </div>
  );
}
