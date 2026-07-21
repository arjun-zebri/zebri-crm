'use client'

/**
 * Step 1: what Zebri is, in a breath.
 *
 * Deliberately short. The four previews that follow do the explaining.
 */
export function StepWelcome() {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full gap-4 px-6">
      <h2 className="text-3xl font-semibold text-text">Welcome to Zebri</h2>
      <p className="text-sm text-text-muted max-w-md">
        Zebri is where wedding MCs run their business. Enquiries, proposals,
        contracts, payments and the couples themselves, all in one place.
      </p>
      <p className="text-sm text-text-subtle max-w-md">
        This takes about a minute. We will get your details down, then show
        you around.
      </p>
    </div>
  )
}
