import { useState } from 'react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/useStepper'
import { DIRECTORY_CHANGE_EFFECTS, MAX_MG_DEPTH, canCreateManagementGroup, depthOf, inheritedAssignments, moveSubscription, planResourceMove, type AzResource, type MgNode, type MovePlan } from '../simulations/hierarchy'
import { Badge, FidelityNote, palette } from './primitives'
import type { SimulationProps } from './types'

const INITIAL_TREE: MgNode[] = [
  { id: 'root', name: 'Tenant Root Group', kind: 'managementGroup', parent: null, assigned: ['Policy: Allowed locations'] },
  { id: 'platform', name: 'Platform', kind: 'managementGroup', parent: 'root', assigned: ['RBAC: Network team → Network Contributor'] },
  { id: 'lz', name: 'Landing zones', kind: 'managementGroup', parent: 'root', assigned: ['Policy: Require costCenter tag'] },
  { id: 'prod', name: 'Prod', kind: 'managementGroup', parent: 'lz', assigned: ['Policy: Deny public IPs'] },
  { id: 'sandbox', name: 'Sandbox', kind: 'managementGroup', parent: 'root', assigned: ['RBAC: Developers → Contributor'] },
  { id: 'sub-conn', name: 'sub-connectivity', kind: 'subscription', parent: 'platform', assigned: [] },
  { id: 'sub-app1', name: 'sub-app1', kind: 'subscription', parent: 'sandbox', assigned: [] },
  { id: 'sub-app2', name: 'sub-app2', kind: 'subscription', parent: 'prod', assigned: [] },
]

const RESOURCES: AzResource[] = [
  { id: 'vm', name: 'vm-web', type: 'Microsoft.Compute/virtualMachines', resourceGroup: 'rg-app', subscription: 'sub-app1', location: 'westeurope', dependsOn: ['disk', 'nic'], movable: true, directRoleAssignments: 1 },
  { id: 'disk', name: 'vm-web-osdisk', type: 'Microsoft.Compute/disks', resourceGroup: 'rg-app', subscription: 'sub-app1', location: 'westeurope', dependsOn: [], movable: true, directRoleAssignments: 0 },
  { id: 'nic', name: 'vm-web-nic', type: 'Microsoft.Network/networkInterfaces', resourceGroup: 'rg-app', subscription: 'sub-app1', location: 'westeurope', dependsOn: [], movable: true, directRoleAssignments: 0 },
  { id: 'st', name: 'stappdata', type: 'Microsoft.Storage/storageAccounts', resourceGroup: 'rg-app', subscription: 'sub-app1', location: 'westeurope', dependsOn: [], movable: true, directRoleAssignments: 2 },
  { id: 'aks', name: 'aks-app', type: 'Microsoft.ContainerService/managedClusters', resourceGroup: 'rg-app', subscription: 'sub-app1', location: 'westeurope', dependsOn: [], movable: false, directRoleAssignments: 0 },
]

type Tab = 'mg' | 'move' | 'sub'

