import { describe, expect, it } from 'vitest'
import { evaluateFlow, validateRule, portMatches, type Flow, type Nsg } from './nsg'
import { azureSubnet, canPeer, validateVnetPlan, ipInCidr } from './subnet'
import { checkAccess, operationMatches, type Principal, type Scope } from './rbac'
import { simulate } from './replication'

const inbound = (port: number, extra: Partial<Flow> = {}): Flow => ({
  direction: 'Inbound', protocol: 'TCP', sourceIp: '203.0.113.10', sourcePort: 50123,
  destinationIp: '10.0.1.4', destinationPort: port, vmAsgs: ['web'], viaStandardPublicIp: true,
  vnetPrefixes: ['10.0.0.0/16'], ...extra,
})

describe('NSG evaluation', () => {
  const allow443: Nsg = { name: 'subnet-nsg', rules: [
    { name: 'Allow-HTTPS', priority: 200, direction: 'Inbound', access: 'Allow', protocol: 'TCP', source: 'Internet', sourcePorts: '*', destination: '*', destinationPorts: '443' },
    { name: 'Deny-HTTPS', priority: 300, direction: 'Inbound', access: 'Deny', protocol: 'TCP', source: '*', sourcePorts: '*', destination: '*', destinationPorts: '443' },
  ] }

  it('lowest priority number wins', () => {
    const r = evaluateFlow(inbound(443), allow443, null)
    expect(r.allowed).toBe(true)
    expect(r.levels[0]!.rule!.name).toBe('Allow-HTTPS')
  })

  it('falls through to DenyAllInBound when nothing matches', () => {
    const r = evaluateFlow(inbound(22), allow443, null)
    expect(r.allowed).toBe(false)
    expect(r.levels[0]!.rule!.name).toBe('DenyAllInBound')
  })

  it('inbound needs both subnet and NIC NSG to allow', () => {
    const nic: Nsg = { name: 'nic-nsg', rules: [] }
    const r = evaluateFlow(inbound(443), allow443, nic)
    expect(r.allowed).toBe(false)
    expect(r.levels.map((l) => l.level)).toEqual(['subnet', 'nic'])
    expect(r.levels[1]!.rule!.name).toBe('DenyAllInBound')
  })

  it('outbound evaluates NIC first', () => {
    const r = evaluateFlow({ ...inbound(443), direction: 'Outbound', sourceIp: '10.0.1.4', destinationIp: '203.0.113.10' }, allow443, { name: 'nic', rules: [] })
    expect(r.levels[0]!.level).toBe('nic')
    expect(r.allowed).toBe(true) // AllowInternetOutBound
  })

  it('Standard public IP without any NSG is closed inbound', () => {
    const r = evaluateFlow(inbound(443), null, null)
    expect(r.allowed).toBe(false)
    expect(r.explanation).toMatch(/secure by default/)
  })

  it('VNet traffic is allowed by default rule', () => {
    const r = evaluateFlow(inbound(22, { sourceIp: '10.0.2.5', viaStandardPublicIp: false }), { name: 'n', rules: [] }, null)
    expect(r.levels[0]!.rule!.name).toBe('AllowVnetInBound')
  })

  it('matches application security groups on the destination NIC', () => {
    const nsg: Nsg = { name: 'n', rules: [{ name: 'web-asg', priority: 100, direction: 'Inbound', access: 'Allow', protocol: 'TCP', source: '*', sourcePorts: '*', destination: 'asg:web', destinationPorts: '80' }] }
    expect(evaluateFlow(inbound(80), nsg, null).allowed).toBe(true)
    expect(evaluateFlow(inbound(80, { vmAsgs: ['db'] }), nsg, null).allowed).toBe(false)
  })

  it('validates priority and ports', () => {
    expect(validateRule({ name: 'x', priority: 50, direction: 'Inbound', access: 'Allow', protocol: '*', source: '*', sourcePorts: '*', destination: '*', destinationPorts: 'abc' })).toHaveLength(2)
    expect(portMatches('1000-2000,3389', 3389)).toBe(true)
    expect(portMatches('1000-2000', 2001)).toBe(false)
  })
})

describe('Subnet maths', () => {
  it('reserves five addresses', () => {
    const s = azureSubnet('10.0.1.0/24')
    expect(s.usableByAzure).toBe(251)
    expect(s.reserved).toEqual(['10.0.1.0', '10.0.1.1', '10.0.1.2', '10.0.1.3', '10.0.1.255'])
    expect(s.firstUsable).toBe('10.0.1.4')
    expect(azureSubnet('10.0.0.0/29').usableByAzure).toBe(3)
    expect(azureSubnet('10.0.0.0/30').errors.length).toBe(1)
  })
  it('flags misaligned, overlapping and out-of-range subnets', () => {
    const issues = validateVnetPlan(['10.0.0.0/16'], ['10.0.1.0/24', '10.0.1.128/25', '10.1.0.0/24', '10.0.2.5/24'])
    expect(issues.map((i) => i.problem).join('|')).toMatch(/overlaps 10.0.1.0\/24/)
    expect(issues.some((i) => i.subnet === '10.1.0.0/24' && /outside/.test(i.problem))).toBe(true)
    expect(issues.some((i) => i.subnet === '10.0.2.5/24' && /boundary/.test(i.problem))).toBe(true)
  })
  it('detects peering conflicts', () => {
    expect(canPeer(['10.0.0.0/16'], ['10.0.128.0/17']).ok).toBe(false)
    expect(canPeer(['10.0.0.0/16'], ['10.1.0.0/16']).ok).toBe(true)
    expect(ipInCidr('10.0.255.255', '10.0.0.0/16')).toBe(true)
  })
})

