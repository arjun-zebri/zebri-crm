"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Fire Slack alert on mount
    fetch("/api/alerts/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ":skull: Critical Error",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: ":skull: Critical Error",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Message:*\n${error.message || "Unknown error"}`,
              },
              {
                type: "mrkdwn",
                text: `*Time:*\n${new Date().toLocaleString("en-AU")}`,
              },
            ],
          },
        ],
      }),
    }).catch(() => {})
  }, [error])

  return (
    <html lang="en">
      <body className="antialiased bg-white text-gray-900">
        <div className="flex items-center justify-center min-h-screen">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-red-50 mb-4">
                <span className="text-2xl">💀</span>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-sm text-gray-600 mb-6">
                A critical error occurred. Please try again.
              </p>
              <button
                onClick={() => reset()}
                className="w-full bg-black text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-neutral-800 transition"
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
