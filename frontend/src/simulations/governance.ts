/**
 * Azure Resource Manager governance model: Azure Policy evaluation and resource locks.
 *
 * Modelled behaviour:
 *  Policy (https://learn.microsoft.com/azure/governance/policy/concepts/effect-basics)
 *  - Assignments apply at their scope and every child scope, minus excluded scopes (notScopes)
 *    and scopes covered by an exemption for that assignment.
 *  - Create/update (PUT/PATCH) requests are evaluated in effect order: Disabled → Append/Modify
 *    (may change the request) → Deny → Audit. AuditIfNotExists/DeployIfNotExists run after the
 *    resource provider responds and are not modelled here.
 *  - enforcementMode DoNotEnforce: effects are not enforced (no deny, no modify), but compliance
 *    is still evaluated and reported.
 *  - Existing resources are never changed or deleted by a new assignment; they are reported as
 *    non-compliant. Modify/DeployIfNotExists fix them only through a remediation task.
 *  - Delete requests and resource actions (POST) are not evaluated by these effects.
 *    (The DenyAction effect, which can block deletes, is not modelled.)
 *  Locks (https://learn.microsoft.com/azure/azure-resource-manager/management/lock-resources)
 *  - CanNotDelete blocks DELETE; ReadOnly blocks every write including POST actions
 *    (for example starting a VM or listing storage account keys). GET stays allowed.
 *  - Locks are inherited by child scopes, the most restrictive lock wins, and they apply to every
 *    user, including Owners.
 *  - A resource group or subscription cannot be deleted while any resource inside it is locked.
 *  - Locks govern the control plane only (management.azure.com), not data-plane operations.
 */

export type Method = 'GET' | 'PUT' | 'PATCH' | 'DELETE' | 'POST'
export type Effect = 'Deny' | 'Audit' | 'Modify' | 'Append' | 'Disabled'

export interface GovScope {
  id: string
  name: string
  kind: 'managementGroup' | 'subscription' | 'resourceGroup' | 'resource'
  parent: string | null
  tags?: Record<string, string>
}

export interface ResourceState {
  type: string
  name: string
  location: string
  tags: Record<string, string>
  vmSize?: string
}

export interface PolicyDefinition {
  id: string
  name: string
  effect: Effect
  description: string
  /** true when the resource does NOT comply with the rule. */
  nonCompliant: (r: ResourceState, params: string[], ctx: { rgTags: Record<string, string> }) => boolean
  modify?: (r: ResourceState, params: string[], ctx: { rgTags: Record<string, string> }) => ResourceState
  defaultParams: string[]
  paramLabel?: string
}

export interface PolicyAssignment {
  id: string
  definitionId: string
  scopeId: string
  notScopes: string[]
  params: string[]
  enforcement: 'Default' | 'DoNotEnforce'
  /** Effect override (built-in definitions often parameterise the effect). */
  effect?: Effect
}

export interface PolicyExemption {
  id: string
  assignmentId: string
  scopeId: string
  category: 'Waiver' | 'Mitigated'
}

export interface ResourceLock {
  id: string
  scopeId: string
  level: 'CanNotDelete' | 'ReadOnly'
  notes?: string
}

export const POLICY_DEFINITIONS: PolicyDefinition[] = [
  {
    id: 'allowed-locations', name: 'Allowed locations', effect: 'Deny', paramLabel: 'Allowed regions',
    description: 'Restricts the locations resources can be deployed to.',
    defaultParams: ['westeurope', 'northeurope'],
    nonCompliant: (r, p) => r.location !== 'global' && !p.includes(r.location),
  },
  {
    id: 'require-tag', name: 'Require a tag on resources', effect: 'Deny', paramLabel: 'Tag name',
    description: 'Denies creation or update of resources that lack the tag.',
    defaultParams: ['costCenter'],
    nonCompliant: (r, p) => !(p[0]! in r.tags),
  },
  {
    id: 'inherit-tag', name: 'Inherit a tag from the resource group if missing', effect: 'Modify', paramLabel: 'Tag name',
    description: 'Adds the resource group\'s tag value to resources that are missing the tag.',
    defaultParams: ['costCenter'],
    nonCompliant: (r, p, ctx) => !(p[0]! in r.tags) && p[0]! in ctx.rgTags,
    modify: (r, p, ctx) => ({ ...r, tags: { ...r.tags, [p[0]!]: ctx.rgTags[p[0]!]! } }),
  },
  {
    id: 'allowed-vm-skus', name: 'Allowed virtual machine size SKUs', effect: 'Deny', paramLabel: 'Allowed sizes',
    description: 'Restricts the VM sizes that can be deployed.',
    defaultParams: ['Standard_B2s', 'Standard_D2s_v5'],
    nonCompliant: (r, p) => r.type === 'Microsoft.Compute/virtualMachines' && !!r.vmSize && !p.includes(r.vmSize),
  },
  {
    id: 'audit-tag', name: 'Audit resources without the environment tag', effect: 'Audit', paramLabel: 'Tag name',
    description: 'Custom definition: reports resources that lack the tag, but allows the request.',
    defaultParams: ['environment'],
    nonCompliant: (r, p) => !(p[0]! in r.tags),
  },
]

