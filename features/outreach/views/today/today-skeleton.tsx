/**
 * Loading placeholder for the Today view. Shapes follow the real layout
 * (a queue and a shorter list) so the page does not jump on load.
 *
 * @module features/outreach/views/today/today-skeleton
 */
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

/** Skeleton for the whole Today view. */
export function TodaySkeleton() {
  return (
    <SkeletonRegion label="Loading today">
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
