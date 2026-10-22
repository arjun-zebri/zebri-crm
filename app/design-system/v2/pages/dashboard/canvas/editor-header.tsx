'use client';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { DIALOG_HEADER_PAD } from '@/components/ui-v2/dialog-parts';
import { IconCircle, type IconCircleIcon } from '@/components/ui-v2/icon-circle';
import { CloseIcon, RedoIcon, UndoIcon } from '@/components/ui-v2/icons';

/**
 * The header of a design editor that saves as the MC works: the brand
 * kit, and the canvas's Design dialog (and its playground). The dialog
 * anatomy (`DialogHeader`): an icon circle, the title quiet in `type-label
 * text-zebra-500`, Close at the far right; then how the work stands, as
 * the proposal editor shows it ("Saved" once something changed, a line
 * saying what the editor is for until then), and Undo and Redo where the
 * editor keeps history. Its own row rather than `DialogHeader`, which has
 * no slot for Undo and Redo before Close.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/editor-header
 */

/** An editor's history, for Undo and Redo. */
export interface EditorHistory {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export interface EditorHeaderProps {
  /** What the dialog's `aria-labelledby` points at. */
  id: string;
  title: string;
  icon: IconCircleIcon;
  /** Something has changed and is kept: shows "Saved". */
  saved: boolean;
  /** Said instead of "Saved" at rest: what the editor is for. */
  detail?: string | undefined;
  /** Undo and Redo, for an editor with history. */
  history?: EditorHistory | undefined;
  /** Closes the editor (the work is kept); left out, no Close (the playground page). */
  onClose?: (() => void) | undefined;
}

/** The header. See {@link EditorHeaderProps}. */
export function EditorHeader({ id, title, icon, saved, detail, history, onClose }: EditorHeaderProps) {
  return (
    <header className={`flex shrink-0 items-center gap-2 ${DIALOG_HEADER_PAD}`}>
      <IconCircle icon={icon} />
      <h2 id={id} className="shrink-0 type-label text-zebra-500">
        {title}
      </h2>
      <div className="min-w-0 flex-1 pl-1">
        {saved ? (
          <Badge dot tone="grass">
            Saved
          </Badge>
        ) : detail ? (
          <p className="truncate type-body text-zebra-400">{detail}</p>
        ) : null}
      </div>
      {history ? (
        <>
          <Button variant="ghost" square aria-label="Undo" tooltip="Undo (⌘Z)" disabled={!history.canUndo} onClick={history.undo}>
            <UndoIcon aria-hidden="true" className="size-4" />
          </Button>
          <Button variant="ghost" square aria-label="Redo" tooltip="Redo (⇧⌘Z)" disabled={!history.canRedo} onClick={history.redo}>
            <RedoIcon aria-hidden="true" className="size-4" />
          </Button>
        </>
      ) : null}
      {onClose ? (
        <Button variant="ghost" square aria-label="Close" onClick={onClose}>
          <CloseIcon aria-hidden="true" className="size-4" />
        </Button>
      ) : (
        // Keeps the row Close's height, so nothing below moves.
        <span aria-hidden="true" className="h-9" />
      )}
    </header>
  );
}
