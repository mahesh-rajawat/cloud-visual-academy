/**
 * AZ-104 networking scenarios: VNet peering, public IPs, user-defined routes, connectivity troubleshooting,
 * Azure Bastion, service endpoints, private endpoints, Azure DNS and Azure Load Balancer.
 * Each evaluate() encodes documented behaviour; see the doc links in the related lessons.
 */
import { chooser } from '../chooser'
import { allOk, bool, chain, num, opt, str, type ScenarioGroup, type Stage } from '../scenario'

// ------------------------------------------------------------------ IP helpers
export function parseCidr(cidr: string): { base: number; bits: number } | null {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(cidr.trim())
  if (!m) return null
  const oct = m.slice(1, 5).map(Number)
  const bits = Number(m[5])
  if (oct.some((o) => o > 255) || bits > 32) return null
  const ip = ((oct[0]! << 24) >>> 0) + (oct[1]! << 16) + (oct[2]! << 8) + oct[3]!
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return { base: (ip & mask) >>> 0, bits }
}

export function ipToInt(ip: string): number {
  const o = ip.split('.').map(Number)
  return ((o[0]! << 24) >>> 0) + (o[1]! << 16) + (o[2]! << 8) + o[3]!
}

export function cidrContains(cidr: string, ip: string): boolean {
  const c = parseCidr(cidr)
  if (!c) return false
  const mask = c.bits === 0 ? 0 : (0xffffffff << (32 - c.bits)) >>> 0
  return ((ipToInt(ip) & mask) >>> 0) === c.base
}

export function cidrsOverlap(a: string, b: string): boolean {
  const x = parseCidr(a)
  const y = parseCidr(b)
  if (!x || !y) return false
  const bits = Math.min(x.bits, y.bits)
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return ((x.base & mask) >>> 0) === ((y.base & mask) >>> 0)
}

// ------------------------------------------------------------------ peering
export interface Peering { from: string; to: string }
/** Peering is not transitive: A can reach B only with a direct peering (in both directions) or via a gateway/NVA. */
export function peeringReach(peerings: Peering[], a: string, b: string, viaHubNva = false, hub = 'hub') {
  const linked = (x: string, y: string) => peerings.some((p) => p.from === x && p.to === y) && peerings.some((p) => p.from === y && p.to === x)
  if (linked(a, b)) return { ok: true, path: `${a} ↔ ${b} (direct peering)` }
  if (viaHubNva && linked(a, hub) && linked(hub, b)) return { ok: true, path: `${a} → ${hub} NVA → ${b} (needs UDRs + allow forwarded traffic)` }
  return { ok: false, path: 'No route: VNet peering is not transitive.' }
}

// ------------------------------------------------------------------ routes
export interface Route { prefix: string; nextHop: 'VirtualAppliance' | 'VirtualNetworkGateway' | 'Internet' | 'VnetLocal' | 'VNetPeering' | 'None'; source: 'User' | 'BGP' | 'Default'; nextHopIp?: string }
const SOURCE_RANK: Record<Route['source'], number> = { User: 0, BGP: 1, Default: 2 }

/** Longest prefix match; ties broken User > BGP > Default (system). */
export function selectRoute(routes: Route[], dest: string): Route | null {
  const matching = routes.filter((r) => cidrContains(r.prefix, dest))
  if (!matching.length) return null
  return matching.sort((a, b) => parseCidr(b.prefix)!.bits - parseCidr(a.prefix)!.bits || SOURCE_RANK[a.source] - SOURCE_RANK[b.source])[0]!
}

export const SYSTEM_ROUTES = (vnet: string): Route[] => [
  { prefix: vnet, nextHop: 'VnetLocal', source: 'Default' },
  { prefix: '0.0.0.0/0', nextHop: 'Internet', source: 'Default' },
  { prefix: '10.0.0.0/8', nextHop: 'None', source: 'Default' },
  { prefix: '172.16.0.0/12', nextHop: 'None', source: 'Default' },
  { prefix: '192.168.0.0/16', nextHop: 'None', source: 'Default' },
]

// ------------------------------------------------------------------ Bastion
export function bastionCheck(b: { subnetName: string; prefixBits: number; sku: 'Developer' | 'Basic' | 'Standard' | 'Premium'; nativeClient: boolean; shareableLink: boolean; publicIpSku: 'Standard' | 'None' }) {
  const issues: string[] = []
  if (b.sku !== 'Developer') {
    if (b.subnetName !== 'AzureBastionSubnet') issues.push('The subnet must be named AzureBastionSubnet.')
    if (b.prefixBits > 26) issues.push('AzureBastionSubnet must be /26 or larger.')
    if (b.publicIpSku !== 'Standard') issues.push('Basic, Standard and Premium Bastion need a Standard SKU public IP (unless Premium private-only).')
  }
  if (b.nativeClient && !['Standard', 'Premium'].includes(b.sku)) issues.push('Native client (az network bastion ssh/rdp) needs the Standard or Premium SKU.')
  if (b.shareableLink && !['Standard', 'Premium'].includes(b.sku)) issues.push('Shareable links need the Standard or Premium SKU.')
  return issues
}

