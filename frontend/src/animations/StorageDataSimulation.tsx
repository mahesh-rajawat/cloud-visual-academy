import { useMemo, useRef, useState } from 'react'
import { AnimationControls, useStepperKeys } from '../components/AnimationControls'
import { useStepper } from '../hooks/useStepper'
import { MAX_SHARE_SNAPSHOTS, MIN_DAYS, applyOps, objectReplicationCheck, readBlob, rehydrateTime, replicateBlob, runLifecycle, shareRecovery, type BlobState, type DataOp, type LifecycleRule, type ReplicationAccount, type Tier } from '../simulations/storageData'
import { Badge, FidelityNote, palette } from './primitives'
import type { SimulationProps } from './types'

type Tab = 'lifecycle' | 'protect' | 'replicate' | 'files'
const TIER_Y: Record<Tier, number> = { Hot: 40, Cool: 80, Cold: 120, Archive: 160 }
const TIER_COLOR: Record<Tier, string> = { Hot: '#d23b3b', Cool: '#0a7cd6', Cold: '#4f46e5', Archive: '#475569' }
const BLOBS: BlobState[] = [
  { name: 'logs/app-2026-01.log', tier: 'Hot', modifiedDay: 0, lastAccessDay: 0, tierChangedDay: 0, deleted: false },
  { name: 'images/logo.png', tier: 'Hot', modifiedDay: 0, lastAccessDay: 0, tierChangedDay: 0, deleted: false },
  { name: 'backups/db-full.bak', tier: 'Hot', modifiedDay: 0, lastAccessDay: 0, tierChangedDay: 0, deleted: false },
]

