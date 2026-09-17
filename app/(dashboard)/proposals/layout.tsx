import type { ReactNode } from 'react';

/**
 * Shared scroll container for every `/proposals` route (list, detail,
 * Templates, Analytics, Settings, and the template editor).
 *
 * The dashboard shell is `overflow-hidden`, so a page without a layout
 * neither pads nor scrolls. The gutter itself lives in `proposals-frame.tsx`
 * (Proposal Layout v2 Phase 2 Task 14), not here: the template editor route
 * needs the full width and owns its own internal scrolling (the canvas),
 * so it renders directly into this scroll container with no padding and no
 * second scrollbar, while every other route wraps its content in
 * `<ProposalsFrame>` for the padded, `space-y-6` orchestrator shape.
 */
export default function ProposalsLayout({ children }: { children: ReactNode }) {
  return <div className="h-full min-h-0 overflow-y-auto scrollbar-hover">{children}</div>;
}
