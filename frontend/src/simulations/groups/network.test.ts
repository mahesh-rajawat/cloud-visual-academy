import { describe, expect, it } from 'vitest'
import { bastionCheck, cidrContains, cidrsOverlap, dnsRecordCheck, groups, lbHealthy, peeringReach, selectRoute, SYSTEM_ROUTES, type Route } from './network'

const sc = (g: string, s: string) => groups.find((x) => x.id === g)!.scenarios.find((x) => x.id === s)!

describe('network models', () => {
  it('CIDR maths', () => {
    expect(cidrContains('10.1.0.0/16', '10.1.2.4')).toBe(true)
    expect(cidrContains('10.1.2.0/24', '10.1.3.4')).toBe(false)
    expect(cidrsOverlap('10.0.0.0/16', '10.0.128.0/17')).toBe(true)
    expect(cidrsOverlap('10.0.0.0/16', '10.1.0.0/16')).toBe(false)
  })
  it('peering is not transitive', () => {
    const p = [{ from: 'a', to: 'hub' }, { from: 'hub', to: 'a' }, { from: 'b', to: 'hub' }, { from: 'hub', to: 'b' }]
    expect(peeringReach(p, 'a', 'b').ok).toBe(false)
    expect(peeringReach(p, 'a', 'b', true).ok).toBe(true)
    expect(peeringReach(p.slice(0, 1), 'a', 'hub').ok).toBe(false)
  })
  it('longest prefix wins, then User over system', () => {
    const routes: Route[] = [...SYSTEM_ROUTES('10.1.0.0/16'), { prefix: '0.0.0.0/0', nextHop: 'VirtualAppliance', source: 'User' }]
    expect(selectRoute(routes, '8.8.8.8')!.nextHop).toBe('VirtualAppliance')
    expect(selectRoute(routes, '10.1.2.4')!.nextHop).toBe('VnetLocal')
    routes.push({ prefix: '10.1.2.0/24', nextHop: 'None', source: 'User' })
    expect(selectRoute(routes, '10.1.2.4')!.nextHop).toBe('None')
  })
  it('Bastion requirements', () => {
    expect(bastionCheck({ subnetName: 'AzureBastionSubnet', prefixBits: 26, sku: 'Basic', nativeClient: false, shareableLink: false, publicIpSku: 'Standard' })).toEqual([])
    expect(bastionCheck({ subnetName: 'AzureBastionSubnet', prefixBits: 27, sku: 'Basic', nativeClient: false, shareableLink: false, publicIpSku: 'Standard' })).toHaveLength(1)
    expect(bastionCheck({ subnetName: 'AzureBastionSubnet', prefixBits: 26, sku: 'Basic', nativeClient: true, shareableLink: false, publicIpSku: 'Standard' })[0]).toMatch(/Standard or Premium/)
  })
  it('DNS record rules', () => {
    expect(dnsRecordCheck({ name: '@', type: 'CNAME', existingTypesAtName: [] })).toMatch(/apex/)
    expect(dnsRecordCheck({ name: '@', type: 'Alias A', existingTypesAtName: [] })).toBeNull()
  })
  it('LB probe and NSG decide healthy backends', () => {
    const b = [{ name: 'vm1', inPool: true, appUp: true, probePortOpen: true }, { name: 'vm2', inPool: true, appUp: false, probePortOpen: true }]
    expect(lbHealthy(b, true)).toEqual(['vm1'])
    expect(lbHealthy(b, false)).toEqual([])
  })
  it('scenarios: private endpoint needs DNS; service endpoint needs a VNet rule', () => {
    const e = sc('network-access-sim', 'endpoints')
    expect(e.evaluate({ ...e.initial, method: 'Private endpoint', publicOff: true }).outcome.ok).toBe(false)
    expect(e.evaluate({ ...e.initial, method: 'Private endpoint', publicOff: true, dnsZone: true }).outcome.ok).toBe(true)
    expect(e.evaluate({ ...e.initial, seSubnet: true }).outcome.ok).toBe(false)
    expect(e.evaluate({ ...e.initial, seSubnet: true, vnetRule: true }).outcome.ok).toBe(true)
  })
  it('UDR through NVA needs IP forwarding', () => {
    const u = sc('network-routing-sim', 'udr')
    expect(u.evaluate(u.initial).outcome.ok).toBe(false)
    expect(u.evaluate({ ...u.initial, ipfwd: true }).checks).toContain('udr-via-nva')
  })
})
