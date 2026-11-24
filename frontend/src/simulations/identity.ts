/**
 * Microsoft Entra ID: users, groups, dynamic membership, group-based licensing, B2B guests and SSPR.
 *
 * Modelled behaviour:
 *  - Dynamic membership rules (subset): user.<attr> -eq/-ne/-startsWith/-contains "value",
 *    combined with -and / -or (-and binds tighter). Dynamic groups cannot have members added manually.
 *    https://learn.microsoft.com/entra/identity/users/groups-dynamic-membership
 *  - Licences assigned directly need a usage location on the user. With group-based licensing, users
 *    without a usage location inherit the directory's location. Licences flow only to direct members:
 *    nested groups are not supported. Not enough licences → CountViolation.
 *    https://learn.microsoft.com/entra/identity/users/licensing-groups-assign
 *  - B2B invitations are checked against the collaboration restrictions (allow or deny list of
 *    domains) and the "who can invite" setting. Guests get userType Guest and a #EXT# UPN.
 *    https://learn.microsoft.com/entra/external-id/external-collaboration-settings-configure
 *  - SSPR: enabled for None, Selected group(s) or All. Users must have registered at least the
 *    required number of methods (1 or 2). Administrators are always enabled and use a stricter
 *    two-method policy without security questions. Synced users need password writeback.
 *    https://learn.microsoft.com/entra/identity/authentication/concept-sspr-howitworks
 */

export interface EntraUser {
  id: string
  upn: string
  displayName: string
  department: string
  country: string
  userType: 'Member' | 'Guest'
  usageLocation: string | null
  source: 'cloud' | 'synced'
  isAdmin: boolean
  methods: SsprMethod[]
  directLicenses: string[]
}

export interface EntraGroup {
  id: string
  name: string
  type: 'Security' | 'Microsoft 365'
  membership: 'Assigned' | 'Dynamic'
  rule?: string
  members: string[] // user ids or group ids (assigned only)
  licenses: string[]
}

export type SsprMethod = 'Authenticator app' | 'Mobile phone' | 'Email' | 'Security questions' | 'Office phone'

// ------------------------------------------------------------ dynamic rules
const ATTRS = ['department', 'country', 'userType', 'displayName', 'upn'] as const
type Attr = (typeof ATTRS)[number]

export interface ParsedRule { ok: true; or: Array<Array<{ attr: Attr; op: string; value: string }>> }

export function parseRule(rule: string): ParsedRule | { ok: false; error: string } {
  const text = rule.trim().replace(/^\((.*)\)$/, '$1')
  if (!text) return { ok: false, error: 'Rule is empty.' }
  const or = text.split(/\s+-or\s+/i).map((part) => part.split(/\s+-and\s+/i))
  const out: ParsedRule['or'] = []
  for (const conj of or) {
    const terms = []
    for (const raw of conj) {
      const m = /^\(?\s*user\.(\w+)\s+-(eq|ne|startsWith|contains)\s+"([^"]*)"\s*\)?$/i.exec(raw.trim())
      if (!m) return { ok: false, error: `Cannot parse "${raw.trim()}". Expected user.<property> -eq "value".` }
      const attr = (m[1] === 'userPrincipalName' ? 'upn' : m[1]) as Attr
      if (!ATTRS.includes(attr)) return { ok: false, error: `Unsupported property user.${m[1]} in this simulator.` }
      terms.push({ attr, op: m[2]!.toLowerCase(), value: m[3]! })
    }
    out.push(terms)
  }
  return { ok: true, or: out }
}

export function matchesRule(rule: ParsedRule, u: EntraUser): boolean {
  return rule.or.some((conj) => conj.every(({ attr, op, value }) => {
    const v = String(u[attr] ?? '').toLowerCase()
    const t = value.toLowerCase()
    return op === 'eq' ? v === t : op === 'ne' ? v !== t : op === 'startswith' ? v.startsWith(t) : v.includes(t)
  }))
}

/** Direct (non-nested) user members of each group. */
export function resolveMembers(groups: EntraGroup[], users: EntraUser[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const g of groups) {
    if (g.membership === 'Dynamic') {
      const parsed = parseRule(g.rule ?? '')
      out[g.id] = parsed.ok ? users.filter((u) => matchesRule(parsed, u)).map((u) => u.id) : []
    } else {
      out[g.id] = g.members.filter((m) => users.some((u) => u.id === m))
    }
  }
  return out
}

export function addMember(group: EntraGroup, memberId: string): { ok: boolean; error?: string; group: EntraGroup } {
  if (group.membership === 'Dynamic') return { ok: false, error: 'Members of a dynamic group are managed by its rule and cannot be added manually.', group }
  if (group.members.includes(memberId)) return { ok: false, error: 'Already a member.', group }
  return { ok: true, group: { ...group, members: [...group.members, memberId] } }
}