// ------------------------------------------------------------------ DNS
export function dnsRecordCheck(r: { name: string; type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'Alias A'; existingTypesAtName: string[] }) {
  if (r.type === 'CNAME' && r.name === '@') return 'A CNAME record is not allowed at the zone apex (@). Use an alias record.'
  if (r.type === 'CNAME' && r.existingTypesAtName.length) return 'A CNAME cannot coexist with other records of the same name.'
  if (r.type !== 'CNAME' && r.existingTypesAtName.includes('CNAME')) return 'A CNAME already exists at this name.'
  return null
}

// ------------------------------------------------------------------ Load balancer
export interface Backend { name: string; inPool: boolean; appUp: boolean; probePortOpen: boolean }
export function lbHealthy(backends: Backend[], nsgAllowsProbe: boolean) {
  return backends.filter((b) => b.inPool && b.appUp && b.probePortOpen && nsgAllowsProbe).map((b) => b.name)
}

// ================================================================== routing group
const peerStages: Stage[] = [{ id: 'a', label: 'vnet-spoke1', kind: 'network' }, { id: 'peer', label: 'Peering link', kind: 'network' }, { id: 'hub', label: 'vnet-hub', kind: 'network' }, { id: 'b', label: 'Destination', kind: 'compute' }]
const ipStages: Stage[] = [{ id: 'sku', label: 'SKU', kind: 'service' }, { id: 'alloc', label: 'Allocation', kind: 'network' }, { id: 'zone', label: 'Zones', kind: 'globe' }, { id: 'assoc', label: 'Association', kind: 'compute' }, { id: 'inbound', label: 'Inbound access', kind: 'security' }]
const routeStages: Stage[] = [{ id: 'src', label: 'VM in snet-app', kind: 'compute' }, { id: 'rt', label: 'Effective routes', kind: 'network' }, { id: 'hop', label: 'Next hop', kind: 'security' }, { id: 'dst', label: 'Destination', kind: 'globe' }]
const tsStages: Stage[] = [{ id: 'vm', label: 'Source VM', kind: 'compute' }, { id: 'nsgOut', label: 'NSG outbound', kind: 'security' }, { id: 'route', label: 'Route', kind: 'network' }, { id: 'nsgIn', label: 'Destination NSG', kind: 'security' }, { id: 'os', label: 'Guest OS / app', kind: 'compute' }]