describe('RBAC', () => {
  const scopes: Scope[] = [
    { id: 'mg', name: 'Contoso MG', kind: 'managementGroup', parent: null },
    { id: 'sub', name: 'Prod subscription', kind: 'subscription', parent: 'mg' },
    { id: 'rg', name: 'rg-web', kind: 'resourceGroup', parent: 'sub' },
    { id: 'vm', name: 'vm-web-01', kind: 'resource', parent: 'rg' },
  ]
  const principals: Principal[] = [
    { id: 'ana', name: 'Ana', kind: 'user', memberOf: ['ops'] },
    { id: 'ops', name: 'Ops team', kind: 'group', memberOf: [] },
  ]
  const op = 'Microsoft.Compute/virtualMachines/restart/action'

  it('inherits a group assignment from a parent scope', () => {
    const r = checkAccess({ scopes, principals, assignments: [{ id: 'a1', principalId: 'ops', role: 'Virtual Machine Contributor', scopeId: 'sub' }], principalId: 'ana', scopeId: 'vm', operation: op })
    expect(r.allowed).toBe(true)
    expect(r.matchingAssignments[0]!.inherited).toBe(true)
  })

  it('does not apply child-scope assignments upward', () => {
    const r = checkAccess({ scopes, principals, assignments: [{ id: 'a1', principalId: 'ana', role: 'Owner', scopeId: 'vm' }], principalId: 'ana', scopeId: 'rg', operation: 'Microsoft.Resources/subscriptions/resourceGroups/write' })
    expect(r.allowed).toBe(false)
  })

  it('Contributor cannot write role assignments; NotActions are not denies', () => {
    const write = 'Microsoft.Authorization/roleAssignments/write'
    const contributorOnly = checkAccess({ scopes, principals, assignments: [{ id: 'a', principalId: 'ana', role: 'Contributor', scopeId: 'rg' }], principalId: 'ana', scopeId: 'rg', operation: write })
    expect(contributorOnly.allowed).toBe(false)
    expect(contributorOnly.reason).toMatch(/NotActions/)
    const plusUaa = checkAccess({ scopes, principals, assignments: [
      { id: 'a', principalId: 'ana', role: 'Contributor', scopeId: 'rg' },
      { id: 'b', principalId: 'ops', role: 'User Access Administrator', scopeId: 'mg' },
    ], principalId: 'ana', scopeId: 'rg', operation: write })
    expect(plusUaa.allowed).toBe(true)
  })

  it('deny assignments override role grants', () => {
    const r = checkAccess({ scopes, principals, assignments: [{ id: 'a', principalId: 'ana', role: 'Owner', scopeId: 'mg' }],
      denyAssignments: [{ id: 'd', actions: ['*/delete'], scopeId: 'rg', excludedPrincipalIds: [], source: 'deployment stack' }],
      principalId: 'ana', scopeId: 'vm', operation: 'Microsoft.Compute/virtualMachines/delete' })
    expect(r.allowed).toBe(false)
    expect(r.deniedBy?.id).toBe('d')
  })

  it('wildcards match operations', () => {
    expect(operationMatches('*/read', 'Microsoft.Storage/storageAccounts/read')).toBe(true)
    expect(operationMatches('Microsoft.Authorization/*/Write', 'Microsoft.Authorization/roleAssignments/write')).toBe(true)
  })
})

describe('Storage redundancy', () => {
  it('LRS loses availability in a datacenter failure', () => {
    expect(simulate('LRS', 'zone').reads).toBe('unavailable')
    expect(simulate('LRS', 'node').reads).toBe('available')
  })
  it('ZRS survives a zone but not a region', () => {
    expect(simulate('ZRS', 'zone').writes).toBe('available')
    expect(simulate('ZRS', 'region').reads).toBe('unavailable')
  })
  it('geo-replication never claims zero data loss on regional failover', () => {
    for (const r of ['GRS', 'RA-GRS', 'GZRS', 'RA-GZRS'] as const) {
      expect(simulate(r, 'region').dataLossRisk).toBe('possible-recent-writes')
    }
  })
  it('only RA-* reads from the secondary without failover', () => {
    expect(simulate('RA-GZRS', 'region').reads).toBe('available-from-secondary')
    expect(simulate('GZRS', 'region').reads).toBe('unavailable')
  })
})
