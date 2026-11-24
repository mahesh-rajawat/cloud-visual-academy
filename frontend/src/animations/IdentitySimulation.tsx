import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/useStepper'
import { addMember, canResetPassword, computeLicenses, inviteGuest, parseRule, resolveMembers, type CollaborationSettings, type EntraGroup, type EntraUser, type SsprMethod, type SsprPolicy } from '../simulations/identity'
import { Badge, FidelityNote } from './primitives'
import type { SimulationProps } from './types'

const INITIAL_USERS: EntraUser[] = [
  { id: 'ana', upn: 'ana@contoso.com', displayName: 'Ana Silva', department: 'Sales', country: 'PT', userType: 'Member', usageLocation: 'PT', source: 'cloud', isAdmin: false, methods: ['Authenticator app'], directLicenses: [] },
  { id: 'ben', upn: 'ben@contoso.com', displayName: 'Ben Okafor', department: 'Engineering', country: 'NG', userType: 'Member', usageLocation: null, source: 'cloud', isAdmin: false, methods: ['Email', 'Mobile phone'], directLicenses: ['Microsoft 365 E3'] },
  { id: 'chen', upn: 'chen@contoso.com', displayName: 'Chen Wei', department: 'Sales', country: 'SG', userType: 'Member', usageLocation: 'SG', source: 'synced', isAdmin: false, methods: ['Email', 'Mobile phone'], directLicenses: [] },
  { id: 'dana', upn: 'dana@contoso.com', displayName: 'Dana Ruiz (Global Admin)', department: 'IT', country: 'ES', userType: 'Member', usageLocation: 'ES', source: 'cloud', isAdmin: true, methods: ['Email', 'Security questions'], directLicenses: [] },
]
const INITIAL_GROUPS: EntraGroup[] = [
  { id: 'g-sales', name: 'Sales (dynamic)', type: 'Security', membership: 'Dynamic', rule: 'user.department -eq "Sales"', members: [], licenses: ['Microsoft 365 E3'] },
  { id: 'g-sspr', name: 'Password reset pilot (assigned)', type: 'Security', membership: 'Assigned', members: ['ana'], licenses: [] },
  { id: 'g-eng', name: 'Engineering (M365, assigned)', type: 'Microsoft 365', membership: 'Assigned', members: ['ben'], licenses: [] },
]
const SKUS = { 'Microsoft 365 E3': 2 }
const ALL_METHODS: SsprMethod[] = ['Authenticator app', 'Mobile phone', 'Email', 'Security questions', 'Office phone']
type Tab = 'groups' | 'licenses' | 'guests' | 'sspr'

const TRY: Record<Tab, string[]> = {
  groups: [
    "Change Ben's department to Sales. He joins the Sales group by himself, because its rule matches.",
    'Try "Add member" with Sales and Ben. It is blocked: you cannot add people by hand to a dynamic group.',
    'Add Ben to the Password reset pilot group instead. That works, because it is an assigned group.',
  ],
  licenses: [
    "Look at the table: Ben's direct licence fails (MissingUsageLocation). Sales members get Microsoft 365 E3 from the group.",
    "Set Ben's usage location to NG. Ben is now licensed, but 3 people share 2 licences, so one Sales member fails with CountViolation.",
    'Raise the purchased licences to 3. Everyone is licensed.',
  ],
  guests: [
    'Invite lee@fabrikam.com as a member user. It works because fabrikam.com is on the allow list.',
    'Change the email to someone@other.com. It is blocked by the domain restriction.',
    'Set "Guest invite settings" to "Only admins and Guest Inviter role" and invite as a member user again.',
  ],
  sspr: [
    'Try Ana: she is in the pilot group, but 2 methods are required and she registered only 1. Tick Email for her and try again.',
    'Try Ben: he is not in the pilot group, so it is blocked. Set "Enabled for" to All and try again.',
    'Try Dana (Global Admin): admins always need 2 methods, and security questions do not count.',
  ],
}

