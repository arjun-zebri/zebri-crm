'use client';

import { Button } from '@/components/ui-v2/button';
import { BrushIcon } from '@/components/ui-v2/icons';


import { openDesign } from './design-store';
import type { DesignKind } from './spec';

/**
 * Design, in a document editor's header: opens the canvas on this kind's
 * design, filled with the document being written, so the MC styles it
 * around its real words. Where the Style pill was: the brand now lives in
 * the canvas's Brand tab and the brand kit. Without `data`, it designs
 * against a sample (a Templates heading). A contract or invoice is the
 * MC's own words as well as its look, so its send flow names it
 * "Edit your contract" (`label`).
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/design-button
 */
export function DesignButton({ kind, data, quiet = false, label = 'Design' }: { kind: DesignKind; data?: unknown; quiet?: boolean; label?: string }) {
  return (
    // `quiet` is the ghost button, for a row whose other actions are ghost too (a Templates heading).
    <Button variant={quiet ? 'ghost' : 'secondary'} icon={<BrushIcon aria-hidden="true" className="size-4" />} onClick={() => openDesign(kind, data)}>
      {label}
    </Button>
  );
}