export function scopePath(scopes: GovScope[], id: string): GovScope[] {
  const byId = new Map(scopes.map((s) => [s.id, s]))
  const out: GovScope[] = []
  let cur = byId.get(id)
  while (cur) {
    out.push(cur)
    cur = cur.parent ? byId.get(cur.parent) : undefined
  }
  return out
}

function descendants(scopes: GovScope[], id: string): GovScope[] {
  const kids = scopes.filter((s) => s.parent === id)
  return kids.flatMap((k) => [k, ...descendants(scopes, k.id)])
}

export type PolicyOutcome = 'compliant' | 'modified' | 'denied' | 'audited' | 'not-enforced' | 'excluded' | 'exempted' | 'disabled'

export interface PolicyEvent {
  assignment: PolicyAssignment
  definition: PolicyDefinition
  effect: Effect
  outcome: PolicyOutcome
  detail: string
}

export interface PolicyResult {
  evaluated: boolean
  allowed: boolean
  resource: ResourceState
  events: PolicyEvent[]
  reason: string
}

const EFFECT_ORDER: Record<Effect, number> = { Disabled: 0, Append: 1, Modify: 1, Deny: 2, Audit: 3 }

/** Assignments whose scope covers the target, with their applicability. */
export function applicableAssignments(scopes: GovScope[], targetScopeId: string, assignments: PolicyAssignment[], exemptions: PolicyExemption[]) {
  const pathIds = new Set(scopePath(scopes, targetScopeId).map((s) => s.id))
  return assignments
    .filter((a) => pathIds.has(a.scopeId))
    .map((a) => {
      const excluded = a.notScopes.some((n) => pathIds.has(n))
      const exemption = exemptions.find((e) => e.assignmentId === a.id && pathIds.has(e.scopeId))
      return { assignment: a, excluded, exemption }
    })
}

export function evaluatePolicy(input: {
  scopes: GovScope[]
  method: Method
  /** The resource group the resource lives in. */
  resourceGroupId: string
  resource: ResourceState
  assignments: PolicyAssignment[]
  exemptions: PolicyExemption[]
  definitions?: PolicyDefinition[]
}): PolicyResult {
  const defs = input.definitions ?? POLICY_DEFINITIONS
  if (input.method !== 'PUT' && input.method !== 'PATCH') {
    return { evaluated: false, allowed: true, resource: input.resource, events: [], reason: `${input.method} requests are not evaluated by Deny/Audit/Modify/Append effects.` }
  }
  const rg = input.scopes.find((s) => s.id === input.resourceGroupId)
  const ctx = { rgTags: rg?.tags ?? {} }
  const applicable = applicableAssignments(input.scopes, input.resourceGroupId, input.assignments, input.exemptions)
    .map((x) => ({ ...x, definition: defs.find((d) => d.id === x.assignment.definitionId)! }))
    .filter((x) => x.definition)
    .sort((a, b) => EFFECT_ORDER[a.assignment.effect ?? a.definition.effect] - EFFECT_ORDER[b.assignment.effect ?? b.definition.effect])

  let res = input.resource
  const events: PolicyEvent[] = []
  let denied: PolicyEvent | null = null

  for (const { assignment, definition, excluded, exemption } of applicable) {
    const effect = assignment.effect ?? definition.effect
    const base = { assignment, definition, effect }
    if (excluded) { events.push({ ...base, outcome: 'excluded', detail: 'Target is inside an excluded scope (notScopes).' }); continue }
    if (exemption) { events.push({ ...base, outcome: 'exempted', detail: `Exemption (${exemption.category}) covers this scope.` }); continue }
    if (effect === 'Disabled') { events.push({ ...base, outcome: 'disabled', detail: 'Effect is Disabled; the rule is skipped.' }); continue }
    const bad = definition.nonCompliant(res, assignment.params, ctx)
    if (!bad) { events.push({ ...base, outcome: 'compliant', detail: 'Resource satisfies the rule.' }); continue }
    if (assignment.enforcement === 'DoNotEnforce') {
      events.push({ ...base, outcome: 'not-enforced', detail: `Non-compliant, but enforcement is DoNotEnforce: ${effect} is not applied; compliance is still reported.` })
      continue
    }
    if ((effect === 'Modify' || effect === 'Append') && definition.modify) {
      res = definition.modify(res, assignment.params, ctx)
      events.push({ ...base, outcome: 'modified', detail: 'Request altered before it reaches the resource provider.' })
    } else if (effect === 'Deny') {
      const ev: PolicyEvent = { ...base, outcome: 'denied', detail: 'Request rejected with RequestDisallowedByPolicy (HTTP 403).' }
      events.push(ev)
      denied = denied ?? ev
    } else if (effect === 'Audit') {
      events.push({ ...base, outcome: 'audited', detail: 'Allowed; a warning is written to the activity log and the resource is non-compliant.' })
    }
  }
  return {
    evaluated: true,
    allowed: !denied,
    resource: res,
    events,
    reason: denied ? `Denied by "${denied.definition.name}" assigned at ${input.scopes.find((s) => s.id === denied!.assignment.scopeId)?.name}.` : 'No Deny effect applies.',
  }
}

