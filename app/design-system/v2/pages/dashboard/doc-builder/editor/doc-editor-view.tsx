'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { CanvasFrame } from '@/components/editor';
import {
  FieldShortcutsProvider,
  SectionCanvas,
  TextBar,
  useEditorShortcuts,
  useNodeBarContent,
  VariableViewProvider,
} from '@/features/proposals';
import type { LayoutAction, LayoutEditorState, TextBarHandle } from '@/features/proposals';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { docBrandVars } from '../look/brand-vars';
import { isEngineKind, toProd } from '../model/as-production';
import type { DocSection } from '../model/types';
import { EngineSection } from '../render/engine-section';
import { useDocFields } from '../sections/parts/parts';
import type { DocEditor } from '../state/use-doc-editor';

import { AddAt, type AddRequest } from './add-menu';
import { BottomBar } from './bottom-bar';
import { HeaderEdit } from './header-edit';
import { LineItemsEdit } from './line-items-edit';
import { MediaHost } from './media-host';
import { SectionBar, type Point } from './section-bar/section-bar';
import { SignaturesEdit } from './signatures-edit';
import { DocTextBar, TextBarHostProvider } from './text-bar/text-bar';
import type { ScreenPoint } from './text-bar/use-drag-bar';
import { VariableToken } from './variable-token';

/**
 * The builder: production's proposal editor, as it ships (founder,
 * 2026-10-10: "the actual editor can be what's in current proposals in
 * production ... the only thing that needs to change is the popover").
 * The canvas, the text and node bars, the "+" on each section's edges,
 * inline data editing and resizing are all production's own
 * (`SectionCanvas` and friends); its "+" opens our add list (`AddAt`),
 * the same one as the bar's Add, in place of production's add palette. Two things are ours: a picked
 * section's tools live in a slim ink bar over it (`SectionBar`) in place of production's anchored toolbar, and a bar
 * at the foot adds a section, opens the Brand kit and teaches "/"
 * (`BottomBar`), in place of production's Global style button. Pictures
 * and videos are asked for through our dialogs (`MediaHost`), since the
 * preview has no server to upload to.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/doc-editor-view
 */

