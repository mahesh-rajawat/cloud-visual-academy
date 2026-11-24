import { useMemo, useRef, useState } from 'react'
import { AnimationControls, useStepperKeys } from '../components/AnimationControls'
import { usePrefersReducedMotion, useStepper } from '../hooks/useStepper'
import {
  POLICY_DEFINITIONS, complianceScan, evaluateLocks, evaluatePolicy,
  type GovScope, type LockResult, type Method, type PolicyAssignment, type PolicyExemption, type PolicyResult, type ResourceLock, type ResourceState,
} from '../simulations/governance'
import { Badge, FidelityNote, FirewallNode, Link, Packet, ServerNode, UserNode, VmNode, palette } from './primitives'
import type { SimulationProps } from './types'

const SCOPES: GovScope[] = [
  { id: 'mg', name: 'MG: Contoso', kind: 'managementGroup', parent: null },
  { id: 'sub', name: 'Sub: Prod', kind: 'subscription', parent: 'mg' },
  { id: 'rg-prod', name: 'RG: rg-prod (costCenter=CC-100)', kind: 'resourceGroup', parent: 'sub', tags: { costCenter: 'CC-100' } },
  { id: 'rg-sandbox', name: 'RG: rg-sandbox (no tags)', kind: 'resourceGroup', parent: 'sub', tags: {} },
  { id: 'vm1', name: 'vm1 (VM)', kind: 'resource', parent: 'rg-prod' },
  { id: 'st1', name: 'st1 (storage account)', kind: 'resource', parent: 'rg-prod' },
]
const EXISTING: Array<{ resourceGroupId: string; resource: ResourceState }> = [
  { resourceGroupId: 'rg-prod', resource: { type: 'Microsoft.Compute/virtualMachines', name: 'vm1', location: 'westeurope', tags: { costCenter: 'CC-100' }, vmSize: 'Standard_D2s_v5' } },
  { resourceGroupId: 'rg-prod', resource: { type: 'Microsoft.Storage/storageAccounts', name: 'st1', location: 'eastus', tags: {} } },
  { resourceGroupId: 'rg-sandbox', resource: { type: 'Microsoft.Compute/virtualMachines', name: 'vm-test', location: 'westeurope', tags: { environment: 'dev' }, vmSize: 'Standard_E8s_v5' } },
]

type OpId = 'create-vm' | 'patch-tags' | 'start-vm' | 'list-keys' | 'delete-vm' | 'delete-rg' | 'read-vm'
const OPS: Record<OpId, { label: string; method: Method; target: (rg: string) => string; rg: (rg: string) => string; note: string }> = {
  'create-vm': { label: 'Create VM vm2', method: 'PUT', target: (rg) => rg, rg: (rg) => rg, note: 'PUT Microsoft.Compute/virtualMachines/vm2' },
  'patch-tags': { label: 'Update vm1 (location/size/tags below)', method: 'PATCH', target: () => 'vm1', rg: () => 'rg-prod', note: 'PATCH Microsoft.Compute/virtualMachines/vm1' },
  'start-vm': { label: 'Start vm1', method: 'POST', target: () => 'vm1', rg: () => 'rg-prod', note: 'POST …/virtualMachines/vm1/start' },
  'list-keys': { label: 'List st1 account keys', method: 'POST', target: () => 'st1', rg: () => 'rg-prod', note: 'POST …/storageAccounts/st1/listKeys' },
  'delete-vm': { label: 'Delete vm1', method: 'DELETE', target: () => 'vm1', rg: () => 'rg-prod', note: 'DELETE …/virtualMachines/vm1' },
  'delete-rg': { label: 'Delete resource group', method: 'DELETE', target: (rg) => rg, rg: (rg) => rg, note: 'DELETE …/resourceGroups/<rg>' },
  'read-vm': { label: 'Read vm1', method: 'GET', target: () => 'vm1', rg: () => 'rg-prod', note: 'GET …/virtualMachines/vm1' },
}
const REGIONS = ['westeurope', 'northeurope', 'eastus']
const SIZES = ['Standard_B2s', 'Standard_D2s_v5', 'Standard_E8s_v5']
const scopeName = (id: string) => SCOPES.find((s) => s.id === id)?.name.split(' (')[0] ?? id

interface Outcome { lock: LockResult; policy: PolicyResult; method: Method; label: string }

