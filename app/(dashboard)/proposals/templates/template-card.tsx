'use client';

/**
 * One card of the proposal templates grid (replaces the old `TemplateRow`
 * list item, UX audit §3.9): a real thumbnail of the layout with the
 * host's outcome chips over its top-left corner and the Row actions menu
 * (Edit / Set as default / Duplicate / Settings / Delete) over its
 * top-right, then the name, the default badge and a "N sections · Edited
 * …" line underneath. The whole thumbnail is a link to the editor.
 *
 * The name is plain text, not an inline rename (dropped 2026-09-19 on the
 * founder's ask): renaming happens in the builder's header, the one place
 * a template is edited, so the list stays a list.
 *
 * Deliberately not a bordered box: the thumbnail already has its own
 * border (it is a framed picture of the page), so a border around the
 * whole card put two frames on screen at once. The caption sits under the
 * thumbnail with no box, the way a file browser lays out documents.
 *
 * @module app/(dashboard)/proposals/templates/template-card
 */
import { Copy, Pencil, Settings, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { RowActionsMenu, type RowAction } from '@/components/ui/row-actions-menu';
import { LayoutThumbnail, type TemplateListItem } from '@/features/proposals';
import type { PublicBranding } from '@/lib/branding/public-branding';
import { formatRelativeTime } from '@/lib/utils';

/** Props for {@link TemplateCard}. */
export interface TemplateCardProps {
  /** The template this card renders, including its layout (for the thumbnail). */
  template: TemplateListItem;
  /** The account's branding, for the thumbnail. `null` while it's still loading (a muted placeholder box shows instead). */
  branding: PublicBranding | null;
  /** Whether Delete is offered (false only for the account's last template; the default itself is deletable). */
  canDelete: boolean;
  /** Opens the template in the editor (the menu's "Edit"; the thumbnail link covers the click case). */
  onEdit: () => void;
  onSetDefault: () => void;
  onDuplicate: () => void;
  /** Opens this template's own proposal settings (the menu's "Settings"). */
  onSettings: () => void;
  onDelete: () => void;
  /** Optional content over the thumbnail's top-left corner (the /proposals page's outcome chips). */
  overlay?: ReactNode;
}

/** A single template card. See {@link TemplateCardProps}. */
export function TemplateCard({
  template,
  branding,
  canDelete,
  onEdit,
  onSetDefault,
  onDuplicate,
  onSettings,
  onDelete,
  overlay,
}: TemplateCardProps) {
  // A lazy initializer, not a bare `Date.now()` in render: the latter is
  // an impure call the React Compiler's purity rule rejects (matches
  // `app/(dashboard)/couples/couple-emails.tsx`'s own `nowMs`).
  const [nowMs] = useState(() => Date.now());

  const icon = (Icon: typeof Pencil) => <Icon size={14} strokeWidth={1.5} aria-hidden="true" />;
  const actions: RowAction[] = [
    { label: 'Edit', icon: icon(Pencil), onSelect: onEdit },
    ...(template.isDefault ? [] : [{ label: 'Set as default', icon: icon(Star), onSelect: onSetDefault }]),
    { label: 'Duplicate', icon: icon(Copy), onSelect: onDuplicate },
    { label: 'Settings', icon: icon(Settings), onSelect: onSettings },
    ...(canDelete ? [{ label: 'Delete', icon: icon(Trash2), onSelect: onDelete, destructive: true }] : []),
  ];

  const sections = template.layout.sections.length;

  return (
    <li className="group flex flex-col gap-1">
      {/* The link is an overlay beside the thumbnail, not its parent: the
          thumbnail is a real render of the layout and contains anchors
          (print mode renders embeds as links), and an <a> inside an <a>
          is invalid HTML that React reports as a hydration error. */}
      <div className="relative">
        {branding ? (
          <LayoutThumbnail
            layout={template.layout}
            branding={branding}
            className="transition-colors group-hover:border-border-strong"
          />
        ) : (
          <div className="aspect-[4/3] rounded-control border border-border bg-surface-muted" />
        )}
        <Link
          href={`/proposals/templates/${template.id}`}
          aria-label={`Open ${template.name}`}
          className="absolute inset-0 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg"
        />
        {/* Both corners come after the link in the DOM so they paint (and
            take the pointer) above it; the rest of the thumbnail still
            opens the editor. */}
        {overlay ? <div className="absolute left-2 top-2">{overlay}</div> : null}
        {/* The menu gets the same solid surface as the chips: the
            trigger's own styling is transparent, which vanishes over a
            photo or a dark cover. */}
        <div className="absolute right-2 top-2 rounded-control bg-surface shadow-sm">
          <RowActionsMenu alwaysVisible size="sm" actions={actions} />
        </div>
      </div>
      <div className="flex h-8 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-body text-text">{template.name}</span>
        {template.isDefault ? (
          <span className="shrink-0 rounded-pill bg-surface-emphasis px-2 py-0.5 text-body text-text-muted">Default</span>
        ) : null}
      </div>
      <div className="text-body text-text-muted">
        {sections} section{sections === 1 ? '' : 's'} · Edited {formatRelativeTime(template.updatedAt, nowMs)}
      </div>
    </li>
  );
}
