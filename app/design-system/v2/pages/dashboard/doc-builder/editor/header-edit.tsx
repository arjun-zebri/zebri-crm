'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { FileDrop } from '@/components/ui-v2/file-drop';
import { ImagePlusIcon } from '@/components/ui-v2/icons';
import { ContentSectionEditor, themeRoleCss } from '@/features/proposals';

import { useBrandKit } from '../../brand/brand-provider';
import { readLogo, setLogo } from '../../brand/kit-edit';
import type { DocSection } from '../model/types';
import { headerFlow, headerOf, LOGO_MAX, LOGO_MIN, type HeaderData } from '../sections/header/data';
import { hasWords, LogoMark } from '../sections/header/view';
import { useDocFields } from '../sections/parts/parts';
import type { DocEditor } from '../state/use-doc-editor';

/**
 * The Header section while editing: the logo, which a click or a dropped
 * picture changes (setting the brand kit's logo, so every document
 * follows), with a handle on its corner that drags it bigger or smaller;
 * and the MC's words under or beside it, typed in place with the same
 * editor and text bar as a Text section, shown once the header is picked
 * or has words. The height shows beside the handle while
 * dragging and lands as one undo step on release.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/header-edit
 */

const ACCEPT = 'image/png,image/svg+xml,image/jpeg,image/webp';
const EMPTY = { type: 'doc', content: [] };

export interface HeaderEditProps {
  section: DocSection;
  builder: DocEditor;
  /** Production's editor state version, which tells the text editor when the layout changed under it (undo). */
  externalVersion: number;
}

/** The edit form. See {@link HeaderEditProps}. */
export function HeaderEdit({ section, builder, externalVersion }: HeaderEditProps) {
  const { kit, saveKit } = useBrandKit();
  const fields = useDocFields();
  const { branding, theme } = builder;
  const data = headerOf(section);
  const [dragging, setDragging] = useState<number | null>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const height = dragging ?? data.height;
  const align = section.style.align ?? 'center';
  const set = (patch: Partial<HeaderData>, commit?: boolean) =>
    builder.dispatch({ type: 'setData', id: section.id, data: { kind: 'header', header: { ...data, ...patch } } }, commit ? { commit } : undefined);
  const logo = branding.logo_url;
  const flow = headerFlow(data, align);
  // The words' line shows while the header is picked or once it has words: an empty one left on the page read as a stray line (founder, 2026-10-21).
  const writing = builder.selected === section.id || hasWords(data.text);

  // Drags from the corner, keeping the logo's shape. The canvas may be zoomed, so screen pixels are scaled back to page pixels.
  const resize = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const box = logoRef.current?.getBoundingClientRect();
    if (!box || box.height === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const scale = box.height / data.height;
    const aspect = box.width / box.height;
    const start = { x: e.clientX, y: e.clientY };
    let next = data.height;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      // Either direction counts: down and right both grow it.
      const grow = (m.clientY - start.y + (m.clientX - start.x) / aspect) / 2 / scale;
      next = Math.round(Math.min(LOGO_MAX, Math.max(LOGO_MIN, data.height + grow)));
      setDragging(next);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      setDragging(null);
      if (next !== data.height) set({ height: next }, true);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  return (
    <div className={flow.box}>
      {logo ? (
        <span ref={logoRef} className="group/logo relative inline-block">
          <FileDrop
            label="Change your logo"
            accept={ACCEPT}
            value={logo}
            onFile={(file) => readLogo(file, (src) => saveKit(setLogo(kit, 'main', src)))}
            face={<LogoMark src={logo} name={branding.business_name ?? ''} height={height} nameStyle={{}} />}
          />
          <span
            role="presentation"
            aria-label="Drag to resize"
            onPointerDown={resize}
            onClick={(e) => e.stopPropagation()}
            className={`absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize touch-none rounded-pill bg-field ring-2 ring-grass-500 transition-opacity duration-150 motion-reduce:transition-none ${
              dragging === null ? 'opacity-0 group-hover/logo:opacity-100' : 'opacity-100'
            }`}
          />
          {/* The logo's ring while it can be resized, so the handle reads as the logo's. */}
          <span aria-hidden="true" className={`pointer-events-none absolute -inset-1 rounded-check ring-1 ring-grass-500/60 transition-opacity duration-150 motion-reduce:transition-none ${dragging === null ? 'opacity-0 group-hover/logo:opacity-100' : 'opacity-100'}`} />
          {dragging !== null ? <span className="absolute -bottom-8 right-0 rounded-check bg-zebra-950 px-1.5 type-numeric text-zebra-50">{dragging}px</span> : null}
        </span>
      ) : (
        <FileDrop
          label="Add your logo"
          accept={ACCEPT}
          value={null}
          onFile={(file) => readLogo(file, (src) => saveKit(setLogo(kit, 'main', src)))}
          face={
            <span style={{ height: data.height, ...themeRoleCss(theme, 'paragraph') }} className="flex items-center gap-2 rounded-button border border-dashed border-hairline px-4 text-zebra-500 transition-colors duration-150 hover:bg-hover hover:text-zebra-950 motion-reduce:transition-none">
              <ImagePlusIcon aria-hidden="true" className="size-4" />
              Add your logo
            </span>
          }
        />
      )}
      <div className={`${flow.words} ${writing ? '' : 'hidden'}`}>
        <ContentSectionEditor
          sectionId={section.id}
          content={data.text ?? EMPTY}
          externalVersion={externalVersion}
          branding={branding}
          theme={theme}
          textColor={section.style.textColor}
          align={flow.align}
          onChange={(_, text) => set({ text })}
          variables={fields?.list}
          onFocusSection={(id) => builder.dispatch({ type: 'select', sectionId: id })}
          onNodeSelect={(node) => builder.dispatch({ type: 'selectNode', node })}
        />
      </div>
    </div>
  );
}
