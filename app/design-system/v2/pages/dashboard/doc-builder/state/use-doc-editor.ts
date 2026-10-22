'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { newSectionFor, useLayoutEditor } from '@/features/proposals';
import type { LayoutAction, LayoutEditorState, ProposalTheme, UseLayoutEditorReturn } from '@/features/proposals';
import type { PublicDocData } from '@/lib/branding/public-blocks/shared';
import type { PublicBranding } from '@/lib/branding/public-branding';

import { useAccount } from '../../account';
import { useKitLook } from '../look/use-kit-look';
import { fromProd, isEngineKind, toProd } from '../model/as-production';
import { docFor } from '../model/doc-data';
import type { DocLayout, DocSection, DocSectionKind, DocType } from '../model/types';
import { upgradeLayout } from '../model/upgrade';
import { useLightEdit } from '../phone/use-light-edit';
import { specFor } from '../registry/kinds';

import { guard, type DocAction } from './guard';
import type { BookingTerms, Device, DocEditorOptions, DocMode } from './options';

/**
 * Everything the editor works from: production's layout editor (the
 * section stack with one undo history, `useLayoutEditor`), the look it
 * wears, and the couple the page is for. While a document is a draft its
 * look is the brand kit's, live (spec §3: drafts follow the brand); a
 * sent document carries its frozen `layout.theme`, which wins.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/state/use-doc-editor
 */

export type { BookingTerms, Device, DocEditorOptions, DocFor, DocMode, FillSection } from './options';

/** The editor's state, with the document as the engine types it. */
export interface DocEditorState extends Omit<LayoutEditorState, 'layout'> {
  layout: DocLayout;
}

export interface DocEditor extends Omit<UseLayoutEditorReturn, 'state' | 'dispatch'> {
  state: DocEditorState;
  /** Production's dispatch behind the engine's guard (`./guard.ts`). */
  dispatch: (action: DocAction, opts?: { commit?: boolean }) => void;
  type: DocType;
  branding: PublicBranding;
  theme: ProposalTheme;
  /** The page's data: the sample proposal's, with this couple's names, date and venue. */
  doc: PublicDocData;
  terms: BookingTerms;
  setTerms: (t: BookingTerms) => void;
  device: Device;
  setDevice: (d: Device) => void;
  /** The section picked, or null. */
  selected: string | null;
  select: (id: string | null) => void;
  /** A new section of `kind` as Add places it: filled, never an empty band. */
  newSection: (kind: DocSectionKind) => DocSection;
  mode: DocMode;
  /** On a phone: words and data only (`phone/use-light-edit.ts`). */
  light: boolean;
}

/** The builder for `initial`, for `who`. Key the caller per document so each opening starts fresh. */
export function useDocEditor(initial: DocLayout, { who, terms: initialTerms, fill, mode = 'proposal', type = 'proposal' }: DocEditorOptions): DocEditor {
  const editor = useLayoutEditor(toProd(upgradeLayout(initial)));
  // The guard reads the layout as it is now; a ref, so `dispatch` keeps one identity.
  const layoutRef = useRef(editor.state.layout);
  useLayoutEffect(() => {
    layoutRef.current = editor.state.layout;
  });
  const prodDispatch = editor.dispatch;
  const dispatch = useCallback(
    (action: DocAction, opts?: { commit?: boolean }) => {
      const allowed = guard(fromProd(layoutRef.current), action);
      // Engine sections and data travel through production's reducer as they are (see `model/as-production.ts`).
      if (allowed) prodDispatch(allowed as LayoutAction, opts);
    },
    [prodDispatch],
  );
  const state = useMemo<DocEditorState>(() => ({ ...editor.state, layout: fromProd(editor.state.layout) }), [editor.state]);
  const account = useAccount();
  const [device, setDevice] = useState<Device>('desktop');
  const [terms, setTerms] = useState<BookingTerms>(() => initialTerms ?? { contract: true, deposit: account.deposit, balanceDays: 30 });
  const look = useKitLook();
  const { branding } = look;
  const frozen = editor.state.layout.theme;
  const theme = frozen ?? look.theme;
  // By value: callers pass a fresh `who` object each render.
  const { couple, date, venue } = who;
  const doc = useMemo(() => docFor({ couple, date, venue }, terms.deposit), [couple, date, venue, terms.deposit]);
  const selected = editor.state.selection.sectionId;
  const light = useLightEdit();
  return {
    ...editor,
    state,
    dispatch,
    type,
    branding,
    theme,
    doc,
    terms,
    setTerms,
    device,
    setDevice,
    selected,
    // An engine kind comes from its registry entry; production's from the document's own fill.
    newSection: (kind) => (isEngineKind(kind) ? specFor(kind).create!() : (fill ?? newSectionFor)(kind)),
    mode,
    select: (id) => dispatch({ type: 'select', sectionId: id }),
    light,
  };
}
