/**
 * Network security group evaluation model (accurate model of documented behaviour).
 *
 * Modelled behaviour (https://learn.microsoft.com/azure/virtual-network/network-security-group-how-it-works):
 *  - Rules are processed in priority order (100–4096, lower first); the first matching rule wins.
 *  - Inbound traffic is evaluated by the subnet NSG first, then the NIC NSG. Both must allow it.
 *  - Outbound traffic is evaluated by the NIC NSG first, then the subnet NSG.
 *  - Default rules (65000, 65001, 65500) exist in every NSG and cannot be deleted, only overridden.
 *  - If no NSG is associated at a level, that level does not filter.
 *  - A Standard SKU public IP is "secure by default": inbound traffic is denied unless an NSG allows it.
 *  - NSGs are stateful: return traffic for an allowed flow is allowed automatically.
 *
 * Simplifications: service tags are limited to Internet, VirtualNetwork, AzureLoadBalancer and '*';
 * address prefixes are IPv4 CIDRs; Azure Virtual Network Manager admin rules are not modelled.
 */
import { ipInCidr } from './subnet'

export type Direction = 'Inbound' | 'Outbound'
export type Access = 'Allow' | 'Deny'
export type Protocol = 'TCP' | 'UDP' | 'ICMP' | '*'

export interface NsgRule {
  name: string
  priority: number
  direction: Direction
  access: Access
  protocol: Protocol
  source: string // CIDR, service tag, '*' or 'asg:<name>'
  sourcePorts: string // '*', '80', '1024-65535'
  destination: string
  destinationPorts: string
  isDefault?: boolean
}

export interface Nsg {
  name: string
  rules: NsgRule[]
}

export interface Flow {
  direction: Direction
  protocol: Exclude<Protocol, '*'>
  sourceIp: string
  sourcePort: number
  destinationIp: string
  destinationPort: number
  /** ASGs the VM NIC belongs to (used when a rule references an ASG). */
  vmAsgs: string[]
  /** Set when the flow arrives via a Standard SKU public IP. */
  viaStandardPublicIp?: boolean
  vnetPrefixes: string[]
}

export interface LevelResult {
  level: 'subnet' | 'nic'
  nsgName: string | null
  access: Access | 'NotFiltered'
  rule: NsgRule | null
  evaluated: NsgRule[]
}

export interface FlowResult {
  allowed: boolean
  levels: LevelResult[]
  explanation: string
}

export const DEFAULT_RULES: NsgRule[] = [
  { name: 'AllowVnetInBound', priority: 65000, direction: 'Inbound', access: 'Allow', protocol: '*', source: 'VirtualNetwork', sourcePorts: '*', destination: 'VirtualNetwork', destinationPorts: '*', isDefault: true },
  { name: 'AllowAzureLoadBalancerInBound', priority: 65001, direction: 'Inbound', access: 'Allow', protocol: '*', source: 'AzureLoadBalancer', sourcePorts: '*', destination: '*', destinationPorts: '*', isDefault: true },
  { name: 'DenyAllInBound', priority: 65500, direction: 'Inbound', access: 'Deny', protocol: '*', source: '*', sourcePorts: '*', destination: '*', destinationPorts: '*', isDefault: true },
  { name: 'AllowVnetOutBound', priority: 65000, direction: 'Outbound', access: 'Allow', protocol: '*', source: 'VirtualNetwork', sourcePorts: '*', destination: 'VirtualNetwork', destinationPorts: '*', isDefault: true },
  { name: 'AllowInternetOutBound', priority: 65001, direction: 'Outbound', access: 'Allow', protocol: '*', source: '*', sourcePorts: '*', destination: 'Internet', destinationPorts: '*', isDefault: true },
  { name: 'DenyAllOutBound', priority: 65500, direction: 'Outbound', access: 'Deny', protocol: '*', source: '*', sourcePorts: '*', destination: '*', destinationPorts: '*', isDefault: true },
]

const AZURE_LB_PROBE_IP = '168.63.129.16'

export function validateRule(rule: NsgRule): string[] {
  const errors: string[] = []
  if (!rule.isDefault && (rule.priority < 100 || rule.priority > 4096)) errors.push('Priority must be between 100 and 4096.')
  if (!rule.name.trim()) errors.push('Rule name is required.')
  for (const p of [rule.sourcePorts, rule.destinationPorts]) {
    if (!/^(\*|\d{1,5}(-\d{1,5})?)(,(\d{1,5}(-\d{1,5})?))*$/.test(p)) errors.push(`Invalid port specification "${p}".`)
  }
  return errors
}

