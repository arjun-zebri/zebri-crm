import type { ReactNode } from 'react';

import { Panel } from '@/components/ui-v2/panel';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

/**
 * Design system v2 media card (preview): a glass `Panel` with a picture
 * on top (a template's cover, a thumbnail) and a caption under it, the
 * whole card one control that opens the thing. The title is the card's
 * `StretchedButton`; a line or two of quiet detail sits under it. The
 * picture runs edge to edge with no rule between it and the caption
 * (their fills already part them), and hovering lays the `hover` tint
 * over the whole card, as rows do (shading only the caption read as selected).
 * `badge` sits over the picture's top-left corner ("From Zebri"). Lay cards out in a grid; each fills its cell's height.
 *
 * @example
 * ```tsx
 * <MediaCard media={<TemplateThumb template={t} />} title="Full day MC" onOpen={() => open(t.id)}>
 *   <p className="type-body text-zebra-500">Ceremony to last dance</p>
 * </MediaCard>
 * ```
 *
 * @module components/ui-v2/media-card
 */

export interface MediaCardProps {
  /** The picture along the top, full width. */
  media: ReactNode;
  title: string;
  /** Opens the thing; the whole card is the hit area. */
  onOpen: () => void;
  /** Lines under the title. */
  children?: ReactNode;
  /**
   * One small control in the picture's top-right corner (a ghost Delete
   * button), above the card's hit area. It shows on hover and on focus,
   * so the resting card stays a clean picture (always, on touch screens,
   * and while its menu is open).
   */
  action?: ReactNode;
  /** A small badge over the picture's top-left corner. */
  badge?: ReactNode;
}

/** v2 media card. See {@link MediaCardProps}. */
export function MediaCard({ media, title, onOpen, children, action, badge }: MediaCardProps) {
  return (
    <Panel className="group relative h-full cursor-pointer overflow-hidden">
      {media}
      {/* The hover step, over picture and caption alike. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-panel bg-transparent transition-colors duration-150 group-hover:bg-hover motion-reduce:transition-none" />
      {badge ? <div className="pointer-events-none absolute left-3 top-3">{badge}</div> : null}
      {action ? (
        <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 has-[[aria-expanded=true]]:opacity-100 motion-reduce:transition-none">
          {action}
        </div>
      ) : null}
      <div className="space-y-1 px-4 py-3">
        <StretchedButton onClick={onOpen} radius="panel">
          <span className="block type-label text-zebra-950">{title}</span>
        </StretchedButton>
        {children}
      </div>
    </Panel>
  );
}