function TryThis({ tab }: { tab: Tab }) {
  return (
    <div className="m-3 mb-0 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
      <p className="font-semibold">Try this</p>
      <ol className="ml-5 mt-1 list-decimal space-y-0.5">{TRY[tab].map((t) => <li key={t}>{t}</li>)}</ol>
    </div>
  )
}

function Avatar({ name, guest, small }: { name: string; guest?: boolean; small?: boolean }) {
  return <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${small ? 'h-4 w-4 text-[9px]' : 'h-7 w-7 text-xs'} ${guest ? 'bg-orange-100 text-orange-800' : 'bg-sky-100 text-sky-800'}`}>{name[0]}</span>
}

export default function IdentitySimulation({ onLabCheck }: SimulationProps) {
  const reduced = usePrefersReducedMotion()
  const [tab, setTab] = useState<Tab>('groups')
  const [users, setUsers] = useState(INITIAL_USERS)
  const [groups, setGroups] = useState(INITIAL_GROUPS)
  const [ruleDraft, setRuleDraft] = useState(INITIAL_GROUPS[0]!.rule!)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [addSel, setAddSel] = useState({ groupId: 'g-sales', userId: 'ben' })
  const [licCount, setLicCount] = useState(SKUS['Microsoft 365 E3'])
  const [collab, setCollab] = useState<CollaborationSettings>({ whoCanInvite: 'members', restriction: 'allow', domains: ['fabrikam.com'] })
  const [inviteEmail, setInviteEmail] = useState('lee@fabrikam.com')
  const [inviter, setInviter] = useState<'member' | 'guest' | 'admin'>('member')
  const [guests, setGuests] = useState<Array<{ email: string; upn: string }>>([])
  const [policy, setPolicy] = useState<SsprPolicy>({ enabledFor: 'Selected', selectedGroupId: 'g-sspr', methodsRequired: 2, allowedMethods: ['Authenticator app', 'Mobile phone', 'Email'], writeback: false })
  const [ssprUser, setSsprUser] = useState('ana')
  const [ssprResult, setSsprResult] = useState<ReturnType<typeof canResetPassword> | null>(null)

  const members = useMemo(() => resolveMembers(groups, users), [groups, users])
  const licenses = useMemo(() => computeLicenses(users, groups, { 'Microsoft 365 E3': licCount }, 'US'), [users, groups, licCount])
  const parsed = parseRule(ruleDraft)

  const setUser = (id: string, patch: Partial<EntraUser>) => {
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, ...patch } : u)))
    if ('department' in patch) onLabCheck?.('user-property-changed')
  }

  const applyRule = () => {
    if (!parsed.ok) { setMsg({ ok: false, text: parsed.error }); return }
    setGroups((gs) => gs.map((g) => (g.id === 'g-sales' ? { ...g, rule: ruleDraft } : g)))
    setMsg({ ok: true, text: 'Rule saved. Membership is re-evaluated (in Azure this can take from minutes to hours in large tenants).' })
    onLabCheck?.('dynamic-rule')
  }

  const tryAdd = () => {
    const g = groups.find((x) => x.id === addSel.groupId)!
    const r = addMember(g, addSel.userId)
    if (!r.ok) { setMsg({ ok: false, text: r.error! }); if (g.membership === 'Dynamic') onLabCheck?.('manual-add-blocked'); return }
    setGroups((gs) => gs.map((x) => (x.id === g.id ? r.group : x)))
    setMsg({ ok: true, text: `Added to ${g.name}.` })
  }

  const licErrors = licenses.filter((l) => l.state === 'error')
  const checkLicenses = () => {
    if (licErrors.length) onLabCheck?.('license-error')
    else if (licenses.length) onLabCheck?.('license-fixed')
  }

  const invite = () => {
    const r = inviteGuest(inviteEmail, { isAdmin: inviter === 'admin', isGuestInviter: false, userType: inviter === 'guest' ? 'Guest' : 'Member' }, collab, 'contoso.onmicrosoft.com')
    setMsg({ ok: r.ok, text: r.reason + (r.ok ? ` UPN: ${r.upn}` : '') })
    if (r.ok) { setGuests((g) => [...g, { email: inviteEmail, upn: r.upn }]); onLabCheck?.('guest-invited') } else onLabCheck?.('guest-blocked')
  }

  const trySspr = () => {
    const u = users.find((x) => x.id === ssprUser)!
    const r = canResetPassword(u, policy, members)
    setSsprResult(r)
    onLabCheck?.(r.ok ? 'sspr-success' : 'sspr-blocked')
    if (u.isAdmin) onLabCheck?.('admin-policy')
  }

  return (
    <div className="@container card overflow-hidden">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
        {([['groups', 'Users & groups'], ['licenses', 'Licences'], ['guests', 'External users'], ['sspr', 'Self-service password reset (SSPR)']] as const).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'btn-primary' : 'btn-ghost'} onClick={() => { setTab(id); setMsg(null) }}>{l}</button>
        ))}
      </div>

      <TryThis tab={tab} />

      {(tab === 'groups' || tab === 'licenses') && (
        <div className="space-y-3 p-3" aria-label="Users and their group memberships">
          <div className="flex flex-wrap gap-2" aria-label="People">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
                <Avatar name={u.displayName} guest={u.userType === 'Guest'} />
                <span><span className="font-medium">{u.displayName}</span><br /><span className="text-slate-500">{u.department || 'no department'} · {u.usageLocation ? `location ${u.usageLocation}` : 'no usage location'}</span></span>
              </div>
            ))}
          </div>
          <div className="grid gap-3 @2xl:grid-cols-3">
            {groups.map((g) => {
              const ids = members[g.id] ?? []
              const dynamic = g.membership === 'Dynamic'
              return (
                <div key={g.id} className={`rounded-xl border-2 p-3 ${dynamic ? 'border-violet-400 bg-violet-50/60 dark:bg-violet-950/20' : 'border-sky-400 bg-sky-50/60 dark:bg-sky-950/20'}`}>
                  <p className="font-semibold">{g.name.replace(/ \(.*\)$/, '')}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{g.type} group · {dynamic ? 'members chosen by a rule' : 'members added by hand'}</p>
                  {dynamic && <p className="mt-1 rounded bg-white/70 px-1 font-mono text-[11px] dark:bg-slate-900/60">{g.rule}</p>}
                  {g.licenses.length > 0 && <p className="mt-1 text-xs">Gives licence: <strong>{g.licenses.join(', ')}</strong></p>}
                  <p className="mt-2 text-xs font-medium text-slate-500">Members ({ids.length})</p>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {ids.length === 0 && <li className="text-xs text-slate-500">nobody yet</li>}
                    {ids.map((uid) => {
                      const u = users.find((x) => x.id === uid)!
                      const lic = tab === 'licenses' ? licenses.find((l) => l.userId === uid && l.source === `group:${g.name}`) : undefined
                      const tone = lic ? (lic.state === 'active' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' : 'border-red-400 bg-red-50 dark:bg-red-950/40') : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                      return (
                        <motion.li key={uid} initial={reduced ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tone}`}>
                          <Avatar name={u.displayName} guest={u.userType === 'Guest'} small />{u.displayName.split(' ')[0]}
                          {lic && <span className="text-[10px]">{lic.state === 'active' ? '✓ licensed' : `✗ ${lic.error}`}</span>}
                        </motion.li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-3 border-t border-slate-200 p-3 text-sm dark:border-slate-800">
        {tab === 'groups' && (
          <div className="grid gap-3 @3xl:grid-cols-3">
            <fieldset className="space-y-2">
              <legend className="label">Dynamic rule for "Sales (dynamic)"</legend>
              <input className="input w-full font-mono text-xs" aria-label="Dynamic membership rule" value={ruleDraft} onChange={(e) => setRuleDraft(e.target.value)} aria-invalid={!parsed.ok} />
              {!parsed.ok && <p className="text-xs text-red-600">{parsed.error}</p>}
              <button type="button" className="btn-primary w-full" onClick={applyRule}>Save rule</button>
              <p className="text-xs text-slate-500">Try: <code>user.department -eq "Sales" -or user.userType -eq "Guest"</code></p>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">Edit user properties</legend>
              {users.filter((u) => !u.isAdmin).map((u) => (
                <label key={u.id} className="flex items-center justify-between gap-2 text-xs">{u.displayName.split(' ')[0]} department
                  <select className="input" value={u.department} onChange={(e) => setUser(u.id, { department: e.target.value })}>{['Sales', 'Engineering', 'IT', ''].map((d) => <option key={d} value={d}>{d || '(empty)'}</option>)}</select>
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">Add a member manually</legend>
              <select className="input w-full" aria-label="Group" value={addSel.groupId} onChange={(e) => setAddSel({ ...addSel, groupId: e.target.value })}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <select className="input w-full" aria-label="User" value={addSel.userId} onChange={(e) => setAddSel({ ...addSel, userId: e.target.value })}>{users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select>
              <button type="button" className="btn-primary w-full" onClick={tryAdd}>Add member</button>
            </fieldset>
          </div>
        )}

        {tab === 'licenses' && (
          <div className="grid gap-3 @3xl:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-2">Purchased Microsoft 365 E3 licences<input type="number" min={0} className="input w-20" value={licCount} onChange={(e) => setLicCount(Number(e.target.value) || 0)} /></label>
              {users.filter((u) => !u.isAdmin).map((u) => (
                <label key={u.id} className="flex items-center justify-between gap-2 text-xs">{u.displayName.split(' ')[0]} usage location
                  <select className="input" value={u.usageLocation ?? ''} onChange={(e) => setUser(u.id, { usageLocation: e.target.value || null })}>{['', 'PT', 'NG', 'SG', 'US'].map((c) => <option key={c} value={c}>{c || 'not set'}</option>)}</select>
                </label>
              ))}
              <button type="button" className="btn-primary w-full" onClick={checkLicenses}>Check licence assignment status</button>
            </div>
            <table className="w-full text-xs" aria-live="polite">
              <thead><tr className="text-left text-slate-500"><th>User</th><th>Source</th><th>State</th><th>Usage location</th></tr></thead>
              <tbody>{licenses.map((l, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td>{users.find((u) => u.id === l.userId)?.displayName}</td><td>{l.source}</td>
                  <td>{l.state === 'active' ? <Badge tone="allow">active</Badge> : <Badge tone="deny">{l.error}</Badge>}</td><td>{l.effectiveUsageLocation ?? '—'}{l.source !== 'direct' && !users.find((u) => u.id === l.userId)?.usageLocation ? ' (inherited from tenant)' : ''}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'guests' && (
          <div className="grid gap-3 @3xl:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="label">External collaboration settings</legend>
              <label className="flex items-center justify-between gap-2 text-xs">Guest invite settings
                <select className="input" value={collab.whoCanInvite} onChange={(e) => setCollab({ ...collab, whoCanInvite: e.target.value as CollaborationSettings['whoCanInvite'] })}>
                  <option value="everyone">Anyone, including guests</option><option value="members">Member users (and admins)</option><option value="adminsAndGuestInviters">Only admins and Guest Inviter role</option><option value="none">No one</option>
                </select></label>
              <label className="flex items-center justify-between gap-2 text-xs">Collaboration restrictions
                <select className="input" value={collab.restriction} onChange={(e) => setCollab({ ...collab, restriction: e.target.value as CollaborationSettings['restriction'] })}>
                  <option value="any">Allow any domain</option><option value="deny">Deny specified domains</option><option value="allow">Allow only specified domains</option>
                </select></label>
              <label className="flex flex-col text-xs">Domains (comma separated)<input className="input" value={collab.domains.join(', ')} onChange={(e) => setCollab({ ...collab, domains: e.target.value.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean) })} /></label>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">Invite an external user</legend>
              <input className="input w-full" aria-label="Guest email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <select className="input w-full" aria-label="Inviter" value={inviter} onChange={(e) => setInviter(e.target.value as typeof inviter)}><option value="member">Inviter: member user</option><option value="guest">Inviter: existing guest</option><option value="admin">Inviter: User Administrator</option></select>
              <button type="button" className="btn-primary w-full" onClick={invite}>Send invitation</button>
              <ul className="text-xs">{guests.map((g) => <li key={g.upn}><Badge tone="warn">Guest · PendingAcceptance</Badge> <span className="font-mono">{g.upn}</span></li>)}</ul>
            </fieldset>
          </div>
        )}

        {tab === 'sspr' && (
          <div className="grid gap-3 @3xl:grid-cols-3">
            <fieldset className="space-y-2">
              <legend className="label">Password reset policy</legend>
              <label className="flex items-center justify-between gap-2 text-xs">Enabled for
                <select className="input" value={policy.enabledFor} onChange={(e) => setPolicy({ ...policy, enabledFor: e.target.value as SsprPolicy['enabledFor'] })}><option>None</option><option>Selected</option><option>All</option></select></label>
              <label className="flex items-center justify-between gap-2 text-xs">Methods required
                <select className="input" value={policy.methodsRequired} onChange={(e) => setPolicy({ ...policy, methodsRequired: Number(e.target.value) as 1 | 2 })}><option value={1}>1</option><option value={2}>2</option></select></label>
              {ALL_METHODS.map((m) => (
                <label key={m} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={policy.allowedMethods.includes(m)} onChange={(e) => setPolicy({ ...policy, allowedMethods: e.target.checked ? [...policy.allowedMethods, m] : policy.allowedMethods.filter((x) => x !== m) })} />{m}</label>
              ))}
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={policy.writeback} onChange={(e) => setPolicy({ ...policy, writeback: e.target.checked })} /> Password writeback (Entra Connect / Cloud Sync)</label>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">User tries "Forgot my password"</legend>
              <select className="input w-full" aria-label="User" value={ssprUser} onChange={(e) => setSsprUser(e.target.value)}>{users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select>
              <p className="text-xs">Registered methods:</p>
              {ALL_METHODS.map((m) => {
                const u = users.find((x) => x.id === ssprUser)!
                return <label key={m} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={u.methods.includes(m)} onChange={(e) => setUser(u.id, { methods: e.target.checked ? [...u.methods, m] : u.methods.filter((x) => x !== m) })} />{m}</label>
              })}
              <button type="button" className="btn-primary w-full" onClick={trySspr}>Try to reset password</button>
            </fieldset>
            <div aria-live="polite">
              {ssprResult && (
                <div role="status" className={`rounded border p-2 text-xs ${ssprResult.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}>
                  <Badge tone={ssprResult.ok ? 'allow' : 'deny'}>{ssprResult.ok ? 'RESET ALLOWED' : 'RESET BLOCKED'}</Badge>
                  {ssprResult.ok ? <p className="mt-1">The user verifies {users.find((u) => u.id === ssprUser)?.isAdmin ? 2 : policy.methodsRequired} method(s) and sets a new password.</p> : <ul className="mt-1 ml-4 list-disc">{ssprResult.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                </div>
              )}
            </div>
          </div>
        )}

        {msg && <p role="status" className={`rounded border p-2 text-xs ${msg.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}><Badge tone={msg.ok ? 'allow' : 'deny'}>{msg.ok ? 'OK' : 'BLOCKED'}</Badge> {msg.text}</p>}
        <button type="button" className="btn-ghost" onClick={() => { setUsers(INITIAL_USERS); setGroups(INITIAL_GROUPS); setRuleDraft(INITIAL_GROUPS[0]!.rule!); setGuests([]); setMsg(null); setSsprResult(null) }}>Reset scenario</button>
      </div>
      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="accurate-model">Models a subset of dynamic-rule syntax, direct vs group-based licensing (usage location, CountViolation, no nested groups), B2B invite restrictions and SSPR eligibility including the administrator policy. Processing delays, licence service-plan conflicts and Conditional Access are not modelled.</FidelityNote>
      </div>
    </div>
  )
}
