/**
 * The templates grid while it loads: the same `grid` as {@link TemplateCards}
 * with one card-shaped placeholder per slot (thumbnail box, name line,
 * caption line), so the real cards land without a reflow and the wait
 * reads as "cards are coming", not as a page-wide spinner.
 *
 * @module app/(dashboard)/proposals/templates/template-cards-skeleton
 */
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export interface TemplateCardsSkeletonProps {
  /** How many placeholder cards to draw. Defaults to 3, one grid row at `xl`. */
  count?: number;
}

/** See {@link TemplateCardsSkeletonProps}. */
export function TemplateCardsSkeleton({ count = 3 }: TemplateCardsSkeletonProps) {
  return (
    <SkeletonRegion label="Loading templates" className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          {/* Same box as `LayoutThumbnail`'s frame, so the grid keeps its height. */}
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="flex h-8 items-center">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </SkeletonRegion>
  );
}