// ------------------------------------------------------------ licensing
export interface LicenseState {
  userId: string
  sku: string
  source: 'direct' | `group:${string}`
  state: 'active' | 'error'
  error?: 'MissingUsageLocation' | 'CountViolation'
  effectiveUsageLocation: string | null
}

export function computeLicenses(users: EntraUser[], groups: EntraGroup[], available: Record<string, number>, tenantCountry: string): LicenseState[] {
  const members = resolveMembers(groups, users)
  const used: Record<string, number> = {}
  const out: LicenseState[] = []
  const take = (sku: string) => {
    used[sku] = (used[sku] ?? 0) + 1
    return used[sku]! <= (available[sku] ?? 0)
  }
  for (const u of users) {
    for (const sku of u.directLicenses) {
      if (!u.usageLocation) { out.push({ userId: u.id, sku, source: 'direct', state: 'error', error: 'MissingUsageLocation', effectiveUsageLocation: null }); continue }
      out.push({ userId: u.id, sku, source: 'direct', state: take(sku) ? 'active' : 'error', error: used[sku]! > (available[sku] ?? 0) ? 'CountViolation' : undefined, effectiveUsageLocation: u.usageLocation })
    }
  }
  for (const g of groups) {
    for (const sku of g.licenses) {
      for (const uid of members[g.id] ?? []) {
        const u = users.find((x) => x.id === uid)!
        // A user with the same SKU already active consumes only one licence.
        if (out.some((l) => l.userId === uid && l.sku === sku && l.state === 'active')) {
          out.push({ userId: uid, sku, source: `group:${g.name}`, state: 'active', effectiveUsageLocation: u.usageLocation ?? tenantCountry })
          continue
        }
        const ok = take(sku)
        out.push({ userId: uid, sku, source: `group:${g.name}`, state: ok ? 'active' : 'error', error: ok ? undefined : 'CountViolation', effectiveUsageLocation: u.usageLocation ?? tenantCountry })
      }
    }
  }
  return out
}

// ------------------------------------------------------------ B2B
export interface CollaborationSettings {
  whoCanInvite: 'everyone' | 'members' | 'adminsAndGuestInviters' | 'none'
  restriction: 'any' | 'deny' | 'allow'
  domains: string[]
}

export function inviteGuest(email: string, inviter: { isAdmin: boolean; isGuestInviter: boolean; userType: 'Member' | 'Guest' }, s: CollaborationSettings, tenantDomain: string) {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, reason: 'Enter a valid email address.' }
  const canInvite = s.whoCanInvite === 'everyone' || (s.whoCanInvite === 'members' && (inviter.userType === 'Member' || inviter.isAdmin || inviter.isGuestInviter)) || (s.whoCanInvite === 'adminsAndGuestInviters' && (inviter.isAdmin || inviter.isGuestInviter))
  if (!canInvite) return { ok: false as const, reason: `Guest invite settings (${s.whoCanInvite}) do not allow this user to invite.` }
  if (s.restriction === 'deny' && s.domains.includes(domain)) return { ok: false as const, reason: `${domain} is on the deny list in collaboration restrictions.` }
  if (s.restriction === 'allow' && !s.domains.includes(domain)) return { ok: false as const, reason: `${domain} is not on the allow list in collaboration restrictions.` }
  const upn = `${email.replace('@', '_')}#EXT#@${tenantDomain}`
  return { ok: true as const, reason: 'Invitation sent; the guest is created with userType Guest and state PendingAcceptance until they redeem it.', upn }
}

// ------------------------------------------------------------ SSPR
export interface SsprPolicy {
  enabledFor: 'None' | 'Selected' | 'All'
  selectedGroupId: string | null
  methodsRequired: 1 | 2
  allowedMethods: SsprMethod[]
  writeback: boolean
}

export function canResetPassword(u: EntraUser, p: SsprPolicy, members: Record<string, string[]>): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (u.isAdmin) {
    // Admin policy is always on: two methods, no security questions.
    const strong = u.methods.filter((m) => m !== 'Security questions')
    if (strong.length < 2) reasons.push('Administrators always have SSPR enabled with a two-method policy that excludes security questions; this admin has fewer than two eligible methods.')
  } else {
    if (p.enabledFor === 'None') reasons.push('SSPR is set to None for users.')
    if (p.enabledFor === 'Selected' && !(p.selectedGroupId && members[p.selectedGroupId]?.includes(u.id))) reasons.push('SSPR is limited to a selected group that this user is not in.')
    const usable = u.methods.filter((m) => p.allowedMethods.includes(m))
    if (usable.length < p.methodsRequired) reasons.push(`The policy requires ${p.methodsRequired} method(s); the user has registered ${usable.length} allowed method(s).`)
  }
  if (u.source === 'synced' && !p.writeback) reasons.push('The account is synced from on-premises AD and password writeback is not enabled.')
  return { ok: reasons.length === 0, reasons }
}