export default function StorageDataSimulation({ onLabCheck }: SimulationProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('lifecycle')
  const [rules, setRules] = useState<LifecycleRule[]>([
    { id: 'logs-cool', prefix: 'logs/', action: 'Cool', afterDays: 30, basis: 'modified' },
    { id: 'logs-archive', prefix: 'logs/', action: 'Archive', afterDays: 90, basis: 'modified' },
  ])
  const [draft, setDraft] = useState<LifecycleRule>({ id: 'backups-delete', prefix: 'backups/', action: 'delete', afterDays: 180, basis: 'modified' })
  const [priority, setPriority] = useState<'Standard' | 'High'>('Standard')
  const [readMsg, setReadMsg] = useState<string | null>(null)
  const [prot, setProt] = useState({ versioning: false, blobSoftDeleteDays: 0, containerSoftDeleteDays: 0 })
  const [ops, setOps] = useState<DataOp[]>(['write', 'overwrite'])
  const [src, setSrc] = useState<ReplicationAccount>({ versioning: false, changeFeed: false, hierarchicalNamespace: false })
  const [dst, setDst] = useState<ReplicationAccount>({ versioning: false, changeFeed: false, hierarchicalNamespace: false })
  const [repMsg, setRepMsg] = useState<string | null>(null)
  const [files, setFiles] = useState({ snapshots: 0, shareSoftDeleteDays: 7 })
  const [filesMsg, setFilesMsg] = useState<{ ok: boolean; how: string } | null>(null)

  const DAYS = 400
  const sim = useMemo(() => runLifecycle(BLOBS, rules, DAYS, false), [rules])
  const frames = 41 // every 10 days
  const stepper = useStepper(frames, { baseMs: 350 })
  useStepperKeys(ref, stepper)
  const day = stepper.step * 10
  const stateAt = (name: string) => {
    let tier: Tier = 'Hot'
    let deleted = false
    for (const e of sim.events) if (e.blob === name && e.day <= day) { if (e.action === 'deleted') deleted = true; else tier = e.action.replace('moved to ', '') as Tier }
    return { tier, deleted }
  }
  const timeline = applyOps(ops, prot)
  const repErrors = objectReplicationCheck(src, dst)

  return (
    <div ref={ref} tabIndex={0} className="@container card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="Blob data management simulation">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
        {([['lifecycle', 'Tiers & lifecycle'], ['protect', 'Versioning & soft delete'], ['replicate', 'Object replication'], ['files', 'Azure Files snapshots']] as const).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>

      {tab === 'lifecycle' && (
        <>
          <svg viewBox="0 0 800 190" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label={`Blob tiers on day ${day}`}>
            {(Object.keys(TIER_Y) as Tier[]).map((t) => (
              <g key={t}><rect x={10} y={TIER_Y[t] - 16} width={780} height={32} rx={6} fill={TIER_COLOR[t]} fillOpacity={0.07} />
                <text x={18} y={TIER_Y[t] + 4} fontSize={11} fontWeight={600} fill={TIER_COLOR[t]}>{t}{MIN_DAYS[t] ? ` (min ${MIN_DAYS[t]} d)` : ''}</text></g>
            ))}
            {BLOBS.map((b, i) => {
              const s = stateAt(b.name)
              return (
                <g key={b.name} style={{ transition: 'transform 0.5s' }} transform={`translate(${200 + i * 200},${TIER_Y[s.tier]})`} opacity={s.deleted ? 0.25 : 1}>
                  <rect x={-80} y={-11} width={160} height={22} rx={5} fill="white" stroke={TIER_COLOR[s.tier]} className="dark:fill-slate-900" />
                  <text y={4} textAnchor="middle" fontSize={10} fill="currentColor">{s.deleted ? '🗑 ' : ''}{b.name}</text>
                </g>
              )
            })}
            <text x={790} y={184} textAnchor="end" fontSize={11} fill={palette.muted}>day {day} since last modification</text>
          </svg>
          <AnimationControls stepper={stepper} stepLabels={Array.from({ length: frames }, (_, i) => `Day ${i * 10}`)} regionLabel="Lifecycle timeline" />
          <div className="grid gap-3 border-t border-slate-200 p-3 text-sm @3xl:grid-cols-3 dark:border-slate-800">
            <fieldset className="space-y-2">
              <legend className="label">Lifecycle rules (run daily; cheapest action wins)</legend>
              <ul className="space-y-1 text-xs">{rules.map((r) => <li key={r.id} className="flex justify-between"><span><span className="font-mono">{r.prefix || '*'}</span> → {r.action} after {r.afterDays} d</span><button type="button" className="text-red-600" aria-label={`Remove rule ${r.id}`} onClick={() => setRules(rules.filter((x) => x.id !== r.id))}>✕</button></li>)}</ul>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <input className="input font-mono" aria-label="Prefix" value={draft.prefix} onChange={(e) => setDraft({ ...draft, prefix: e.target.value })} />
                <select className="input" aria-label="Action" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value as LifecycleRule['action'] })}><option>Cool</option><option>Cold</option><option>Archive</option><option value="delete">delete</option></select>
                <input type="number" className="input" aria-label="Days after modification" value={draft.afterDays} onChange={(e) => setDraft({ ...draft, afterDays: Number(e.target.value) })} />
              </div>
              <button type="button" className="btn-primary w-full" onClick={() => { setRules([...rules.filter((r) => r.id !== `${draft.prefix}-${draft.action}`), { ...draft, id: `${draft.prefix}-${draft.action}` }]); onLabCheck?.('lifecycle-rule') }}>Add rule</button>
            </fieldset>
            <div className="space-y-1 text-xs">
              <p className="label">Policy actions</p>
              <ul className="max-h-36 overflow-y-auto">{sim.events.map((e, i) => <li key={i} className={e.day <= day ? '' : 'text-slate-400'}>Day {e.day}: {e.blob} {e.action}{e.earlyDeletionDays ? <Badge tone="warn">early deletion charge: {e.earlyDeletionDays} d</Badge> : null}</li>)}</ul>
            </div>
            <fieldset className="space-y-2">
              <legend className="label">Read logs/app-2026-01.log on day {day}</legend>
              <select className="input w-full" aria-label="Rehydration priority" value={priority} onChange={(e) => setPriority(e.target.value as 'Standard' | 'High')}><option>Standard</option><option>High</option></select>
              <button type="button" className="btn-ghost w-full" onClick={() => {
                const s = stateAt(BLOBS[0]!.name)
                const r = readBlob({ ...BLOBS[0]!, tier: s.tier, deleted: s.deleted })
                setReadMsg(r.ok ? r.detail : `${r.detail}${s.tier === 'Archive' && !s.deleted ? ` ${priority} priority rehydration takes ${rehydrateTime(priority, 0.2)}.` : ''}`)
                if (s.tier === 'Archive') onLabCheck?.('archive-read')
              }}>Read blob</button>
              {readMsg && <p role="status" className="text-xs">{readMsg}</p>}
            </fieldset>
          </div>
        </>
      )}

      {tab === 'protect' && (
        <div className="grid gap-3 p-3 text-sm @3xl:grid-cols-3">
          <fieldset className="space-y-2">
            <legend className="label">Data protection settings</legend>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={prot.versioning} onChange={(e) => setProt({ ...prot, versioning: e.target.checked })} />Blob versioning</label>
            <label className="flex items-center justify-between text-xs">Blob soft delete (days, 0 = off)<input type="number" min={0} max={365} className="input w-16" value={prot.blobSoftDeleteDays} onChange={(e) => setProt({ ...prot, blobSoftDeleteDays: Math.min(365, Number(e.target.value)) })} /></label>
            <label className="flex items-center justify-between text-xs">Container soft delete (days)<input type="number" min={0} max={365} className="input w-16" value={prot.containerSoftDeleteDays} onChange={(e) => setProt({ ...prot, containerSoftDeleteDays: Math.min(365, Number(e.target.value)) })} /></label>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="label">Operations on report.csv</legend>
            <div className="flex flex-wrap gap-1">{(['write', 'overwrite', 'delete-blob', 'delete-container'] as DataOp[]).map((o) => <button key={o} type="button" className="btn-ghost" onClick={() => setOps([...ops, o])}>{o}</button>)}</div>
            <p className="font-mono text-xs">{ops.join(' → ')}</p>
            <button type="button" className="btn-ghost" onClick={() => setOps(['write'])}>Clear</button>
          </fieldset>
          <div aria-live="polite" className="space-y-1 text-xs">
            <svg viewBox="0 0 260 60" className="w-full" aria-hidden>
              {timeline.versions.map((v, i) => <g key={v}><rect x={4 + i * 52} y={10} width={46} height={22} rx={4} fill={palette.muted} fillOpacity={0.2} /><text x={27 + i * 52} y={25} textAnchor="middle" fontSize={10}>{v}</text></g>)}
              {timeline.current && <g><rect x={4 + timeline.versions.length * 52} y={10} width={46} height={22} rx={4} fill={palette.allow} fillOpacity={0.3} /><text x={27 + timeline.versions.length * 52} y={25} textAnchor="middle" fontSize={10}>{timeline.current}*</text></g>}
              <text x={4} y={50} fontSize={9} fill={palette.muted}>grey = previous versions · * = current</text>
            </svg>
            <p><Badge tone="allow">Recoverable</Badge> {timeline.recoverable.join('; ') || 'nothing'}</p>
            <p><Badge tone="deny">Lost</Badge> {timeline.lost.join('; ') || 'nothing'}</p>
            <button type="button" className="btn-primary" onClick={() => onLabCheck?.(timeline.lost.length ? 'data-lost' : 'data-recovered')}>Assess recovery</button>
          </div>
        </div>
      )}

      {tab === 'replicate' && (
        <div className="grid gap-3 p-3 text-sm @3xl:grid-cols-3">
          {([['Source account (West Europe)', src, setSrc], ['Destination account (North Europe)', dst, setDst]] as const).map(([label, a, set]) => (
            <fieldset key={label} className="space-y-1">
              <legend className="label">{label}</legend>
              {(['versioning', 'changeFeed', 'hierarchicalNamespace'] as const).map((k) => <label key={k} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={a[k]} onChange={(e) => set({ ...a, [k]: e.target.checked })} />{{ versioning: 'Blob versioning', changeFeed: 'Change feed', hierarchicalNamespace: 'Hierarchical namespace' }[k]}</label>)}
            </fieldset>
          ))}
          <div className="space-y-2 text-xs" aria-live="polite">
            <button type="button" className="btn-primary w-full" onClick={() => { setRepMsg(repErrors.length ? repErrors.join(' ') : 'Policy created: rule reports → reports-copy.'); onLabCheck?.(repErrors.length ? 'replication-prereq' : 'replication-policy') }}>Create replication policy</button>
            {!repErrors.length && (['Hot', 'Archive'] as Tier[]).map((t) => <button key={t} type="button" className="btn-ghost w-full" onClick={() => setRepMsg(replicateBlob(t, 'write').detail)}>Upload a {t} blob to source</button>)}
            {!repErrors.length && <button type="button" className="btn-ghost w-full" onClick={() => setRepMsg(replicateBlob('Hot', 'write-to-destination').detail)}>Overwrite a replicated blob in destination</button>}
            {repMsg && <p role="status">{repMsg}</p>}
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div className="grid gap-3 p-3 text-sm @3xl:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="label">Share "finance"</legend>
            <p className="text-xs">Share snapshots: {files.snapshots} / {MAX_SHARE_SNAPSHOTS}</p>
            <button type="button" className="btn-ghost w-full" disabled={files.snapshots >= MAX_SHARE_SNAPSHOTS} onClick={() => { setFiles({ ...files, snapshots: files.snapshots + 1 }); onLabCheck?.('snapshot-taken') }}>Take share snapshot</button>
            <label className="flex items-center justify-between text-xs">Share soft delete (days, 0 = off)<input type="number" min={0} max={365} className="input w-16" value={files.shareSoftDeleteDays} onChange={(e) => setFiles({ ...files, shareSoftDeleteDays: Math.min(365, Number(e.target.value)) })} /></label>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="label">Incident</legend>
            {(['file-overwritten', 'file-deleted', 'share-deleted'] as const).map((ev) => (
              <button key={ev} type="button" className="btn-ghost w-full" onClick={() => { const r = shareRecovery({ ...files, event: ev }); setFilesMsg(r); if (r.ok) onLabCheck?.('files-recovered') }}>{ev.replace('-', ' ')}</button>
            ))}
            {filesMsg && <p role="status" className="text-xs"><Badge tone={filesMsg.ok ? 'allow' : 'deny'}>{filesMsg.ok ? 'RECOVERABLE' : 'NOT RECOVERABLE'}</Badge> {filesMsg.how}</p>}
          </fieldset>
        </div>
      )}
      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="accurate-model">Tier minimums, lifecycle precedence (least expensive action), archive rehydration, versioning/soft delete semantics, object replication prerequisites and share snapshot/soft delete behaviour follow Microsoft documentation. Lifecycle runs are shown daily; in Azure, actions can take up to 24 hours or more to apply.</FidelityNote>
      </div>
    </div>
  )
}
