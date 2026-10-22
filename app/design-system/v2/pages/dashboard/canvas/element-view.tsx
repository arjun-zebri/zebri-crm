'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

import { ImageIcon } from '@/components/ui-v2/icons';

import { fontStack } from '../../onboarding/demo-data';

import { useCanvasData } from './canvas-context';
import type { CanvasElement } from './model';
import { boxCss, colorOf, textCss } from './resolve';

/**
 * One element's contents, filling its box: text (editable in place while
 * `editing`), a shape, an image (an empty slot until one is dropped in),
 * the MC's logo (their business name in the heading face until they upload
 * one), a field's words, or a working part. Position and selection are the
 * page's job; this only draws what is inside.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/element-view
 */

export interface ElementViewProps {
  el: CanvasElement;
  /** Its text is being typed into. */
  editing?: boolean | undefined;
  /** The new words, when typing ends. */
  onText?: ((text: string) => void) | undefined;
  /** Escape: stop typing (the words are kept). */
  onDone?: (() => void) | undefined;
}

/** Text typed into in place, plain (styling is the element's, not per letter). */
function EditableText({ text, onText, onDone }: { text: string; onText: (t: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const commit = useRef(onText);
  useLayoutEffect(() => {
    commit.current = onText;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Caret at the end, as Canva does when you double-click into text.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    // A click elsewhere on the canvas ends editing before the blur arrives,
    // and React sends no blur to a box it removes: keep the words on the way out.
    return () => commit.current(el.innerText);
  }, []);
  return (
    <div
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Text"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          // Ends typing only, not the dialog the canvas sits in.
          e.preventDefault();
          onDone();
        }
      }}
      className="w-full cursor-text whitespace-pre-wrap break-words outline-none"
    >
      {text}
    </div>
  );
}

/** An element's contents. See {@link ElementViewProps}. */
export function ElementView({ el, editing = false, onText, onDone }: ElementViewProps) {
  const { kit, fields, widgets, business } = useCanvasData();
  const box = boxCss(el.box, kit);
  switch (el.kind) {
    case 'text':
      return (
        <div style={{ ...box, ...textCss(el.look, kit) }} className="w-full whitespace-pre-wrap break-words">
          {editing && onText ? <EditableText text={el.text} onText={onText} onDone={() => onDone?.()} /> : el.text}
        </div>
      );
    case 'field':
      return (
        <div style={{ ...box, ...textCss(el.look, kit) }} className="w-full whitespace-pre-wrap break-words">
          {fields[el.field] ?? ''}
        </div>
      );
    case 'shape':
      if (el.shape === 'line') return <div style={{ background: colorOf(el.box?.fill ?? 'kit:ink', kit), opacity: el.box?.opacity }} className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" />;
      return <div style={{ ...box, borderRadius: el.shape === 'ellipse' ? '9999px' : box.borderRadius }} className="size-full" />;
    case 'image':
      return el.src ? (
        // The MC's own picture, often a data URL: next/image cannot take it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={el.src} alt="" draggable={false} style={{ ...box, objectFit: el.fit }} className="size-full" />
      ) : (
        <div style={box} className="flex size-full items-center justify-center bg-zebra-100 text-zebra-400">
          <ImageIcon aria-hidden="true" className="size-4" />
        </div>
      );
    case 'logo': {
      const src = kit.logos.find((l) => l.id === el.variant)?.src ?? kit.logos.find((l) => l.id === 'main')?.src;
      return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} className="size-full object-contain object-left" />
      ) : (
        <div style={{ fontFamily: fontStack(kit.text.heading.font), color: colorOf('kit:ink', kit), fontSize: Math.min(el.h * 0.6, 28) }} className="flex size-full items-center truncate">
          {business}
        </div>
      );
    }
    case 'widget':
      return <div className="size-full">{widgets[el.widget]?.({ w: el.w, h: el.h }) ?? null}</div>;
  }
}
