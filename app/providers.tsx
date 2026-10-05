'use client'

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { ToastProvider } from '@/components/ui/toast'
import { reportClientError } from '@/lib/alerts/report-client-error'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
          },
        },
        // On the cache, not in `defaultOptions.mutations`: a default
        // `onError` is replaced outright by any mutation that sets its
        // own, so every mutation with an error handler (most optimistic
        // ones) used to fail without ever reaching Slack.
        mutationCache: new MutationCache({
          onError: (error, _variables, _onMutateResult, mutation) => {
            const key = mutation.options.mutationKey
            reportClientError({
              kind: 'mutation',
              error,
              ...(key ? { mutation: JSON.stringify(key) } : {}),
            })
          },
        }),
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
