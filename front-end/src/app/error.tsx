'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/Button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the error for observability without leaking it to the UI.
    // eslint-disable-next-line no-console -- error boundary diagnostics
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <AlertTriangle className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="font-display text-lg font-semibold">
          Algo deu errado
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Não foi possível concluir a operação. O servidor pode estar
          inicializando — tente novamente em alguns segundos.
        </p>
      </div>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  )
}
