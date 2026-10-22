'use client';

import type { ReactNode } from 'react';

import { Dialog } from '@/components/ui-v2/dialog';

/**
 * The window every document editor opens in: close to full screen, not
 * all of it (2026-10-09). A `lg` dialog grown to the window less the
 * 2rem margin every workspace keeps, so the dimmed page still shows at
 * the edges and says "this is on top of where you were". A click on that
 * edge never closes it (a stray click must not end the work); Escape and
 * the editor's own close do. Its size is
 * set when it opens and never changes while it is open (modals never
 * resize). Full screen on phones, like every workspace. Not modal:
 * the editor inside is production's, whose text bar and popovers portal
 * to `<body>`, and a modal dialog would draw them under itself.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/shell/doc-shell
 */

export interface DocShellProps {
  open: boolean;
  onClose: () => void;
  /** Id of the editor's visible title, in its header. */
  'aria-labelledby': string;
  children: ReactNode;
}

/** The editor window. See {@link DocShellProps}. */
export function DocShell({ open, onClose, children, ...aria }: DocShellProps) {
  return (
    <Dialog open={open} onClose={onClose} size="lg" expanded closeOnBackdrop={false} modal={false} {...aria}>
      {children}
    </Dialog>
  );
}
