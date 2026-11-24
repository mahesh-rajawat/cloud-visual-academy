import { useMemo, useRef, useState } from 'react'
import { AnimationControls, useStepperKeys } from '../components/AnimationControls'
import { usePrefersReducedMotion, useStepper } from '../hooks/useStepper'
import { DEFAULT_RULES, effectiveRules, evaluateFlow, validateRule, type Direction, type Flow, type FlowResult, type Nsg, type NsgRule, type Protocol } from '../simulations/nsg'
import { Badge, FidelityNote, FirewallNode, GlobeNode, IpNode, Link, Packet, UserNode, VmNode } from './primitives'
import type { SimulationProps } from './types'

const SOURCES = {
  internet: { label: 'Internet client', ip: '203.0.113.10' },
  vnet: { label: 'VM in same VNet', ip: '10.0.2.5' },
  probe: { label: 'Azure LB probe', ip: '168.63.129.16' },
} as const
type SourceKey = keyof typeof SOURCES

const PORTS = [22, 80, 443, 1433, 3389]

const blankRule = (): NsgRule => ({ name: 'Allow-HTTPS', priority: 200, direction: 'Inbound', access: 'Allow', protocol: 'TCP', source: 'Internet', sourcePorts: '*', destination: '*', destinationPorts: '443' })

interface TimelineStep { label: string; at: number; level?: 0 | 1; reveal?: boolean }

function buildTimeline(result: FlowResult, direction: Direction): TimelineStep[] {
  const steps: TimelineStep[] = [{ label: direction === 'Inbound' ? 'Packet leaves the source' : 'VM sends a packet', at: 0 }]
  if (direction === 'Inbound') steps.push({ label: 'Arrives at the Standard public IP', at: 1 })
  result.levels.forEach((l, i) => {
    const pos = direction === 'Inbound' ? 2 + i : 1 + i
    steps.push({ label: `${l.level === 'subnet' ? 'Subnet' : 'NIC'} NSG ${l.nsgName ? 'evaluates rules by priority' : 'not associated: no filtering'}`, at: pos, level: i as 0 | 1 })
    if (l.access !== 'NotFiltered') steps.push({ label: `${l.rule?.name} (${l.rule?.priority}) → ${l.access}`, at: pos, level: i as 0 | 1, reveal: true })
  })
  if (result.allowed) steps.push({ label: direction === 'Inbound' ? 'Delivered to vm-web-01' : 'Leaves toward the internet', at: direction === 'Inbound' ? 4 : 3 })
  else steps.push({ label: 'Dropped', at: steps[steps.length - 1]!.at })
  return steps
}

