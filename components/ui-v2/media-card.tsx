import type { ReactNode } from 'react';

import { Panel } from '@/components/ui-v2/panel';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

/**
 * Design system v2 media card (preview): a glass `Panel` with a picture
 * on top (a template's cover, a thumbnail) and a caption under it, the
 * whole card one control that opens the thing. The title is the card's
 * `StretchedButton`; a line or two of quiet detail sits under it. The
 * picture runs edge to edge with no rule between it and the caption
 * (their fills already part them), and hovering shades the caption one
 * step, as rows do. Lay cards out in a grid; each fills its cell's height.
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
}

/** v2 media card. See {@link MediaCardProps}. */
export function MediaCard({ media, title, onOpen, children }: MediaCardProps) {
  return (
    <Panel className="group relative h-full cursor-pointer overflow-hidden">
      {media}
      <div className="space-y-1 px-4 py-3 transition-colors duration-150 group-hover:bg-zebra-950/[0.03] motion-reduce:transition-none">
        <StretchedButton onClick={onOpen} radius="panel">
          <span className="block type-label text-zebra-950">{title}</span>
        </StretchedButton>
        {children}
      </div>
    </Panel>
  );
}
