export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_50%_-10%,oklch(0.40_0.235_288/0.18),transparent_70%),radial-gradient(45%_40%_at_85%_110%,oklch(0.55_0.20_330/0.15),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,oklch(0_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0_0_0/0.04)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />

      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}