export default function NsgSimulation({ onLabCheck }: SimulationProps) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [subnetEnabled, setSubnetEnabled] = useState(true)
  const [nicEnabled, setNicEnabled] = useState(false)
  const [subnetRules, setSubnetRules] = useState<NsgRule[]>([])
  const [nicRules, setNicRules] = useState<NsgRule[]>([])
  const [editing, setEditing] = useState<'subnet' | 'nic'>('subnet')
  const [draft, setDraft] = useState<NsgRule>(blankRule())
  const [direction, setDirection] = useState<Direction>('Inbound')
  const [source, setSource] = useState<SourceKey>('internet')
  const [port, setPort] = useState(443)
  const [protocol, setProtocol] = useState<Exclude<Protocol, '*'>>('TCP')
  const [vmAsg, setVmAsg] = useState('web')
  const [sent, setSent] = useState<{ result: FlowResult; flow: Flow } | null>(null)
  const [inspect, setInspect] = useState<string | null>(null)

  const subnetNsg: Nsg | null = subnetEnabled ? { name: 'nsg-web-subnet', rules: subnetRules } : null
  const nicNsg: Nsg | null = nicEnabled ? { name: 'nsg-vm-nic', rules: nicRules } : null

  const timeline = useMemo(() => (sent ? buildTimeline(sent.result, sent.flow.direction) : [{ label: 'Configure rules, then send a packet', at: 0 }]), [sent])
  const stepper = useStepper(timeline.length, { baseMs: 1100 })
  useStepperKeys(ref, stepper)
  const cur = timeline[stepper.step]!

  const send = () => {
    const vmIp = '10.0.1.4'
    const flow: Flow = direction === 'Inbound'
      ? { direction, protocol, sourceIp: SOURCES[source].ip, sourcePort: 50123, destinationIp: vmIp, destinationPort: port, vmAsgs: vmAsg ? [vmAsg] : [], viaStandardPublicIp: source === 'internet', vnetPrefixes: ['10.0.0.0/16'] }
      : { direction, protocol, sourceIp: vmIp, sourcePort: 50123, destinationIp: '203.0.113.10', destinationPort: port, vmAsgs: vmAsg ? [vmAsg] : [], vnetPrefixes: ['10.0.0.0/16'] }
    const result = evaluateFlow(flow, subnetNsg, nicNsg)
    setSent({ result, flow })
    stepper.play()
    if (direction === 'Inbound') {
      const deciding = result.levels.find((l) => l.access === 'Deny') ?? result.levels.filter((l) => l.rule).at(-1)
      if (!result.allowed && deciding?.rule?.name === 'DenyAllInBound') onLabCheck?.('observed-default-deny')
      if (result.allowed && port === 443 && result.levels.some((l) => l.rule && !l.rule.isDefault)) onLabCheck?.('allowed-https')
      if (!result.allowed && result.levels[0]?.access === 'Allow' && result.levels[1]?.access === 'Deny') onLabCheck?.('observed-nic-deny')
    }
  }

  const rules = editing === 'subnet' ? subnetRules : nicRules
  const setRules = editing === 'subnet' ? setSubnetRules : setNicRules
  const draftErrors = validateRule(draft).concat(rules.some((r) => r.priority === draft.priority && r.direction === draft.direction) ? ['Another rule in this direction already uses that priority.'] : [])

  const injections: Array<{ label: string; apply: () => void }> = [
    { label: 'Add NIC NSG with default rules only', apply: () => { setNicEnabled(true); setNicRules([]) } },
    { label: 'Add conflicting deny at priority 150', apply: () => setSubnetRules((r) => [...r.filter((x) => x.priority !== 150), { name: 'Deny-All-TCP', priority: 150, direction: 'Inbound', access: 'Deny', protocol: 'TCP', source: '*', sourcePorts: '*', destination: '*', destinationPorts: '*' }]) },
    { label: 'Remove all NSG associations', apply: () => { setSubnetEnabled(false); setNicEnabled(false) } },
    { label: 'Deny-all that also blocks LB probes', apply: () => setSubnetRules((r) => [...r.filter((x) => x.priority !== 4000), { name: 'Deny-Everything', priority: 4000, direction: 'Inbound', access: 'Deny', protocol: '*', source: '*', sourcePorts: '*', destination: '*', destinationPorts: '*' }]) },
  ]

  const inbound = direction === 'Inbound'
  const pts: Array<[number, number]> = inbound ? [[70, 110], [330, 110], [470, 110], [620, 110], [780, 110]] : [[780, 110], [620, 110], [470, 110], [190, 110]]
  const packetState = !sent ? 'moving' : stepper.atEnd ? (sent.result.allowed ? 'allowed' : 'denied') : 'moving'
  const levelState = (i: 0 | 1) => {
    if (!sent) return 'neutral' as const
    const l = sent.result.levels[i]
    if (!l) return 'neutral' as const
    const revealed = stepper.step >= timeline.findIndex((t) => t.level === i && t.reveal)
    if (!revealed || l.access === 'NotFiltered') return 'neutral' as const
    return l.access === 'Allow' ? ('ok' as const) : ('fail' as const)
  }
  const subnetIdx = inbound ? 0 : 1
  const nicIdx = inbound ? 1 : 0

  const inspectInfo: Record<string, string> = {
    client: `${SOURCES[source].label} ${SOURCES[source].ip}. Change the source below.`,
    pip: 'Standard SKU public IP: closed to inbound traffic unless an NSG on the subnet or NIC allows it.',
    subnet: subnetNsg ? `nsg-web-subnet associated with snet-web (10.0.1.0/24). ${subnetRules.length} custom rule(s) + 3 default inbound rules.` : 'No NSG associated with the subnet.',
    nic: nicNsg ? `nsg-vm-nic associated with vm-web-01's NIC. ${nicRules.length} custom rule(s).` : 'No NSG associated with the NIC.',
    vm: `vm-web-01, private IP 10.0.1.4, NIC member of ASG "${vmAsg || 'none'}".`,
  }

  return (
    <div ref={ref} tabIndex={0} className="@container card overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="NSG packet simulation. Use arrow keys to step, space to play or pause.">
      <div className="grid gap-0 @4xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <svg viewBox="0 0 860 220" className="w-full text-slate-700 dark:text-slate-200" role="img" aria-labelledby="nsg-svg-title">
            <title id="nsg-svg-title">Network path from client to VM through public IP, subnet NSG and NIC NSG</title>
            <rect x={400} y={20} width={440} height={180} rx={14} fill="#0a7cd6" fillOpacity={0.05} stroke="#0a7cd6" strokeDasharray="6 4" />
            <text x={410} y={36} fontSize={11} fill="#0a7cd6" fontWeight={600}>vnet-prod 10.0.0.0/16 · snet-web 10.0.1.0/24</text>
            <Link x1={70} y1={110} x2={780} y2={110} state={sent && stepper.atEnd ? (sent.result.allowed ? 'ok' : 'fail') : undefined} />
            <UserNode x={70} y={110} label={SOURCES[source].label} sublabel={SOURCES[source].ip} onClick={() => setInspect('client')} title="Inspect source" active={inspect === 'client'} />
            <GlobeNode x={190} y={110} label="Internet" />
            <IpNode x={330} y={110} label="Public IP" sublabel="Standard SKU" onClick={() => setInspect('pip')} title="Inspect public IP" active={inspect === 'pip'} />
            <FirewallNode x={470} y={110} label="Subnet NSG" sublabel={subnetEnabled ? 'nsg-web-subnet' : 'not associated'} state={levelState(subnetIdx as 0 | 1)} onClick={() => { setInspect('subnet'); setEditing('subnet') }} title="Inspect and edit subnet NSG" active={inspect === 'subnet'} />
            <FirewallNode x={620} y={110} label="NIC NSG" sublabel={nicEnabled ? 'nsg-vm-nic' : 'not associated'} state={levelState(nicIdx as 0 | 1)} onClick={() => { setInspect('nic'); setEditing('nic') }} title="Inspect and edit NIC NSG" active={inspect === 'nic'} />
            <VmNode x={780} y={110} label="vm-web-01" sublabel={`10.0.1.4 · ASG ${vmAsg || '—'}`} state={sent && stepper.atEnd && inbound ? (sent.result.allowed ? 'ok' : 'fail') : 'neutral'} onClick={() => setInspect('vm')} title="Inspect VM" active={inspect === 'vm'} />
            {sent && <Packet points={pts} at={cur.at} state={packetState} reduced={reduced} label={`${port}`} />}
          </svg>
          <AnimationControls stepper={stepper} stepLabels={timeline.map((t) => t.label)} regionLabel="NSG simulation" />
          {inspect && <p className="border-t border-slate-200 px-3 py-2 text-sm dark:border-slate-800"><span className="font-semibold">Inspect:</span> {inspectInfo[inspect]}</p>}
          {sent && stepper.atEnd && (
            <div className={`border-t px-3 py-2 text-sm ${sent.result.allowed ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`} role="status">
              <Badge tone={sent.result.allowed ? 'allow' : 'deny'}>{sent.result.allowed ? 'ALLOWED' : 'DENIED'}</Badge> {sent.result.explanation}
            </div>
          )}
        </div>

        <aside className="grid content-start gap-3 border-t border-slate-200 p-3 text-sm @xl:grid-cols-2 @4xl:grid-cols-1 @4xl:border-t-0 @4xl:border-l dark:border-slate-800">
          <fieldset className="space-y-2">
            <legend className="label">Traffic</legend>
            <div className="flex gap-2">
              {(['Inbound', 'Outbound'] as const).map((d) => (
                <button key={d} type="button" className={direction === d ? 'btn-primary' : 'btn-ghost'} onClick={() => setDirection(d)} aria-pressed={direction === d}>{d}</button>
              ))}
            </div>
            {inbound && (
              <label className="flex items-center justify-between gap-2">Source
                <select className="input" value={source} onChange={(e) => setSource(e.target.value as SourceKey)}>
                  {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            )}
            <label className="flex items-center justify-between gap-2">Destination port
              <select className="input" value={port} onChange={(e) => setPort(Number(e.target.value))}>
                {PORTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">Protocol
              <select className="input" value={protocol} onChange={(e) => setProtocol(e.target.value as 'TCP' | 'UDP')}>
                <option>TCP</option><option>UDP</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">VM NIC ASG
              <select className="input" value={vmAsg} onChange={(e) => setVmAsg(e.target.value)}>
                <option value="web">asg-web</option><option value="db">asg-db</option><option value="">none</option>
              </select>
            </label>
            <button type="button" className="btn-primary w-full" onClick={send}>Send packet</button>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="label">Associations</legend>
            <label className="flex items-center gap-2"><input type="checkbox" checked={subnetEnabled} onChange={(e) => setSubnetEnabled(e.target.checked)} /> NSG on subnet</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={nicEnabled} onChange={(e) => setNicEnabled(e.target.checked)} /> NSG on NIC</label>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="label">Failure injection</legend>
            {injections.map((i) => <button key={i.label} type="button" className="btn-ghost w-full justify-start text-left" onClick={i.apply}>{i.label}</button>)}
          </fieldset>
        </aside>
      </div>

      <div className="grid gap-3 border-t border-slate-200 p-3 @3xl:grid-cols-2 dark:border-slate-800">
        {([['subnet', subnetNsg, subnetIdx], ['nic', nicNsg, nicIdx]] as const).map(([lvl, nsg, idx]) => {
          const evalRes = sent?.result.levels[idx]
          const revealed = sent ? stepper.step >= timeline.findIndex((t) => t.level === idx && t.reveal) && timeline.some((t) => t.level === idx && t.reveal) : false
          return (
            <div key={lvl} className="min-w-0 overflow-x-auto">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-sm font-semibold">{lvl === 'subnet' ? 'Subnet NSG' : 'NIC NSG'} · {direction} effective rules</h4>
                {nsg && <button type="button" className="text-xs text-sky-600 underline" onClick={() => setEditing(lvl)}>{editing === lvl ? 'Editing' : 'Edit rules'}</button>}
              </div>
              {!nsg ? <p className="text-xs text-slate-500">Not associated. This level does not filter.</p> : (
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-500"><th>Pri</th><th>Name</th><th>Src</th><th>Port</th><th>Action</th><th /></tr></thead>
                  <tbody>
                    {effectiveRules(nsg, direction).map((r) => {
                      const evaluated = revealed && evalRes?.evaluated.includes(r)
                      const deciding = revealed && evalRes?.rule === r
                      return (
                        <tr key={`${r.name}-${r.priority}`} className={deciding ? (r.access === 'Allow' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40') : evaluated ? 'opacity-60 line-through decoration-slate-400' : ''}>
                          <td className="font-mono">{r.priority}</td>
                          <td>{r.name}{r.isDefault && <span className="text-slate-400"> (default)</span>}</td>
                          <td>{r.source.replace('asg:', 'ASG ')}→{r.destination.replace('asg:', 'ASG ')}</td>
                          <td className="font-mono">{r.protocol}/{r.destinationPorts}</td>
                          <td><Badge tone={r.access === 'Allow' ? 'allow' : 'deny'}>{r.access}</Badge></td>
                          <td>{!r.isDefault && <button type="button" aria-label={`Delete rule ${r.name}`} className="text-red-600" onClick={() => (lvl === 'subnet' ? setSubnetRules : setNicRules)((rs) => rs.filter((x) => x !== r))}>✕</button>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>

      <form
        className="grid grid-cols-2 gap-2 border-t border-slate-200 p-3 text-xs @md:grid-cols-4 @4xl:grid-cols-8 dark:border-slate-800"
        onSubmit={(e) => { e.preventDefault(); if (draftErrors.length === 0) { setRules([...rules, draft]); setDraft({ ...draft, priority: draft.priority + 10, name: `${draft.name}-2` }) } }}
        aria-label={`Add rule to ${editing} NSG`}
      >
        <span className="col-span-2 self-center font-semibold @md:col-span-4 @4xl:col-span-8">Add rule to {editing === 'subnet' ? 'subnet' : 'NIC'} NSG{(editing === 'nic' && !nicEnabled) || (editing === 'subnet' && !subnetEnabled) ? ' (not associated)' : ''}</span>
        <label className="flex flex-col">Name<input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="flex flex-col">Priority<input className="input" type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} /></label>
        <label className="flex flex-col">Direction<select className="input" value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value as Direction })}><option>Inbound</option><option>Outbound</option></select></label>
        <label className="flex flex-col">Action<select className="input" value={draft.access} onChange={(e) => setDraft({ ...draft, access: e.target.value as 'Allow' | 'Deny' })}><option>Allow</option><option>Deny</option></select></label>
        <label className="flex flex-col">Protocol<select className="input" value={draft.protocol} onChange={(e) => setDraft({ ...draft, protocol: e.target.value as Protocol })}><option>TCP</option><option>UDP</option><option value="*">Any</option></select></label>
        <label className="flex flex-col">Source<select className="input" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}><option>Internet</option><option>VirtualNetwork</option><option>AzureLoadBalancer</option><option value="*">Any</option><option value="203.0.113.10/32">203.0.113.10/32</option><option value="asg:web">ASG web</option></select></label>
        <label className="flex flex-col">Destination<select className="input" value={draft.destination} onChange={(e) => setDraft({ ...draft, destination: e.target.value })}><option value="*">Any</option><option value="asg:web">ASG web</option><option value="asg:db">ASG db</option><option value="10.0.1.0/24">10.0.1.0/24</option><option>Internet</option></select></label>
        <label className="flex flex-col">Dest. ports<input className="input" value={draft.destinationPorts} onChange={(e) => setDraft({ ...draft, destinationPorts: e.target.value })} /></label>
        <div className="col-span-2 flex items-center gap-2 @md:col-span-4 @4xl:col-span-8">
          <button type="submit" className="btn-primary" disabled={draftErrors.length > 0}>Add rule</button>
          <button type="button" className="btn-ghost" onClick={() => { setSubnetRules([]); setNicRules([]); setSubnetEnabled(true); setNicEnabled(false); setSent(null); stepper.restart() }}>Reset scenario</button>
          {draftErrors.map((e) => <span key={e} className="text-red-600">{e}</span>)}
        </div>
      </form>

      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <FidelityNote fidelity="accurate-model">Implements documented NSG priority processing, default rules ({DEFAULT_RULES.length}), subnet→NIC order and Standard public IP secure-by-default. Service tags are limited to Internet, VirtualNetwork and AzureLoadBalancer.</FidelityNote>
        <details className="mt-1 text-xs"><summary className="cursor-pointer text-slate-500">Text transcript of the current animation</summary>
          <ol className="ml-5 list-decimal">{timeline.map((t, i) => <li key={i} className={i === stepper.step ? 'font-semibold' : ''}>{t.label}</li>)}</ol>
        </details>
      </div>
    </div>
  )
}
