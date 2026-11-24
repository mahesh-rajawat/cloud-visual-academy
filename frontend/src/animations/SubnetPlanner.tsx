import { useEffect, useState } from 'react'
import { azureSubnet, canPeer, parseCidr, size, validateVnetPlan } from '../simulations/subnet'
import { Badge, FidelityNote } from './primitives'
import type { SimulationProps } from './types'

export default function SubnetPlanner({ onLabCheck }: SimulationProps) {
  const [space, setSpace] = useState('10.10.0.0/16')
  const [subnets, setSubnets] = useState(['10.10.1.0/24', '10.10.2.0/24'])
  const [draft, setDraft] = useState('10.10.1.128/25')
  const [selected, setSelected] = useState(0)
  const [peer, setPeer] = useState('10.10.128.0/17')

  let spaceOk = true
  try { parseCidr(space) } catch { spaceOk = false }
  const issues = spaceOk ? validateVnetPlan([space], subnets) : []
  let peerRes: ReturnType<typeof canPeer> | null = null
  try { peerRes = spaceOk ? canPeer([space], [peer]) : null } catch { peerRes = null }
  const sel = subnets[selected]
  let info: ReturnType<typeof azureSubnet> | null = null
  try { info = sel ? azureSubnet(sel) : null } catch { info = null }

  useEffect(() => { if (issues.length) onLabCheck?.('overlap-detected') }, [issues.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (spaceOk && subnets.length >= 2 && issues.length === 0 && peerRes?.ok) onLabCheck?.('valid-plan') }, [spaceOk, subnets.length, issues.length, peerRes?.ok]) // eslint-disable-line react-hooks/exhaustive-deps

  // Address-space bar: each subnet drawn proportionally inside the VNet range.
  const bar = spaceOk ? parseCidr(space) : null
  const total = bar ? size(bar) : 1

  return (
    <div className="card space-y-3 p-3 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col"><span className="label">VNet address space</span><input className="input font-mono" value={space} onChange={(e) => setSpace(e.target.value)} aria-invalid={!spaceOk} /></label>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setSubnets([...subnets, draft.trim()]); setSelected(subnets.length) } }}>
          <label className="flex flex-col"><span className="label">New subnet</span><input className="input font-mono" value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
          <button className="btn-primary" type="submit">Add subnet</button>
        </form>
        <label className="flex flex-col"><span className="label">Peer VNet address space</span><input className="input font-mono" value={peer} onChange={(e) => setPeer(e.target.value)} /></label>
      </div>

      {bar && (
        <svg viewBox="0 0 800 54" className="w-full" role="img" aria-label="Address space usage">
          <rect x={0} y={10} width={800} height={30} rx={6} fill="#0a7cd6" fillOpacity={0.08} stroke="#0a7cd6" />
          {subnets.map((s, i) => {
            try {
              const c = parseCidr(s)
              const x = ((c.network - bar.network) / total) * 800
              const w = Math.max(2, (size(c) / total) * 800)
              const bad = issues.some((iss) => iss.subnet === s)
              if (x < 0 || x > 800) return null
              return <rect key={i} x={x} y={10} width={Math.min(w, 800 - x)} height={30} fill={bad ? '#d23b3b' : '#15935a'} fillOpacity={0.6} stroke={i === selected ? '#0f172a' : 'none'} onClick={() => { setSelected(i); onLabCheck?.('reserved-5') }} style={{ cursor: 'pointer' }}><title>{s}</title></rect>
            } catch { return null }
          })}
          <text x={4} y={52} fontSize={10} fill="#64748b">{space}: {total.toLocaleString()} addresses (bar not to scale below 0.25%)</text>
        </svg>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="mb-1 font-semibold">Subnets</h4>
          <ul className="space-y-1">
            {subnets.map((s, i) => (
              <li key={`${s}-${i}`} className="flex items-center gap-2">
                <button type="button" className={`font-mono ${i === selected ? 'font-bold underline' : ''}`} onClick={() => { setSelected(i); onLabCheck?.('reserved-5') }}>{s}</button>
                {issues.filter((iss) => iss.subnet === s).map((iss) => <Badge key={iss.problem} tone="deny">{iss.problem}</Badge>)}
                <button type="button" className="ml-auto text-red-600" aria-label={`Remove ${s}`} onClick={() => { setSubnets(subnets.filter((_, j) => j !== i)); setSelected(0) }}>✕</button>
              </li>
            ))}
          </ul>
          {!spaceOk && <p className="text-red-600">Invalid address space.</p>}
          {peerRes && <p className="mt-2">Peering with {peer}: {peerRes.ok ? <Badge tone="allow">possible, no overlap</Badge> : <Badge tone="deny">blocked: overlaps {peerRes.conflicts.map((c) => c[0]).join(', ')}</Badge>}</p>}
        </div>
        {info && (
          <div>
            <h4 className="mb-1 font-semibold">Subnet {info.cidr}</h4>
            <dl className="grid grid-cols-2 gap-x-2 text-xs">
              <dt className="label">Total addresses</dt><dd>{info.totalAddresses.toLocaleString()}</dd>
              <dt className="label">Usable in Azure</dt><dd className="font-semibold">{info.usableByAzure.toLocaleString()}</dd>
              <dt className="label">First usable</dt><dd className="font-mono">{info.firstUsable}</dd>
              <dt className="label">Last usable</dt><dd className="font-mono">{info.lastUsable}</dd>
            </dl>
            <p className="label mt-2">Reserved by Azure</p>
            <ul className="font-mono text-xs">
              {info.reserved.map((ip, i) => <li key={ip}>{ip}: {['network address', 'default gateway', 'Azure DNS mapping', 'Azure DNS mapping', 'broadcast'][i]}</li>)}
            </ul>
            {info.errors.map((e) => <p key={e} className="text-red-600">{e}</p>)}
          </div>
        )}
      </div>
      <FidelityNote fidelity="accurate-model">IPv4 CIDR arithmetic with Azure's five reserved addresses and /29–/2 subnet limits. Special-subnet name and size rules are covered in the lesson text.</FidelityNote>
    </div>
  )
}
