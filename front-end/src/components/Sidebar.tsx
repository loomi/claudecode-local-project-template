'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { sections } from '@/lib/sections'
import { useSidebar } from './SidebarContext'

const OPEN_W  = 240
const CLOSED_W = 64
const spring   = { type: 'spring', stiffness: 300, damping: 30 } as const

const fadeIn  = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { delay: 0.08, duration: 0.18 } }, exit: { opacity: 0, transition: { duration: 0.1 } } }
const fadeOut = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { delay: 0.05, duration: 0.18 } }, exit: { opacity: 0, transition: { duration: 0.1 } } }

export function Sidebar() {
  const pathname = usePathname()
  const { open, toggle } = useSidebar()

  return (
    <motion.aside
      animate={{ width: open ? OPEN_W : CLOSED_W }}
      transition={spring}
      className="fixed left-0 top-0 z-40 flex h-full flex-col overflow-hidden bg-[#171717]"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={`flex shrink-0 pt-6 pb-5 ${open ? 'flex-col px-6' : 'flex-col items-center px-3'}`}>
        <AnimatePresence>
          {open && (
            <motion.div key="wordmark" {...fadeIn} className="w-full">
              <h1 className="font-display text-[18px] font-bold leading-tight text-white">
                Claude Code
              </h1>
              <p className="mt-1 font-mono text-[11px] text-white/25">Guia de Onboarding</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={toggle}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/8 hover:text-white/65 ${
            open ? 'mt-4 self-end' : 'mt-0'
          }`}
        >
          {open
            ? <PanelLeftClose size={15} strokeWidth={1.75} />
            : <PanelLeftOpen  size={15} strokeWidth={1.75} />
          }
        </button>
      </div>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <div className={`h-px shrink-0 bg-white/8 ${open ? 'mx-6' : 'mx-3'}`} />

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-0.5">
          {sections.map(({ href, label, number }) => {
            const active = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={!open ? label : undefined}
                  className={`group relative flex items-center rounded-lg py-2 text-[13px] font-medium transition-colors duration-150 ${
                    open ? 'gap-3 px-3' : 'justify-center px-0'
                  }`}
                >
                  {/* Active highlight */}
                  <AnimatePresence>
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-lg bg-[#5b2dc4]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </AnimatePresence>

                  {!active && (
                    <span className="absolute inset-0 rounded-lg bg-white/0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:bg-white/6" />
                  )}

                  {/* Number badge */}
                  <span
                    className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-semibold transition-colors ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-white/8 text-white/35 group-hover:bg-white/12 group-hover:text-white/60'
                    }`}
                  >
                    {number}
                  </span>

                  {/* Label — fades in/out with sidebar */}
                  <AnimatePresence>
                    {open && (
                      <motion.span
                        key={`lbl-${href}`}
                        {...fadeOut}
                        className={`relative z-10 whitespace-nowrap ${
                          active ? 'text-white' : 'text-white/45 group-hover:text-white/75'
                        }`}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div key="footer" {...fadeIn}>
            <div className="mx-6 h-px bg-white/8" />
            <div className="px-6 py-4">
              <p className="font-mono text-[10px] text-white/20">Time de Produto · 2025</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
