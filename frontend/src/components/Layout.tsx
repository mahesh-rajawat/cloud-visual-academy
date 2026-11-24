import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../services/AppContext'
import { EXAMS, PLAN_EXAMS, examEnabled, registries } from '../services/curriculum'

type NavItem = { to: string; label: string; icon: string; show?: boolean }

/** Sidebar entries; exam-specific pages appear only when their exam is enabled (see VITE_EXAMS). */
const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '◧' },
  ...EXAMS.map((e): NavItem => ({ to: `/course/${e}`, label: e === 'az-104' ? 'AZ-104 (priority)' : registries[e].examCode, icon: e === 'az-104' ? '★' : '▤' })),
  { to: '/sprint', label: 'Study plan', icon: '▦', show: PLAN_EXAMS.length > 0 },
  { to: '/clear-up', label: 'Clear the confusion', icon: '⇆', show: examEnabled('az-104') },
  { to: '/exam-guide', label: 'Exam-day guide', icon: '✎', show: examEnabled('az-104') },
  { to: '/diagnostic', label: 'AZ-900 diagnostic', icon: '✓', show: examEnabled('az-900') },
  { to: '/practice', label: 'Practice exams', icon: '✎' },
  { to: '/reviews', label: 'Daily recall', icon: '↻' },
  { to: '/animations', label: 'Animation library', icon: '▶' },
  { to: '/labs', label: 'Labs', icon: '⚙' },
  { to: '/compare', label: 'Azure ↔ AWS', icon: '⇄', show: examEnabled('aws-clf-c02') },
  { to: '/coverage', label: 'Coverage audit', icon: '☰' },
  { to: '/analytics', label: 'Analytics', icon: '◔' },
  { to: '/bookmarks', label: 'Bookmarks', icon: '⚑' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
].filter((n) => n.show !== false)

export function Layout({ children }: { children: ReactNode }) {
  const { online, error, setError } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  // Lessons use the whole screen width; other pages stay centred for readability.
  const wide = useLocation().pathname.startsWith('/lesson/')
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">Skip to content</a>
      <aside className={`${open ? 'block' : 'hidden'} fixed inset-y-0 left-0 z-40 w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 md:sticky md:top-0 md:block md:h-screen dark:border-slate-800 dark:bg-slate-900`}>
        <div className="mb-4 flex items-center gap-2 px-2">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden><rect width="32" height="32" rx="7" fill="#0f172a" /><path d="M9 21a5 5 0 0 1 .6-10A7 7 0 0 1 23 12.5 4.5 4.5 0 0 1 23 21z" fill="#38bdf8" /></svg>
          <span className="font-semibold">Cloud Visual Academy</span>
        </div>
        <nav aria-label="Main">
          <ul className="space-y-0.5">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.to === '/'} onClick={() => setOpen(false)}
                  className={({ isActive }) => `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${isActive ? 'bg-sky-100 font-medium text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                  <span aria-hidden className="w-4 text-center">{n.icon}</span>{n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <button type="button" className="btn-ghost md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Toggle navigation">☰</button>
          <form role="search" className="flex flex-1 items-center" onSubmit={(e) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q)}`) }}>
            <input className="input w-full max-w-md" placeholder="Search objectives, lessons, questions…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          </form>
          <span className="flex items-center gap-1.5 text-xs text-slate-500" title="Local progress server status">
            <span className={`h-2 w-2 rounded-full ${online === null ? 'bg-slate-400' : online ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden />
            {online === null ? 'Connecting…' : online ? 'Progress saved locally' : 'Backend offline: progress not saved'}
          </span>
        </header>
        {error && (
          <div role="alert" className="flex items-center justify-between bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
            {error}<button type="button" className="underline" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        <main id="main" className={`mx-auto w-full flex-1 p-4 md:p-6 ${wide ? '' : 'max-w-[1760px]'}`}>{children}</main>
      </div>
    </div>
  )
}
