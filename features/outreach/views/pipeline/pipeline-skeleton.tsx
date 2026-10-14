/**
 * Loading placeholder for the pipeline board. Shaped like the first few
 * columns with their cards, so the board does not jump when it arrives.
 *
 * @module features/outreach/views/pipeline/pipeline-skeleton
 */
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

/** Four column-shaped placeholders, each with two card-shaped blocks under a heading block. */
export function PipelineSkeleton() {
  return (
    <SkeletonRegion label="Loading pipeline">
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-56 shrink-0 space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
