import type { LucideProps } from 'lucide-react';
import { forwardRef, type ForwardRefExoticComponent, type ReactNode, type RefAttributes } from 'react';

/**
 * Design system v2 custom icons (preview): the shared svg frame every
 * Zebri icon is drawn into, and the factory that turns a set of paths
 * into a component with Lucide's exact type. That is what lets a Zebri
 * icon go anywhere a Lucide icon does (`icon={RunSheetIcon}` on a
 * PropertyChip) and sit beside one without a seam.
 *
 * New icons are made with the `/new-icon` skill
 * (`.claude/skills/new-icon/SKILL.md`), which holds the drawing rules
 * per tier. Never hand-roll an svg icon outside this folder.
 *
 * @module components/ui-v2/icons/icon-base
 */

/** The three icon tiers. Each has its own grid and stroke (see the skill). */
export type IconTier = 'glyph' | 'tile' | 'spot';

/** Props of a v2 icon: everything a Lucide icon takes, plus an accessible `title`. */
export type ZebriIconProps = Omit<LucideProps, 'ref'> & {
  /** Accessible name. Omit for a decorative icon beside a text label. */
  title?: string | undefined;
};

/**
 * A v2 icon component. Assignable to `LucideIcon` (it takes a superset
 * of Lucide's optional props), so either can fill an `icon` prop.
 */
export type ZebriIcon = ForwardRefExoticComponent<ZebriIconProps & RefAttributes<SVGSVGElement>>;

/** Grid and stroke per tier. Tile and spot are filled in when their style is locked. */
const TIER_FRAME: Record<IconTier, { viewBox: string; strokeWidth: number }> = {
  glyph: { viewBox: '0 0 24 24', strokeWidth: 1.5 },
  tile: { viewBox: '0 0 48 48', strokeWidth: 1.5 },
  spot: { viewBox: '0 0 160 160', strokeWidth: 1.5 },
};

/**
 * Builds a v2 icon component from its paths.
 *
 * The stroke width belongs to the drawing, not the call site: call sites
 * pass `strokeWidth={1.5}` out of Lucide habit, and a passed value is
 * ignored so every Zebri icon keeps the weight it was drawn at.
 * Decorative by default (`aria-hidden`); pass `title` when the icon is
 * the only label, and it becomes `role="img"` with that title.
 *
 * @param displayName - Component name, e.g. `RunSheetIcon`.
 * @param tier - Which grid the paths are drawn on.
 * @param paths - The svg children, in the tier's viewBox.
 * @returns A component assignable to `LucideIcon`.
 */
export function createIcon(displayName: string, tier: IconTier, paths: ReactNode): ZebriIcon {
  const frame = TIER_FRAME[tier];
  const Icon = forwardRef<SVGSVGElement, ZebriIconProps>(function ZebriIcon(
    { className, title, ...props },
    ref,
  ) {
    // `strokeWidth`, `size` and `absoluteStrokeWidth` are Lucide props this
    // frame deliberately does not honour (see above); dropped so they never
    // reach the DOM or override the drawing's weight.
    const rest = { ...props };
    delete rest.strokeWidth;
    delete rest.size;
    delete rest.absoluteStrokeWidth;
    const labelled = typeof title === 'string' && title.length > 0;
    return (
      <svg
        ref={ref}
        viewBox={frame.viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={frame.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={labelled ? undefined : true}
        role={labelled ? 'img' : undefined}
        className={`shrink-0${className ? ` ${className}` : ''}`}
        {...rest}
      >
        {labelled ? <title>{title}</title> : null}
        {paths}
      </svg>
    );
  });
  Icon.displayName = displayName;
  return Icon;
}