export default function HierarchySimulation({ onLabCheck }: SimulationProps) {
  const reduced = usePrefersReducedMotion()
  const [tab, setTab] = useState<Tab>('mg')
  const [tree, setTree] = useState(INITIAL_TREE)
  const [selSub, setSelSub] = useState('sub-app1')
  const [target, setTarget] = useState('prod')
  const [perms, setPerms] = useState({ ownerOnSubscription: true, writeOnTargetMg: true, writeOnCurrentParentMg: false })
  const [moveMsg, setMoveMsg] = useState<{ ok: boolean; lines: string[]; before?: string[]; after?: string[] } | null>(null)
  const [newMgParent, setNewMgParent] = useState('prod')
  const [selected, setSelected] = useState<string[]>(['vm'])
  const [destRg, setDestRg] = useState('rg-app-prod')
  const [destSub, setDestSub] = useState('sub-app1')
  const [plan, setPlan] = useState<MovePlan | null>(null)
  const [dirChange, setDirChange] = useState(false)

  // Layout: assign x by in-order position of leaves, y by depth.
  const mgs = tree
  const order: string[] = []
  const walk = (id: string) => { order.push(id); mgs.filter((n) => n.parent === id).forEach((c) => walk(c.id)) }
  walk('root')
  const leaves = order.filter((id) => !mgs.some((n) => n.parent === id))
  const pos = new Map<string, { x: number; y: number }>()
  const place = (id: string): number => {
    const kids = mgs.filter((n) => n.parent === id)
    const x = kids.length ? kids.map((k) => place(k.id)).reduce((a, b) => a + b, 0) / kids.length : 70 + leaves.indexOf(id) * (680 / Math.max(1, leaves.length - 1 || 1))
    pos.set(id, { x, y: 30 + depthOf(mgs, id) * 62 })
    return x
  }
  place('root')
  const maxDepth = Math.max(...mgs.map((n) => depthOf(mgs, n.id)))
  const height = 70 + maxDepth * 62

  const doMove = () => {
    const r = moveSubscription(tree, selSub, target, perms)
    if (!r.ok) { setMoveMsg({ ok: false, lines: r.errors }); return }
    setTree(r.tree)
    setMoveMsg({ ok: true, lines: [`${tree.find((n) => n.id === selSub)?.name} moved to ${tree.find((n) => n.id === target)?.name}. Inherited assignments changed immediately.`], before: r.before.map((b) => `${b.item} (from ${b.from})`), after: r.after.map((b) => `${b.item} (from ${b.from})`) })
    onLabCheck?.('moved-subscription')
  }

  const addMg = () => {
    const r = canCreateManagementGroup(tree, newMgParent)
    if (!r.ok) { setMoveMsg({ ok: false, lines: [r.reason] }); onLabCheck?.('depth-limit'); return }
    const id = `mg-${tree.length}`
    setTree([...tree, { id, name: `MG L${depthOf(tree, newMgParent) + 1}`, kind: 'managementGroup', parent: newMgParent, assigned: [] }])
    setNewMgParent(id)
    setMoveMsg({ ok: true, lines: [r.reason] })
  }

  const validateMove = () => {
    const p = planResourceMove(RESOURCES, selected, { resourceGroup: destRg, subscription: destSub })
    setPlan(p)
    if (!p.ok) onLabCheck?.('move-validation-failed')
    if (p.ok && p.warnings.some((w) => w.includes('role assignment'))) onLabCheck?.('move-orphaned-roles')
  }

  const subs = tree.filter((n) => n.kind === 'subscription')
  const mgOptions = tree.filter((n) => n.kind === 'managementGroup')

  return (
    <div className="@container card overflow-hidden">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
        {([['mg', 'Management groups'], ['move', 'Move resources'], ['sub', 'Subscription directory']] as const).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>

      {tab === 'mg' && (
        <>
          <svg viewBox={`0 0 820 ${height}`} className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label="Management group hierarchy">
            {mgs.filter((n) => n.parent).map((n) => {
              const a = pos.get(n.parent!)!; const b = pos.get(n.id)!
              return <motion.line key={`l-${n.id}`} initial={false} animate={{ x1: a.x, y1: a.y + 14, x2: b.x, y2: b.y - 14 }} transition={reduced ? { duration: 0 } : { duration: 0.5 }} stroke={palette.muted} strokeWidth={1.5} />
            })}
            {mgs.map((n) => {
              const p = pos.get(n.id)!
              const isSub = n.kind === 'subscription'
              const selectedNode = n.id === selSub || n.id === target
              return (
                <motion.g key={n.id} initial={false} animate={{ x: p.x, y: p.y }} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 15 }}
                  onClick={() => (isSub ? setSelSub(n.id) : setTarget(n.id))} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label={`${isSub ? 'Select subscription' : 'Select target management group'} ${n.name}`}
                  onKeyDown={(e) => { if (e.key === 'Enter') (isSub ? setSelSub(n.id) : setTarget(n.id)) }}>
                  <rect x={-62} y={-14} width={124} height={28} rx={isSub ? 4 : 14} fill={isSub ? '#e88a00' : palette.azure} fillOpacity={0.12} stroke={selectedNode ? '#0f172a' : isSub ? '#e88a00' : palette.azure} strokeWidth={selectedNode ? 2.5 : 1.5} />
                  <text y={4} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="currentColor">{n.name}</text>
                  {!isSub && <text y={24} textAnchor="middle" fontSize={8.5} fill={palette.muted}>level {depthOf(mgs, n.id)}</text>}
                </motion.g>
              )
            })}
          </svg>
          <div className="grid gap-3 border-t border-slate-200 p-3 text-sm @3xl:grid-cols-3 dark:border-slate-800">
            <fieldset className="space-y-2">
              <legend className="label">Move a subscription (click nodes to select)</legend>
              <select className="input w-full" aria-label="Subscription" value={selSub} onChange={(e) => setSelSub(e.target.value)}>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select className="input w-full" aria-label="Target management group" value={target} onChange={(e) => setTarget(e.target.value)}>{mgOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={perms.ownerOnSubscription} onChange={(e) => setPerms({ ...perms, ownerOnSubscription: e.target.checked })} /> I am Owner of the subscription</label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={perms.writeOnTargetMg} onChange={(e) => setPerms({ ...perms, writeOnTargetMg: e.target.checked })} /> MG write on target</label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={perms.writeOnCurrentParentMg} onChange={(e) => setPerms({ ...perms, writeOnCurrentParentMg: e.target.checked })} /> MG write on current parent</label>
              <button type="button" className="btn-primary w-full" onClick={doMove}>Move subscription</button>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">Create a management group (max {MAX_MG_DEPTH} levels)</legend>
              <select className="input w-full" aria-label="Parent management group" value={newMgParent} onChange={(e) => setNewMgParent(e.target.value)}>{mgOptions.map((s) => <option key={s.id} value={s.id}>{s.name} (level {depthOf(tree, s.id)})</option>)}</select>
              <button type="button" className="btn-primary w-full" onClick={addMg}>Create child management group</button>
              <button type="button" className="btn-ghost w-full" onClick={() => { setTree(INITIAL_TREE); setMoveMsg(null) }}>Reset hierarchy</button>
            </fieldset>
            <div className="space-y-1" aria-live="polite">
              <p className="label">Inherited by {tree.find((n) => n.id === selSub)?.name}</p>
              <ul className="text-xs">{inheritedAssignments(tree, selSub).map((a) => <li key={a.item}>• {a.item} <span className="text-slate-500">from {a.from}</span></li>)}</ul>
              {moveMsg && (
                <div role="status" className={`mt-2 rounded border p-2 text-xs ${moveMsg.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}>
                  <Badge tone={moveMsg.ok ? 'allow' : 'deny'}>{moveMsg.ok ? 'OK' : 'FAILED'}</Badge> {moveMsg.lines.join(' ')}
                  {moveMsg.before && <p className="mt-1">Before: {moveMsg.before.join('; ')}<br />After: {moveMsg.after!.join('; ')}</p>}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'move' && (
        <div className="grid gap-3 p-3 text-sm @3xl:grid-cols-2">
          <fieldset className="space-y-1">
            <legend className="label">Resources in sub-app1 / rg-app (select what to move)</legend>
            {RESOURCES.map((r) => (
              <label key={r.id} className="flex items-center gap-2">
                <input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))} />
                <span className="font-mono">{r.name}</span><span className="text-xs text-slate-500">{r.type.split('/').slice(-1)[0]}{r.dependsOn.length ? ` · depends on ${r.dependsOn.map((d) => RESOURCES.find((x) => x.id === d)?.name).join(', ')}` : ''}{r.directRoleAssignments ? ` · ${r.directRoleAssignments} direct role assignment(s)` : ''}</span>
              </label>
            ))}
            <div className="flex gap-2 pt-2">
              <select className="input flex-1" aria-label="Destination subscription" value={destSub} onChange={(e) => setDestSub(e.target.value)}><option value="sub-app1">sub-app1 (same)</option><option value="sub-app2">sub-app2</option></select>
              <select className="input flex-1" aria-label="Destination resource group" value={destRg} onChange={(e) => setDestRg(e.target.value)}><option value="rg-app-prod">rg-app-prod</option><option value="rg-app">rg-app</option></select>
            </div>
            <button type="button" className="btn-primary w-full" onClick={validateMove}>Validate and move</button>
          </fieldset>
          <div aria-live="polite">
            {!plan ? <p className="text-xs text-slate-500">The portal validates a move before it starts. Try moving only the VM, the AKS cluster, or the VM with its disk and NIC.</p> : (
              <div role="status" className={`rounded border p-2 text-xs ${plan.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}>
                <Badge tone={plan.ok ? 'allow' : 'deny'}>{plan.ok ? 'MOVE SUCCEEDED' : 'VALIDATION FAILED'}</Badge>
                <ul className="mt-1 ml-4 list-disc">{plan.errors.map((e) => <li key={e}>{e}</li>)}{plan.warnings.map((w) => <li key={w} className="text-amber-800 dark:text-amber-300">{w}</li>)}</ul>
                {plan.ok && <><p className="mt-1 font-semibold">Resource IDs change:</p><ul className="font-mono">{plan.newIds.map((n) => <li key={n.from}>{n.from} → {n.to}</li>)}</ul></>}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'sub' && (
        <div className="space-y-2 p-3 text-sm">
          <p>A subscription trusts exactly one Microsoft Entra tenant. You can transfer billing ownership, or move the subscription to a different directory (Subscriptions → Change directory). The two are different operations.</p>
          <button type="button" className="btn-primary" onClick={() => { setDirChange(true); onLabCheck?.('directory-change') }}>Simulate: change directory of sub-app1</button>
          {dirChange && (
            <div role="status" className="rounded border border-amber-300 bg-amber-50 p-2 text-xs dark:bg-amber-950/30">
              <p className="font-semibold">Consequences</p>
              <ul className="ml-4 list-disc">{DIRECTORY_CHANGE_EFFECTS.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="accurate-model">Implements the documented six-level depth limit, subscription-move permission checks, inheritance changes, and resource-move rules (dependents, unsupported types, IDs change, region unchanged, direct role assignments not moved). Move support per resource type is illustrative: check the official move-support table.</FidelityNote>
      </div>
    </div>
  )
}
