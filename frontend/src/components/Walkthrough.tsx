import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Walkthrough as WalkthroughData, WalkNode } from '../services/types'

// Lite, step-by-step lesson view: the diagram builds up one idea at a time while the
// explanation panel walks through problem → technique → case → recap.

const W = 800
const H = 440
const NW = 150
const NH = 54

const KIND: Record<string, { color: string; name: string }> = {
  user: { color: '#64748b', name: 'user' },
  compute: { color: '#ea7a12', name: 'compute' },
  network: { color: '#7c3aed', name: 'network' },
  storage: { color: '#16a34a', name: 'storage' },
  database: { color: '#2563eb', name: 'database' },
  security: { color: '#dc2626', name: 'security' },
  identity: { color: '#c026d3', name: 'identity' },
  globe: { color: '#0891b2', name: 'location' },
  cost: { color: '#ca8a04', name: 'cost' },
  ai: { color: '#0d9488', name: 'AI / analytics' },
  service: { color: '#475569', name: 'service' },
}

const SERVICE = { color: '#475569', name: 'service' }
const kindOf = (k: string) => KIND[k] ?? SERVICE

const BADGE: Record<string, { text: string; cls: string }> = {
  problem: { text: 'Problem', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' },
  concept: { text: 'Concept', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  technique: { text: 'Technique', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200' },
  case: { text: 'Case', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  recap: { text: 'Recap', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
}

const CALLOUT: Record<string, { title: string; cls: string }> = {
  key: { title: 'Key idea', cls: 'border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/50' },
  tip: { title: 'Good to know', cls: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/50' },
  warn: { title: 'Exam trap', cls: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50' },
}

function Icon({ kind, color }: { kind: string; color: string }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'user': return <g {...p}><circle cx="8" cy="5" r="3" /><path d="M2 15c0-3.3 2.7-5 6-5s6 1.7 6 5" /></g>
    case 'compute': return <g {...p}><rect x="3" y="3" width="10" height="10" rx="1.5" /><path d="M6 1v2M10 1v2M6 13v2M10 13v2M1 6h2M1 10h2M13 6h2M13 10h2" /></g>
    case 'network': return <g {...p}><circle cx="8" cy="3" r="2" /><circle cx="3" cy="13" r="2" /><circle cx="13" cy="13" r="2" /><path d="M7 5 4 11M9 5l3 6M5 13h6" /></g>
    case 'storage': return <g {...p}><path d="M2 4h12l-1.5 10h-9z" /><path d="M2 4c0-1 2.7-2 6-2s6 1 6 2" /></g>
    case 'database': return <g {...p}><ellipse cx="8" cy="3.5" rx="5.5" ry="2" /><path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" /></g>
    case 'security': return <g {...p}><path d="M8 1.5 2.5 3.5v4c0 3.5 2.4 6 5.5 7 3.1-1 5.5-3.5 5.5-7v-4z" /></g>
    case 'identity': return <g {...p}><circle cx="5" cy="8" r="3" /><path d="M8 8h7M12 8v3M14.5 8v2" /></g>
    case 'globe': return <g {...p}><circle cx="8" cy="8" r="6.5" /><path d="M1.5 8h13M8 1.5c2 2 2.8 4.2 2.8 6.5S10 12.5 8 14.5C6 12.5 5.2 10.3 5.2 8S6 3.5 8 1.5" /></g>
    case 'cost': return <g {...p}><circle cx="8" cy="8" r="6.5" /><path d="M10 5.5H7a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H6M8 4v1.5M8 11.5V13" /></g>
    case 'ai': return <g {...p}><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M4 4l1.8 1.8M10.2 10.2 12 12M12 4l-1.8 1.8M5.8 10.2 4 12" /></g>
    default: return <g {...p}><path d="M8 1.5 14 5v6l-6 3.5L2 11V5z" /><path d="M2 5l6 3.5L14 5M8 8.5v6" /></g>
  }
}

// Boxes grow to fit their text (the content builder checks they don't overlap using the same rule).
export const nodeWidth = (n: WalkNode) => Math.max(NW, n.label.length * 7.2 + 44, (n.sub?.length ?? 0) * 5.9 + 44)

// Point where the line from a node's centre towards (tx, ty) leaves the node's box.
function exitPoint(n: WalkNode, tx: number, ty: number) {
  const dx = tx - n.x
  const dy = ty - n.y
  if (dx === 0 && dy === 0) return { x: n.x, y: n.y }
  const s = Math.min(Math.abs((nodeWidth(n) / 2 + 4) / (dx || 1e-9)), Math.abs((NH / 2 + 4) / (dy || 1e-9)))
  return { x: n.x + dx * s, y: n.y + dy * s }
}

type Edge = WalkthroughData['steps'][number]['edges'][number]
type Box = { x: number; y: number; w: number }

// Edge end points, plus a label position along each line that avoids labels already placed.
function placeEdges(edges: Edge[], byId: Record<string, WalkNode>) {
  const placed: Box[] = []
  const hits = (b: Box) => placed.some((o) => Math.abs(o.x - b.x) < (o.w + b.w) / 2 + 4 && Math.abs(o.y - b.y) < 22)
  return edges.flatMap((e) => {
    const a = byId[e.from]
    const b = byId[e.to]
    if (!a || !b) return []
    const p1 = exitPoint(a, b.x, b.y)
    const p2 = exitPoint(b, a.x, a.y)
    let label: Box | null = null
    if (e.label) {
      const w = e.label.length * 6.2 + 14
      const at = (t: number) => ({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t, w })
      label = [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85].map(at).find((c) => !hits(c)) ?? at(0.5)
      placed.push(label)
    }
    return [{ e, p1, p2, label }]
  })
}

export function Walkthrough({ data, onFinish }: { data: WalkthroughData; onFinish?: () => void }) {
  const [i, setI] = useState(0)
  const steps = data.steps
  const step = steps[Math.min(i, steps.length - 1)]!
  const last = i === steps.length - 1
  const byId = useMemo(() => Object.fromEntries(data.nodes.map((n) => [n.id, n])), [data.nodes])
  const go = useCallback((n: number) => setI(Math.max(0, Math.min(steps.length - 1, n))), [steps.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return
      if (e.key === 'ArrowRight') go(i + 1)
      else if (e.key === 'ArrowLeft') go(i - 1)
      else if (e.key === 'r' || e.key === 'R') go(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, i])

  useEffect(() => { if (last) onFinish?.() }, [last, onFinish])

  const visible = new Set(step.show)
  const focus = new Set(step.focus)
  const kinds = [...new Set(data.nodes.filter((n) => visible.has(n.id)).map((n) => n.kind))]
  const badge = BADGE[step.kind] ?? { text: step.kind, cls: 'bg-slate-100 text-slate-700' }

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]" aria-label="Step-by-step walkthrough">
      <div className="min-w-0 space-y-3">
        <div className="card p-3">
          {step.stats && step.stats.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2" aria-label="Running totals">
              {step.stats.map((s) => (
                <div key={s.label} className="min-w-[96px] rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</p>
                  <p className="font-mono text-sm font-semibold">{s.value}</p>
                </div>
              ))}
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-slate-700 dark:text-slate-200" role="img" aria-label={`Diagram for step ${i + 1}: ${step.title}`}>
            <defs>
              <pattern id="wt-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className="fill-slate-200 dark:fill-slate-800" /></pattern>
              <marker id="wt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" className="fill-slate-500" /></marker>
              <marker id="wt-arrow-new" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#ea7a12" /></marker>
            </defs>
            <rect width={W} height={H} fill="url(#wt-dots)" />
            {placeEdges(step.edges, byId).map(({ e, p1, p2, label }) => (
              <motion.g key={`${e.from}-${e.to}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} strokeWidth={e.fresh ? 2.2 : 1.5} stroke={e.fresh ? '#ea7a12' : 'currentColor'} strokeOpacity={e.fresh ? 1 : 0.45}
                  strokeDasharray={e.fresh ? '6 5' : undefined} markerEnd={`url(#${e.fresh ? 'wt-arrow-new' : 'wt-arrow'})`} className={e.fresh ? 'wt-flow' : undefined} />
                {label && (
                  <g>
                    <rect x={label.x - label.w / 2} y={label.y - 10} width={label.w} height={20} rx={10} className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600" />
                    <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize="11" className="fill-current">{e.label}</text>
                  </g>
                )}
              </motion.g>
            ))}
            {data.nodes.filter((n) => visible.has(n.id)).map((n) => {
                const k = kindOf(n.kind)
                const on = focus.has(n.id)
                const nw = nodeWidth(n)
                return (
                  <motion.g key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: focus.size && !on ? 0.55 : 1, y: 0 }} transition={{ duration: 0.35 }}>
                    <rect x={n.x - nw / 2} y={n.y - NH / 2} width={nw} height={NH} rx={12} strokeWidth={on ? 2.5 : 1.5} stroke={k.color}
                      className="fill-white dark:fill-slate-900" style={on ? { filter: `drop-shadow(0 0 6px ${k.color}66)` } : undefined} />
                    <g transform={`translate(${n.x - nw / 2 + 10} ${n.y - (n.sub ? 15 : 8)})`}><Icon kind={n.kind} color={k.color} /></g>
                    <text x={n.x - nw / 2 + 32} y={n.y + (n.sub ? -3 : 4)} fontSize="12.5" fontWeight={600} className="fill-current">{n.label}</text>
                    {n.sub && <text x={n.x - nw / 2 + 32} y={n.y + 13} fontSize="10.5" className="fill-slate-500 dark:fill-slate-400">{n.sub}</text>}
                  </motion.g>
                )
              })}
          </svg>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {kinds.map((k) => <span key={k} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: kindOf(k).color }} />{kindOf(k).name}</span>)}
            <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-[#ea7a12]" />new this step</span>
            <button type="button" className="btn-ghost ml-auto px-2 py-0.5 text-xs" onClick={() => go(0)} aria-label="Replay from step 1">↺ Replay</button>
          </div>
        </div>

        <nav className="card p-3" aria-label="Steps in this lesson">
          <div className="mb-2 flex items-center justify-between text-xs"><p className="font-semibold uppercase tracking-wide">In this lesson</p><p className="text-slate-500">Step {i + 1} of {steps.length}</p></div>
          <ol className="flex items-start gap-1 overflow-x-auto pb-1">
            {steps.map((s, n) => (
              <li key={s.title} className="flex min-w-[44px] flex-1 flex-col items-center">
                <button type="button" onClick={() => go(n)} aria-current={n === i ? 'step' : undefined} aria-label={`Step ${n + 1}: ${s.label}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${n === i ? 'border-emerald-600 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-300 dark:bg-emerald-900 dark:text-emerald-50' : n < i ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-slate-300 text-slate-500 dark:border-slate-600'}`}>
                  {n + 1}
                </button>
                <span className={`mt-1 text-center text-[10px] leading-tight ${n === i ? 'font-semibold' : 'text-transparent sm:text-slate-400'}`}>{s.label}</span>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <aside className="grid gap-3 self-start md:grid-cols-2 2xl:sticky 2xl:top-16 2xl:grid-cols-1">
        <motion.section key={i} className="card self-start p-4 text-sm" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} aria-live="polite">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {i + 1} / {steps.length}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${badge.cls}`}>{badge.text}</span>
            </div>
            <h2 className="mb-2 text-lg font-semibold leading-snug">{step.title}</h2>
            <div className="prose-cva space-y-2">{step.body.map((p) => <p key={p}>{p}</p>)}</div>
            {step.recap && (
              <ul className="mt-3 space-y-1.5">{step.recap.map((r) => <li key={r} className="flex gap-2"><span aria-hidden className="text-emerald-600">✓</span><span>{r}</span></li>)}</ul>
            )}
            {step.callout && (
              <div className={`mt-3 rounded-lg border p-3 ${CALLOUT[step.callout.type]?.cls ?? ''}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{CALLOUT[step.callout.type]?.title ?? 'Key idea'}</p>
                <p>{step.callout.text}</p>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => go(i - 1)} disabled={i === 0}>← Back</button>
              <button type="button" className="btn-primary flex-1" onClick={() => go(i + 1)} disabled={last}>{last ? 'Done' : `Next: ${steps[i + 1]?.label ?? ''} →`}</button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">← → to step · R to replay</p>
        </motion.section>
        <section className="card self-start p-4 text-sm" aria-labelledby="wt-learn">
          <h3 id="wt-learn" className="mb-2 text-xs font-semibold uppercase tracking-wide">You'll learn</h3>
          <ul className="space-y-1.5">
            {data.learn.map((l, n) => {
              const done = step.learned.includes(n)
              return <li key={l} className={`flex gap-2 ${done ? '' : 'text-slate-500'}`}><span aria-hidden className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{done ? '✓' : ''}</span><span>{l}</span><span className="sr-only">{done ? '(covered)' : '(coming up)'}</span></li>
            })}
          </ul>
        </section>
      </aside>
    </div>
  )
}