export function portMatches(spec: string, port: number): boolean {
  if (spec === '*') return true
  return spec.split(',').some((part) => {
    const [lo, hi] = part.split('-').map(Number)
    if (lo === undefined || Number.isNaN(lo)) return false
    return hi === undefined ? port === lo : port >= lo && port <= hi
  })
}

function isVirtualNetwork(ip: string, flow: Flow): boolean {
  return flow.vnetPrefixes.some((p) => ipInCidr(ip, p))
}

export function addressMatches(spec: string, ip: string, flow: Flow, side: 'source' | 'destination'): boolean {
  if (spec === '*') return true
  if (spec.startsWith('asg:')) {
    // ASGs only ever describe VM NICs: for inbound the VM is the destination, for outbound the source.
    const vmSide = flow.direction === 'Inbound' ? 'destination' : 'source'
    return side === vmSide && flow.vmAsgs.includes(spec.slice(4))
  }
  if (spec === 'VirtualNetwork') return isVirtualNetwork(ip, flow)
  if (spec === 'Internet') return !isVirtualNetwork(ip, flow) && !isPrivate(ip)
  if (spec === 'AzureLoadBalancer') return ip === AZURE_LB_PROBE_IP
  return ipInCidr(ip, spec.includes('/') ? spec : `${spec}/32`)
}

function isPrivate(ip: string): boolean {
  return ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'].some((c) => ipInCidr(ip, c))
}

export function ruleMatches(rule: NsgRule, flow: Flow): boolean {
  return (
    rule.direction === flow.direction &&
    (rule.protocol === '*' || rule.protocol === flow.protocol) &&
    portMatches(rule.sourcePorts, flow.sourcePort) &&
    portMatches(rule.destinationPorts, flow.destinationPort) &&
    addressMatches(rule.source, flow.sourceIp, flow, 'source') &&
    addressMatches(rule.destination, flow.destinationIp, flow, 'destination')
  )
}

export function effectiveRules(nsg: Nsg, direction: Direction): NsgRule[] {
  return [...nsg.rules, ...DEFAULT_RULES]
    .filter((r) => r.direction === direction)
    .sort((a, b) => a.priority - b.priority)
}

export function evaluateNsg(nsg: Nsg | null, flow: Flow, level: 'subnet' | 'nic'): LevelResult {
  if (!nsg) return { level, nsgName: null, access: 'NotFiltered', rule: null, evaluated: [] }
  const evaluated: NsgRule[] = []
  for (const rule of effectiveRules(nsg, flow.direction)) {
    evaluated.push(rule)
    if (ruleMatches(rule, flow)) return { level, nsgName: nsg.name, access: rule.access, rule, evaluated }
  }
  // Unreachable in practice because DenyAll* matches everything.
  return { level, nsgName: nsg.name, access: 'Deny', rule: null, evaluated }
}

export function evaluateFlow(flow: Flow, subnetNsg: Nsg | null, nicNsg: Nsg | null): FlowResult {
  const order: Array<['subnet' | 'nic', Nsg | null]> =
    flow.direction === 'Inbound' ? [['subnet', subnetNsg], ['nic', nicNsg]] : [['nic', nicNsg], ['subnet', subnetNsg]]
  const levels: LevelResult[] = []
  for (const [level, nsg] of order) {
    const res = evaluateNsg(nsg, flow, level)
    levels.push(res)
    if (res.access === 'Deny') {
      return {
        allowed: false,
        levels,
        explanation: `${level === 'subnet' ? 'Subnet' : 'NIC'} NSG "${res.nsgName}" denied the flow with rule "${res.rule?.name}" (priority ${res.rule?.priority}). Evaluation stops at the first deny.`,
      }
    }
  }
  if (flow.direction === 'Inbound' && flow.viaStandardPublicIp && levels.every((l) => l.access === 'NotFiltered')) {
    return {
      allowed: false,
      levels,
      explanation: 'No NSG is associated with the subnet or the NIC. A Standard SKU public IP is secure by default, so inbound traffic is blocked until an NSG explicitly allows it.',
    }
  }
  const deciding = levels.filter((l) => l.rule).map((l) => `${l.level} NSG rule "${l.rule!.name}" (${l.rule!.priority})`)
  return {
    allowed: true,
    levels,
    explanation: deciding.length
      ? `Allowed by ${deciding.join(' and ')}. Return traffic is allowed automatically because NSGs are stateful.`
      : 'No NSG filters this path, so the flow is not blocked by NSGs.',
  }
}
