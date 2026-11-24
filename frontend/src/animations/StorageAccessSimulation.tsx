import { useMemo, useRef, useState } from 'react'
import { AnimationControls, useStepperKeys } from '../components/AnimationControls'
import { usePrefersReducedMotion, useStepper } from '../hooks/useStepper'
import { evaluateStorageRequest, filesAccess, validateIpRule, type AccessResult, type AccountAuthConfig, type AuthMethod, type NetworkConfig, type NtfsRight, type Op, type Request, type SasToken, type ShareRole, type Source } from '../simulations/storageAccess'
import { Badge, DiskNode, FidelityNote, FirewallNode, Link, Packet, UserNode, palette } from './primitives'
import type { SimulationProps } from './types'

const SOURCES: Record<Source, string> = {
  internet: 'Internet client',
  'vnet-service-endpoint': 'VM in snet-app (service endpoint)',
  'vnet-no-endpoint': 'VM in snet-legacy (no endpoint)',
  'private-endpoint': 'VM via private endpoint',
  'same-region-azure': 'Azure service, same region',
  'trusted-service': 'Trusted Azure service (e.g. Azure Backup)',
}
const AUTHS: Record<AuthMethod, string> = {
  'account-key': 'Account key (Shared Key)', 'account-sas': 'Account SAS', 'service-sas': 'Service SAS', 'user-delegation-sas': 'User delegation SAS', 'entra-id': 'Microsoft Entra ID token', anonymous: 'Anonymous',
}
const SHARE_ROLES: ShareRole[] = ['none', 'Storage File Data SMB Share Reader', 'Storage File Data SMB Share Contributor', 'Storage File Data SMB Share Elevated Contributor']
type Tab = 'blob' | 'files'

