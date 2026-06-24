import Link from 'next/link'

import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { AccountTopbar } from './_components/AccountTopbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display text-sm font-semibold">Conta</span>
            </Link>
            <AccountTopbar />
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
      </div>
    </RequireAuth>
  )
}
