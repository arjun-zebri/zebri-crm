'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState, type MouseEvent } from 'react';

import { MENU_RULE } from '@/components/ui-v2/control-styles';
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from '@/components/ui-v2/icons';
import { MenuOption, Popover, PopoverAnchor, PopoverContent } from '@/components/ui-v2/popover';
import { PROPOSAL_VARIABLES } from '@/features/proposals';

import { useDocFields } from '../sections/parts/parts';

/**
 * A client field in the words ("Couple name"), as a quiet token: a soft
 * tint and no border, ringed when picked (founder, 2026-10-10: the mint
 * box and its form popover were not premium). It takes the words'
 * formatting (bold, size, colour) like any word, and a picked token gets
 * the text bar below it (founder: "there's no way to highlight variables
 * to change things about them"). A click also opens a short menu above
 * it, as Notion and Attio do: the field's name, which swaps it for
 * another field; what to show when it is not known yet, typed in the
 * row; and Remove. Drawn in place of production's chip through
 * `VariableViewProvider`; the node and its attributes are production's.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/variable-token
 */

/** The token and its menu. */
export function VariableToken({ node, selected, editor, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const { id = '', fallback = null } = node.attrs as { id?: string | null; fallback?: string | null };
  // The document's own fields when it has some (a contract's package and fee), else a proposal's.
  const list = useDocFields()?.list ?? PROPOSAL_VARIABLES;
  const label = list.find((v) => v.id === id)?.label ?? id ?? '';
  const [open, setOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  // Held while typing and written on Enter or leaving: a write per key would be an undo step each.
  const [draft, setDraft] = useState(fallback ?? '');
  const commit = () => {
    const next = draft.trim();
    if (next !== (fallback ?? '')) updateAttributes({ fallback: next || null });
  };
  const pick = (e: MouseEvent<HTMLElement>) => {
    // The menu portals out, but React bubbles its clicks through here; only the token itself opens it.
    if (!e.currentTarget.contains(e.target as Node)) return;
    e.preventDefault();
    const pos = getPos();
    if (typeof pos === 'number') editor.commands.setNodeSelection(pos);
    setDraft(fallback ?? '');
    setSwapping(false);
    setOpen(true);
  };
  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : (commit(), setOpen(false)))}>
      <PopoverAnchor asChild>
        <NodeViewWrapper
          as="span"
          data-variable={id}
          contentEditable={false}
          onClickCapture={pick}
          // Em padding and no type size or colour: it takes the words' own, in headings too; the tint alone marks it.
          className={`inline cursor-pointer rounded-check bg-grass-500/15 px-[0.2em] transition-colors duration-150 hover:bg-grass-500/25 motion-reduce:transition-none ${selected || open ? 'ring-1 ring-selected' : ''}`}
        >
          {label}
          {fallback ? <span className="opacity-60">{` · ${fallback}`}</span> : null}
        </NodeViewWrapper>
      </PopoverAnchor>
      {/* Above the token: the text bar takes the space below it. */}
      <PopoverContent size="menu" side="top" align="start" aria-label={label} className="w-64">
        {swapping ? (
          <div className="max-h-72 overflow-y-auto">
            <MenuOption onSelect={() => setSwapping(false)}>
              <ChevronLeftIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-500" />
              Fields
            </MenuOption>
            {list.map((v) => (
              <MenuOption key={v.id} selected={v.id === id} onSelect={() => (updateAttributes({ id: v.id }), setSwapping(false))}>
                {v.label}
              </MenuOption>
            ))}
          </div>
        ) : (
          <>
            <MenuOption onSelect={() => setSwapping(true)}>
              <span className="text-zebra-950">{label}</span>
              <ChevronRightIcon aria-hidden="true" className="ml-auto size-4 shrink-0 text-zebra-400" />
            </MenuOption>
            <label className="flex h-8 items-center gap-2 rounded-check px-2 type-body text-zebra-500 focus-within:bg-hover">
              If unknown
              <input
                value={draft}
                maxLength={200}
                placeholder="leave blank"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit(), setOpen(false))}
                className="min-w-0 flex-1 bg-transparent text-right text-zebra-950 outline-none placeholder:text-zebra-400"
              />
            </label>
            <div aria-hidden="true" className={MENU_RULE} />
            <MenuOption onSelect={() => (setOpen(false), deleteNode())}>
              <TrashIcon aria-hidden="true" className="size-4 shrink-0 text-zebra-500" />
              Remove
            </MenuOption>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
