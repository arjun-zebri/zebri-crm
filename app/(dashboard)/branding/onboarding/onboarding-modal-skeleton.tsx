'use client'

/**
 * OnboardingModalSkeleton: the modal shell painted INSTANTLY while the
 * branding page's first fetch is in flight, so opening the page feels
 * immediate instead of waiting for onboarded_at to come back before any
 * modal appears. Same overlay, card size, and pane split as the real
 * OnboardingModal; the wizard content swaps in when data lands.
 *
 * Shown only when the cached onboarding flag says the user likely needs
 * the wizard, so onboarded users never see a modal flash.
 * @internal
 */
export function OnboardingModalSkeleton() {
  return (
    <div aria-hidden className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          aria-busy="true"
          className="w-full max-w-3xl bg-surface rounded-xl shadow-lg outline-none animate-modal-in h-[780px] max-h-[94vh] flex overflow-hidden"
        >
          {/* Left pane: welcome-screen shaped skeleton. */}
          <div className="flex-1 min-w-0 flex flex-col px-6 py-6">
            <div className="flex-1 flex flex-col justify-center gap-3 pb-10">
              <div className="h-6 w-56 rounded-full bg-surface-emphasis animate-pulse" />
              <div className="h-3 w-full rounded-full bg-surface-emphasis animate-pulse" />
              <div className="h-3 w-4/5 rounded-full bg-surface-emphasis animate-pulse" />
            </div>
            <div className="-mx-6 mt-4 px-6 pt-4 border-t border-border flex items-center justify-between">
              <div className="h-3 w-28 rounded-full bg-surface-emphasis animate-pulse" />
              <div className="h-8 w-28 rounded-xl bg-surface-emphasis animate-pulse" />
            </div>
          </div>

          {/* Right pane: document-shaped skeleton. */}
          <div className="hidden sm:block w-[380px] shrink-0 border-l border-border bg-surface-muted p-5">
            <div className="rounded-lg border border-border bg-surface shadow-sm p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-emphasis animate-pulse" />
                <div className="h-3 w-32 rounded-full bg-surface-emphasis animate-pulse" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-2 w-full rounded-full bg-surface-emphasis animate-pulse" />
                <div className="h-2 w-4/5 rounded-full bg-surface-emphasis animate-pulse" />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-2 w-2/5 rounded-full bg-surface-emphasis animate-pulse" />
                  <div className="h-2 w-12 rounded-full bg-surface-emphasis animate-pulse" />
                </div>
              ))}
              <div className="h-9 w-full rounded-lg bg-surface-emphasis animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
