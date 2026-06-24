import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <p className="text-sm">
        Carregando… o servidor pode levar alguns segundos para acordar.
      </p>
    </main>
  )
}
