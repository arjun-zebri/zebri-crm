'use client';

import { Button } from '@/components/ui-v2/button';
import { BAR_RULE, FLOATING_BAR } from '@/components/ui-v2/control-styles';
import { PlusIcon } from '@/components/ui-v2/icons';
import { Kbd } from '@/components/ui-v2/kbd';

import { GlobalStylingButton } from '../../brand/global-styling-button';
import type { DocEditor } from '../state/use-doc-editor';

import { AddMenu } from './add-menu';

/**
 * The quiet bar floating at the foot of the desk (founder's mockup,
 * 2026-10-10): Add a section (after the picked one, else at the end),
 * Global styling, which every document shares, and the "/" hint, so a
 * first-time MC learns the shortcut without being told twice. It
 * replaces the side panel's add list and brand settings. Not on a phone,
 * which edits words and data only.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/bottom-bar
 */

/** The bar for `builder`. */
export function BottomBar({ builder }: { builder: DocEditor }) {
  const { sections } = builder.state.layout;
  const picked = sections.findIndex((s) => s.id === builder.selected);
  if (builder.light) return null;
  return (
    // Centred at the foot of the desk; the zoom pill is gone (founder, 2026-10-10), pinch and ⌘ + wheel still zoom.
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center">
      <div className={`pointer-events-auto ${FLOATING_BAR}`}>
        <AddMenu builder={builder} at={picked === -1 ? sections.length : picked + 1} side="top">
          <Button variant="ghost" icon={<PlusIcon aria-hidden="true" className="size-4" />}>
            Add
          </Button>
        </AddMenu>
        <GlobalStylingButton main={builder.branding.brand_color} accent={builder.branding.secondary_color} />
        <span aria-hidden="true" className={BAR_RULE} />
        <p className="flex items-center gap-1.5 pl-1 pr-2.5 type-body text-zebra-500">
          <Kbd>/</Kbd>
          to insert
        </p>
      </div>
    </div>
  );
}
