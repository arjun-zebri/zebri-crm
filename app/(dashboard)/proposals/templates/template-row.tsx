'use client';

/**
 * One row of the Templates tab: the template's name (click to rename),
 * the default badge, Open (the editor route, Proposal Layout v2 Phase 2
 * Task 14), and Delete.
 *
 * @module app/(dashboard)/proposals/templates/template-row
 */
import Link from 'next/link';
import { useRef, useState } from 'react';

import { Button, buttonClassName } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import type { TemplateSummary } from '@/features/proposals';

/** Props for {@link TemplateRow}. */
export interface TemplateRowProps {
  /** The template this row renders. */
  template: TemplateSummary;
  /** Whether the row's Delete control is enabled (not the default, not the last one). */
  canDelete: boolean;
  /**
   * Fires with the trimmed new name once the rename field is committed and
   * actually changed. Resolves `true` once the rename is applied and the
   * caller's refetch has landed, `false` if it was rejected or threw;
   * `commit` (below) awaits this to decide whether to revert its own
   * optimistic display.
   */
  onRename: (name: string) => Promise<boolean>;
  /** Fires when "Make default" is clicked. */
  onSetDefault: () => void;
  /** Fires when Delete is clicked (the caller owns the confirmation step). */
  onDelete: () => void;
}

/** A single template row. See {@link TemplateRowProps}. */
export function TemplateRow({ template, canDelete, onRename, onSetDefault, onDelete }: TemplateRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(template.name);
  // Tracks the last name seen from props, so the render-phase adjustment
  // below fires only on an actual server-driven change, not on every
  // render. React's documented "adjusting state when a prop changes"
  // pattern (https://react.dev/learn/you-might-not-need-an-effect):
  // `commit` (below) shows the typed name optimistically and awaits
  // `onRename`'s outcome: on failure it reverts `value` itself, so this
  // effect's job is only the success path: adopting the confirmed name
  // once the caller's refetch lands `template.name` as the new value.
  const [syncedName, setSyncedName] = useState(template.name);
  if (template.name !== syncedName) {
    setSyncedName(template.name);
    setValue(template.name);
  }

  // Escape cancels synchronously (state + exit edit mode) so the input
  // unmounts right away; a mutable ref (not state) guards `commit`
  // against the blur that unmounting can still trigger, in either render
  // order, because a plain ref read is never stale the way a value
  // captured in the keydown handler's closure could be. It is reset when
  // a new edit starts (the name button's onClick, below), not only in
  // `commit`: jsdom (and possibly real browsers) do not reliably fire
  // blur on an input that unmounts after Escape, so without this reset
  // the guard could stay armed and swallow the row's next, legitimate
  // rename.
  const cancelledRef = useRef(false);

  const commit = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    setEditing(false);
    const name = value.trim();
    if (name && name !== template.name) {
      // Optimistic: the typed value is already on screen (it's what
      // `value` holds) and the editor closes immediately. If the rename
      // is rejected (or throws), snap back to the last-known-good name
      // ourselves; if it succeeds, the sync tracker above adopts the
      // refetched name once it lands.
      const ok = await onRename(name);
      if (!ok) setValue(template.name);
    } else {
      setValue(template.name);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      {editing ? (
        <Input
          aria-label={`Template name for ${template.name}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              cancelledRef.current = true;
              setValue(template.name);
              setEditing(false);
            }
          }}
          autoFocus
          className="min-w-0 flex-1"
        />
      ) : (
        <Tooltip label="Click to rename" className="min-w-0 flex-1">
          <Button
            variant="ghost"
            aria-label={`Rename ${template.name}`}
            onClick={() => {
              cancelledRef.current = false;
              setEditing(true);
            }}
            className="w-full min-w-0 justify-start"
          >
            <span className="min-w-0 truncate">{value}</span>
          </Button>
        </Tooltip>
      )}
      {template.isDefault ? (
        <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-body text-text-muted">Default</span>
      ) : (
        <Button variant="ghost" onClick={onSetDefault}>Make default</Button>
      )}
      {/* `Button` has neither an `asChild` nor an `href` prop (it only ever
          renders a real `<button>`), so a link styled to match it goes
          through `buttonClassName` (the primitive's own class builder)
          rather than nesting two interactive elements or hand-copying its
          classes. */}
      <Link
        href={`/proposals/templates/${template.id}`}
        aria-label={`Open ${template.name}`}
        className={buttonClassName({ variant: 'secondary' })}
      >
        Open
      </Link>
      <Button variant="ghost" disabled={!canDelete} onClick={onDelete} aria-label={`Delete ${template.name}`}>
        Delete
      </Button>
    </li>
  );
}
