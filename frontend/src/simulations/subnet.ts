/**
 * IPv4 / Azure subnet arithmetic (accurate model).
 * Azure reserves 5 addresses in every subnet: network address, .1 (default gateway),
 * .2 and .3 (Azure DNS mapping to the VNet space) and the broadcast address.
 * https://learn.microsoft.com/azure/virtual-network/virtual-networks-faq
 */

export function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address "${ip}"`)
  }
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!
}

export function intToIp(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

export interface Cidr {
  network: number
  prefix: number
}

export function parseCidr(cidr: string): Cidr {
  const m = /^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/.exec(cidr.trim())
  if (!m) throw new Error(`Invalid CIDR "${cidr}"`)
  const prefix = Number(m[2])
  if (prefix > 32) throw new Error(`Invalid prefix /${prefix}`)
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return { network: (ipToInt(m[1]!) & mask) >>> 0, prefix }
}

export function isAligned(cidr: string): boolean {
  const m = /^(\d+\.\d+\.\d+\.\d+)\//.exec(cidr.trim())
  return !!m && ipToInt(m[1]!) === parseCidr(cidr).network
}

export function size(c: Cidr): number {
  return 2 ** (32 - c.prefix)
}

export function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const c = parseCidr(cidr)
    const n = ipToInt(ip)
    return n >= c.network && n < c.network + size(c)
  } catch {
    return false
  }
}

export function overlaps(a: string, b: string): boolean {
  const x = parseCidr(a)
  const y = parseCidr(b)
  return x.network < y.network + size(y) && y.network < x.network + size(x)
}

export function contains(outer: string, inner: string): boolean {
  const o = parseCidr(outer)
  const i = parseCidr(inner)
  return i.network >= o.network && i.network + size(i) <= o.network + size(o)
}

export interface AzureSubnetInfo {
  cidr: string
  networkAddress: string
  broadcastAddress: string
  totalAddresses: number
  usableByAzure: number
  reserved: string[]
  firstUsable: string
  lastUsable: string
  errors: string[]
}

/** Azure allows IPv4 subnets from /2 to /29. */
export function azureSubnet(cidr: string): AzureSubnetInfo {
  const c = parseCidr(cidr)
  const errors: string[] = []
  if (!isAligned(cidr)) errors.push(`${cidr} is not on a /${c.prefix} boundary; Azure stores it as ${intToIp(c.network)}/${c.prefix}.`)
  if (c.prefix > 29) errors.push('Azure subnets must be /29 or larger (a /29 leaves 3 usable addresses).')
  if (c.prefix < 2) errors.push('Azure subnets cannot be larger than /2.')
  const total = size(c)
  const last = c.network + total - 1
  return {
    cidr: `${intToIp(c.network)}/${c.prefix}`,
    networkAddress: intToIp(c.network),
    broadcastAddress: intToIp(last),
    totalAddresses: total,
    usableByAzure: Math.max(0, total - 5),
    reserved: [c.network, c.network + 1, c.network + 2, c.network + 3, last].map(intToIp),
    firstUsable: intToIp(c.network + 4),
    lastUsable: intToIp(last - 1),
    errors,
  }
}

export interface VnetPlanIssue {
  subnet: string
  problem: string
}

/** Validate subnets against a VNet address space: containment and mutual overlap. */
export function validateVnetPlan(addressSpace: string[], subnets: string[]): VnetPlanIssue[] {
  const issues: VnetPlanIssue[] = []
  subnets.forEach((s, i) => {
    try {
      if (!addressSpace.some((a) => contains(a, s))) issues.push({ subnet: s, problem: 'is outside the VNet address space' })
      subnets.slice(0, i).forEach((other) => {
        if (overlaps(s, other)) issues.push({ subnet: s, problem: `overlaps ${other}` })
      })
      azureSubnet(s).errors.forEach((e) => issues.push({ subnet: s, problem: e }))
    } catch (e) {
      issues.push({ subnet: s, problem: (e as Error).message })
    }
  })
  return issues
}

/** Peering requires non-overlapping address spaces between the two VNets. */
export function canPeer(a: string[], b: string[]): { ok: boolean; conflicts: Array<[string, string]> } {
  const conflicts: Array<[string, string]> = []
  for (const x of a) for (const y of b) if (overlaps(x, y)) conflicts.push([x, y])
  return { ok: conflicts.length === 0, conflicts }
}