export default function StorageAccessSimulation({ onLabCheck }: SimulationProps) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('blob')
  const [net, setNet] = useState<NetworkConfig>({ publicAccess: 'selected', ipRules: ['203.0.113.0/24'], vnetRules: [], allowTrustedServices: true })
  const [ipDraft, setIpDraft] = useState('198.51.100.20')
  const [acct, setAcct] = useState<AccountAuthConfig>({ allowSharedKeyAccess: true, keyVersion: { key1: 1, key2: 1 }, allowBlobAnonymousAccess: false, containerAnonymousLevel: 'private', storedPolicies: [{ id: 'partner-read', permissions: ['read', 'list'], expiresInHours: 720 }] })
  const [source, setSource] = useState<Source>('internet')
  const [clientIp, setClientIp] = useState('198.51.100.20')
  const [https, setHttps] = useState(true)
  const [op, setOp] = useState<Op>('read')
  const [auth, setAuth] = useState<AuthMethod>('service-sas')
  const [sas, setSas] = useState<(SasToken & { keyVersionAtSigning: number }) | null>(null)
  const [sasDraft, setSasDraft] = useState({ permissions: ['read'] as Op[], hours: 8, signedWith: 'key1' as 'key1' | 'key2', usePolicy: false, ip: '' })
  const [roles, setRoles] = useState<string[]>(['Owner'])
  const [result, setResult] = useState<AccessResult | null>(null)
  const [files, setFiles] = useState({ identitySource: 'AD DS' as 'none' | 'AD DS' | 'Microsoft Entra Domain Services' | 'Microsoft Entra Kerberos', userSynced: true, port445Open: true, shareRole: 'Storage File Data SMB Share Contributor' as ShareRole, defaultSharePermission: 'none' as ShareRole, ntfs: 'read' as NtfsRight, op: 'write' as 'read' | 'write' | 'change-acl' })
  const [filesResult, setFilesResult] = useState<ReturnType<typeof filesAccess> | null>(null)

  const steps = useMemo(() => {
    if (!result) return ['Build a request and send it to stcontoso.blob.core.windows.net']
    const s = [`${op.toUpperCase()} from ${SOURCES[source]} using ${AUTHS[auth]}`]
    result.steps.forEach((x) => s.push(`${x.layer === 'network' ? 'Network rules' : 'Authorization'}: ${x.ok ? 'pass' : 'fail'}, ${x.detail}`))
    s.push(result.allowed ? 'HTTP 200: request served' : 'HTTP 403: AuthorizationFailure')
    return s
  }, [result, op, source, auth])
  const stepper = useStepper(steps.length, { baseMs: 1200 })
  useStepperKeys(ref, stepper)
  const done = !!result && stepper.atEnd
  const at = !result ? 0 : Math.min(stepper.step, result.allowed ? 3 : result.steps.length)
  const pts: Array<[number, number]> = [[70, 100], [290, 100], [500, 100], [720, 100]]

  const generateSas = () => {
    const type = auth === 'account-sas' ? 'account' : auth === 'user-delegation-sas' ? 'user-delegation' : 'service'
    setSas({
      type, signedWith: type === 'user-delegation' ? 'delegation-key' : sasDraft.signedWith,
      permissions: sasDraft.permissions, expiresInHours: sasDraft.hours, httpsOnly: true,
      allowedIp: sasDraft.ip || undefined, policyId: type === 'service' && sasDraft.usePolicy ? acct.storedPolicies[0]?.id ?? 'deleted-policy' : undefined,
      keyVersionAtSigning: type === 'user-delegation' ? 0 : acct.keyVersion[sasDraft.signedWith],
    })
  }

  const send = () => {
    const r: Request = { source, clientIp, subnet: source === 'vnet-service-endpoint' ? 'snet-app' : undefined, https, op, auth, sas: auth.endsWith('sas') ? sas ?? undefined : undefined, dataRoles: roles }
    if (auth.endsWith('sas') && !sas) { setResult({ allowed: false, status: 403, steps: [{ layer: 'authorization', ok: false, detail: 'Generate a SAS token first.' }] }); stepper.play(); return }
    const res = evaluateStorageRequest(r, net, acct)
    setResult(res)
    stepper.play()
    const netStep = res.steps[0]!
    const authStep = res.steps[1]
    if (!netStep.ok) onLabCheck?.('net-blocked')
    if (netStep.ok && source === 'vnet-service-endpoint') onLabCheck?.('net-vnet-allowed')
    if (netStep.ok && source === 'private-endpoint' && net.publicAccess === 'disabled') onLabCheck?.('private-endpoint')
    if (authStep && !authStep.ok) {
      if (/rotated/.test(authStep.detail)) onLabCheck?.('key-rotated-sas-broken')
      if (/stored access policy/.test(authStep.detail)) onLabCheck?.('policy-revoked')
      if (/grants .* but not/.test(authStep.detail)) onLabCheck?.('sas-denied-permission')
      if (/Shared Key authorization is disallowed/.test(authStep.detail)) onLabCheck?.('shared-key-disabled')
    }
  }

  const ipError = validateIpRule(ipDraft)
  const gate = (i: number) => (!result || stepper.step < i + 1 ? 'neutral' as const : result.steps[i] ? (result.steps[i]!.ok ? 'ok' as const : 'fail' as const) : 'neutral' as const)

  return (
    <div ref={ref} tabIndex={0} className="@container card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="Storage access simulation">
      <div role="tablist" className="flex gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
        <button type="button" role="tab" aria-selected={tab === 'blob'} className={tab === 'blob' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('blob')}>Blob: network + authorization</button>
        <button type="button" role="tab" aria-selected={tab === 'files'} className={tab === 'files' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('files')}>Azure Files: identity-based SMB</button>
      </div>

      {tab === 'blob' && (
        <>
          <svg viewBox="0 0 800 180" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label="Request path: client, storage firewall, authorization, container">
            <Link x1={70} y1={100} x2={720} y2={100} state={done ? (result!.allowed ? 'ok' : 'fail') : undefined} />
            <UserNode x={70} y={100} label={SOURCES[source].split(' (')[0]} sublabel={source === 'internet' ? clientIp : source === 'private-endpoint' ? '10.0.5.4 (PE)' : ''} />
            <FirewallNode x={290} y={100} label="Storage firewall" sublabel={net.publicAccess === 'selected' ? 'selected networks' : net.publicAccess} state={gate(0)} />
            <FirewallNode x={500} y={100} label="Authorization" sublabel={AUTHS[auth]} state={gate(1)} color="#7c4dcc" />
            <DiskNode x={720} y={100} label="container: reports" sublabel="stcontoso" state={done ? (result!.allowed ? 'ok' : 'fail') : 'neutral'} />
            {result && <Packet points={pts} at={at} state={done ? (result.allowed ? 'allowed' : 'denied') : 'moving'} reduced={reduced} label={op.slice(0, 3).toUpperCase()} />}
          </svg>
          <AnimationControls stepper={stepper} stepLabels={steps} regionLabel="Storage access simulation" />
          {done && result && (
            <div role="status" className={`border-t px-3 py-2 text-sm ${result.allowed ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}>
              <Badge tone={result.allowed ? 'allow' : 'deny'}>HTTP {result.status}</Badge> {result.steps.at(-1)!.detail}
            </div>
          )}
          <div className="grid gap-3 border-t border-slate-200 p-3 text-sm @3xl:grid-cols-3 dark:border-slate-800">
            <fieldset className="space-y-2">
              <legend className="label">Request</legend>
              <select className="input w-full" aria-label="Source" value={source} onChange={(e) => setSource(e.target.value as Source)}>{Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              {source === 'internet' && <input className="input w-full font-mono" aria-label="Client IP" value={clientIp} onChange={(e) => setClientIp(e.target.value)} />}
              <div className="flex gap-2">
                <select className="input flex-1" aria-label="Operation" value={op} onChange={(e) => setOp(e.target.value as Op)}>{(['read', 'write', 'delete', 'list'] as Op[]).map((o) => <option key={o}>{o}</option>)}</select>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={https} onChange={(e) => setHttps(e.target.checked)} />HTTPS</label>
              </div>
              <select className="input w-full" aria-label="Authorization method" value={auth} onChange={(e) => { setAuth(e.target.value as AuthMethod); setSas(null) }}>{Object.entries(AUTHS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              {auth === 'entra-id' && (
                <div className="space-y-1 text-xs">{['Owner', 'Storage Blob Data Reader', 'Storage Blob Data Contributor'].map((r) => (
                  <label key={r} className="flex items-center gap-1"><input type="checkbox" checked={roles.includes(r)} onChange={(e) => setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))} />{r}</label>
                ))}</div>
              )}
              {auth.endsWith('sas') && (
                <div className="space-y-1 rounded border border-slate-200 p-2 text-xs dark:border-slate-700">
                  <p className="font-semibold">Generate SAS</p>
                  <div className="flex flex-wrap gap-2">{(['read', 'write', 'delete', 'list'] as Op[]).map((p) => (
                    <label key={p} className="flex items-center gap-1"><input type="checkbox" checked={sasDraft.permissions.includes(p)} disabled={sasDraft.usePolicy} onChange={(e) => setSasDraft({ ...sasDraft, permissions: e.target.checked ? [...sasDraft.permissions, p] : sasDraft.permissions.filter((x) => x !== p) })} />{p}</label>
                  ))}</div>
                  <label className="flex items-center justify-between">Expires in (h)<input type="number" className="input w-16" value={sasDraft.hours} onChange={(e) => setSasDraft({ ...sasDraft, hours: Number(e.target.value) })} /></label>
                  {auth !== 'user-delegation-sas' && <label className="flex items-center justify-between">Signing key<select className="input" value={sasDraft.signedWith} onChange={(e) => setSasDraft({ ...sasDraft, signedWith: e.target.value as 'key1' | 'key2' })}><option>key1</option><option>key2</option></select></label>}
                  <label className="flex items-center justify-between">Allowed IP (sip)<input className="input w-28" value={sasDraft.ip} placeholder="any" onChange={(e) => setSasDraft({ ...sasDraft, ip: e.target.value })} /></label>
                  {auth === 'service-sas' && <label className="flex items-center gap-1"><input type="checkbox" checked={sasDraft.usePolicy} onChange={(e) => setSasDraft({ ...sasDraft, usePolicy: e.target.checked })} />Use stored access policy ({acct.storedPolicies[0]?.id ?? 'none'})</label>}
                  <button type="button" className="btn-ghost w-full" onClick={generateSas}>Generate SAS</button>
                  {sas && <p className="break-all font-mono">?sv=2022-11-02&amp;sp={sas.policyId ? '' : sas.permissions.map((p) => p[0]).join('')}&amp;se=+{sas.expiresInHours}h{sas.policyId ? `&si=${sas.policyId}` : ''}{sas.allowedIp ? `&sip=${sas.allowedIp}` : ''}&amp;spr=https&amp;sig=({sas.signedWith}{sas.signedWith !== 'delegation-key' ? ` v${sas.keyVersionAtSigning}` : ''})</p>}
                </div>
              )}
              <button type="button" className="btn-primary w-full" onClick={send}>Send request</button>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">Networking</legend>
              <select className="input w-full" aria-label="Public network access" value={net.publicAccess} onChange={(e) => setNet({ ...net, publicAccess: e.target.value as NetworkConfig['publicAccess'] })}>
                <option value="all">Enabled from all networks</option><option value="selected">Enabled from selected networks and IPs</option><option value="disabled">Disabled (private endpoints only)</option>
              </select>
              <div className="flex gap-1">
                <input className="input flex-1 font-mono" aria-label="IP rule" value={ipDraft} onChange={(e) => setIpDraft(e.target.value)} />
                <button type="button" className="btn-ghost" disabled={!!ipError} onClick={() => setNet({ ...net, ipRules: [...new Set([...net.ipRules, ipDraft])] })}>Add IP rule</button>
              </div>
              {ipError && <p className="text-xs text-red-600">{ipError}</p>}
              <ul className="text-xs">{net.ipRules.map((r) => <li key={r} className="flex justify-between"><span className="font-mono">{r}</span><button type="button" className="text-red-600" aria-label={`Remove IP rule ${r}`} onClick={() => setNet({ ...net, ipRules: net.ipRules.filter((x) => x !== r) })}>✕</button></li>)}</ul>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={net.vnetRules.includes('snet-app')} onChange={(e) => setNet({ ...net, vnetRules: e.target.checked ? ['snet-app'] : [] })} />VNet rule: vnet-prod/snet-app (service endpoint enabled)</label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={net.allowTrustedServices} onChange={(e) => setNet({ ...net, allowTrustedServices: e.target.checked })} />Allow trusted Azure services</label>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">Keys, Shared Key and stored access policies</legend>
              <p className="text-xs">key1 v{acct.keyVersion.key1} · key2 v{acct.keyVersion.key2}</p>
              <div className="flex gap-1">
                <button type="button" className="btn-ghost flex-1" onClick={() => setAcct({ ...acct, keyVersion: { ...acct.keyVersion, key1: acct.keyVersion.key1 + 1 } })}>Rotate key1</button>
                <button type="button" className="btn-ghost flex-1" onClick={() => setAcct({ ...acct, keyVersion: { ...acct.keyVersion, key2: acct.keyVersion.key2 + 1 } })}>Rotate key2</button>
              </div>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={acct.allowSharedKeyAccess} onChange={(e) => setAcct({ ...acct, allowSharedKeyAccess: e.target.checked })} />Allow storage account key access (Shared Key)</label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={acct.allowBlobAnonymousAccess} onChange={(e) => setAcct({ ...acct, allowBlobAnonymousAccess: e.target.checked })} />Allow blob anonymous access</label>
              <select className="input w-full text-xs" aria-label="Container anonymous access level" value={acct.containerAnonymousLevel} onChange={(e) => setAcct({ ...acct, containerAnonymousLevel: e.target.value as AccountAuthConfig['containerAnonymousLevel'] })}><option value="private">Container level: Private</option><option value="blob">Container level: Blob</option><option value="container">Container level: Container</option></select>
              <ul className="text-xs">{acct.storedPolicies.map((p) => (
                <li key={p.id} className="flex items-center justify-between"><span>Policy <span className="font-mono">{p.id}</span>: {p.permissions.join('/')} · {p.expiresInHours} h</span>
                  <button type="button" className="text-red-600" aria-label={`Delete stored access policy ${p.id}`} onClick={() => setAcct({ ...acct, storedPolicies: acct.storedPolicies.filter((x) => x.id !== p.id) })}>Delete</button></li>
              ))}</ul>
              {acct.storedPolicies.length === 0 && <button type="button" className="btn-ghost w-full" onClick={() => setAcct({ ...acct, storedPolicies: [{ id: 'partner-read', permissions: ['read', 'list'], expiresInHours: 720 }] })}>Re-create policy partner-read</button>}
            </fieldset>
          </div>
        </>
      )}

      {tab === 'files' && (
        <div className="grid gap-3 p-3 text-sm @3xl:grid-cols-3">
          <svg viewBox="0 0 320 170" className="w-full text-slate-700 @3xl:col-span-3 dark:text-slate-200" role="img" aria-label="SMB access path: client, port 445, share-level permission, NTFS permission">
            {[['Client (domain-joined)', 30], ['TCP 445', 105], ['Share-level (RBAC)', 185], ['NTFS ACL', 265]].map(([l, x], i) => {
              const r = filesResult
              const fail = r && !r.ok && ((i === 1 && r.reasons.some((x) => x.includes('445'))) || (i === 2 && r.reasons.some((x) => x.includes('Share-level'))) || (i === 3 && r.reasons.some((x) => x.includes('NTFS'))))
              return <g key={l as string}><rect x={(x as number) - 34} y={60} width={68} height={40} rx={8} fill={fail ? palette.deny : r?.ok ? palette.allow : palette.azure} fillOpacity={0.15} stroke={fail ? palette.deny : r?.ok ? palette.allow : palette.azure} /><text x={x as number} y={84} textAnchor="middle" fontSize={8.5} fill="currentColor">{l}</text></g>
            })}
          </svg>
          <fieldset className="space-y-2">
            <legend className="label">Storage account</legend>
            <select className="input w-full" aria-label="Identity source" value={files.identitySource} onChange={(e) => setFiles({ ...files, identitySource: e.target.value as typeof files.identitySource })}>{['none', 'AD DS', 'Microsoft Entra Domain Services', 'Microsoft Entra Kerberos'].map((s) => <option key={s}>{s}</option>)}</select>
            <select className="input w-full text-xs" aria-label="Default share-level permission" value={files.defaultSharePermission} onChange={(e) => setFiles({ ...files, defaultSharePermission: e.target.value as ShareRole })}>{SHARE_ROLES.map((r) => <option key={r} value={r}>Default share-level: {r}</option>)}</select>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="label">User and client</legend>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={files.userSynced} onChange={(e) => setFiles({ ...files, userSynced: e.target.checked })} />User is a hybrid identity (synced)</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={files.port445Open} onChange={(e) => setFiles({ ...files, port445Open: e.target.checked })} />Outbound TCP 445 open</label>
            <select className="input w-full text-xs" aria-label="Share-level role" value={files.shareRole} onChange={(e) => setFiles({ ...files, shareRole: e.target.value as ShareRole })}>{SHARE_ROLES.map((r) => <option key={r} value={r}>Role: {r}</option>)}</select>
            <select className="input w-full text-xs" aria-label="NTFS permission" value={files.ntfs} onChange={(e) => setFiles({ ...files, ntfs: e.target.value as NtfsRight })}>{(['none', 'read', 'modify', 'full'] as NtfsRight[]).map((r) => <option key={r} value={r}>NTFS: {r}</option>)}</select>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="label">Operation</legend>
            <select className="input w-full" aria-label="File operation" value={files.op} onChange={(e) => setFiles({ ...files, op: e.target.value as typeof files.op })}><option value="read">Read a file</option><option value="write">Write a file</option><option value="change-acl">Change ACLs</option></select>
            <button type="button" className="btn-primary w-full" onClick={() => { const r = filesAccess(files); setFilesResult(r); if (r.ok) onLabCheck?.('files-ok'); else if (r.reasons.some((x) => x.includes('NTFS'))) onLabCheck?.('files-ntfs-blocked') }}>Access \\stcontoso.file.core.windows.net\share</button>
            {filesResult && <div role="status" className={`rounded border p-2 text-xs ${filesResult.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}><Badge tone={filesResult.ok ? 'allow' : 'deny'}>{filesResult.ok ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</Badge><ul className="ml-4 list-disc">{filesResult.reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>}
          </fieldset>
        </div>
      )}
      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="accurate-model">Network rule precedence, SAS validation (key version, permissions, expiry, sip, spr, stored access policy), Shared Key disablement, data roles, and the two-layer Azure Files permission model follow Microsoft documentation. Resource instance rules, CORS and Kerberos ticket details are not modelled.</FidelityNote>
      </div>
    </div>
  )
}
