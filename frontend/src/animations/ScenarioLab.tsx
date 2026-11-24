import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimationControls, useStepperKeys } from '../components/AnimationControls'
import { usePrefersReducedMotion, useStepper } from '../hooks/useStepper'
import type { Control, Evaluation, Scenario, ScenarioGroup, Stage, State } from '../simulations/scenario'
import { Badge, DiskNode, FidelityNote, FirewallNode, GlobeNode, Link, Packet, ServerNode, UserNode, VmNode, palette } from './primitives'
import type { SimulationProps } from './types'

function StageIcon({ st, x, y, state }: { st: Stage; x: number; y: number; state: 'ok' | 'fail' | 'neutral' }) {
  const p = { x, y, label: st.label.length > 22 ? st.label.slice(0, 21) + '…' : st.label, state, title: st.label }
  switch (st.kind) {
    case 'user': return <UserNode {...p} />
    case 'compute': return <VmNode {...p} />
    case 'network': return <ServerNode {...p} color="#0891b2" />
    case 'security': return <FirewallNode {...p} />
    case 'storage': return <DiskNode {...p} />
    case 'identity': return <UserNode {...p} color="#7c4dcc" />
    case 'globe': return <GlobeNode {...p} />
    case 'ai': return <ServerNode {...p} color="#7c4dcc" />
    default: return <ServerNode {...p} />
  }
}

function SeriesChart({ series }: { series: NonNullable<Evaluation['series']> }) {
  const all = series.lines.flatMap((l) => l.points)
  const max = Math.max(1, ...all)
  const n = Math.max(...series.lines.map((l) => l.points.length))
  const X = (i: number) => 50 + (i / Math.max(1, n - 1)) * 720
  const Y = (v: number) => 170 - (v / max) * 150
  const colors = [palette.azure, palette.allow, '#7c4dcc', palette.warn, palette.deny]
  return (
    <svg viewBox="0 0 800 200" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label={`${series.yLabel} over ${series.xLabel}`}>
      <line x1={50} x2={770} y1={170} y2={170} stroke={palette.muted} />
      <line x1={50} x2={50} y1={15} y2={170} stroke={palette.muted} />
      <text x={52} y={14} fontSize={10} fill={palette.muted}>{series.yLabel} (max {Math.round(max * 10) / 10})</text>
      <text x={770} y={188} textAnchor="end" fontSize={10} fill={palette.muted}>{series.xLabel} →</text>
      {(series.markers ?? []).map((m, i) => (
        <g key={i}><line x1={X(m.x)} x2={X(m.x)} y1={20} y2={170} stroke={palette.warn} strokeDasharray="3 3" /><text x={X(m.x) + 3} y={30 + (i % 4) * 11} fontSize={9} fill={palette.warn}>{m.label}</text></g>
      ))}
      {series.lines.map((l, li) => (
        <g key={l.label}>
          <polyline fill="none" stroke={l.color ?? colors[li % colors.length]} strokeWidth={2} strokeDasharray={l.dashed ? '5 4' : undefined} points={l.points.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} />
          <text x={60 + li * 170} y={198} fontSize={10} fill={l.color ?? colors[li % colors.length]}>■ {l.label}</text>
        </g>
      ))}
    </svg>
  )
}

/**
 * "Pick the best option" scenarios are a quiz, not a process, so they get a plain practice card:
 * a requirement, the answer choices as buttons, and immediate feedback. No pipeline animation.
 */