export default function GovernanceSimulation({ onLabCheck }: SimulationProps) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [assignments, setAssignments] = useState<PolicyAssignment[]>([])
  const [exemptions, setExemptions] = useState<PolicyExemption[]>([])
  const [locks, setLocks] = useState<ResourceLock[]>([])
  const [draftA, setDraftA] = useState({ definitionId: 'allowed-locations', scopeId: 'mg', enforcement: 'Default' as PolicyAssignment['enforcement'], excludeSandbox: false })
  const [draftL, setDraftL] = useState<{ scopeId: string; level: ResourceLock['level'] }>({ scopeId: 'rg-prod', level: 'CanNotDelete' })
  const [op, setOp] = useState<OpId>('create-vm')
  const [rg, setRg] = useState('rg-prod')
  const [location, setLocation] = useState('eastus')
  const [size, setSize] = useState('Standard_B2s')
  const [tags, setTags] = useState<{ costCenter: boolean; environment: boolean }>({ costCenter: false, environment: false })
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [scan, setScan] = useState<ReturnType<typeof complianceScan> | null>(null)

  const steps = useMemo(() => {
    if (!outcome) return ['Build a request, then send it to Azure Resource Manager']
    const s = [`${outcome.label}: ${outcome.method} sent to management.azure.com`, 'ARM authenticates the caller (Owner on the subscription) and checks RBAC: allowed']
    s.push(outcome.lock.blocked ? `Resource lock: ${outcome.lock.reason}` : `Resource locks: ${outcome.lock.reason}`)
    if (!outcome.lock.blocked) {
      if (!outcome.policy.evaluated) s.push(`Azure Policy: ${outcome.policy.reason}`)
      else if (outcome.policy.events.length === 0) s.push('Azure Policy: no assignment applies to this scope')
      else outcome.policy.events.forEach((e) => s.push(`Policy "${e.definition.name}" (${e.effect}) → ${e.outcome}: ${e.detail}`))
    }
    const ok = !outcome.lock.blocked && outcome.policy.allowed
    s.push(ok ? 'Request forwarded to the resource provider: succeeded' : `Request rejected${outcome.lock.blocked ? ' (ScopeLocked)' : ' (RequestDisallowedByPolicy)'}`)
    return s
  }, [outcome])
  const stepper = useStepper(steps.length, { baseMs: 1300 })
  useStepperKeys(ref, stepper)

  const lockIdx = 2
  const policyStart = 3
  const atPolicy = outcome && stepper.step >= policyStart && !outcome.lock.blocked
  const done = !!outcome && stepper.atEnd
  const ok = !!outcome && !outcome.lock.blocked && outcome.policy.allowed
  const packetAt = !outcome ? 0 : stepper.step <= 1 ? stepper.step : stepper.step === lockIdx ? 2 : done ? (ok ? 4 : outcome.lock.blocked ? 2 : 3) : 3
  const pts: Array<[number, number]> = [[60, 100], [210, 100], [370, 100], [530, 100], [700, 100]]

  const send = () => {
    const o = OPS[op]
    const target = o.target(rg)
    const resource: ResourceState = op === 'create-vm' || op === 'patch-tags'
      ? { type: 'Microsoft.Compute/virtualMachines', name: op === 'create-vm' ? 'vm2' : 'vm1', location, vmSize: size, tags: { ...(tags.costCenter ? { costCenter: 'CC-999' } : {}), ...(tags.environment ? { environment: 'prod' } : {}) } }
      : EXISTING.find((e) => e.resource.name === target)?.resource ?? { type: 'Microsoft.Resources/resourceGroups', name: target, location: 'westeurope', tags: {} }
    const lock = evaluateLocks(SCOPES, target, o.method, locks)
    const policy = evaluatePolicy({ scopes: SCOPES, method: o.method, resourceGroupId: o.rg(rg), resource, assignments, exemptions })
    setOutcome({ lock, policy, method: o.method, label: o.label.replace('resource group', scopeName(rg)) })
    stepper.play()
    if (!lock.blocked) {
      if (policy.events.some((e) => e.outcome === 'denied')) onLabCheck?.('policy-deny')
      if (policy.events.some((e) => e.outcome === 'modified' && e.definition.id === 'inherit-tag')) onLabCheck?.('modify-tag')
      if (policy.allowed && policy.events.some((e) => e.outcome === 'excluded' || e.outcome === 'exempted')) onLabCheck?.('exclusion')
    } else {
      // The lock sits on a resource inside the group, not on the group or its parents.
      if (op === 'delete-rg' && lock.lock && SCOPES.find((x) => x.id === lock.lock!.scopeId)?.parent === target) onLabCheck?.('rg-delete-child-lock')
      if (o.method === 'DELETE') onLabCheck?.('lock-delete-blocked')
      if (o.method === 'POST' && lock.lock?.level === 'ReadOnly') onLabCheck?.('readonly-post-blocked')
    }
  }

  const runScan = () => {
    const res = complianceScan({ scopes: SCOPES, resources: EXISTING, assignments, exemptions })
    setScan(res)
    if (res.some((r) => !r.compliant)) onLabCheck?.('compliance-scan')
  }

  const addAssignment = () => {
    const def = POLICY_DEFINITIONS.find((d) => d.id === draftA.definitionId)!
    setAssignments((a) => [...a, { id: `pa-${a.length + 1}-${def.id}`, definitionId: def.id, scopeId: draftA.scopeId, notScopes: draftA.excludeSandbox ? ['rg-sandbox'] : [], params: def.defaultParams, enforcement: draftA.enforcement }])
    setScan(null)
  }

  const gateState = (which: 'lock' | 'policy') => {
    if (!outcome) return 'neutral' as const
    if (which === 'lock') return stepper.step >= lockIdx ? (outcome.lock.blocked ? 'fail' as const : 'ok' as const) : 'neutral' as const
    if (!atPolicy) return 'neutral' as const
    return outcome.policy.allowed ? (outcome.policy.events.some((e) => e.outcome === 'audited' || e.outcome === 'not-enforced') ? 'warn' as const : 'ok' as const) : 'fail' as const
  }

  return (
    <div ref={ref} tabIndex={0} className="@container card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="Azure Policy and resource lock simulation">
      <svg viewBox="0 0 780 190" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label="Request path through Azure Resource Manager, resource locks and Azure Policy">
        <rect x={150} y={20} width={460} height={150} rx={14} fill={palette.azure} fillOpacity={0.05} stroke={palette.azure} strokeDasharray="6 4" />
        <text x={160} y={36} fontSize={11} fontWeight={600} fill={palette.azure}>Azure Resource Manager (control plane)</text>
        <Link x1={60} y1={100} x2={700} y2={100} state={done ? (ok ? 'ok' : 'fail') : undefined} />
        <UserNode x={60} y={100} label="Admin" sublabel="Owner role" />
        <ServerNode x={210} y={100} label="ARM + RBAC" sublabel="authz check" state={outcome && stepper.step >= 1 ? 'ok' : 'neutral'} />
        <FirewallNode x={370} y={100} label="Resource locks" sublabel={`${locks.length} lock(s)`} state={gateState('lock')} />
        <FirewallNode x={530} y={100} label="Azure Policy" sublabel={`${assignments.length} assignment(s)`} state={gateState('policy')} color="#7c4dcc" />
        <VmNode x={700} y={100} label="Resource provider" sublabel={outcome ? OPS[op].note.split(' ')[0] : ''} state={done ? (ok ? 'ok' : 'fail') : 'neutral'} />
        {outcome && <Packet points={pts} at={packetAt} state={done ? (ok ? 'allowed' : 'denied') : 'moving'} reduced={reduced} label={outcome.method} />}
      </svg>
      <AnimationControls stepper={stepper} stepLabels={steps} regionLabel="Governance simulation" />
      {done && outcome && (
        <div className={`border-t px-3 py-2 text-sm ${ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`} role="status">
          <Badge tone={ok ? 'allow' : 'deny'}>{ok ? 'SUCCEEDED' : 'REJECTED'}</Badge>{' '}
          {outcome.lock.blocked ? outcome.lock.reason : outcome.policy.evaluated ? outcome.policy.reason : outcome.policy.reason}
          {ok && outcome.policy.events.some((e) => e.outcome === 'modified') && <> Final tags: <code>{JSON.stringify(outcome.policy.resource.tags)}</code></>}
        </div>
      )}

      <div className="grid gap-3 border-t border-slate-200 p-3 text-sm @3xl:grid-cols-3 dark:border-slate-800">
        <fieldset className="space-y-2">
          <legend className="label">1 · Request</legend>
          <select className="input w-full" aria-label="Operation" value={op} onChange={(e) => setOp(e.target.value as OpId)}>
            {Object.entries(OPS).map(([k, v]) => <option key={k} value={k}>{v.method}: {v.label}</option>)}
          </select>
          {(op === 'create-vm' || op === 'delete-rg') && (
            <select className="input w-full" aria-label="Resource group" value={rg} onChange={(e) => setRg(e.target.value)}>
              <option value="rg-prod">rg-prod (tag costCenter=CC-100)</option><option value="rg-sandbox">rg-sandbox (no tags)</option>
            </select>
          )}
          {(op === 'create-vm' || op === 'patch-tags') && (
            <>
              <div className="flex gap-2">
                <select className="input flex-1" aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
                <select className="input flex-1" aria-label="VM size" value={size} onChange={(e) => setSize(e.target.value)}>{SIZES.map((r) => <option key={r}>{r}</option>)}</select>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={tags.costCenter} onChange={(e) => setTags({ ...tags, costCenter: e.target.checked })} /> tag costCenter=CC-999</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={tags.environment} onChange={(e) => setTags({ ...tags, environment: e.target.checked })} /> tag environment=prod</label>
              </div>
            </>
          )}
          <p className="text-xs text-slate-500 font-mono">{OPS[op].note}</p>
          <button type="button" className="btn-primary w-full" onClick={send}>Send request</button>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="label">2 · Policy assignments</legend>
          <select className="input w-full" aria-label="Policy definition" value={draftA.definitionId} onChange={(e) => setDraftA({ ...draftA, definitionId: e.target.value })}>
            {POLICY_DEFINITIONS.map((d) => <option key={d.id} value={d.id}>{d.name} [{d.effect}]</option>)}
          </select>
          <div className="flex gap-2">
            <select className="input flex-1" aria-label="Assignment scope" value={draftA.scopeId} onChange={(e) => setDraftA({ ...draftA, scopeId: e.target.value })}>
              {SCOPES.filter((s) => s.kind !== 'resource').map((s) => <option key={s.id} value={s.id}>{scopeName(s.id)}</option>)}
            </select>
            <select className="input flex-1" aria-label="Enforcement mode" value={draftA.enforcement} onChange={(e) => setDraftA({ ...draftA, enforcement: e.target.value as PolicyAssignment['enforcement'] })}>
              <option value="Default">Enforced</option><option value="DoNotEnforce">DoNotEnforce</option>
            </select>
          </div>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draftA.excludeSandbox} onChange={(e) => setDraftA({ ...draftA, excludeSandbox: e.target.checked })} /> Exclude rg-sandbox (notScopes)</label>
          <p className="text-xs text-slate-500">{POLICY_DEFINITIONS.find((d) => d.id === draftA.definitionId)?.description} Parameter: {POLICY_DEFINITIONS.find((d) => d.id === draftA.definitionId)?.defaultParams.join(', ')}</p>
          <button type="button" className="btn-primary w-full" onClick={addAssignment}>Assign policy</button>
          <ul className="space-y-1 text-xs">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center gap-1">
                <span className="flex-1">{POLICY_DEFINITIONS.find((d) => d.id === a.definitionId)?.name} @ {scopeName(a.scopeId)}{a.enforcement === 'DoNotEnforce' ? ' (DoNotEnforce)' : ''}{a.notScopes.length ? ' excl. rg-sandbox' : ''}{exemptions.some((x) => x.assignmentId === a.id) ? ' · exempt: rg-sandbox' : ''}</span>
                {!exemptions.some((x) => x.assignmentId === a.id) && <button type="button" className="text-sky-700 underline dark:text-sky-400" onClick={() => setExemptions((x) => [...x, { id: `ex-${a.id}`, assignmentId: a.id, scopeId: 'rg-sandbox', category: 'Waiver' }])}>exempt sandbox</button>}
                <button type="button" className="text-red-600" aria-label={`Remove assignment ${a.id}`} onClick={() => { setAssignments((x) => x.filter((y) => y.id !== a.id)); setExemptions((x) => x.filter((y) => y.assignmentId !== a.id)); setScan(null) }}>✕</button>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="label">3 · Resource locks</legend>
          <div className="flex gap-2">
            <select className="input flex-1" aria-label="Lock scope" value={draftL.scopeId} onChange={(e) => setDraftL({ ...draftL, scopeId: e.target.value })}>
              {SCOPES.filter((s) => s.kind !== 'managementGroup').map((s) => <option key={s.id} value={s.id}>{scopeName(s.id)}</option>)}
            </select>
            <select className="input flex-1" aria-label="Lock level" value={draftL.level} onChange={(e) => setDraftL({ ...draftL, level: e.target.value as ResourceLock['level'] })}>
              <option value="CanNotDelete">CanNotDelete (Delete)</option><option value="ReadOnly">ReadOnly</option>
            </select>
          </div>
          <button type="button" className="btn-primary w-full" onClick={() => setLocks((l) => [...l.filter((x) => x.scopeId !== draftL.scopeId || x.level !== draftL.level), { id: `lk-${Date.now()}`, ...draftL }])}>Add lock</button>
          <ul className="space-y-1 text-xs">
            {locks.map((l) => (
              <li key={l.id} className="flex items-center gap-1"><span className="flex-1">🔒 {l.level} on {scopeName(l.scopeId)}</span>
                <button type="button" className="text-red-600" aria-label={`Remove ${l.level} lock on ${scopeName(l.scopeId)}`} onClick={() => setLocks((x) => x.filter((y) => y.id !== l.id))}>✕</button></li>
            ))}
          </ul>
          <p className="label pt-1">Scenarios</p>
          <button type="button" className="btn-ghost w-full justify-start" onClick={() => { setLocks([{ id: 'lk-st1', scopeId: 'st1', level: 'CanNotDelete' }]); setOp('delete-rg'); setRg('rg-prod') }}>Delete RG that contains a locked resource</button>
          <button type="button" className="btn-ghost w-full justify-start" onClick={() => { setLocks([{ id: 'lk-rg', scopeId: 'rg-prod', level: 'ReadOnly' }]); setOp('list-keys') }}>ReadOnly lock vs. listing storage keys</button>
          <button type="button" className="btn-ghost w-full justify-start" onClick={() => { setAssignments([{ id: 'pa-req', definitionId: 'require-tag', scopeId: 'sub', notScopes: [], params: ['costCenter'], enforcement: 'Default' }, { id: 'pa-inh', definitionId: 'inherit-tag', scopeId: 'sub', notScopes: [], params: ['costCenter'], enforcement: 'Default' }]); setOp('create-vm'); setLocation('westeurope'); setTags({ costCenter: false, environment: false }); setScan(null) }}>Require + inherit costCenter tag</button>
        </fieldset>
      </div>

      <div className="border-t border-slate-200 p-3 text-sm dark:border-slate-800">
        <div className="mb-2 flex items-center gap-2">
          <h4 className="font-semibold">Existing resources: compliance</h4>
          <button type="button" className="btn-ghost ml-auto" onClick={runScan}>Run compliance scan</button>
        </div>
        {!scan ? <p className="text-xs text-slate-500">New assignments never change or delete existing resources. Azure evaluates them in a compliance scan, which starts shortly after the assignment takes effect, repeats every 24 hours, and can be triggered on demand.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500"><th>Resource</th><th>RG</th><th>Location</th><th>Tags</th><th>Result</th></tr></thead>
              <tbody>
                {scan.map((r) => (
                  <tr key={r.resource.name} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 font-mono">{r.resource.name}</td><td>{r.resourceGroupId}</td><td>{r.resource.location}</td><td className="font-mono">{JSON.stringify(r.resource.tags)}</td>
                    <td>{r.results.length === 0 ? <Badge tone="muted">no assignments</Badge> : r.results.map((x) => (
                      <span key={x.assignmentId} className="mr-1 inline-block"><Badge tone={x.state === 'non-compliant' ? 'deny' : x.state === 'compliant' ? 'allow' : 'muted'}>{x.definition}: {x.state}{x.remediable ? ' (remediation task can fix)' : ''}</Badge></span>
                    ))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="accurate-model">Implements documented Policy effect order (Disabled → Modify/Append → Deny → Audit), scope inheritance, notScopes, exemptions, DoNotEnforce, and lock semantics (inheritance, ReadOnly blocking POST, child locks blocking RG deletion). RBAC is assumed to pass (the caller is Owner). AuditIfNotExists, DeployIfNotExists and DenyAction are not modelled, and the order between the lock check and Policy is illustrative.</FidelityNote>
        <details className="mt-1 text-xs"><summary className="cursor-pointer text-slate-500">Text transcript</summary>
          <ol className="ml-5 list-decimal">{steps.map((t, i) => <li key={i} className={i === stepper.step ? 'font-semibold' : ''}>{t}</li>)}</ol>
        </details>
      </div>
    </div>
  )
}
