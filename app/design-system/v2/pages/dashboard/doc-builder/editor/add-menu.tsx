'use client';

import { useState, type ReactNode } from 'react';

import { MenuOption, Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';

import type { DocSectionKind } from '../model/types';
import { addableIn } from '../registry/kinds';
import type { DocEditor } from '../state/use-doc-editor';

/**
 * The one way a section is added: a short list, each kind of section a
 * small custom icon and its name, like the "/" menu (founder, 2026-10-10:
 * the add buttons opened two different things; "I prefer the one with
 * small icons in a list"). The bar's Add opens it (`AddMenu`), and so do
 * every "+" on a section's edge, the page's trailing "Add section" and
 * the empty page's button (`AddAt`, through `SectionCanvas onRequestAdd`).
 * Each kind lands already filled, picked and brought into view.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/add-menu
 */

/** Adds a section of `kind` at `at`, picked and brought into view. */
export function addSection(builder: DocEditor, kind: DocSectionKind, at: number) {
  const section = builder.newSection(kind);
  builder.dispatch({ type: 'addSection', at, section }, { commit: true });
  requestAnimationFrame(() => document.querySelector(`[data-canvas-section-id="${section.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

/** The list itself: one row per kind this document may hold. */
function AddList({ builder, at, onDone }: { builder: DocEditor; at: number; onDone: () => void }) {
  return addableIn(builder.type).map(({ kind, label, icon: Icon }) => (
    <MenuOption
      key={kind}
      onSelect={() => {
        addSection(builder, kind, at);
        onDone();
      }}
    >
      <Icon aria-hidden="true" className="mr-2.5 size-4 shrink-0 text-zebra-500" />
      {label}
    </MenuOption>
  ));
}

export interface AddMenuProps {
  builder: DocEditor;
  /** Where the new section goes in the stack. */
  at: number;
  /** The control that opens it. */
  children: ReactNode;
  /** Which way it opens; up from the bar at the desk's foot. */
  side?: 'top' | 'bottom' | undefined;
}

/** The list behind a control of the host's own (the bar's Add). See {@link AddMenuProps}. */
export function AddMenu({ builder, at, children, side = 'bottom' }: AddMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent size="menu" side={side} align="center" aria-label="Add a section">
        <AddList builder={builder} at={at} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** Where production's canvas asked to add: the index, and the control it came from. */
export interface AddRequest {
  at: number;
  anchor: HTMLElement | null;
}

/** The list opened by one of the canvas's own add controls, beside that control. */
export function AddAt({ builder, request, onClose }: { builder: DocEditor; request: AddRequest | null; onClose: () => void }) {
  // The trailing "Add section" sends no element; it still has focus from the click.
  const anchor = request ? (request.anchor ?? (document.activeElement as HTMLElement | null)) : null;
  return (
    <Popover open={request !== null} onOpenChange={(open) => (open ? null : onClose())}>
      {anchor ? <PopoverAnchor virtualRef={{ current: anchor }} /> : null}
      <PopoverContent size="menu" side="bottom" align="center" aria-label="Add a section">
        {request ? <AddList builder={builder} at={request.at} onDone={onClose} /> : null}
      </PopoverContent>
    </Popover>
  );
}
