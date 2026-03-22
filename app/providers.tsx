'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
              const message =
                error instanceof Error ? error.message : String(error);
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
                          text: `*Error:*\n${message}`,
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
