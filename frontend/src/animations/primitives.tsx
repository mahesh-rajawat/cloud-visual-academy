/**
 * Reusable SVG primitives for cloud diagrams. Original vector shapes (no vendor icon files).
 * Every primitive is positioned by its centre (x, y) and can be made clickable.
 */
import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export const palette = {
  azure: '#0a7cd6',
  aws: '#e88a00',
  allow: '#15935a',
  deny: '#d23b3b',
  warn: '#c98400',
  muted: '#94a3b8',
  ink: 'currentColor',
}

interface NodeProps {
  x: number
  y: number
  label?: string
  sublabel?: string
  active?: boolean
  state?: 'ok' | 'fail' | 'neutral' | 'warn'
  onClick?: () => void
  title?: string
  color?: string
}

const stateColor = (s: NodeProps['state'], fallback: string) =>
  s === 'ok' ? palette.allow : s === 'fail' ? palette.deny : s === 'warn' ? palette.warn : fallback

function Frame({ x, y, label, sublabel, active, onClick, title, children }: NodeProps & { children: ReactNode }) {
  const interactive = !!onClick
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      onKeyDown={(e) => { if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.() } }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? title ?? label : undefined}
      style={{ cursor: interactive ? 'pointer' : 'default', outline: 'none' }}
      className="focus-visible:[&>rect.focus]:stroke-sky-400"
    >
      {title && <title>{title}</title>}
      <rect className="focus" x={-46} y={-40} width={92} height={80} rx={10} fill="transparent" stroke={active ? palette.azure : 'transparent'} strokeWidth={2} strokeDasharray="4 3" />
      {children}
      {label && <text y={34} textAnchor="middle" fontSize={11} fontWeight={600} fill="currentColor">{label}</text>}
      {sublabel && <text y={47} textAnchor="middle" fontSize={9.5} fill={palette.muted}>{sublabel}</text>}
    </g>
  )
}

export function UserNode(p: NodeProps) {
  const c = stateColor(p.state, p.color ?? '#475569')
  return (
    <Frame {...p}>
      <circle cx={0} cy={-14} r={8} fill="none" stroke={c} strokeWidth={2.2} />
      <path d="M-14 12 a14 12 0 0 1 28 0" fill="none" stroke={c} strokeWidth={2.2} />
    </Frame>
  )
}

export function ServerNode(p: NodeProps) {
  const c = stateColor(p.state, p.color ?? palette.azure)
  return (
    <Frame {...p}>
      <rect x={-20} y={-26} width={40} height={40} rx={4} fill="none" stroke={c} strokeWidth={2.2} />
      {[-16, -4, 8].map((yy) => <line key={yy} x1={-14} x2={6} y1={yy} y2={yy} stroke={c} strokeWidth={2} />)}
      {[-16, -4, 8].map((yy) => <circle key={yy} cx={12} cy={yy} r={1.8} fill={c} />)}
    </Frame>
  )
}

export function VmNode(p: NodeProps) {
  const c = stateColor(p.state, p.color ?? palette.azure)
  return (
    <Frame {...p}>
      <rect x={-22} y={-26} width={44} height={30} rx={3} fill="none" stroke={c} strokeWidth={2.2} />
      <path d="M-8 10 h16 M0 4 v6" stroke={c} strokeWidth={2.2} />
      <text y={-7} textAnchor="middle" fontSize={10} fontWeight={700} fill={c}>VM</text>
    </Frame>
  )
}

export function FirewallNode(p: NodeProps) {
  const c = stateColor(p.state, p.color ?? '#b45309')
  return (
    <Frame {...p}>
      <path d="M0 -28 L20 -20 V-4 C20 8 10 14 0 18 C-10 14 -20 8 -20 -4 V-20 Z" fill="none" stroke={c} strokeWidth={2.2} />
      <path d="M-10 -10 h20 M-10 -2 h20 M-4 -18 v8 M4 -10 v8 M-4 -2 v8" stroke={c} strokeWidth={1.6} />
    </Frame>
  )
}

