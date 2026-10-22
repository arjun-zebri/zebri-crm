'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { DIALOG_HEADER_PAD } from '@/components/ui-v2/dialog-parts';
import { CloseIcon } from '@/components/ui-v2/icons';

/**
 * The run sheet's side panel, as the client profile's is: × at the top,
 * then the picked moment (`RunSheetDetail`), or, with nothing picked, a
 * few words on how to add one (on wide screens only); and at the foot the sheet's two actions,
 * Download and Send. It stays put while the day beside it scrolls.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-side
 */

export interface RunSheetSideProps {
  /** The picked moment's detail, or undefined for the how-to. */
  children?: ReactNode;
  /** The sheet has no moments yet. */
  empty: boolean;
  onClose: () => void;
  onDownload: () => void;
  onSend: () => void;
}

/** The side panel. See {@link RunSheetSideProps}. */
export function RunSheetSide({ children, empty, onClose, onDownload, onSend }: RunSheetSideProps) {
  return (
    <aside
      aria-label="Moment"
      className="flex shrink-0 flex-col border-t border-hairline lg:w-[28rem] lg:border-l lg:border-t-0"
    >
      {/* The day's header row continued, so Close lands where every dialog's does (2026-10-15). */}
      <div className={`hidden justify-end ${DIALOG_HEADER_PAD} lg:flex`}>
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <CloseIcon aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 lg:pt-2">
        {children ?? (
          // Phones get one line above the day instead (the workspace's), as
          // this panel sits under the day there, out of sight.
          <div className="hidden space-y-2 lg:block">
            <p className="type-label text-zebra-950">
              {empty ? 'Add the first moment' : 'Pick a moment'}
            </p>
            <p className="type-body text-zebra-500">
              {empty
                ? 'Click a time on the day to add a 30 minute moment there, then name it here. The ceremony line is a good place to start.'
                : 'Click a block to change it, or click an empty time to add one.'}
            </p>
            <p className="type-body text-zebra-500">
              Drag a block to move it, or pull its top or bottom edge to change when it starts and
              ends.
            </p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-6 pb-6 sm:px-8 sm:pb-8">
        <Button variant="secondary" onClick={onDownload} disabled={empty}>
          Download
        </Button>
        <Button onClick={onSend} disabled={empty}>
          Send
        </Button>
      </div>
    </aside>
  );
}