function ChoicePractice({ scenario, onLabCheck }: { scenario: Scenario; onLabCheck?: (id: string) => void }) {
  const [reqCtl, choiceCtl] = scenario.controls as [Extract<Control, { type: 'select' }>, Extract<Control, { type: 'select' }>]
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const req = reqCtl.options[i]!
  const ev = picked === null ? null : scenario.evaluate({ [reqCtl.key]: req.value, [choiceCtl.key]: picked })
  const best = ev && !ev.outcome.ok ? ev.outcome.detail.replace(/^Best fit: |\.$/g, '') : null
  const go = (n: number) => { setI((n + reqCtl.options.length) % reqCtl.options.length); setPicked(null) }
  const pick = (v: string) => {
    setPicked(v)
    scenario.evaluate({ [reqCtl.key]: req.value, [choiceCtl.key]: v }).checks.forEach((c) => onLabCheck?.(c))
  }
  return (
    <div className="space-y-3 p-3 text-sm">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{reqCtl.label} {i + 1} of {reqCtl.options.length}</span>
        <span className="flex gap-1">
          <button type="button" className="btn-ghost" onClick={() => go(i - 1)} aria-label="Previous requirement">←</button>
          <button type="button" className="btn-ghost" onClick={() => go(i + 1)}>Next requirement →</button>
        </span>
      </div>
      <p className="rounded-lg bg-slate-50 p-3 text-base font-medium dark:bg-slate-800/60">{req.label}</p>
      <fieldset>
        <legend className="label mb-1">{choiceCtl.label}</legend>
        <div className="grid gap-2 @md:grid-cols-2 @3xl:grid-cols-3">
          {choiceCtl.options.map((o) => {
            const state = picked === null ? '' : o.value === picked ? (ev!.outcome.ok ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-red-500 bg-red-50 dark:bg-red-950/40') : o.value === best ? 'border-emerald-500 font-medium text-emerald-800 dark:text-emerald-300' : 'opacity-70'
            return <button key={o.value} type="button" aria-pressed={o.value === picked} className={`rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-sky-400 dark:border-slate-700 ${state}`} onClick={() => pick(o.value)}>{o.label}</button>
          })}
        </div>
      </fieldset>
      <div aria-live="polite">
        {ev && (
          <div className={`rounded-lg border p-3 ${ev.outcome.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}>
            <p className="font-semibold">{ev.outcome.ok ? '✓ Good fit' : `✗ Not the best fit. Best: ${best}`}</p>
            <p className="mt-1">{ev.outcome.ok ? ev.outcome.detail : ev.stages[2]?.detail.replace(`Not the best fit. ${best} is: `, '')}</p>
            <button type="button" className="btn-primary mt-2" onClick={() => go(i + 1)}>Next requirement →</button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ScenarioLab({ group, onLabCheck }: SimulationProps & { group: ScenarioGroup }) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(group.scenarios[0]!.id)
  const scenario = group.scenarios.find((s) => s.id === active)!
  const [states, setStates] = useState<Record<string, State>>(() => Object.fromEntries(group.scenarios.map((s) => [s.id, { ...s.initial }])))
  const [run, setRun] = useState<{ ev: Evaluation; key: number } | null>(null)
  const state = states[active]!
  const preview = useMemo(() => scenario.evaluate(state), [scenario, state])

  const stepLabels = useMemo(() => {
    if (!run) return ['Configure the scenario, then run it']
    const reached = run.ev.stages.filter((s) => s.ok !== null)
    return [...reached.map((s) => `${scenario.stages.find((x) => x.id === s.id)?.label}: ${s.ok ? 'pass' : 'fail'}. ${s.detail}`), `${run.ev.outcome.title}: ${run.ev.outcome.detail}`]
  }, [run, scenario])
  const stepper = useStepper(stepLabels.length, { baseMs: 1100 })
  useStepperKeys(ref, stepper)
  useEffect(() => { setRun(null); stepper.restart() }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const execute = () => {
    const ev = scenario.evaluate(state)
    setRun({ ev, key: Date.now() })
    stepper.play()
    ev.checks.forEach((c) => onLabCheck?.(c))
  }
  const set = (k: string, v: string | number | boolean) => setStates((s) => ({ ...s, [active]: { ...s[active]!, [k]: v } }))

  const n = scenario.stages.length
  const xs = scenario.stages.map((_, i) => 70 + (i * 660) / Math.max(1, n - 1))
  const reachedCount = run ? run.ev.stages.filter((s) => s.ok !== null).length : 0
  const at = run ? Math.min(stepper.step, Math.max(0, reachedCount - 1)) : 0
  const done = !!run && stepper.atEnd
  const stageState = (i: number): 'ok' | 'fail' | 'neutral' => {
    if (!run || i > stepper.step) return 'neutral'
    const r = run.ev.stages[i]
    return !r || r.ok === null ? 'neutral' : r.ok ? 'ok' : 'fail'
  }

  return (
    <div ref={ref} tabIndex={0} className="@container card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label={`${scenario.title} simulation`}>
      {group.scenarios.length > 1 && (
        <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
          {group.scenarios.map((s) => <button key={s.id} type="button" role="tab" aria-selected={s.id === active} className={s.id === active ? 'btn-primary' : 'btn-ghost'} onClick={() => setActive(s.id)}>{s.kind === 'choice' ? `Practice: ${s.title}` : s.title}</button>)}
        </div>
      )}
      <p className="px-3 pt-2 text-sm text-slate-600 dark:text-slate-300">{scenario.description}</p>
      {scenario.kind === 'choice' ? <ChoicePractice key={scenario.id} scenario={scenario} onLabCheck={onLabCheck} /> : <>
      <svg viewBox="0 0 800 170" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label={scenario.stages.map((s) => s.label).join(' → ')}>
        <Link x1={xs[0]!} y1={90} x2={xs[n - 1]!} y2={90} state={done ? (run!.ev.outcome.ok ? 'ok' : 'fail') : undefined} />
        {scenario.stages.map((st, i) => <StageIcon key={st.id} st={st} x={xs[i]!} y={90} state={stageState(i)} />)}
        {run && <Packet key={run.key} points={xs.map((x) => [x, 90] as [number, number])} at={at} state={done ? (run.ev.outcome.ok ? 'allowed' : 'denied') : 'moving'} reduced={reduced} label="REQ" />}
      </svg>
      <AnimationControls stepper={stepper} stepLabels={stepLabels} regionLabel={scenario.title} />
      {done && run && (
        <div role="status" className={`border-t px-3 py-2 text-sm ${run.ev.outcome.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}>
          <Badge tone={run.ev.outcome.ok ? 'allow' : 'deny'}>{run.ev.outcome.title}</Badge> {run.ev.outcome.detail}
        </div>
      )}
      <div className="grid gap-3 border-t border-slate-200 p-3 text-sm @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] dark:border-slate-800">
        {/* min-w-0: a fieldset otherwise refuses to shrink below its widest <select> and spills into the next column. */}
        <fieldset className="min-w-0 space-y-3">
          <legend className="label">Configuration</legend>
          {scenario.controls.map((c) => c.type === 'checkbox' ? (
            <label key={c.key} className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={Boolean(state[c.key])} onChange={(e) => set(c.key, e.target.checked)} />
              <span>{c.label}</span>
            </label>
          ) : (
            <label key={c.key} className="block space-y-1 text-xs">
              <span className="block font-medium text-slate-600 dark:text-slate-300">{c.label}</span>
              {c.type === 'select' && <select className="input w-full min-w-0 truncate" title={c.options.find((o) => o.value === String(state[c.key]))?.label} value={String(state[c.key])} onChange={(e) => set(c.key, e.target.value)}>{c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
              {c.type === 'number' && <input type="number" className="input w-28" min={c.min} max={c.max} step={c.step} value={Number(state[c.key])} onChange={(e) => set(c.key, Number(e.target.value))} />}
            </label>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn-primary" onClick={execute}>Run scenario</button>
            <button type="button" className="btn-ghost" onClick={() => { setStates((s) => ({ ...s, [active]: { ...scenario.initial } })); setRun(null); stepper.restart() }}>Reset</button>
          </div>
          {scenario.presets && scenario.presets.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="label">Presets / failure injection</p>
              {scenario.presets.map((p) => <button key={p.label} type="button" className="btn-ghost w-full justify-start text-left" onClick={() => { setStates((s) => ({ ...s, [active]: { ...s[active]!, ...p.values } })); setRun(null) }}>{p.label}</button>)}
            </div>
          )}
        </fieldset>
        <div className="min-w-0 space-y-2" aria-live="polite">
          <p className="label">Live evaluation</p>
          <ol className="space-y-1.5 text-xs leading-relaxed">
            {preview.stages.map((r) => {
              const st = scenario.stages.find((s) => s.id === r.id)!
              return <li key={r.id} className="flex items-start gap-2"><Badge tone={r.ok === null ? 'muted' : r.ok ? 'allow' : 'deny'}>{r.ok === null ? '·' : r.ok ? '✓' : '✗'}</Badge><span><span className="font-medium">{st.label}</span>{r.detail ? `: ${r.detail}` : ''}</span></li>
            })}
          </ol>
          {preview.metrics && <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">{preview.metrics.map((m) => <div key={m.label} className="contents"><dt className="label">{m.label}</dt><dd>{m.value}</dd></div>)}</dl>}
          {preview.series && <SeriesChart series={preview.series} />}
          {preview.notes?.map((n) => <p key={n} className="text-xs text-slate-600 dark:text-slate-400">• {n}</p>)}
        </div>
      </div>
      </>}
      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity={group.fidelity}>{group.fidelityNote}</FidelityNote>
        {scenario.kind !== 'choice' && <details className="mt-1 text-xs"><summary className="cursor-pointer text-slate-500">Text transcript</summary>
          <ol className="ml-5 list-decimal">{stepLabels.map((t, i) => <li key={i} className={i === stepper.step ? 'font-semibold' : ''}>{t}</li>)}</ol>
        </details>}
      </div>
    </div>
  )
}
