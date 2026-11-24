import { useState } from 'react'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '../hooks/useStepper'
import { KIND_INFO, buildAzCopy, validateAccount, validateContainerName, validateShare, type AccountDraft, type AccountKind, type AzCopyDraft, type Redundancy, type ShareDraft } from '../simulations/storageAccount'
import { Badge, FidelityNote, palette } from './primitives'
import type { SimulationProps } from './types'

type Tab = 'create' | 'data' | 'tools'
const TAKEN = ['contoso', 'storage', 'stcontoso']

export default function StorageAccountSimulation({ onLabCheck }: SimulationProps) {
  const reduced = usePrefersReducedMotion()
  const [tab, setTab] = useState<Tab>('create')
  const [d, setD] = useState<AccountDraft>({ name: 'StContoso', kind: 'StorageV2', redundancy: 'GRS', hierarchicalNamespace: false, minimumTls: '1.0', secureTransfer: true, allowBlobAnonymousAccess: true, encryption: { keySource: 'Microsoft-managed', vaultSoftDelete: true, vaultPurgeProtection: false, identityHasKeyAccess: false, infrastructureEncryption: false } })
  const [created, setCreated] = useState<{ infra: boolean } | null>(null)
  const [createMsg, setCreateMsg] = useState<string[] | null>(null)
  const [container, setContainer] = useState({ name: 'Reports_2026', level: 'private' as 'private' | 'blob' | 'container' })
  const [containers, setContainers] = useState<string[]>([])
  const [share, setShare] = useState<ShareDraft>({ name: 'finance', protocol: 'NFS', tier: 'Transaction optimized', quotaGiB: 6000 })
  const [largeShares, setLargeShares] = useState(false)
  const [shares, setShares] = useState<string[]>([])
  const [dataMsg, setDataMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [az, setAz] = useState<AzCopyDraft>({ verb: 'copy', source: 'local', dest: 'blob', auth: 'login', recursive: true, deleteDestination: false, hasDataRole: false })

  const v = validateAccount(d, { existing: !!created, existingInfraEncryption: created?.infra, taken: TAKEN })
  const kindInfo = KIND_INFO[d.kind]
  const azResult = buildAzCopy(az)

  const create = () => {
    if (v.errors.length) { setCreateMsg(v.errors); onLabCheck?.('account-validation'); return }
    setCreateMsg(null)
    if (!created) setCreated({ infra: d.encryption.infrastructureEncryption })
    if (d.encryption.keySource === 'Customer-managed') onLabCheck?.('cmk-configured')
    onLabCheck?.('account-created')
  }

  return (
    <div className="@container card overflow-hidden">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
        {([['create', created ? 'Account settings' : 'Create account'], ['data', 'Containers & file shares'], ['tools', 'AzCopy & Storage Explorer']] as const).map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>

      <svg viewBox="0 0 800 120" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-label="Storage account and its service endpoints">
        <rect x={20} y={20} width={210} height={80} rx={12} fill={palette.azure} fillOpacity={0.08} stroke={created ? palette.allow : palette.azure} strokeDasharray={created ? undefined : '6 4'} />
        <text x={32} y={44} fontSize={12} fontWeight={700} fill="currentColor">{d.name || '<name>'}</text>
        <text x={32} y={62} fontSize={10} fill={palette.muted}>{kindInfo.label}</text>
        <text x={32} y={78} fontSize={10} fill={palette.muted}>{d.redundancy} · {d.encryption.keySource} keys{d.encryption.infrastructureEncryption ? ' · double encryption' : ''}</text>
        {v.endpoints.map((e, i) => (
          <motion.g key={e} initial={reduced ? false : { opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
            <line x1={230} y1={60} x2={300} y2={14 + i * 20} stroke={palette.muted} />
            <text x={306} y={18 + i * 20} fontSize={10.5} fontFamily="monospace" fill="currentColor">{e}</text>
          </motion.g>
        ))}
      </svg>

      <div className="space-y-3 border-t border-slate-200 p-3 text-sm dark:border-slate-800">
        {tab === 'create' && (
          <div className="grid gap-3 @3xl:grid-cols-3">
            <fieldset className="space-y-2">
              <legend className="label">Basics</legend>
              <input className="input w-full font-mono" aria-label="Storage account name" value={d.name} disabled={!!created} onChange={(e) => setD({ ...d, name: e.target.value })} />
              <select className="input w-full" aria-label="Account type" value={d.kind} disabled={!!created} onChange={(e) => setD({ ...d, kind: e.target.value as AccountKind })}>{Object.entries(KIND_INFO).map(([k, i]) => <option key={k} value={k}>{i.performance}: {i.label}</option>)}</select>
              <select className="input w-full" aria-label="Redundancy" value={d.redundancy} onChange={(e) => setD({ ...d, redundancy: e.target.value as Redundancy })}>{(['LRS', 'ZRS', 'GRS', 'RA-GRS', 'GZRS', 'RA-GZRS'] as Redundancy[]).map((r) => <option key={r}>{r}</option>)}</select>
              <p className="text-xs text-slate-500">Services: {kindInfo.services.join(', ')}</p>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">Advanced & security</legend>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.secureTransfer} onChange={(e) => setD({ ...d, secureTransfer: e.target.checked })} />Require secure transfer</label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.allowBlobAnonymousAccess} onChange={(e) => setD({ ...d, allowBlobAnonymousAccess: e.target.checked })} />Allow blob anonymous access</label>
              <label className="flex items-center justify-between text-xs">Minimum TLS<select className="input" value={d.minimumTls} onChange={(e) => setD({ ...d, minimumTls: e.target.value as AccountDraft['minimumTls'] })}><option>1.0</option><option>1.1</option><option>1.2</option></select></label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.hierarchicalNamespace} disabled={!!created} onChange={(e) => setD({ ...d, hierarchicalNamespace: e.target.checked })} />Hierarchical namespace (Data Lake Gen2)</label>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">Encryption (always on: AES-256)</legend>
              <select className="input w-full" aria-label="Key source" value={d.encryption.keySource} onChange={(e) => setD({ ...d, encryption: { ...d.encryption, keySource: e.target.value as 'Microsoft-managed' | 'Customer-managed' } })}><option>Microsoft-managed</option><option>Customer-managed</option></select>
              {d.encryption.keySource === 'Customer-managed' && <>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.encryption.vaultSoftDelete} onChange={(e) => setD({ ...d, encryption: { ...d.encryption, vaultSoftDelete: e.target.checked } })} />Key vault soft delete</label>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.encryption.vaultPurgeProtection} onChange={(e) => setD({ ...d, encryption: { ...d.encryption, vaultPurgeProtection: e.target.checked } })} />Key vault purge protection</label>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.encryption.identityHasKeyAccess} onChange={(e) => setD({ ...d, encryption: { ...d.encryption, identityHasKeyAccess: e.target.checked } })} />Managed identity has Key Vault Crypto Service Encryption User</label>
              </>}
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.encryption.infrastructureEncryption} onChange={(e) => setD({ ...d, encryption: { ...d.encryption, infrastructureEncryption: e.target.checked } })} />Infrastructure encryption (double)</label>
              <button type="button" className="btn-primary w-full" onClick={create}>{created ? 'Save settings' : 'Review + create'}</button>
            </fieldset>
            <div className="@3xl:col-span-3" aria-live="polite">
              {createMsg && <div role="status" className="rounded border border-red-300 bg-red-50 p-2 text-xs dark:bg-red-950/30"><Badge tone="deny">VALIDATION FAILED</Badge><ul className="ml-4 list-disc">{createMsg.map((m) => <li key={m}>{m}</li>)}</ul></div>}
              {!createMsg && created && <p role="status" className="text-xs"><Badge tone="allow">DEPLOYED</Badge> {d.name}. Some settings are now fixed (name, type, hierarchical namespace, infrastructure encryption).</p>}
              {v.warnings.length > 0 && <ul className="mt-1 text-xs text-amber-700 dark:text-amber-300">{v.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className="grid gap-3 @3xl:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="label">Blob container</legend>
              <input className="input w-full font-mono" aria-label="Container name" value={container.name} onChange={(e) => setContainer({ ...container, name: e.target.value })} />
              <select className="input w-full" aria-label="Anonymous access level" value={container.level} onChange={(e) => setContainer({ ...container, level: e.target.value as typeof container.level })}><option value="private">Private (no anonymous access)</option><option value="blob">Blob (anonymous read for blobs)</option><option value="container">Container (anonymous read and list)</option></select>
              <button type="button" className="btn-primary w-full" onClick={() => {
                const err = validateContainerName(container.name) ?? (container.level !== 'private' && !d.allowBlobAnonymousAccess ? 'Anonymous access is disallowed on the storage account, so only Private is possible.' : null) ?? (d.kind === 'FileStorage' ? 'Premium file share accounts have no Blob service.' : null)
                setDataMsg(err ? { ok: false, text: err } : { ok: true, text: `Container ${container.name} created (${container.level}).` })
                if (!err) { setContainers((c) => [...c, container.name]); onLabCheck?.('container-created') }
              }}>Create container</button>
              <ul className="text-xs font-mono">{containers.map((c) => <li key={c}>📦 {c}</li>)}</ul>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="label">File share</legend>
              <input className="input w-full font-mono" aria-label="Share name" value={share.name} onChange={(e) => setShare({ ...share, name: e.target.value })} />
              <div className="flex gap-2">
                <select className="input flex-1" aria-label="Protocol" value={share.protocol} onChange={(e) => setShare({ ...share, protocol: e.target.value as 'SMB' | 'NFS' })}><option>SMB</option><option>NFS</option></select>
                <select className="input flex-1" aria-label="Share tier" value={share.tier} onChange={(e) => setShare({ ...share, tier: e.target.value as ShareDraft['tier'] })}>{['Transaction optimized', 'Hot', 'Cool', 'Premium (provisioned)'].map((t) => <option key={t}>{t}</option>)}</select>
              </div>
              <label className="flex items-center justify-between text-xs">Quota (GiB)<input type="number" className="input w-24" value={share.quotaGiB} onChange={(e) => setShare({ ...share, quotaGiB: Number(e.target.value) })} /></label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={largeShares} onChange={(e) => setLargeShares(e.target.checked)} />Large file shares enabled (up to 100 TiB)</label>
              <button type="button" className="btn-primary w-full" onClick={() => {
                const errs = validateShare(share, d.kind, largeShares)
                setDataMsg(errs.length ? { ok: false, text: errs.join(' ') } : { ok: true, text: `Share ${share.name} created (${share.protocol}, ${share.tier}, ${share.quotaGiB} GiB). Mount on Windows: net use Z: \\\\${d.name}.file.core.windows.net\\${share.name} (TCP 445).` })
                if (!errs.length) { setShares((s) => [...s, share.name]); onLabCheck?.('share-created') } else onLabCheck?.('share-validation')
              }}>Create file share</button>
              <ul className="text-xs font-mono">{shares.map((s) => <li key={s}>🗂 {s}</li>)}</ul>
            </fieldset>
            {dataMsg && <p role="status" className={`rounded border p-2 text-xs @3xl:col-span-2 ${dataMsg.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}><Badge tone={dataMsg.ok ? 'allow' : 'deny'}>{dataMsg.ok ? 'OK' : 'ERROR'}</Badge> {dataMsg.text}</p>}
          </div>
        )}

        {tab === 'tools' && (
          <div className="grid gap-3 @3xl:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="label">AzCopy command builder</legend>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col">Verb<select className="input" value={az.verb} onChange={(e) => setAz({ ...az, verb: e.target.value as AzCopyDraft['verb'] })}><option>copy</option><option>sync</option></select></label>
                <label className="flex flex-col">Authorization<select className="input" value={az.auth} onChange={(e) => setAz({ ...az, auth: e.target.value as AzCopyDraft['auth'] })}><option value="login">azcopy login (Entra ID)</option><option value="sas">SAS token</option></select></label>
                <label className="flex flex-col">Source<select className="input" value={az.source} onChange={(e) => setAz({ ...az, source: e.target.value as AzCopyDraft['source'] })}><option value="local">Local folder</option><option value="blob">Blob container</option><option value="other-account">Container in another account</option></select></label>
                <label className="flex flex-col">Destination<select className="input" value={az.dest} onChange={(e) => setAz({ ...az, dest: e.target.value as AzCopyDraft['dest'] })}><option value="blob">Blob container</option><option value="file-share">File share</option><option value="local">Local folder</option></select></label>
              </div>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={az.recursive} onChange={(e) => setAz({ ...az, recursive: e.target.checked })} />--recursive</label>
              {az.verb === 'sync' && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={az.deleteDestination} onChange={(e) => setAz({ ...az, deleteDestination: e.target.checked })} />--delete-destination=true</label>}
              {az.auth === 'login' && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={az.hasDataRole} onChange={(e) => { setAz({ ...az, hasDataRole: e.target.checked }); if (e.target.checked) onLabCheck?.('azcopy-role') }} />Identity has Storage Blob Data Contributor</label>}
            </fieldset>
            <div className="space-y-2" aria-live="polite">
              <pre className="code">{azResult.command}</pre>
              {azResult.errors.map((e) => <p key={e} className="text-xs text-red-600">✗ {e}</p>)}
              {azResult.notes.map((n) => <p key={n} className="text-xs text-slate-600 dark:text-slate-400">• {n}</p>)}
              <button type="button" className="btn-ghost" onClick={() => onLabCheck?.('azcopy-built')}>Mark command as reviewed</button>
              <p className="text-xs text-slate-500">Azure Storage Explorer is a free desktop app that browses blobs, files, queues and tables, connects with Entra ID, account keys, SAS or connection strings, and uses AzCopy for transfers.</p>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="accurate-model">Name rules, redundancy per account type, CMK prerequisites, settings fixed at creation, container/share rules and AzCopy authorization requirements follow Microsoft documentation. Pricing and regional availability are not modelled.</FidelityNote>
      </div>
    </div>
  )
}