export function GlobeNode(p: NodeProps) {
  const c = stateColor(p.state, p.color ?? '#475569')
  return (
    <Frame {...p}>
      <circle r={20} cy={-6} fill="none" stroke={c} strokeWidth={2.2} />
      <ellipse rx={8} ry={20} cy={-6} fill="none" stroke={c} strokeWidth={1.6} />
      <path d="M-20 -6 h40 M-17 -16 h34 M-17 4 h34" stroke={c} strokeWidth={1.4} />
    </Frame>
  )
}

export function IpNode(p: NodeProps) {
  const c = stateColor(p.state, p.color ?? palette.azure)
  return (
    <Frame {...p}>
      <rect x={-22} y={-20} width={44} height={26} rx={13} fill="none" stroke={c} strokeWidth={2.2} />
      <text y={-3} textAnchor="middle" fontSize={11} fontWeight={700} fill={c}>IP</text>
    </Frame>
  )
}

export function DiskNode(p: NodeProps & { copies?: number }) {
  const c = stateColor(p.state, p.color ?? palette.azure)
  return (
    <Frame {...p}>
      <ellipse cx={0} cy={-22} rx={16} ry={5} fill="none" stroke={c} strokeWidth={2} />
      <path d="M-16 -22 v26 a16 5 0 0 0 32 0 v-26" fill="none" stroke={c} strokeWidth={2} />
      {p.copies !== undefined && <text y={-2} textAnchor="middle" fontSize={11} fontWeight={700} fill={c}>×{p.copies}</text>}
    </Frame>
  )
}

export function ScopeBox({ x, y, w, h, label, color = palette.azure, dashed, state, children }: { x: number; y: number; w: number; h: number; label: string; color?: string; dashed?: boolean; state?: NodeProps['state']; children?: ReactNode }) {
  const c = stateColor(state, color)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={c} fillOpacity={state === 'fail' ? 0.12 : 0.05} stroke={c} strokeWidth={1.5} strokeDasharray={dashed ? '6 4' : undefined} />
      <text x={x + 10} y={y + 16} fontSize={11} fontWeight={600} fill={c}>{label}</text>
      {children}
    </g>
  )
}

export function Link({ x1, y1, x2, y2, state, dashed, label }: { x1: number; y1: number; x2: number; y2: number; state?: NodeProps['state']; dashed?: boolean; label?: string }) {
  const c = stateColor(state, palette.muted)
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={2} strokeDasharray={dashed ? '5 4' : undefined} />
      {label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={9.5} fill={palette.muted}>{label}</text>}
    </g>
  )
}

/** A data packet that moves along a list of points; `at` is the index it has reached. */
export function Packet({ points, at, state, reduced, label }: { points: Array<[number, number]>; at: number; state: 'moving' | 'allowed' | 'denied'; reduced: boolean; label?: string }) {
  const p = points[Math.min(at, points.length - 1)] ?? [0, 0]
  const fill = state === 'denied' ? palette.deny : state === 'allowed' ? palette.allow : palette.azure
  return (
    <motion.g initial={false} animate={{ x: p[0], y: p[1] }} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 16 }} aria-hidden>
      <rect x={-13} y={-8} width={26} height={16} rx={4} fill={fill} />
      <text y={4} textAnchor="middle" fontSize={9} fontWeight={700} fill="white">{label ?? 'PKT'}</text>
      {state === 'denied' && <path d="M-6 -20 l12 12 M6 -20 l-12 12" stroke={palette.deny} strokeWidth={3} />}
    </motion.g>
  )
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'allow' | 'deny' | 'warn' | 'info' | 'muted' }) {
  const cls = {
    allow: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    deny: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    muted: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }[tone]
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}

export function FidelityNote({ fidelity, children }: { fidelity: 'accurate-model' | 'simplified-illustration'; children: ReactNode }) {
  return (
    <p className="text-xs text-slate-500">
      <Badge tone={fidelity === 'accurate-model' ? 'info' : 'warn'}>{fidelity === 'accurate-model' ? 'Accurate model' : 'Simplified illustration'}</Badge>{' '}
      {children}
    </p>
  )
}
