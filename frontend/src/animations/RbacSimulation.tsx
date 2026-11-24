import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AnimationControls, useStepperKeys } from '../components/AnimationControls'
import { usePrefersReducedMotion, useStepper } from '../hooks/useStepper'
import { BUILT_IN_ROLES, checkAccess, type AccessCheck, type DenyAssignment, type Principal, type RoleAssignment, type Scope } from '../simulations/rbac'
import { Badge, FidelityNote, ScopeBox, UserNode, palette } from './primitives'
import type { SimulationProps } from './types'

const SCOPES: Scope[] = [
  { id: 'mg', name: 'MG: Contoso', kind: 'managementGroup', parent: null },
  { id: 'sub', name: 'Sub: Prod', kind: 'subscription', parent: 'mg' },
  { id: 'rg', name: 'RG: rg-web', kind: 'resourceGroup', parent: 'sub' },
  { id: 'vm', name: 'VM: vm-web-01', kind: 'resource', parent: 'rg' },
]
const PRINCIPALS: Principal[] = [
  { id: 'ana', name: 'Ana', kind: 'user', memberOf: ['ops'] },
  { id: 'ops', name: 'Ops team (group)', kind: 'group', memberOf: [] },
  { id: 'ci', name: 'CI pipeline (service principal)', kind: 'servicePrincipal', memberOf: [] },
]
const OPERATIONS = [
  { op: 'Microsoft.Compute/virtualMachines/read', label: 'Read VM' },
  { op: 'Microsoft.Compute/virtualMachines/restart/action', label: 'Restart VM' },
  { op: 'Microsoft.Compute/virtualMachines/delete', label: 'Delete VM' },
  { op: 'Microsoft.Network/virtualNetworks/write', label: 'Modify VNet' },
  { op: 'Microsoft.Authorization/roleAssignments/write', label: 'Create role assignment' },
]
const BOX = { mg: { x: 20, y: 20, w: 560, h: 300 }, sub: { x: 45, y: 50, w: 510, h: 255 }, rg: { x: 70, y: 82, w: 460, h: 208 }, vm: { x: 100, y: 120, w: 200, h: 150 } } as const

