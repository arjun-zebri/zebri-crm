"use client"

import { useEffect } from "react"

import { reportClientError } from "@/lib/alerts/report-client-error"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError({
      kind: "crash",
      error,
      ...(error.digest ? { digest: error.digest } : {}),
    })
  }, [error])

  return (
    <html lang="en">
      <body className="antialiased bg-surface text-text">
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-md w-full bg-surface border border-border rounded-control shadow-sm p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-control bg-red-50 mb-4">
                <span className="text-2xl">💀</span>
              </div>
              <h1 className="text-section font-semibold text-text mb-2">
                Something went wrong
              </h1>
              <p className="text-body text-gray-600 mb-6">
                A critical error occurred. Please try again.
              </p>
              <button
                onClick={() => reset()}
                className="w-full bg-black text-white rounded-control px-4 py-2 text-body font-medium hover:bg-neutral-800 transition"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
