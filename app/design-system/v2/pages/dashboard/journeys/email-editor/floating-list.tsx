'use client';

import type { Editor } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import { Suggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ComponentType, type ReactNode } from 'react';

import { MENU_ITEM, MENU_LABEL, MENU_SURFACE } from '@/components/ui-v2/control-styles';

/**
 * The floating list a journey email's `@` (fields) and `/` (sections)
 * open under the caret, as production's proposal editor does: grouped
 * rows with a glyph, narrowed by what is typed after the trigger; arrows
 * move, Enter or Tab or a click picks, Escape puts it away. The trigger
 * only fires at the start of a word, so an email address never opens
 * it. Mounted inside the open `<dialog>`, or the browser would keep it
 * inert behind it.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/floating-list
 */

/** One row: what it is called, an optional glyph or tag, its group heading, and what it does. */
export interface ListItem {
  id: string;
  label: string;
  group?: string | undefined;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }> | undefined;
  /** Drawn in place of the label (a green field tag). */
  tag?: ReactNode;
  /** Quiet words on the right: a field's sample value. */
  aside?: string | undefined;
  run: (editor: Editor) => void;
}

interface ListHandle {
  onKeyDown: (p: SuggestionKeyDownProps) => boolean;
}

interface ListProps {
  items: ListItem[];
  command: (item: ListItem) => void;
  empty: string;
}

const List = forwardRef<ListHandle, ListProps>(function List({ items, command, empty }, ref) {
  const [at, setAt] = useState(0);
  const i = Math.min(at, Math.max(items.length - 1, 0));
  const n = Math.max(items.length, 1);
  // Keeps the arrow keys' row in view as it moves past the list's scrolled edge (with its group heading).
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => rows.current[i]?.scrollIntoView({ block: 'nearest' }), [i]);
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown') return setAt((i + 1) % n), true;
      if (event.key === 'ArrowUp') return setAt((i - 1 + n) % n), true;
      if ((event.key === 'Enter' || event.key === 'Tab') && items[i]) return command(items[i]), true;
      return false;
    },
  }));
  if (!items.length) return <div className={`${MENU_SURFACE} w-64 px-3 py-2 type-body text-zebra-500`}>{empty}</div>;
  return (
    <div role="listbox" className={`${MENU_SURFACE} max-h-80 w-64 overflow-y-auto`}>
      {items.map((item, k) => {
        const Icon = item.icon;
        const heading = item.group && item.group !== items[k - 1]?.group ? item.group : null;
        return (
          <div key={item.id} ref={(el) => void (rows.current[k] = el)}>
            {heading ? <p className={MENU_LABEL}>{heading}</p> : null}
            <button
              type="button"
              role="option"
              aria-selected={k === i}
              onMouseDown={(e) => (e.preventDefault(), command(item))}
              onMouseEnter={() => setAt(k)}
              // The arrow keys' row is the highlighted one; a menu row takes no focus mark.
              data-highlighted={k === i ? '' : undefined}
              tabIndex={-1}
              className={MENU_ITEM}
            >
              {Icon ? <Icon className="size-4 shrink-0 text-zebra-500" /> : null}
              {item.tag ?? <span className="min-w-0 truncate">{item.label}</span>}
              {item.aside ? <span className="min-w-0 flex-1 truncate text-right text-zebra-400">{item.aside}</span> : null}
            </button>
          </div>
        );
      })}
    </div>
  );
});

/** A Suggestion plugin on `char` whose rows come from `items(query)`. */
export function suggestion(editor: Editor, char: string, items: (query: string) => ListItem[], empty: string) {
  return Suggestion<ListItem, ListItem>({
    editor,
    char,
    pluginKey: new PluginKey(`email-suggest-${char}`),
    items: ({ query }) => items(query),
    // The typed trigger goes first, so what it puts in lands in its place.
    command: ({ editor: ed, range, props }) => (ed.chain().focus().deleteRange(range).run(), props.run(ed)),
    render: () => {
      let list: ReactRenderer<ListHandle, ListProps> | null = null;
      let box: HTMLDivElement | null = null;
      const place = (p: SuggestionProps<ListItem, ListItem>) => {
        const r = p.clientRect?.();
        if (!box || !r) return;
        // Above the caret when there is no room under it.
        const below = r.bottom + 6;
        const top = below + 320 > window.innerHeight ? Math.max(8, r.top - Math.min(box.offsetHeight || 320, 320) - 6) : below;
        Object.assign(box.style, { top: `${top}px`, left: `${Math.min(r.left, window.innerWidth - 272)}px` });
      };
      const end = () => (list?.destroy(), box?.remove(), (list = null), (box = null));
      return {
        onStart: (p: SuggestionProps<ListItem, ListItem>) => {
          list = new ReactRenderer(List, { props: { items: p.items, command: p.command, empty }, editor: p.editor });
          box = document.createElement('div');
          box.className = 'fixed z-[95]';
          box.appendChild(list.element);
          (p.editor.view.dom.closest('dialog') ?? document.body).appendChild(box);
          place(p);
        },
        onUpdate: (p: SuggestionProps<ListItem, ListItem>) => (list?.updateProps({ items: p.items, command: p.command, empty }), place(p)),
        onKeyDown: (p: SuggestionKeyDownProps) => (p.event.key === 'Escape' ? (end(), true) : (list?.ref?.onKeyDown(p) ?? false)),
        onExit: end,
      };
    },
  });
}
