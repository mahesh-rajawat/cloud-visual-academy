import { describe, expect, it } from 'vitest'
import { addMember, canResetPassword, computeLicenses, inviteGuest, matchesRule, parseRule, resolveMembers, type EntraGroup, type EntraUser, type SsprPolicy } from './identity'

const user = (over: Partial<EntraUser>): EntraUser => ({ id: 'u', upn: 'u@contoso.com', displayName: 'U', department: 'Sales', country: 'PT', userType: 'Member', usageLocation: 'PT', source: 'cloud', isAdmin: false, methods: [], directLicenses: [], ...over })
const users = [
  user({ id: 'ana', department: 'Sales' }),
  user({ id: 'ben', department: 'Engineering', usageLocation: null }),
  user({ id: 'guest', department: '', userType: 'Guest' }),
]

describe('dynamic membership', () => {
  it('parses and evaluates -and / -or rules', () => {
    const r = parseRule('(user.department -eq "Sales") -or (user.userType -eq "Guest")')
    expect(r.ok).toBe(true)
    if (r.ok) expect(users.filter((u) => matchesRule(r, u)).map((u) => u.id)).toEqual(['ana', 'guest'])
  })
  it('rejects invalid syntax', () => {
    expect(parseRule('department = Sales').ok).toBe(false)
  })
  it('does not allow manual members in dynamic groups', () => {
    const g: EntraGroup = { id: 'g', name: 'Sales', type: 'Security', membership: 'Dynamic', rule: 'user.department -eq "Sales"', members: [], licenses: [] }
    expect(addMember(g, 'ben').ok).toBe(false)
  })
})

describe('licensing', () => {
  it('direct assignment needs a usage location; group assignment inherits the tenant location', () => {
    const u = [user({ id: 'ben', usageLocation: null, directLicenses: ['E3'] })]
    expect(computeLicenses(u, [], { E3: 5 }, 'US')[0]).toMatchObject({ state: 'error', error: 'MissingUsageLocation' })
    const g: EntraGroup = { id: 'g', name: 'Lic', type: 'Security', membership: 'Assigned', members: ['ben'], licenses: ['E3'] }
    expect(computeLicenses([{ ...u[0]!, directLicenses: [] }], [g], { E3: 5 }, 'US')[0]).toMatchObject({ state: 'active', effectiveUsageLocation: 'US' })
  })
  it('reports CountViolation when licences run out and ignores nested groups', () => {
    const inner: EntraGroup = { id: 'inner', name: 'Inner', type: 'Security', membership: 'Assigned', members: ['ben'], licenses: [] }
    const outer: EntraGroup = { id: 'outer', name: 'Outer', type: 'Security', membership: 'Assigned', members: ['ana', 'guest', 'inner'], licenses: ['E3'] }
    const res = computeLicenses(users, [inner, outer], { E3: 1 }, 'US')
    expect(res.map((r) => [r.userId, r.state])).toEqual([['ana', 'active'], ['guest', 'error']])
    expect(resolveMembers([inner, outer], users).outer).toEqual(['ana', 'guest'])
  })
})

describe('B2B and SSPR', () => {
  const settings = { whoCanInvite: 'members' as const, restriction: 'allow' as const, domains: ['fabrikam.com'] }
  it('applies allow lists and builds the #EXT# UPN', () => {
    const ok = inviteGuest('lee@fabrikam.com', { isAdmin: false, isGuestInviter: false, userType: 'Member' }, settings, 'contoso.onmicrosoft.com')
    expect(ok.ok && ok.upn).toBe('lee_fabrikam.com#EXT#@contoso.onmicrosoft.com')
    expect(inviteGuest('x@gmail.com', { isAdmin: false, isGuestInviter: false, userType: 'Member' }, settings, 'c').ok).toBe(false)
    expect(inviteGuest('lee@fabrikam.com', { isAdmin: false, isGuestInviter: false, userType: 'Guest' }, settings, 'c').ok).toBe(false)
  })
  const policy: SsprPolicy = { enabledFor: 'Selected', selectedGroupId: 'g', methodsRequired: 2, allowedMethods: ['Authenticator app', 'Mobile phone', 'Email', 'Security questions'], writeback: false }
  it('checks scope, registered methods and writeback', () => {
    const members = { g: ['ana'] }
    expect(canResetPassword(user({ id: 'ana', methods: ['Email', 'Mobile phone'] }), policy, members).ok).toBe(true)
    expect(canResetPassword(user({ id: 'ana', methods: ['Email'] }), policy, members).ok).toBe(false)
    expect(canResetPassword(user({ id: 'ben', methods: ['Email', 'Mobile phone'] }), policy, members).reasons[0]).toMatch(/selected group/)
    expect(canResetPassword(user({ id: 'ana', source: 'synced', methods: ['Email', 'Mobile phone'] }), policy, members).ok).toBe(false)
  })
  it('admins are always enabled but cannot use security questions', () => {
    const none = { ...policy, enabledFor: 'None' as const }
    expect(canResetPassword(user({ id: 'adm', isAdmin: true, methods: ['Authenticator app', 'Mobile phone'] }), none, {}).ok).toBe(true)
    expect(canResetPassword(user({ id: 'adm', isAdmin: true, methods: ['Email', 'Security questions'] }), none, {}).ok).toBe(false)
  })
})