const routingGroup: ScenarioGroup = {
  id: 'network-routing-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'Peering transitivity and gateway transit, public IP SKU rules, longest-prefix route selection with User > BGP > system tie-breaking, and Network Watcher diagnostics follow Microsoft Learn. Address spaces are illustrative.',
  scenarios: [
    {
      id: 'peering',
      title: 'VNet peering',
      description: 'Hub-and-spoke: peer spokes to a hub and test whether spoke1 can reach spoke2 and on-premises.',
      stages: peerStages,
      controls: [
        { type: 'select', key: 'dest', label: 'Traffic from spoke1 to', options: opt('vnet-hub VM', 'vnet-spoke2 VM', 'On-premises (via hub VPN gateway)') },
        { type: 'select', key: 'spaces', label: 'Address spaces', options: opt('hub 10.0.0.0/16, spoke1 10.1.0.0/16, spoke2 10.2.0.0/16', 'hub 10.0.0.0/16, spoke1 10.0.0.0/16 (overlap)') },
        { type: 'checkbox', key: 'both', label: 'Peering created in both directions (status Connected)' },
        { type: 'checkbox', key: 'nva', label: 'Hub NVA + UDRs in spokes + "Allow forwarded traffic"' },
        { type: 'checkbox', key: 'gwTransit', label: 'Hub: Allow gateway transit; spoke: Use remote gateway' },
      ],
      initial: { dest: 'vnet-spoke2 VM', spaces: 'hub 10.0.0.0/16, spoke1 10.1.0.0/16, spoke2 10.2.0.0/16', both: true, nva: false, gwTransit: false },
      presets: [{ label: 'Spoke to spoke via hub NVA', values: { nva: true } }, { label: 'On-premises via gateway transit', values: { dest: 'On-premises (via hub VPN gateway)', gwTransit: true } }, { label: 'Overlapping address space', values: { dest: 'vnet-hub VM', spaces: 'hub 10.0.0.0/16, spoke1 10.0.0.0/16 (overlap)' } }, { label: 'Only one side created', values: { dest: 'vnet-hub VM', both: false } }],
      evaluate: (s) => {
        const overlap = str(s, 'spaces').includes('overlap')
        const dest = str(s, 'dest')
        const peerings: Peering[] = bool(s, 'both') ? [{ from: 'spoke1', to: 'hub' }, { from: 'hub', to: 'spoke1' }, { from: 'spoke2', to: 'hub' }, { from: 'hub', to: 'spoke2' }] : [{ from: 'spoke1', to: 'hub' }, { from: 'spoke2', to: 'hub' }, { from: 'hub', to: 'spoke2' }]
        const target = dest.startsWith('vnet-hub') ? 'hub' : dest.startsWith('vnet-spoke2') ? 'spoke2' : 'onprem'
        const reach = target === 'onprem' ? { ok: bool(s, 'gwTransit') && bool(s, 'both'), path: bool(s, 'gwTransit') ? 'spoke1 → hub VPN gateway → on-premises' : 'Spoke cannot use the hub gateway without gateway transit.' } : peeringReach(peerings, 'spoke1', target, bool(s, 'nva'))
        const stages = chain(peerStages, [
          [!overlap, overlap ? 'Peering cannot be created: address spaces overlap.' : 'Address spaces do not overlap.'],
          [bool(s, 'both'), bool(s, 'both') ? 'Peering status Connected on both sides.' : 'Status Initiated: create the peering from the other VNet too (the portal can create both).'],
          [reach.ok || target === 'hub', target === 'hub' ? 'Direct peering to the hub.' : reach.path],
          [reach.ok, reach.ok ? `Reachable: ${reach.path}` : 'Unreachable.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'CONNECTED' : 'NO CONNECTIVITY', detail: stages.find((x) => x.ok === false)?.detail ?? reach.path }, checks: [ok ? (target === 'spoke2' ? 'peering-transit-nva' : target === 'onprem' ? 'peering-gateway-transit' : 'peering-connected') : 'peering-failed'], notes: ['Peering traffic is billed per GB in each direction; global peering (across regions) costs more.'] }
      },
    },
    {
      id: 'public-ip',
      title: 'Public IP addresses',
      description: 'Configure a public IP for a VM or load balancer and see what each setting allows.',
      stages: ipStages,
      controls: [
        { type: 'select', key: 'sku', label: 'SKU', options: opt('Standard', 'Basic') },
        { type: 'select', key: 'alloc', label: 'Assignment', options: opt('Static', 'Dynamic') },
        { type: 'select', key: 'zone', label: 'Availability zone', options: opt('Zone-redundant', 'Zone 1', 'No zone') },
        { type: 'select', key: 'assoc', label: 'Associate to', options: opt('VM NIC', 'Standard load balancer frontend', 'Azure Bastion') },
        { type: 'checkbox', key: 'nsg', label: 'NSG allows inbound 443 on the NIC/subnet' },
      ],
      initial: { sku: 'Basic', alloc: 'Dynamic', zone: 'No zone', assoc: 'VM NIC', nsg: false },
      presets: [{ label: 'Standard, static, zone-redundant + NSG', values: { sku: 'Standard', alloc: 'Static', zone: 'Zone-redundant', nsg: true } }, { label: 'Standard without NSG', values: { sku: 'Standard', alloc: 'Static', zone: 'Zone-redundant' } }],
      evaluate: (s) => {
        const std = str(s, 'sku') === 'Standard'
        const staticAlloc = str(s, 'alloc') === 'Static'
        const stages = chain(ipStages, [
          [std, std ? 'Standard SKU: secure by default, supports zones and Standard load balancers.' : 'Basic SKU public IPs were retired on 30 September 2025: create Standard.'],
          [staticAlloc, staticAlloc ? 'Static: the address never changes while the resource exists.' : 'Standard public IPs support static assignment only.'],
          [true, str(s, 'zone') === 'Zone-redundant' ? 'Zone-redundant: survives a zone failure.' : str(s, 'zone') === 'Zone 1' ? 'Zonal: tied to zone 1 (same zone as the resource).' : 'No zone: not zone-resilient.'],
          [true, `Associated to ${str(s, 'assoc')}.`],
          [bool(s, 'nsg') || str(s, 'assoc') !== 'VM NIC', bool(s, 'nsg') ? 'NSG allows 443: inbound works.' : str(s, 'assoc') === 'VM NIC' ? 'Standard public IPs are closed to inbound traffic until an NSG allows it.' : 'Inbound handled by the service/rules.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'PUBLIC IP READY' : 'MISCONFIGURED', detail: stages.find((x) => x.ok === false)?.detail ?? 'Reachable on a static Standard public IP.' }, checks: [ok ? 'pip-configured' : 'pip-error'], notes: ['Public IP prefixes reserve a contiguous range of static public IPs. Public IPv4 addresses are billed hourly.'] }
      },
    },
    {
      id: 'udr',
      title: 'User-defined routes',
      description: 'Force traffic through a firewall NVA. See which route wins for each destination (longest prefix, then User > BGP > system).',
      stages: routeStages,
      controls: [
        { type: 'select', key: 'dest', label: 'Destination IP', options: opt('10.1.2.4 (snet-db)', '8.8.8.8 (internet)', '10.2.0.4 (peered spoke)') },
        { type: 'checkbox', key: 'default', label: 'Route table: 0.0.0.0/0 → VirtualAppliance 10.1.0.4' },
        { type: 'checkbox', key: 'db', label: 'Route table: 10.1.2.0/24 → VirtualAppliance 10.1.0.4' },
        { type: 'checkbox', key: 'assoc', label: 'Route table associated with snet-app' },
        { type: 'checkbox', key: 'ipfwd', label: 'IP forwarding enabled on the NVA NIC (and in its OS)' },
        { type: 'checkbox', key: 'drop', label: 'Route: 10.2.0.0/16 → None' },
      ],
      initial: { dest: '8.8.8.8 (internet)', default: true, db: false, assoc: true, ipfwd: false, drop: false },
      presets: [{ label: 'Enable IP forwarding', values: { ipfwd: true } }, { label: 'Inspect traffic to the DB subnet', values: { dest: '10.1.2.4 (snet-db)', db: true, ipfwd: true } }, { label: 'Route table not associated', values: { assoc: false } }, { label: 'Black-hole a prefix', values: { dest: '10.2.0.4 (peered spoke)', drop: true } }],
      evaluate: (s) => {
        const dest = str(s, 'dest').split(' ')[0]!
        const routes: Route[] = [...SYSTEM_ROUTES('10.1.0.0/16'), { prefix: '10.2.0.0/16', nextHop: 'VNetPeering', source: 'Default' }]
        if (bool(s, 'assoc')) {
          if (bool(s, 'default')) routes.push({ prefix: '0.0.0.0/0', nextHop: 'VirtualAppliance', source: 'User', nextHopIp: '10.1.0.4' })
          if (bool(s, 'db')) routes.push({ prefix: '10.1.2.0/24', nextHop: 'VirtualAppliance', source: 'User', nextHopIp: '10.1.0.4' })
          if (bool(s, 'drop')) routes.push({ prefix: '10.2.0.0/16', nextHop: 'None', source: 'User' })
        }
        const r = selectRoute(routes, dest)!
        const viaNva = r.nextHop === 'VirtualAppliance'
        const delivered = r.nextHop !== 'None' && (!viaNva || bool(s, 'ipfwd'))
        const stages = chain(routeStages, [
          [true, `Packet to ${dest}.`],
          [true, `${bool(s, 'assoc') ? 'User routes + system routes.' : 'Route table not associated with the subnet: only system routes apply.'} Selected: ${r.prefix} → ${r.nextHop} (${r.source}).`],
          [delivered, r.nextHop === 'None' ? 'Next hop None: the packet is dropped.' : viaNva ? (bool(s, 'ipfwd') ? 'NVA 10.1.0.4 inspects and forwards the packet.' : 'NVA drops it: IP forwarding is not enabled on its NIC.') : `Delivered by ${r.nextHop}.`],
          [delivered, delivered ? 'Reached the destination.' : 'Not reached.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? (viaNva ? 'ROUTED THROUGH NVA' : 'DELIVERED') : 'DROPPED', detail: stages[2]!.detail }, checks: [ok && viaNva ? 'udr-via-nva' : ok ? 'udr-delivered' : 'udr-dropped'], metrics: [{ label: 'Winning route', value: `${r.prefix} → ${r.nextHop}` }] }
      },
    },
    {
      id: 'conn-ts',
      title: 'Troubleshoot connectivity',
      description: 'A web VM cannot reach a database VM on 1433. Use Network Watcher tools to find which hop blocks it.',
      stages: tsStages,
      controls: [
        { type: 'select', key: 'fault', label: 'Hidden fault (pick one to practise)', options: opt('None', 'Destination NSG denies 1433', 'UDR next hop None', 'SQL service stopped', 'Outbound NSG denies VirtualNetwork') },
        { type: 'select', key: 'tool', label: 'Network Watcher tool', options: opt('IP flow verify', 'Next hop', 'Connection troubleshoot', 'Effective security rules') },
      ],
      initial: { fault: 'Destination NSG denies 1433', tool: 'Next hop' },
      presets: [{ label: 'Use IP flow verify', values: { tool: 'IP flow verify' } }, { label: 'Use Connection troubleshoot', values: { tool: 'Connection troubleshoot' } }, { label: 'Routing fault', values: { fault: 'UDR next hop None', tool: 'Next hop' } }],
      evaluate: (s) => {
        const f = str(s, 'fault')
        const tool = str(s, 'tool')
        const detects: Record<string, string[]> = { 'Destination NSG denies 1433': ['IP flow verify', 'Connection troubleshoot', 'Effective security rules'], 'UDR next hop None': ['Next hop', 'Connection troubleshoot'], 'SQL service stopped': ['Connection troubleshoot'], 'Outbound NSG denies VirtualNetwork': ['IP flow verify', 'Connection troubleshoot', 'Effective security rules'], None: [] }
        const found = detects[f]!.includes(tool)
        const stages = chain(tsStages, [
          [true, `web-vm 10.1.1.4 → db-vm 10.1.2.4:1433, investigated with ${tool}.`],
          [f !== 'Outbound NSG denies VirtualNetwork', f === 'Outbound NSG denies VirtualNetwork' ? 'Outbound security rule DenyVnetOutbound matches.' : 'Outbound allowed.'],
          [f !== 'UDR next hop None', f === 'UDR next hop None' ? 'Route 10.1.2.0/24 → None drops the packet.' : 'Next hop VnetLocal.'],
          [f !== 'Destination NSG denies 1433', f === 'Destination NSG denies 1433' ? 'Inbound rule Deny-SQL (priority 200) matches.' : 'Inbound allowed.'],
          [f !== 'SQL service stopped', f === 'SQL service stopped' ? 'TCP connection refused: nothing is listening on 1433.' : 'SQL Server answers.'],
        ])
        const ok = f === 'None'
        return {
          stages, outcome: { ok, title: f === 'None' ? 'NO FAULT' : found ? 'ROOT CAUSE FOUND' : 'TOOL CAN\'T SEE THIS FAULT', detail: f === 'None' ? 'Connectivity works.' : found ? `${tool} reveals: ${stages.find((x) => x.ok === false)!.detail}` : `${tool} does not detect "${f}". Try ${detects[f]!.join(' or ')}.` },
          checks: [found ? 'conn-root-cause' : 'conn-wrong-tool'],
          notes: ['IP flow verify: NSG allow/deny for a 5-tuple and the matching rule. Next hop: next hop type and route table. Connection troubleshoot: end-to-end test including the guest. Effective security rules: merged NSG rules on a NIC.'],
        }
      },
    },
  ],
}

// ================================================================== access group
const bastionStages: Stage[] = [{ id: 'user', label: 'Admin browser / native client', kind: 'user' }, { id: 'bastion', label: 'Azure Bastion', kind: 'security' }, { id: 'subnet', label: 'AzureBastionSubnet', kind: 'network' }, { id: 'nsg', label: 'Target NSG', kind: 'security' }, { id: 'vm', label: 'VM (no public IP)', kind: 'compute' }]
const peStages: Stage[] = [{ id: 'vm', label: 'VM in snet-app', kind: 'compute' }, { id: 'dns', label: 'DNS resolution', kind: 'network' }, { id: 'path', label: 'Network path', kind: 'network' }, { id: 'fw', label: 'Storage firewall', kind: 'security' }, { id: 'st', label: 'stcontoso blob', kind: 'storage' }]

const accessGroup: ScenarioGroup = {
  id: 'network-access-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'Bastion SKU and subnet requirements, service endpoint source-IP behaviour and private endpoint DNS resolution follow Microsoft Learn.',
  scenarios: [
    {
      id: 'bastion',
      title: 'Azure Bastion',
      description: 'Deploy Bastion so admins can RDP/SSH to VMs that have no public IP.',
      stages: bastionStages,
      controls: [
        { type: 'select', key: 'sku', label: 'Bastion SKU', options: opt('Developer', 'Basic', 'Standard', 'Premium') },
        { type: 'select', key: 'subnet', label: 'Subnet name', options: opt('AzureBastionSubnet', 'snet-bastion') },
        { type: 'number', key: 'bits', label: 'Subnet prefix length (/n)', min: 22, max: 29 },
        { type: 'select', key: 'pip', label: 'Public IP', options: opt('Standard', 'None') },
        { type: 'checkbox', key: 'native', label: 'Need native client (az network bastion ssh)' },
        { type: 'checkbox', key: 'nsg', label: 'VM NSG allows 3389/22 from the AzureBastionSubnet range' },
      ],
      initial: { sku: 'Basic', subnet: 'snet-bastion', bits: 27, pip: 'Standard', native: false, nsg: true },
      presets: [{ label: 'Correct Basic deployment', values: { subnet: 'AzureBastionSubnet', bits: 26 } }, { label: 'Native client on Basic', values: { subnet: 'AzureBastionSubnet', bits: 26, native: true } }, { label: 'Standard with native client', values: { sku: 'Standard', subnet: 'AzureBastionSubnet', bits: 26, native: true } }],
      evaluate: (s) => {
        const issues = bastionCheck({ subnetName: str(s, 'subnet'), prefixBits: num(s, 'bits'), sku: str(s, 'sku') as 'Basic', nativeClient: bool(s, 'native'), shareableLink: false, publicIpSku: str(s, 'pip') as 'Standard' })
        const stages = chain(bastionStages, [
          [true, bool(s, 'native') ? 'Native client: az network bastion ssh/rdp.' : 'Azure portal > VM > Connect > Bastion (HTML5 over TLS 443).'],
          [issues.length === 0, issues.length ? issues.join(' ') : `${str(s, 'sku')} Bastion deployed${str(s, 'sku') === 'Developer' ? ' (shared, free, one connection at a time, no dedicated subnet).' : '.'}`],
          [true, str(s, 'sku') === 'Developer' ? 'Developer SKU uses shared infrastructure.' : 'Bastion reaches VMs by private IP in this VNet (and peered VNets).'],
          [bool(s, 'nsg'), bool(s, 'nsg') ? 'RDP/SSH allowed from Bastion.' : 'NSG blocks RDP/SSH from the Bastion subnet.'],
          [true, 'Session opened. The VM needs no public IP.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'SECURE SESSION OPEN' : 'DEPLOYMENT/CONNECT FAILED', detail: stages.find((x) => x.ok === false)?.detail ?? 'Connected through Bastion.' }, checks: [ok ? (bool(s, 'native') ? 'bastion-native' : 'bastion-connected') : 'bastion-error'] }
      },
    },
    {
      id: 'endpoints',
      title: 'Service endpoints vs private endpoints',
      description: 'Give a VM private access to a storage account, then lock down public access.',
      stages: peStages,
      controls: [
        { type: 'select', key: 'method', label: 'Access method', options: opt('Service endpoint', 'Private endpoint', 'None (public endpoint)') },
        { type: 'checkbox', key: 'seSubnet', label: 'Subnet has Microsoft.Storage service endpoint enabled' },
        { type: 'checkbox', key: 'vnetRule', label: 'Storage firewall: virtual network rule for snet-app' },
        { type: 'checkbox', key: 'ipRule', label: 'Storage firewall: IP rule for the VM\'s public IP' },
        { type: 'checkbox', key: 'dnsZone', label: 'Private DNS zone privatelink.blob.core.windows.net linked to the VNet' },
        { type: 'checkbox', key: 'publicOff', label: 'Public network access: Disabled' },
      ],
      initial: { method: 'Service endpoint', seSubnet: false, vnetRule: false, ipRule: true, dnsZone: false, publicOff: false },
      presets: [{ label: 'Service endpoint done right', values: { seSubnet: true, vnetRule: true } }, { label: 'Private endpoint without DNS zone', values: { method: 'Private endpoint', publicOff: true } }, { label: 'Private endpoint with DNS zone', values: { method: 'Private endpoint', dnsZone: true, publicOff: true } }],
      evaluate: (s) => {
        const m = str(s, 'method')
        const off = bool(s, 'publicOff')
        let dns = 'stcontoso.blob.core.windows.net → public IP of the storage service.'
        let dnsOk = true
        let path = 'Internet path to the public endpoint (source = VM public/NAT IP).'
        let fwOk = !off && bool(s, 'ipRule')
        let fwDetail = off ? 'Public network access disabled: request rejected.' : bool(s, 'ipRule') ? 'IP rule matches the VM\'s public IP.' : 'No firewall rule matches.'
        if (m === 'Service endpoint') {
          const se = bool(s, 'seSubnet')
          path = se ? 'Microsoft backbone; source becomes the VM\'s private IP from snet-app.' : 'No service endpoint: internet path with the public IP.'
          fwOk = !off && (se ? bool(s, 'vnetRule') : bool(s, 'ipRule'))
          fwDetail = off ? 'Service endpoints use the public endpoint, so disabling public access blocks them.' : se ? (bool(s, 'vnetRule') ? 'Virtual network rule for snet-app matches.' : 'With a service endpoint the source is private, so the IP rule no longer matches: add a virtual network rule.') : fwDetail
        } else if (m === 'Private endpoint') {
          dnsOk = bool(s, 'dnsZone')
          dns = dnsOk ? 'stcontoso.blob.core.windows.net → CNAME privatelink → 10.1.3.5 (private endpoint NIC).' : 'Name still resolves to the public IP: link the privatelink DNS zone so it resolves to the private IP.'
          path = 'Private IP 10.1.3.5 inside the VNet (Private Link).'
          fwOk = true
          fwDetail = 'Private endpoint connections are allowed even with public access disabled.'
        }
        const stages = chain(peStages, [[true, 'VM requests https://stcontoso.blob.core.windows.net.'], [dnsOk, dns], [true, path], [fwOk, fwDetail], [true, 'Blob returned.']])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? (m === 'Private endpoint' ? 'PRIVATE ACCESS (PRIVATE IP)' : 'ACCESS ALLOWED') : 'ACCESS FAILED', detail: stages.find((x) => x.ok === false)?.detail ?? path }, checks: [ok ? (m === 'Private endpoint' ? 'pe-private-ip' : m === 'Service endpoint' ? 'se-vnet-rule' : 'public-access') : 'endpoint-error'], notes: ['Service endpoints are free and per subnet; private endpoints are billed hourly plus per GB and work from peered VNets and on-premises.'] }
      },
    },
  ],
}

// ================================================================== DNS + LB group
const dnsStages: Stage[] = [{ id: 'client', label: 'Client resolver', kind: 'user' }, { id: 'tld', label: '.com servers / registrar NS', kind: 'globe' }, { id: 'zone', label: 'Azure DNS zone', kind: 'network' }, { id: 'rec', label: 'Record set', kind: 'service' }]
const pdnsStages: Stage[] = [{ id: 'vm', label: 'VM in vnet-app', kind: 'compute' }, { id: 'resolver', label: 'Azure DNS 168.63.129.16', kind: 'network' }, { id: 'link', label: 'Virtual network link', kind: 'security' }, { id: 'zone', label: 'Private zone contoso.internal', kind: 'service' }]
const lbStages: Stage[] = [{ id: 'client', label: 'Client', kind: 'user' }, { id: 'fe', label: 'Frontend IP', kind: 'network' }, { id: 'rule', label: 'LB rule', kind: 'service' }, { id: 'probe', label: 'Health probe', kind: 'security' }, { id: 'pool', label: 'Backend pool', kind: 'compute' }]

const dnsLbGroup: ScenarioGroup = {
  id: 'dns-lb-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'DNS delegation, record rules (no CNAME at apex, alias records), private zone links and autoregistration, and Standard Load Balancer probe/NSG behaviour follow Microsoft Learn.',
  scenarios: [
    {
      id: 'dns-public',
      title: 'Public DNS zone',
      description: 'Host contoso.com in Azure DNS and add records.',
      stages: dnsStages,
      controls: [
        { type: 'checkbox', key: 'delegated', label: 'Registrar NS records updated to the four Azure DNS name servers' },
        { type: 'select', key: 'name', label: 'Record name', options: opt('@', 'www', 'mail') },
        { type: 'select', key: 'type', label: 'Record type', options: opt('A', 'CNAME', 'Alias A', 'MX', 'TXT') },
        { type: 'checkbox', key: 'existing', label: 'Another record already exists at this name' },
        { type: 'number', key: 'ttl', label: 'TTL (seconds)', min: 1, max: 86400 },
      ],
      initial: { delegated: false, name: '@', type: 'CNAME', existing: false, ttl: 3600 },
      presets: [{ label: 'Delegate + alias at apex', values: { delegated: true, type: 'Alias A' } }, { label: 'www CNAME', values: { delegated: true, name: 'www', type: 'CNAME' } }],
      evaluate: (s) => {
        const err = dnsRecordCheck({ name: str(s, 'name'), type: str(s, 'type') as 'A', existingTypesAtName: bool(s, 'existing') ? ['A'] : [] })
        const stages = chain(dnsStages, [
          [true, `Query ${str(s, 'name') === '@' ? '' : str(s, 'name') + '.'}contoso.com`],
          [bool(s, 'delegated'), bool(s, 'delegated') ? 'Parent zone delegates to ns1-0x.azure-dns.com/.net/.org/.info.' : 'Not delegated: the internet still asks the old name servers. Update NS records at the registrar.'],
          [err === null, err ?? 'Record set created.'],
          [true, str(s, 'type') === 'Alias A' ? 'Alias record follows an Azure resource (public IP, Traffic Manager, Front Door) and updates automatically.' : `Answer cached for ${num(s, 'ttl')} s (TTL).`],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'RESOLVES' : 'DNS ERROR', detail: stages.find((x) => x.ok === false)?.detail ?? stages[3]!.detail }, checks: [ok ? (str(s, 'type') === 'Alias A' ? 'dns-alias' : 'dns-resolves') : 'dns-error'] }
      },
    },
    {
      id: 'dns-private',
      title: 'Private DNS zone',
      description: 'Resolve VM names inside VNets with a private DNS zone.',
      stages: pdnsStages,
      controls: [
        { type: 'checkbox', key: 'link', label: 'Virtual network link from contoso.internal to vnet-app' },
        { type: 'checkbox', key: 'autoreg', label: 'Autoregistration enabled on the link' },
        { type: 'select', key: 'query', label: 'Query', options: opt('db01.contoso.internal (VM)', 'api.contoso.internal (manual A record)') },
        { type: 'checkbox', key: 'customDns', label: 'VNet uses custom DNS servers that don\'t forward to 168.63.129.16' },
      ],
      initial: { link: false, autoreg: false, query: 'db01.contoso.internal (VM)', customDns: false },
      presets: [{ label: 'Link with autoregistration', values: { link: true, autoreg: true } }, { label: 'Custom DNS without forwarding', values: { link: true, autoreg: true, customDns: true } }],
      evaluate: (s) => {
        const vmQuery = str(s, 'query').startsWith('db01')
        const stages = chain(pdnsStages, [
          [true, `nslookup ${str(s, 'query').split(' ')[0]}`],
          [!bool(s, 'customDns'), bool(s, 'customDns') ? 'Custom DNS servers don\'t forward to Azure DNS (168.63.129.16): private zones are not used.' : 'Azure-provided DNS.'],
          [bool(s, 'link'), bool(s, 'link') ? 'VNet is linked to the zone.' : 'No virtual network link: the zone is invisible to this VNet.'],
          [!vmQuery || bool(s, 'autoreg'), vmQuery ? (bool(s, 'autoreg') ? 'db01 A record auto-registered (10.1.2.4).' : 'No record: enable autoregistration or add the A record manually.') : 'Manual A record found.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'NAME RESOLVED' : 'NXDOMAIN', detail: stages.find((x) => x.ok === false)?.detail ?? stages[3]!.detail }, checks: [ok ? 'dns-private-resolves' : 'dns-error'], notes: ['A VNet can be linked to many private zones but can have autoregistration in only one.'] }
      },
    },
    {
      id: 'lb',
      title: 'Load balancer and troubleshooting',
      description: 'Configure a Standard load balancer (public or internal) with a backend pool, health probe and rule, then break things.',
      stages: lbStages,
      controls: [
        { type: 'select', key: 'type', label: 'Type', options: opt('Public', 'Internal') },
        { type: 'select', key: 'sku', label: 'SKU', options: opt('Standard', 'Basic') },
        { type: 'checkbox', key: 'rule', label: 'LB rule TCP 80 → backend 80 with the probe' },
        { type: 'select', key: 'probe', label: 'Health probe', options: opt('HTTP 80 /health', 'TCP 8080 (nothing listening)') },
        { type: 'checkbox', key: 'nsgProbe', label: 'NSG allows AzureLoadBalancer (probe source 168.63.129.16)' },
        { type: 'checkbox', key: 'nsgClient', label: 'NSG allows client traffic on 80' },
        { type: 'number', key: 'inPool', label: 'VMs in backend pool (of 3)', min: 0, max: 3 },
        { type: 'number', key: 'appDown', label: 'VMs with the web app stopped', min: 0, max: 3 },
      ],
      initial: { type: 'Public', sku: 'Standard', rule: true, probe: 'HTTP 80 /health', nsgProbe: true, nsgClient: false, inPool: 3, appDown: 0 },
      presets: [{ label: 'Allow client traffic', values: { nsgClient: true } }, { label: 'Probe on wrong port', values: { nsgClient: true, probe: 'TCP 8080 (nothing listening)' } }, { label: 'NSG blocks the probe', values: { nsgClient: true, nsgProbe: false } }, { label: 'One VM down', values: { nsgClient: true, appDown: 1 } }],
      evaluate: (s) => {
        const std = str(s, 'sku') === 'Standard'
        const probeOk = str(s, 'probe').startsWith('HTTP')
        const backends: Backend[] = [0, 1, 2].map((i) => ({ name: `vm${i + 1}`, inPool: i < num(s, 'inPool'), appUp: i >= num(s, 'appDown'), probePortOpen: probeOk }))
        const healthy = lbHealthy(backends, bool(s, 'nsgProbe'))
        const internal = str(s, 'type') === 'Internal'
        const stages = chain(lbStages, [
          [true, internal ? 'Client in the VNet (or peered/on-premises) → private frontend IP.' : 'Internet client → Standard public frontend IP.'],
          [std, std ? `${internal ? 'Private' : 'Public'} frontend on a Standard load balancer.` : 'Basic Load Balancer was retired on 30 September 2025: use Standard.'],
          [bool(s, 'rule') && (internal || bool(s, 'nsgClient')), !bool(s, 'rule') ? 'No load-balancing rule: nothing maps port 80 to the pool.' : !internal && !bool(s, 'nsgClient') ? 'Standard LB is secure by default: the backend NSG must allow client traffic on 80.' : 'Rule TCP 80 → 80, 5-tuple hash distribution.'],
          [healthy.length > 0, healthy.length ? `${healthy.length} healthy instance(s): ${healthy.join(', ')}.` : !bool(s, 'nsgProbe') ? 'NSG blocks the probe from AzureLoadBalancer: all instances marked down.' : !probeOk ? 'Probe port 8080 has no listener: all instances marked down.' : num(s, 'inPool') === 0 ? 'Backend pool is empty.' : 'All backends failed the probe.'],
          [true, `Traffic spread across ${healthy.join(', ')}.`],
        ])
        const ok = allOk(stages)
        return {
          stages, outcome: { ok, title: ok ? (healthy.length < 3 ? 'SERVING (DEGRADED)' : 'LOAD BALANCED') : 'NO HEALTHY BACKEND / BLOCKED', detail: stages.find((x) => x.ok === false)?.detail ?? `Requests are served by ${healthy.length} instance(s); unhealthy ones are taken out of rotation.` },
          checks: [ok ? (internal ? 'lb-internal' : 'lb-public') : 'lb-troubleshoot', ...(ok && healthy.length < 3 && healthy.length > 0 ? ['lb-degraded'] : [])],
          metrics: [{ label: 'Healthy backends', value: `${healthy.length}/3` }],
          notes: ['Use Load balancer > Insights and the Health Probe Status metric to troubleshoot. HA ports rules are for internal load balancers.'],
        }
      },
    },
    chooser({
      id: 'lb-choice', title: 'Choose a load balancing service', description: 'Pick the Azure service for each requirement.', requirementLabel: 'Requirement', answerLabel: 'Service',
      answers: ['Azure Load Balancer', 'Application Gateway', 'Azure Front Door', 'Traffic Manager'],
      answerNotes: { 'Azure Load Balancer': 'Layer 4 (TCP/UDP), regional, public or internal.', 'Application Gateway': 'Layer 7 regional: URL path routing, TLS termination, WAF.', 'Azure Front Door': 'Global layer 7 with CDN, WAF and anycast.', 'Traffic Manager': 'DNS-based global routing (priority, weighted, performance, geographic).' },
      cases: [
        { value: 'sql', label: 'Internal TCP 1433 across three SQL VMs', answer: 'Azure Load Balancer', why: 'Layer 4 internal load balancing.' },
        { value: 'path', label: 'Route /images to one pool and /api to another, with WAF, in one region', answer: 'Application Gateway', why: 'Path-based routing at layer 7.' },
        { value: 'global', label: 'Global HTTP app with caching and the fastest edge for users worldwide', answer: 'Azure Front Door', why: 'Global layer 7 with CDN.' },
        { value: 'dnsfail', label: 'DNS-level failover between two regions for a non-HTTP service', answer: 'Traffic Manager', why: 'DNS-based routing for any protocol.' },
      ],
    }),
  ],
}

export const groups: ScenarioGroup[] = [routingGroup, accessGroup, dnsLbGroup]