/** The builder for `builder`; it fills its parent (a dialog's body). */
export function DocEditorView({ builder }: { builder: DocEditor }) {
  const { state, branding, theme, device, selected, undo, redo } = builder;
  const fields = useDocFields();
  // Production's editor state, wearing the look the page wears: the brand kit's live, or the frozen one of a sent copy.
  const prodState = useMemo<LayoutEditorState>(
    () => ({ ...state, layout: { ...toProd(state.layout), theme } }),
    [state, theme],
  );
  // The canvas only ever sends production's own actions, which the engine's dispatch accepts as they are.
  const dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void = builder.dispatch;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const swatches = useMemo(() => {
    const colors = [
      branding.brand_color,
      branding.accent_color,
      branding.secondary_color,
      branding.heading_color,
      branding.text_color,
    ];
    return Array.from(new Set(colors.filter((c): c is string => Boolean(c))));
  }, [branding]);
  const textBarRef = useRef<TextBarHandle>(null);
  useEditorShortcuts({ state: prodState, dispatch, undo, redo, textBarRef });
  const { sectionEditor, barContent } = useNodeBarContent({
    state: prodState,
    scrollRef,
    zoom,
    swatches,
  });
  const shortcuts = useMemo(() => ({ undo, redo }), [undo, redo]);
  // Every brand face, so a kit change shows on the page at once.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  // The box the section popover is placed in, and where the MC dragged it (it stays there once moved).
  const host = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState<Point | null>(null);
  // Where the text bar was dragged to; it stays there once moved, as the section bar does.
  const [textAt, setTextAt] = useState<ScreenPoint | null>(null);
  const textHost = useMemo(
    () => ({ branding, pinned: textAt, onPin: setTextAt }),
    [branding, textAt],
  );
  // Where the canvas's own "+" asked to add; our list opens there, as the bar's Add does.
  const [adding, setAdding] = useState<AddRequest | null>(null);
  // A click on a section leaves focus on the window itself, outside the
  // host, where the host's own Escape never hears it and the window's
  // closed the editor (live-found 2026-10-10). Caught first, at the window.
  const { select } = builder;
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== 'Escape' || e.defaultPrevented || host.current?.contains(target)) return;
      // A popover open over the page closes itself on this Escape; the section stays picked.
      if (target !== document.body && target.tagName !== 'DIALOG') return;
      if (document.querySelector('[data-radix-popper-content-wrapper]')) return;
      e.preventDefault();
      select(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selected, select]);
  return (
    <div
      ref={host}
      // The starters' brand-coloured parts (the cover, the small headings) read the brand from these, live.
      style={docBrandVars(branding.brand_color)}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      // Escape steps out of the text or the section, never out of the
      // dialog: closing on it lost a page of work in the canvas (2026-10-03).
      // One from inside a popover (which React bubbles up through its portal) shuts that popover, not the section.
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || e.defaultPrevented || !selected) return;
        if ((e.target as HTMLElement).closest('[data-radix-popper-content-wrapper]')) return;
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        builder.select(null);
      }}
      // A click on the desk around the page lets the section go, as in
      // production; one on the page, a bar, a popover or a grip is theirs.
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (
          target.closest(
            '[data-page-sheet], [data-canvas-section-id], [role="toolbar"], [role="dialog"], [role="slider"], button, input',
          )
        )
          return;
        if (selected) builder.select(null);
      }}
    >
      <FieldShortcutsProvider value={shortcuts}>
        {/* Client fields in the words are our quiet token, not production's chip. */}
        <VariableViewProvider value={VariableToken}>
          <CanvasFrame
            device={device === 'phone' ? 'mobile' : 'desktop'}
            zoom={zoom}
            setZoom={setZoom}
            page
            wide
            scrollRef={scrollRef}
            overlay={barContent}
            zoomControl={false}
          >
            <SectionCanvas
              state={prodState}
              dispatch={dispatch}
              branding={branding}
              device={device === 'phone' ? 'mobile' : 'desktop'}
              // Only flavours the add palette's starter copy.
              role="mc"
              boundsRef={scrollRef}
              swatches={swatches}
              sectionToolbar={false}
              // Width is the bar's Width menu; the height drag stays.
              widthHandles={false}
              onRequestAdd={(at, anchor) => setAdding({ at, anchor })}
              // A contract's own fields (its package, fee) on `@`, besides the couple's and the business's.
              {...(fields ? { variables: fields.list } : {})}
              // Production draws only its own kinds; the engine's draw here, the Header, Signatures and an invoice's lines in their edit forms.
              renderBody={(section, index) =>
                isEngineKind(section.kind) ? (
                  <EngineSection
                    section={section as unknown as DocSection}
                    index={index}
                    theme={theme}
                    branding={branding}
                    mode="edit"
                    values={{}}
                    body={
                      section.kind === 'header' ? (
                        <HeaderEdit section={section as unknown as DocSection} builder={builder} externalVersion={prodState.externalVersion} />
                      ) : section.kind === 'signatures' ? (
                        <SignaturesEdit section={section as unknown as DocSection} builder={builder} externalVersion={prodState.externalVersion} />
                      ) : section.kind === 'lineItems' ? (
                        <LineItemsEdit section={section as unknown as DocSection} builder={builder} externalVersion={prodState.externalVersion} />
                      ) : undefined
                    }
                  />
                ) : undefined
              }
            />
          </CanvasFrame>
        </VariableViewProvider>
      </FieldShortcutsProvider>
      {/* TipTap's own bubble places itself over the selected words; the row in it is ours. */}
      {sectionEditor ? (
        <TextBarHostProvider value={textHost}>
          <TextBar
            editor={sectionEditor}
            swatches={swatches}
            theme={theme}
            ref={textBarRef}
            row={DocTextBar}
            // A picked field is formatted like the words around it.
            showOverVariables
          />
        </TextBarHostProvider>
      ) : null}
      <SectionBar builder={builder} host={host} pinned={pinned} onPin={setPinned} />
      <AddAt builder={builder} request={adding} onClose={() => setAdding(null)} />
      <BottomBar builder={builder} />
      <MediaHost builder={builder} />
    </div>
  );
}
