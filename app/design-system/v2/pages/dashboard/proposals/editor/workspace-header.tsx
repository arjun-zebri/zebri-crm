'use client';

import { Badge } from '@/components/ui-v2/badge';
import { Button } from '@/components/ui-v2/button';
import { CloseIcon, PlayIcon, ResetIcon } from '@/components/ui-v2/icons';

/**
 * The document editor's header: the title with how the work stands
 * beside it ("Saved", a green-dot `Badge`), then on the right Reset once
 * there is earlier work (a plain button; it is one undo step, so ⌘Z
 * brings the work back), a proposal's Send or a template's Use template,
 * Preview as the one green button, and Close at the far right (founder,
 * 2026-10-10: "the preview button should be the green CTA. remove done
 * and move the X to the right hand side"). The work saves as it goes, so
 * Close is all a template needs. No Undo or Redo buttons: ⌘Z and ⇧⌘Z
 * do it.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/editor/workspace-header
 */

export interface WorkspaceHeaderProps {
  title: string;
  /** How the work stands ("Saved", "Draft kept"), or null at rest. */
  status: string | null;
  /** Said instead of a status at rest. */
  detail?: string | undefined;
  /** Close's name, which says the work is kept. */
  close: string;
  /** Reset's words, or null when there is nothing earlier to drop. */
  over: string | null;
  /** Send or Use template, beside Preview; null when Close is the only way out. */
  action: { label: string; run: () => void } | null;
  onClose: () => void;
  onStartOver: () => void;
  onPreview: () => void;
  /** The MC reached for the header: counts as the start of their work. */
  onReach: () => void;
}

/** The header. See {@link WorkspaceHeaderProps}. */
export function WorkspaceHeader({ title, status, detail, close, over, action, onClose, onStartOver, onPreview, onReach }: WorkspaceHeaderProps) {
  const icon = (Icon: typeof CloseIcon) => <Icon aria-hidden="true" className="size-4" />;
  return (
    <header onPointerDownCapture={onReach} className="flex items-center gap-3 px-3 py-2.5 md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 pl-1">
        <h2 id="editor-title" className="truncate type-label text-zebra-950">
          {title}
        </h2>
        {status ? (
          <Badge dot tone="grass">
            {status}
          </Badge>
        ) : detail ? (
          <span className="shrink-0 type-body text-zebra-500">{detail}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {over ? (
          <Button variant="ghost" icon={icon(ResetIcon)} onClick={onStartOver}>
            {over}
          </Button>
        ) : null}
        {action ? (
          <Button variant="ghost" onClick={action.run}>
            {action.label}
          </Button>
        ) : null}
        <Button icon={icon(PlayIcon)} onClick={onPreview}>
          Preview
        </Button>
      </div>
      <span aria-hidden="true" className="h-5 w-px bg-hairline" />
      <Button variant="ghost" square aria-label={close} onClick={onClose}>
        {icon(CloseIcon)}
      </Button>
    </header>
  );
}
