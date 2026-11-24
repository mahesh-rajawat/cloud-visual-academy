import { useMemo, useRef, useState } from 'react'
import { AnimationControls, useStepperKeys } from '../components/AnimationControls'
import { useStepper } from '../hooks/useStepper'
import { ADVISOR_CPU_THRESHOLDS, ADVISOR_LOOKBACK_DAYS, advisorCostRecommendations, simulateBudget, type AlertCondition } from '../simulations/cost'
import { Badge, FidelityNote, palette } from './primitives'
import type { SimulationProps } from './types'

const VMS = [
  { name: 'vm-build-01', size: 'Standard_D8s_v5', avgCpu: 2, monthlyCost: 280 },
  { name: 'vm-web-01', size: 'Standard_D4s_v5', avgCpu: 7, monthlyCost: 140 },
  { name: 'vm-sql-01', size: 'Standard_E8s_v5', avgCpu: 46, monthlyCost: 370 },
]

export default function BudgetSimulation({ onLabCheck }: SimulationProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [amount, setAmount] = useState(500)
  const [daily, setDaily] = useState(14)
  const [spikeDay, setSpikeDay] = useState(12)
  const [spike, setSpike] = useState(120)
  const [conditions, setConditions] = useState<AlertCondition[]>([
    { id: 'Actual 80%', type: 'Actual', percent: 80 },
    { id: 'Forecasted 100%', type: 'Forecasted', percent: 100 },
  ])
  const [automation, setAutomation] = useState(false)
  const [cpu, setCpu] = useState<number>(10)
  const [lookback, setLookback] = useState<number>(7)

  const spend = useMemo(() => Array.from({ length: 30 }, (_, i) => daily + (i + 1 === spikeDay ? spike : 0)), [daily, spikeDay, spike])
  const sim = useMemo(() => simulateBudget({ amount, days: 30, dailySpend: spend, conditions, dataDelayDays: 1, automation: automation && conditions[0] ? { conditionId: conditions[0].id, reduceTo: 0.2 } : undefined }), [amount, spend, conditions, automation])
  const stepper = useStepper(30, { baseMs: 260 })
  useStepperKeys(ref, stepper)
  const today = stepper.step + 1
  const visible = sim.days.slice(0, today)
  const firedSoFar = sim.fired.filter((f) => f.observedOn <= today)

  const max = Math.max(amount * 1.3, ...sim.days.map((d) => Math.max(d.cumulative, d.forecast)))
  const X = (d: number) => 50 + ((d - 1) / 29) * 700
  const Y = (v: number) => 200 - (v / max) * 170
  const recs = advisorCostRecommendations(VMS, cpu)

  const play = () => {
    stepper.play()
    if (sim.fired.length) onLabCheck?.('budget-alert')
    if (automation && !sim.overBudget) onLabCheck?.('automation-stopped')
  }

  return (
    <div ref={ref} tabIndex={0} className="@container card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="Budget and Advisor simulation">
      <svg viewBox="0 0 800 230" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label={`Month-to-date cost versus budget of ${amount}`}>
        <line x1={50} x2={750} y1={Y(amount)} y2={Y(amount)} stroke={palette.deny} strokeDasharray="6 4" />
        <text x={752} y={Y(amount) + 4} fontSize={10} fill={palette.deny}>budget {amount}</text>
        {conditions.map((c) => <g key={c.id}><line x1={50} x2={750} y1={Y((c.percent / 100) * amount)} y2={Y((c.percent / 100) * amount)} stroke={palette.warn} strokeDasharray="2 4" /><text x={54} y={Y((c.percent / 100) * amount) - 3} fontSize={9} fill={palette.warn}>{c.id}</text></g>)}
        <polyline fill="none" stroke={palette.azure} strokeWidth={2.5} points={visible.map((d) => `${X(d.day)},${Y(d.cumulative)}`).join(' ')} />
        <polyline fill="none" stroke="#7c4dcc" strokeWidth={1.5} strokeDasharray="4 3" points={visible.map((d) => `${X(d.day)},${Y(d.forecast)}`).join(' ')} />
        {firedSoFar.map((f) => <g key={f.conditionId}><line x1={X(f.observedOn)} x2={X(f.observedOn)} y1={30} y2={200} stroke={palette.warn} /><text x={X(f.observedOn) + 3} y={40} fontSize={9.5} fill={palette.warn}>🔔 {f.conditionId} (data of day {f.day})</text></g>)}
        <line x1={50} x2={750} y1={200} y2={200} stroke={palette.muted} />
        {[1, 10, 20, 30].map((d) => <text key={d} x={X(d)} y={216} fontSize={10} textAnchor="middle" fill={palette.muted}>day {d}</text>)}
        <text x={60} y={225} fontSize={9.5} fill={palette.azure}>— actual (month to date)</text>
        <text x={240} y={225} fontSize={9.5} fill="#7c4dcc">- - forecast</text>
      </svg>
      <AnimationControls stepper={stepper} stepLabels={sim.days.map((d) => `Day ${d.day}: spent ${Math.round(d.cumulative)} of ${amount}`)} regionLabel="Budget simulation" />
      <div className="grid gap-3 border-t border-slate-200 p-3 text-sm @3xl:grid-cols-3 dark:border-slate-800">
        <fieldset className="space-y-2">
          <legend className="label">Budget (monthly reset)</legend>
          <label className="flex items-center justify-between gap-2">Amount (USD)<input type="number" className="input w-24" value={amount} min={50} onChange={(e) => setAmount(Number(e.target.value) || 50)} /></label>
          <label className="flex items-center justify-between gap-2">Normal daily spend<input type="number" className="input w-24" value={daily} min={0} onChange={(e) => setDaily(Number(e.target.value) || 0)} /></label>
          <label className="flex items-center justify-between gap-2">Spike on day<input type="number" className="input w-24" value={spikeDay} min={1} max={30} onChange={(e) => setSpikeDay(Number(e.target.value) || 1)} /></label>
          <label className="flex items-center justify-between gap-2">Spike amount<input type="number" className="input w-24" value={spike} min={0} onChange={(e) => setSpike(Number(e.target.value) || 0)} /></label>
          <button type="button" className="btn-primary w-full" onClick={play}>Run the month</button>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="label">Alert conditions → action group</legend>
          {conditions.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              <select className="input" aria-label={`Condition ${i + 1} type`} value={c.type} onChange={(e) => setConditions(conditions.map((x, j) => j === i ? { ...x, type: e.target.value as AlertCondition['type'], id: `${e.target.value} ${x.percent}%` } : x))}><option>Actual</option><option>Forecasted</option></select>
              <input type="number" className="input w-16" aria-label={`Condition ${i + 1} percent`} value={c.percent} onChange={(e) => setConditions(conditions.map((x, j) => j === i ? { ...x, percent: Number(e.target.value) || 1, id: `${x.type} ${Number(e.target.value) || 1}%` } : x))} />%
              <button type="button" className="text-red-600" aria-label={`Remove condition ${c.id}`} onClick={() => setConditions(conditions.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          {conditions.length < 5 && <button type="button" className="btn-ghost w-full" onClick={() => setConditions([...conditions, { id: `Actual ${100 + conditions.length}%`, type: 'Actual', percent: 100 + conditions.length }])}>Add condition</button>}
          <label className="flex items-start gap-1 text-xs"><input type="checkbox" checked={automation} onChange={(e) => setAutomation(e.target.checked)} /> Action group on the first condition runs a runbook that deallocates dev VMs (spend drops to 20%)</label>
          <p className="text-xs" aria-live="polite">{sim.overBudget ? <Badge tone="deny">month ends over budget: {Math.round(sim.total)}</Badge> : <Badge tone="allow">month ends at {Math.round(sim.total)}</Badge>}</p>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="label">Azure Advisor: cost</legend>
          <div className="flex gap-2 text-xs">
            <label className="flex flex-col">CPU threshold<select className="input" value={cpu} onChange={(e) => { setCpu(Number(e.target.value)); onLabCheck?.('advisor-configured') }}>{ADVISOR_CPU_THRESHOLDS.map((t) => <option key={t} value={t}>{t}%</option>)}</select></label>
            <label className="flex flex-col">Lookback<select className="input" value={lookback} onChange={(e) => setLookback(Number(e.target.value))}>{ADVISOR_LOOKBACK_DAYS.map((t) => <option key={t} value={t}>{t} days</option>)}</select></label>
          </div>
          <ul className="space-y-1 text-xs">
            {VMS.map((v) => {
              const r = recs.find((x) => x.vm === v.name)
              return <li key={v.name}><span className="font-mono">{v.name}</span> avg CPU {v.avgCpu}% ({lookback} d): {r ? <Badge tone="warn">{r.recommendation} · ≈ {r.estimatedMonthlySaving} USD/month</Badge> : <Badge tone="allow">no recommendation</Badge>}</li>
            })}
          </ul>
        </fieldset>
      </div>
      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="simplified-illustration">Budgets alert but never stop resources unless an action group runs automation. The 1-day data delay and linear forecast are simplifications; Advisor savings are illustrative.</FidelityNote>
      </div>
    </div>
  )
}