export interface LockResult {
  blocked: boolean
  lock: ResourceLock | null
  reason: string
}

export function lockBlocks(level: ResourceLock['level'], method: Method): boolean {
  if (method === 'GET') return false
  return level === 'ReadOnly' || method === 'DELETE'
}

export function evaluateLocks(scopes: GovScope[], targetScopeId: string, method: Method, locks: ResourceLock[]): LockResult {
  const path = scopePath(scopes, targetScopeId)
  const pathIds = new Set(path.map((s) => s.id))
  const inherited = locks.filter((l) => pathIds.has(l.scopeId))
  // Most restrictive applicable lock first.
  const blocking = inherited.filter((l) => lockBlocks(l.level, method)).sort((a, b) => (a.level === 'ReadOnly' ? -1 : 1) - (b.level === 'ReadOnly' ? -1 : 1))[0]
  const name = (id: string) => scopes.find((s) => s.id === id)?.name ?? id
  if (blocking) {
    return { blocked: true, lock: blocking, reason: `${blocking.level} lock on "${name(blocking.scopeId)}"${blocking.scopeId !== targetScopeId ? ' (inherited)' : ''} blocks ${method}. Locks apply to everyone, including Owners.` }
  }
  if (method === 'DELETE') {
    const child = locks.find((l) => descendants(scopes, targetScopeId).some((d) => d.id === l.scopeId))
    if (child) return { blocked: true, lock: child, reason: `Cannot delete "${name(targetScopeId)}" because "${name(child.scopeId)}" inside it has a ${child.level} lock.` }
  }
  return { blocked: false, lock: null, reason: inherited.length ? `Applicable lock(s) (${inherited.map((l) => l.level).join(', ')}) do not block ${method}.` : 'No locks apply.' }
}

/** Compliance scan of existing resources: reports, never changes or deletes them. */
export function complianceScan(input: {
  scopes: GovScope[]
  resources: Array<{ resourceGroupId: string; resource: ResourceState }>
  assignments: PolicyAssignment[]
  exemptions: PolicyExemption[]
  definitions?: PolicyDefinition[]
}) {
  const defs = input.definitions ?? POLICY_DEFINITIONS
  return input.resources.map(({ resourceGroupId, resource }) => {
    const rg = input.scopes.find((s) => s.id === resourceGroupId)
    const results = applicableAssignments(input.scopes, resourceGroupId, input.assignments, input.exemptions).map(({ assignment, excluded, exemption }) => {
      const def = defs.find((d) => d.id === assignment.definitionId)!
      const effect = assignment.effect ?? def.effect
      const state = excluded ? 'not-applicable' : exemption ? 'exempt' : effect === 'Disabled' ? 'not-applicable'
        : def.nonCompliant(resource, assignment.params, { rgTags: rg?.tags ?? {} }) ? 'non-compliant' : 'compliant'
      return { assignmentId: assignment.id, definition: def.name, effect, state, remediable: state === 'non-compliant' && (effect === 'Modify') }
    })
    return { resource, resourceGroupId, results, compliant: results.every((r) => r.state !== 'non-compliant') }
  })
}
