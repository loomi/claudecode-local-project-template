'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { isTransientError } from '@/lib/api'

const MAX_RETRIES = 4
const MAX_MUTATION_RETRIES = 2
const MAX_RETRY_DELAY_MS = 8_000

/** Retry only cold-start / transient failures, never 4xx. */
function transientRetry(max: number) {
  return (failureCount: number, error: unknown): boolean =>
    failureCount < max && isTransientError(error)
}

/** Exponential backoff capped at ~8s. */
function retryDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, MAX_RETRY_DELAY_MS)
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: transientRetry(MAX_RETRIES),
            retryDelay,
          },
          mutations: {
            retry: transientRetry(MAX_MUTATION_RETRIES),
            retryDelay,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
