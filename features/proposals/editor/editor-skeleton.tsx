/**
 * The template editor while the template row or the branding loads: the
 * `h-12` header row (back link, name, Preview, device toggle) over the
 * canvas with one page sheet on it, in the same frame `TemplateEditorBody`
 * renders into. The editor is a whole-screen surface, so a centred
 * spinner left the workbench blank; this keeps its shape on screen from
 * the first paint.
 *
 * @module features/proposals/editor/editor-skeleton
 */
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton'

/** See the module doc. */
export function EditorSkeleton() {
  return (
    <SkeletonRegion label="Loading template" className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <Skeleton className="h-8 w-24" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-8 w-20" />
        <Skeleton shape="pill" className="h-8 w-24" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-surface-muted p-6 sm:p-10">
        {/* One page sheet, section by section, at the canvas's own width. */}
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-control border border-border bg-surface p-8 shadow-lg">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-7 w-2/3" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </SkeletonRegion>
  )
}
