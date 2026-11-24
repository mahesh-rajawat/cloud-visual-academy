import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AnimationControls, useStepperKeys } from '../components/AnimationControls'
import { usePrefersReducedMotion, useStepper } from '../hooks/useStepper'
import { LAYOUTS, simulate, type Failure, type Redundancy } from '../simulations/replication'
import { Badge, DiskNode, FidelityNote, ScopeBox, UserNode, palette } from './primitives'
import type { SimulationProps } from './types'

const OPTIONS: Redundancy[] = ['LRS', 'ZRS', 'GRS', 'RA-GRS', 'GZRS', 'RA-GZRS']
const FAILURES: Array<{ id: Failure; label: string }> = [
  { id: 'none', label: 'No failure' },
  { id: 'node', label: 'Disk / node / rack' },
  { id: 'zone', label: 'Datacenter / zone 1' },
  { id: 'region', label: 'Primary region' },
]

export default function ReplicationSimulation({ onLabCheck }: SimulationProps) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [r, setR] = useState<Redundancy>('LRS')
  const [failure, setFailure] = useState<Failure>('none')
  const layout = LAYOUTS[r]
  const outcome = simulate(r, failure)

  const steps = useMemo(() => {
    const s = ['Client writes a blob to the primary endpoint']
    s.push(layout.primary.length === 3 ? 'Written synchronously to 3 zones' : 'Written synchronously to 3 copies in one datacenter')
    s.push('Write acknowledged to the client')
    if (layout.geo) s.push('Later: copied asynchronously to the secondary region (Last Sync Time advances)')
    if (failure !== 'none') s.push(`Failure injected: ${FAILURES.find((f) => f.id === failure)?.label}`)
    s.push(`Result: reads ${outcome.reads}, writes ${outcome.writes}`)
    return s
  }, [layout, failure, outcome.reads, outcome.writes])
  const stepper = useStepper(steps.length, { baseMs: 1200 })
  useStepperKeys(ref, stepper)
  const cur = steps[stepper.step] ?? ''
  const showSync = stepper.step >= 1
  const showAck = stepper.step >= 2
  const showGeo = !!layout.geo && stepper.step >= 3
  const failed = failure !== 'none' && stepper.step >= steps.length - 2

  const run = (nextR: Redundancy, nextF: Failure) => {
    if (nextR === 'LRS' && nextF === 'zone') onLabCheck?.('lrs-zone-fail')
    if (nextR === 'ZRS' && nextF === 'region') onLabCheck?.('zrs-region-fail')
    if (nextR.startsWith('RA-') && nextF === 'region') onLabCheck?.('ra-read-secondary')
    stepper.play()
  }

  const primaryFailed = (zone: number) => failed && (failure === 'region' || (failure === 'zone' && zone === 1))
  const zoneX = (z: number) => 160 + (z - 1) * 120

  return (
    <div ref={ref} tabIndex={0} className="card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="Storage replication simulation">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3 dark:border-slate-800" role="group" aria-label="Redundancy option">
        {OPTIONS.map((o) => (
          <button key={o} type="button" aria-pressed={o === r} className={o === r ? 'btn-primary' : 'btn-ghost'} onClick={() => { setR(o); run(o, failure) }}>{o}</button>
        ))}
        <span className="mx-2 self-center text-slate-300">|</span>
        {FAILURES.map((f) => (
          <button key={f.id} type="button" aria-pressed={f.id === failure} className={f.id === failure ? 'btn bg-red-600 text-white' : 'btn-ghost'} onClick={() => { setFailure(f.id); run(r, f.id) }}>{f.label}</button>
        ))}
      </div>
      <svg viewBox="0 0 820 260" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label={`${r} replication with ${failure} failure`}>
        <UserNode x={50} y={130} label="App" />
        <ScopeBox x={100} y={20} w={390} h={220} label="Primary region (West Europe)" state={failed && failure === 'region' ? 'fail' : undefined} />
        {[1, 2, 3].map((z) => (
          <ScopeBox key={z} x={zoneX(z) - 50} y={50} w={100} h={170} label={`Zone ${z}`} dashed color={palette.muted} state={primaryFailed(z) ? 'fail' : undefined} />
        ))}
        {layout.primary.map((p) => (
          <g key={p.zone}>
            <DiskNode x={zoneX(p.zone)} y={140} copies={p.copies} label={`${p.copies} cop${p.copies > 1 ? 'ies' : 'y'}`} state={primaryFailed(p.zone) ? 'fail' : showSync ? 'ok' : 'neutral'} />
            {showSync && !reduced && <motion.line x1={70} y1={130} x2={zoneX(p.zone) - 18} y2={130} stroke={palette.allow} strokeWidth={2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />}
            {showSync && reduced && <line x1={70} y1={130} x2={zoneX(p.zone) - 18} y2={130} stroke={palette.allow} strokeWidth={2} />}
          </g>
        ))}
        {showAck && <text x={300} y={235} textAnchor="middle" fontSize={10} fill={palette.allow}>sync write committed → ACK</text>}
        <ScopeBox x={560} y={20} w={240} h={220} label="Secondary region (paired)" color={layout.secondary ? palette.azure : palette.muted} dashed={!layout.secondary} />
        {layout.secondary ? (
          <>
            <DiskNode x={680} y={140} copies={3} label="3 copies (LRS)" sublabel={layout.readableSecondary ? 'read-only endpoint' : 'not readable until failover'} state={showGeo ? (failed && failure === 'region' && layout.readableSecondary ? 'ok' : 'neutral') : 'neutral'} />
            {showGeo && <motion.line x1={490} y1={130} x2={650} y2={130} stroke={palette.azure} strokeWidth={2} strokeDasharray="6 5" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4 }} />}
            {showGeo && <text x={570} y={120} textAnchor="middle" fontSize={10} fill={palette.azure}>async (lag)</text>}
          </>
        ) : <text x={680} y={135} textAnchor="middle" fontSize={11} fill={palette.muted}>no geo copy</text>}
      </svg>
      <AnimationControls stepper={stepper} stepLabels={steps} regionLabel="Replication simulation" />
      <div className="grid gap-3 border-t border-slate-200 p-3 text-sm md:grid-cols-[1fr_1fr] dark:border-slate-800" aria-live="polite">
        <div className="space-y-1">
          <p><span className="label">Now: </span>{cur}</p>
          <p className="flex flex-wrap gap-1">
            <Badge tone={outcome.reads === 'unavailable' ? 'deny' : outcome.reads === 'available' ? 'allow' : 'warn'}>Reads: {outcome.reads.replace(/-/g, ' ')}</Badge>
            <Badge tone={outcome.writes === 'available' ? 'allow' : 'deny'}>Writes: {outcome.writes}</Badge>
            <Badge tone={outcome.dataLossRisk === 'none' ? 'allow' : outcome.dataLossRisk === 'possible-all' ? 'deny' : 'warn'}>Data-loss risk: {outcome.dataLossRisk.replace(/-/g, ' ')}</Badge>
          </p>
          <p>{outcome.summary}</p>
          <p className="text-slate-600 dark:text-slate-400"><span className="font-semibold">Recovery:</span> {outcome.recovery}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="label">Primary replication</dt><dd>{layout.sync}, {layout.primary.length === 3 ? '3 zones' : '1 datacenter'}</dd>
          <dt className="label">Geo replication</dt><dd>{layout.geo ?? 'none'}</dd>
          <dt className="label">Readable secondary</dt><dd>{layout.readableSecondary ? 'yes' : 'no'}</dd>
          <dt className="label">Durability design target</dt><dd>{layout.durability} / year</dd>
          <dt className="label">Geo RPO</dt><dd>{layout.geo ? 'typically < 15 min, no SLA' : 'n/a'}</dd>
          <dt className="label">Archive tier</dt><dd>{['LRS', 'GRS', 'RA-GRS'].includes(r) ? 'supported' : 'not supported'}</dd>
        </dl>
      </div>
      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="simplified-illustration">Copy placement and failure outcomes follow Microsoft's redundancy and failover documentation. Timing is illustrative: real geo-lag varies and is reported by Last Sync Time.</FidelityNote>
      </div>
    </div>
  )
}
