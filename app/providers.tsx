'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/toast'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
          },
          mutations: {
            onError: (error: unknown) => {
              const err = error as Record<string, unknown> | null;
              const message =
                error instanceof Error
                  ? error.message
                  : typeof err === "object" && err !== null && "message" in err
                  ? String(err.message)
                  : JSON.stringify(error);
              const code =
                typeof err === "object" && err !== null && "code" in err
                  ? String(err.code)
                  : null;
              const page =
                typeof window !== "undefined" ? window.location.pathname : "unknown";
              fetch("/api/alerts/slack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: ":warning: Mutation Error",
                  blocks: [
                    {
                      type: "header",
                      text: { type: "plain_text", text: ":warning: Mutation Error" },
                    },
                    {
                      type: "section",
                      fields: [
                        {
                          type: "mrkdwn",
                          text: `*Error:*\n${message}${code ? ` (${code})` : ""}`,
                        },
                        {
                          type: "mrkdwn",
                          text: `*Page:*\n${page}`,
                        },
                        {
                          type: "mrkdwn",
                          text: `*Time:*\n${new Date().toLocaleString("en-AU")}`,
                        },
                      ],
                    },
                  ],
                }),
              }).catch(() => {});
            },
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
