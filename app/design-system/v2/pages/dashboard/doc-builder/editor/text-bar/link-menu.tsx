'use client';

import type { Editor } from '@tiptap/react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui-v2/button';
import { LinkIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { LINK_ERROR, LINK_PATTERN, type TextState } from '@/features/proposals';

import { BarButton } from '../section-bar/bar-parts';

/**
 * Linking the selected words: one field and Save, with Remove when they
 * are linked already. Held to production's own rule on what a link may
 * be (`LINK_PATTERN`), since the page is production's. Opened by the bar
 * or by Cmd+K, through `open`.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/text-bar/link-menu
 */

export interface LinkMenuProps {
  editor: Editor;
  state: TextState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The link button and its field. See {@link LinkMenuProps}. */
export function LinkMenu({ editor, state, open, onOpenChange }: LinkMenuProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <BarButton label="Link" on={open || Boolean(state.linkHref)} toggle={false}>
          <LinkIcon aria-hidden="true" className="size-4" />
        </BarButton>
      </PopoverTrigger>
      <PopoverContent data-text-bar="" size="card" side="bottom" align="center" aria-label="Link">
        <LinkForm editor={editor} href={state.linkHref} onDone={() => onOpenChange(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** The field and its buttons. Mounted on each opening, so it starts from the words' link, or a start on one. */
function LinkForm({ editor, href, onDone }: { editor: Editor; href: string | null; onDone: () => void }) {
  const [value, setValue] = useState(href ?? 'https://');
  const [error, setError] = useState<string | null>(null);
  const save = (e: FormEvent) => {
    e.preventDefault();
    const next = value.trim();
    if (!LINK_PATTERN.test(next)) return setError(LINK_ERROR);
    editor.chain().focus().extendMarkRange('link').setLink({ href: next }).run();
    onDone();
  };
  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onDone();
  };
  return (
    <form onSubmit={save} className="space-y-3">
      <Input icon={LinkIcon} label="Link" autoFocus value={value} onChange={(e) => (setValue(e.target.value), setError(null))} error={error ?? undefined} />
      <div className="flex justify-end gap-2">
        {href ? (
          <Button variant="ghost" onClick={remove}>
            Remove
          </Button>
        ) : null}
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
