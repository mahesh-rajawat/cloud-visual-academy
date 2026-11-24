/**
 * Azure RBAC effective-access model.
 *
 * Modelled behaviour (https://learn.microsoft.com/azure/role-based-access-control/overview):
 *  - Role assignments apply at the assigned scope and are inherited by every child scope.
 *  - Effective permissions are the union of all role assignments for the user and the groups they belong to.
 *  - Within one role, NotActions are subtracted from Actions. NotActions are NOT deny rules: another
 *    role that grants the operation still allows it.
 *  - Deny assignments block access even when a role grants it. Customers cannot create them directly;
 *    they come from Azure-managed apps, deployment stacks and similar features.
 *
 * Simplification: role definitions below list the main Actions/NotActions of the built-in roles,
 * not every NotAction; data actions are not modelled.
 */

export type ScopeKind = 'managementGroup' | 'subscription' | 'resourceGroup' | 'resource'

export interface Scope {
  id: string
  name: string
  kind: ScopeKind
  parent: string | null
}

export interface RoleDefinition {
  name: string
  actions: string[]
  notActions: string[]
  description: string
}

export interface Principal {
  id: string
  name: string
  kind: 'user' | 'group' | 'servicePrincipal' | 'managedIdentity'
  memberOf: string[]
}

export interface RoleAssignment {
  id: string
  principalId: string
  role: string
  scopeId: string
}

export interface DenyAssignment {
  id: string
  actions: string[]
  scopeId: string
  excludedPrincipalIds: string[]
  source: string
}

export const BUILT_IN_ROLES: Record<string, RoleDefinition> = {
  Owner: { name: 'Owner', actions: ['*'], notActions: [], description: 'Full access to manage all resources, including assigning roles.' },
  Contributor: {
    name: 'Contributor',
    actions: ['*'],
    notActions: ['Microsoft.Authorization/*/Delete', 'Microsoft.Authorization/*/Write', 'Microsoft.Authorization/elevateAccess/Action'],
    description: 'Manage all resources but cannot assign roles or manage policy assignments.',
  },
  Reader: { name: 'Reader', actions: ['*/read'], notActions: [], description: 'View all resources; no changes.' },
  'User Access Administrator': {
    name: 'User Access Administrator',
    actions: ['*/read', 'Microsoft.Authorization/*', 'Microsoft.Support/*'],
    notActions: [],
    description: 'Manage user access (role assignments) to Azure resources.',
  },
  'Virtual Machine Contributor': {
    name: 'Virtual Machine Contributor',
    actions: ['Microsoft.Compute/virtualMachines/*', 'Microsoft.Network/networkInterfaces/*', 'Microsoft.Resources/subscriptions/resourceGroups/read', 'Microsoft.Compute/disks/*'],
    notActions: [],
    description: 'Manage virtual machines, but not access to them, and not the virtual network they connect to.',
  },
}

/** Azure-style wildcard match on operation strings (case-insensitive). */
export function operationMatches(pattern: string, operation: string): boolean {
  const re = new RegExp('^' + pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('.*') + '$', 'i')
  return re.test(operation)
}

export function roleAllows(role: RoleDefinition, operation: string): boolean {
  return role.actions.some((a) => operationMatches(a, operation)) && !role.notActions.some((n) => operationMatches(n, operation))
}

export function ancestry(scopes: Scope[], scopeId: string): Scope[] {
  const byId = new Map(scopes.map((s) => [s.id, s]))
  const chain: Scope[] = []
  let cur = byId.get(scopeId)
  while (cur) {
    chain.push(cur)
    cur = cur.parent ? byId.get(cur.parent) : undefined
  }
  return chain // target first, root last
}

export interface AccessCheck {
  allowed: boolean
  reason: string
  matchingAssignments: Array<{ assignment: RoleAssignment; via: string; inherited: boolean; grants: boolean }>
  deniedBy: DenyAssignment | null
  path: Scope[]
}

export function checkAccess(input: {
  scopes: Scope[]
  principals: Principal[]
  assignments: RoleAssignment[]
  denyAssignments?: DenyAssignment[]
  principalId: string
  scopeId: string
  operation: string
  roles?: Record<string, RoleDefinition>
}): AccessCheck {
  const roles = input.roles ?? BUILT_IN_ROLES
  const principal = input.principals.find((p) => p.id === input.principalId)
  if (!principal) throw new Error('Unknown principal')
  const identities = new Set([principal.id, ...principal.memberOf])
  const path = ancestry(input.scopes, input.scopeId)
  const pathIds = new Set(path.map((s) => s.id))
  const nameOf = (id: string) => input.principals.find((p) => p.id === id)?.name ?? id

  const matching = input.assignments
    .filter((a) => identities.has(a.principalId) && pathIds.has(a.scopeId))
    .map((a) => {
      const role = roles[a.role]
      return {
        assignment: a,
        via: a.principalId === principal.id ? 'direct' : `group "${nameOf(a.principalId)}"`,
        inherited: a.scopeId !== input.scopeId,
        grants: role ? roleAllows(role, input.operation) : false,
      }
    })

  const deny = (input.denyAssignments ?? []).find(
    (d) => pathIds.has(d.scopeId) && !d.excludedPrincipalIds.some((x) => identities.has(x)) && d.actions.some((p) => operationMatches(p, input.operation)),
  )
  const scopeName = (id: string) => input.scopes.find((s) => s.id === id)?.name ?? id
  const granting = matching.filter((m) => m.grants)

  if (deny) {
    return { allowed: false, reason: `A deny assignment (${deny.source}) at "${scopeName(deny.scopeId)}" blocks ${input.operation}. Deny assignments take precedence over role assignments.`, matchingAssignments: matching, deniedBy: deny, path }
  }
  if (granting.length) {
    const g = granting[0]!
    return {
      allowed: true,
      reason: `${g.assignment.role} assigned ${g.via === 'direct' ? 'directly' : `via ${g.via}`} at "${scopeName(g.assignment.scopeId)}"${g.inherited ? ' is inherited down to this scope' : ''} and grants ${input.operation}.`,
      matchingAssignments: matching,
      deniedBy: null,
      path,
    }
  }
  if (matching.length) {
    const blocked = matching.filter((m) => roles[m.assignment.role]?.notActions.some((n) => operationMatches(n, input.operation)))
    return {
      allowed: false,
      reason: blocked.length
        ? `${blocked.map((b) => b.assignment.role).join(', ')} applies here, but its NotActions exclude ${input.operation}, and no other role grants it.`
        : `Roles in effect (${matching.map((m) => m.assignment.role).join(', ')}) do not include ${input.operation}.`,
      matchingAssignments: matching,
      deniedBy: null,
      path,
    }
  }
  return { allowed: false, reason: `No role assignment for ${principal.name} or their groups exists at this scope or any parent scope.`, matchingAssignments: [], deniedBy: null, path }
}
