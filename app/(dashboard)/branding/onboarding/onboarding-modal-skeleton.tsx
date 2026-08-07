'use client'

/**
 * OnboardingModalSkeleton: the inner content painted INSTANTLY while the
 * branding page's first fetch is in flight. Renders the skeleton content
 * that fills the modal frame (which is managed by page.tsx) so the wizard
 * content can swap in smoothly once data loads, preventing jarring flash.
 *
 * Shown only when the cached onboarding flag says the user likely needs
 * the wizard, so onboarded users never see a modal flash.
 *
 * Frame size: managed by page.tsx (max-w-3xl h-[780px] max-h-[94vh]).
 * @internal
 */
export function OnboardingModalSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Middle: form column left, companion pane right. */}
      <div className="flex flex-1 min-h-0">
        {/* Left pane: welcome-screen shaped skeleton. */}
        <div className="flex-1 min-w-0 flex flex-col px-6 py-5">
          <div className="flex-1 flex flex-col justify-center gap-3 pb-10">
            <div className="h-6 w-56 rounded-pill bg-surface-emphasis animate-pulse" />
            <div className="h-3 w-full rounded-pill bg-surface-emphasis animate-pulse" />
            <div className="h-3 w-4/5 rounded-pill bg-surface-emphasis animate-pulse" />
          </div>
        </div>

        {/* Right pane: document-shaped skeleton. */}
        <div className="hidden sm:block w-[380px] shrink-0 border-l border-border bg-surface-muted p-5">
          <div className="rounded-control border border-border bg-surface shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-control bg-surface-emphasis animate-pulse" />
              <div className="h-3 w-32 rounded-pill bg-surface-emphasis animate-pulse" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-2 w-full rounded-pill bg-surface-emphasis animate-pulse" />
              <div className="h-2 w-4/5 rounded-pill bg-surface-emphasis animate-pulse" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-2 w-2/5 rounded-pill bg-surface-emphasis animate-pulse" />
                <div className="h-2 w-12 rounded-pill bg-surface-emphasis animate-pulse" />
              </div>
            ))}
            <div className="h-9 w-full rounded-control bg-surface-emphasis animate-pulse" />
          </div>
        </div>
      </div>

      {/* Footer: skeleton button area at bottom. */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <div className="h-3 w-28 rounded-pill bg-surface-emphasis animate-pulse" />
        <div className="h-8 w-28 rounded-control bg-surface-emphasis animate-pulse" />
      </div>
    </div>
  )
}