export default function RbacSimulation({ onLabCheck }: SimulationProps) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [assignments, setAssignments] = useState<RoleAssignment[]>([])
  const [denies, setDenies] = useState<DenyAssignment[]>([])
  const [draft, setDraft] = useState({ principalId: 'ops', role: 'Virtual Machine Contributor', scopeId: 'sub' })
  const [who, setWho] = useState('ana')
  const [target, setTarget] = useState('vm')
  const [op, setOp] = useState(OPERATIONS[1]!.op)
  const [check, setCheck] = useState<AccessCheck | null>(null)

  // Timeline: request starts at target, walks up each ancestor, then the decision.
  const steps = useMemo(() => {
    if (!check) return ['Assign roles, then evaluate a request']
    return [
      `Request: ${OPERATIONS.find((o) => o.op === op)?.label} on ${SCOPES.find((s) => s.id === target)?.name}`,
      ...check.path.map((s) => {
        const here = check.matchingAssignments.filter((m) => m.assignment.scopeId === s.id)
        return here.length ? `${s.name}: ${here.map((m) => `${m.assignment.role} (${m.via})${m.grants ? ' ✓ grants' : ' ✗ does not grant'}`).join('; ')}` : `${s.name}: no assignment for this principal or its groups`
      }),
      check.deniedBy ? 'Deny assignment found in scope path' : 'Union of all applicable role permissions computed',
      `${check.allowed ? 'ALLOWED' : 'DENIED'}: ${check.reason}`,
    ]
  }, [check, op, target])
  const stepper = useStepper(steps.length, { baseMs: 1200 })
  useStepperKeys(ref, stepper)
  const visitingIdx = check ? stepper.step - 1 : -1
  const visiting = check?.path[visitingIdx]?.id
  const done = !!check && stepper.atEnd

  const evaluate = (nextAssignments = assignments) => {
    const res = checkAccess({ scopes: SCOPES, principals: PRINCIPALS, assignments: nextAssignments, denyAssignments: denies, principalId: who, scopeId: target, operation: op })
    setCheck(res)
    stepper.play()
    if (res.allowed && res.matchingAssignments.some((m) => m.grants && m.inherited)) onLabCheck?.('inherited-allow')
    if (!res.allowed && /NotActions/.test(res.reason) && res.matchingAssignments.some((m) => m.assignment.role === 'Contributor')) onLabCheck?.('notactions-block')
  }

  const removeAssignment = (id: string) => {
    const next = assignments.filter((a) => a.id !== id)
    setAssignments(next)
    const anaHeavy = next.some((a) => a.principalId === 'ana' && ['Owner', 'Contributor'].includes(a.role))
    if (!anaHeavy && next.some((a) => a.principalId === 'ops' && a.role === 'Virtual Machine Contributor')) onLabCheck?.('least-privilege')
  }

  const nameOf = (id: string) => PRINCIPALS.find((p) => p.id === id)?.name ?? id
  const scopeState = (id: string) => {
    if (!check) return undefined
    if (done && id === target) return check.allowed ? ('ok' as const) : ('fail' as const)
    if (visiting === id) return 'warn' as const
    return undefined
  }

  return (
    <div ref={ref} tabIndex={0} className="@container card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="RBAC scope simulation. Arrow keys step, space plays.">
      <div className="grid @4xl:grid-cols-[1fr_330px]">
        <div className="min-w-0">
          <svg viewBox="0 0 760 340" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label="Scope hierarchy with role assignments">
            {(['mg', 'sub', 'rg', 'vm'] as const).map((id) => {
              const s = SCOPES.find((x) => x.id === id)!
              const b = BOX[id]
              const here = assignments.filter((a) => a.scopeId === id)
              return (
                <ScopeBox key={id} {...b} label={s.name} state={scopeState(id)} color={id === 'vm' ? palette.azure : '#4f46e5'}>
                  {here.map((a, i) => (
                    <g key={a.id} transform={`translate(${b.x + b.w - 175},${b.y + 6 + i * 16})`}>
                      <rect width={170} height={14} rx={3} fill={palette.azure} fillOpacity={0.12} />
                      <text x={4} y={10.5} fontSize={9.5} fill="currentColor">{a.role} → {nameOf(a.principalId).split(' (')[0]}</text>
                    </g>
                  ))}
                  {denies.filter((d) => d.scopeId === id).map((d) => (
                    <text key={d.id} x={b.x + 10} y={b.y + b.h - 8} fontSize={9.5} fill={palette.deny}>⛔ deny assignment: {d.actions.join(', ')} ({d.source})</text>
                  ))}
                </ScopeBox>
              )
            })}
            <text x={200} y={200} textAnchor="middle" fontSize={10} fill={palette.muted}>Inheritance flows down ↓</text>
            <UserNode x={680} y={110} label={nameOf(who).split(' (')[0]} sublabel={who === 'ana' ? 'member of Ops team' : PRINCIPALS.find((p) => p.id === who)?.kind} />
            {check && (
              <motion.circle r={9} fill={done ? (check.allowed ? palette.allow : palette.deny) : palette.warn} initial={false}
                animate={(() => {
                  const id = visiting ?? target
                  const b = BOX[id as keyof typeof BOX]
                  return { cx: b.x + b.w - 14, cy: b.y + b.h - 14 }
                })()}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 15 }} />
            )}
          </svg>
          <AnimationControls stepper={stepper} stepLabels={steps} regionLabel="RBAC simulation" />
          {done && check && (
            <div className={`border-t px-3 py-2 text-sm ${check.allowed ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`} role="status">
              <Badge tone={check.allowed ? 'allow' : 'deny'}>{check.allowed ? 'ALLOWED' : 'DENIED'}</Badge> {check.reason}
            </div>
          )}
        </div>
        <aside className="grid content-start gap-3 border-t border-slate-200 p-3 text-sm @xl:grid-cols-2 @4xl:grid-cols-1 @4xl:border-t-0 @4xl:border-l dark:border-slate-800">
          <fieldset className="space-y-2">
            <legend className="label">Add role assignment</legend>
            <select className="input w-full" aria-label="Principal" value={draft.principalId} onChange={(e) => setDraft({ ...draft, principalId: e.target.value })}>
              {PRINCIPALS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="input w-full" aria-label="Role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              {Object.keys(BUILT_IN_ROLES).map((r) => <option key={r}>{r}</option>)}
            </select>
            <select className="input w-full" aria-label="Scope" value={draft.scopeId} onChange={(e) => setDraft({ ...draft, scopeId: e.target.value })}>
              {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="text-xs text-slate-500">{BUILT_IN_ROLES[draft.role]?.description}</p>
            <button type="button" className="btn-primary w-full" onClick={() => setAssignments((a) => a.some((x) => x.principalId === draft.principalId && x.role === draft.role && x.scopeId === draft.scopeId) ? a : [...a, { id: `ra-${Date.now()}`, ...draft }])}>Assign</button>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="label">Current assignments</legend>
            {assignments.length === 0 && <p className="text-xs text-slate-500">None.</p>}
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                <span>{a.role} → {nameOf(a.principalId)} @ {SCOPES.find((s) => s.id === a.scopeId)?.name}</span>
                <button type="button" className="text-red-600" aria-label={`Remove ${a.role} for ${nameOf(a.principalId)}`} onClick={() => removeAssignment(a.id)}>✕</button>
              </div>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="label">Evaluate a request</legend>
            <select className="input w-full" aria-label="Requesting principal" value={who} onChange={(e) => setWho(e.target.value)}>
              {PRINCIPALS.filter((p) => p.kind !== 'group').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="input w-full" aria-label="Operation" value={op} onChange={(e) => setOp(e.target.value)}>
              {OPERATIONS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
            </select>
            <select className="input w-full" aria-label="Target scope" value={target} onChange={(e) => setTarget(e.target.value)}>
              {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" className="btn-primary w-full" onClick={() => evaluate()}>Check access</button>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="label">Failure injection</legend>
            <button type="button" className="btn-ghost w-full justify-start" onClick={() => setDenies((d) => d.length ? [] : [{ id: 'deny-stack', actions: ['*/delete'], scopeId: 'rg', excludedPrincipalIds: [], source: 'deployment stack' }])}>
              {denies.length ? 'Remove' : 'Add'} deny assignment on rg-web
            </button>
            <button type="button" className="btn-ghost w-full justify-start" onClick={() => setAssignments([])}>Clear all assignments</button>
          </fieldset>
        </aside>
      </div>
      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="accurate-model">Models additive RBAC, downward inheritance, group membership, NotActions and deny assignments. Role definitions show the main Actions/NotActions only; data actions and conditions are not modelled.</FidelityNote>
        <details className="mt-1 text-xs"><summary className="cursor-pointer text-slate-500">Text transcript</summary>
          <ol className="ml-5 list-decimal">{steps.map((t, i) => <li key={i} className={i === stepper.step ? 'font-semibold' : ''}>{t}</li>)}</ol>
        </details>
      </div>
    </div>
  )
}
