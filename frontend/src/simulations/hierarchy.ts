/**
 * Management groups, subscriptions and resource groups.
 * https://learn.microsoft.com/azure/governance/management-groups/overview
 * https://learn.microsoft.com/azure/azure-resource-manager/management/move-resource-group-and-subscription
 *
 * Modelled behaviour:
 *  - One root management group per tenant. Management groups support up to six levels of depth,
 *    not counting the root level or the subscription level. Every MG and subscription has one parent.
 *  - Moving a subscription needs: write + role-assignment write on the subscription (Owner),
 *    and management group write on the target parent and on the current parent MG
 *    (Owner, Contributor or Management Group Contributor). The root MG needs no check as the current parent.
 *  - Policy and RBAC assignments made at management groups are inherited by everything below,
 *    so moving a subscription changes what it inherits immediately.
 *  - Resource moves: the resource keeps its region, its resource ID changes, source and target
 *    resource groups are locked for write/delete during the move, dependent resources must move
 *    together, some types cannot be moved, and role assignments made directly on a resource are
 *    not moved with it.
 */

export interface MgNode {
  id: string
  name: string
  kind: 'managementGroup' | 'subscription'
  parent: string | null
  /** Policies / roles assigned directly at this node (display only). */
  assigned: string[]
}

export const MAX_MG_DEPTH = 6

/** Depth below the root MG: root = 0, its children = 1, … */
export function depthOf(tree: MgNode[], id: string): number {
  let d = 0
  let cur = tree.find((n) => n.id === id)
  while (cur?.parent) {
    d++
    cur = tree.find((n) => n.id === cur!.parent)
  }
  return d
}

export function canCreateManagementGroup(tree: MgNode[], parentId: string): { ok: boolean; reason: string } {
  const parent = tree.find((n) => n.id === parentId)
  if (!parent || parent.kind !== 'managementGroup') return { ok: false, reason: 'A management group can only be created under another management group.' }
  const depth = depthOf(tree, parentId) + 1
  return depth > MAX_MG_DEPTH
    ? { ok: false, reason: `That would be level ${depth}; management groups support at most ${MAX_MG_DEPTH} levels below the root.` }
    : { ok: true, reason: `Created at level ${depth} of ${MAX_MG_DEPTH}.` }
}

export function inheritedAssignments(tree: MgNode[], id: string): Array<{ from: string; item: string }> {
  const out: Array<{ from: string; item: string }> = []
  let cur = tree.find((n) => n.id === id)
  while (cur) {
    for (const item of cur.assigned) out.push({ from: cur.name, item })
    cur = cur.parent ? tree.find((n) => n.id === cur!.parent) : undefined
  }
  return out
}

export interface MovePermissions {
  ownerOnSubscription: boolean
  writeOnTargetMg: boolean
  writeOnCurrentParentMg: boolean
}

export function moveSubscription(tree: MgNode[], subId: string, targetMgId: string, perms: MovePermissions) {
  const sub = tree.find((n) => n.id === subId)
  const target = tree.find((n) => n.id === targetMgId)
  const errors: string[] = []
  if (!sub || sub.kind !== 'subscription') errors.push('Select a subscription.')
  if (!target || target.kind !== 'managementGroup') errors.push('The target must be a management group.')
  if (sub && sub.parent === targetMgId) errors.push('The subscription is already in that management group.')
  if (!perms.ownerOnSubscription) errors.push('Missing Owner (write and role-assignment write) on the subscription.')
  if (!perms.writeOnTargetMg) errors.push('Missing management group write on the target parent (Owner, Contributor or Management Group Contributor).')
  const currentParent = tree.find((n) => n.id === sub?.parent)
  if (currentParent && currentParent.parent !== null && !perms.writeOnCurrentParentMg) errors.push(`Missing management group write on the current parent "${currentParent.name}".`)
  if (errors.length || !sub) return { ok: false as const, errors, tree, before: [], after: [] }
  const next = tree.map((n) => (n.id === subId ? { ...n, parent: targetMgId } : n))
  return { ok: true as const, errors: [], tree: next, before: inheritedAssignments(tree, subId), after: inheritedAssignments(next, subId) }
}

export interface AzResource {
  id: string
  name: string
  type: string
  resourceGroup: string
  subscription: string
  location: string
  dependsOn: string[]
  movable: boolean
  directRoleAssignments: number
}

export interface MovePlan {
  ok: boolean
  errors: string[]
  warnings: string[]
  newIds: Array<{ from: string; to: string }>
}

export function planResourceMove(all: AzResource[], selected: string[], target: { resourceGroup: string; subscription: string }): MovePlan {
  const errors: string[] = []
  const warnings: string[] = []
  const chosen = all.filter((r) => selected.includes(r.id))
  if (chosen.length === 0) errors.push('Select at least one resource.')
  const sources = new Set(chosen.map((r) => `${r.subscription}/${r.resourceGroup}`))
  if (sources.size > 1) errors.push('All resources in one move must come from the same source resource group.')
  for (const r of chosen) {
    if (r.resourceGroup === target.resourceGroup && r.subscription === target.subscription) errors.push(`${r.name} is already in the target resource group.`)
    if (!r.movable) errors.push(`${r.name} (${r.type}) does not support being moved; redeploy it in the target instead.`)
    for (const dep of r.dependsOn) {
      if (!selected.includes(dep)) {
        const d = all.find((x) => x.id === dep)
        errors.push(`${r.name} depends on ${d?.name ?? dep}, which must be moved in the same operation.`)
      }
    }
    if (r.directRoleAssignments > 0) warnings.push(`${r.directRoleAssignments} role assignment(s) made directly on ${r.name} are not moved and must be re-created.`)
  }
  if (!errors.length) {
    warnings.push('Resources keep their region; use Azure Resource Mover or redeployment to change region.')
    warnings.push('Source and target resource groups are locked for write and delete operations until the move completes; the resources keep running.')
    if (chosen.some((r) => r.subscription !== target.subscription)) warnings.push('Cross-subscription move: the target subscription must be in the same Microsoft Entra tenant and have the resource providers registered.')
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    newIds: chosen.map((r) => ({ from: `/subscriptions/${r.subscription}/resourceGroups/${r.resourceGroup}/…/${r.name}`, to: `/subscriptions/${target.subscription}/resourceGroups/${target.resourceGroup}/…/${r.name}` })),
  }
}

/** What happens when a subscription is moved to a different Microsoft Entra directory. */
export const DIRECTORY_CHANGE_EFFECTS = [
  'All Azure role assignments in the subscription are permanently deleted.',
  'System- and user-assigned managed identities must be disabled and re-enabled or re-created.',
  'Key vaults keep the old tenant ID and need it updated; access policies must be re-created.',
  'Resources stay in place and billing ownership does not change.',
]
