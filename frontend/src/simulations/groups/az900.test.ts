import { describe, expect, it } from 'vitest'
import { capacityModel, compositeSla, downtimePerMonthMinutes, groups, responsibility, transferDays } from './az900'

const sc = (g: string, s: string) => groups.find((x) => x.id === g)!.scenarios.find((x) => x.id === s)!

describe('AZ-900 models', () => {
  it('shared responsibility follows the Microsoft diagram', () => {
    expect(responsibility('SaaS', 'Information and data')).toBe('Customer')
    expect(responsibility('IaaS', 'Operating system')).toBe('Customer')
    expect(responsibility('PaaS', 'Operating system')).toBe('Microsoft')
    expect(responsibility('PaaS', 'Applications')).toBe('Shared')
    expect(responsibility('SaaS', 'Physical datacenter, hosts and network')).toBe('Microsoft')
    expect(responsibility('On-premises', 'Physical datacenter, hosts and network')).toBe('Customer')
  })
  it('composite SLA multiplies dependencies', () => {
    expect(compositeSla([99.95, 99.99])).toBeCloseTo(99.94, 2)
    expect(downtimePerMonthMinutes(99.9)).toBeCloseTo(43.2, 1)
  })
  it('fixed capacity sized for peak sits idle; under-buying leaves demand unmet', () => {
    const d = [10, 10, 10, 40]
    expect(capacityModel(d, 40, 1, 1.3).idlePct).toBeGreaterThan(50)
    expect(capacityModel(d, 20, 1, 1.3).unmet).toBe(1)
  })
  it('estimates transfer time', () => {
    expect(transferDays(80, 100)).toBeCloseTo(74.1, 0)
  })
  it('zones survive a datacenter failure but not a region outage', () => {
    const s = sc('az900-regions-sim', 'regions')
    expect(s.evaluate(s.initial).outcome.ok).toBe(true)
    expect(s.evaluate({ ...s.initial, event: 'Whole region outage' }).outcome.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, event: 'Whole region outage', deploy: 'Two regions (region pair)' }).outcome.ok).toBe(true)
  })
  it('Conditional Access blocks password-only sign-in from unknown locations; RBAC limits actions', () => {
    const s = sc('az900-access-sim', 'signin')
    expect(s.evaluate(s.initial).stages[2]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, method: 'Password + MFA' }).stages[3]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, method: 'Password + MFA', role: 'Contributor' }).outcome.ok).toBe(true)
  })
  it('choosers grade answers', () => {
    const s = sc('az900-compute-sim', 'compute')
    expect(s.evaluate({ req: 'event', choice: 'Azure Functions' }).outcome.ok).toBe(true)
    expect(s.evaluate({ req: 'event', choice: 'Azure Virtual Machines' }).outcome.ok).toBe(false)
  })
  it('defense in depth reports gaps', () => {
    const s = sc('az900-defense-sim', 'defense')
    expect(s.evaluate(s.initial).outcome.ok).toBe(false)
    expect(s.evaluate({ mfa: true, ddos: true, nsg: true, patch: true, appsec: true, enc: true, defender: true }).outcome.ok).toBe(true)
  })
  it('a VM needs size, OS disk, VNet and NIC; internet access needs a public IP and NSG rule', () => {
    const s = sc('az900-vm-hosting-sim', 'vm-build')
    expect(s.evaluate(s.initial).stages[2]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, nic: true }).outcome.ok).toBe(true)
    expect(s.evaluate({ ...s.initial, nic: true, nsg: false }).stages[3]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, nic: true, pip: false, nsg: false, access: 'Not needed from the internet' }).outcome.ok).toBe(true)
  })
  it('private endpoints work from the VNet even with public access disabled; not from the internet', () => {
    const s = sc('az900-endpoints-sim', 'endpoint-reach')
    expect(s.evaluate(s.initial).outcome.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, from: 'VM in the same VNet' }).checks).toEqual(['endpoint-private'])
    expect(s.evaluate({ ...s.initial, from: 'VM in the same VNet', pe: false }).outcome.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, pub: 'Enabled from selected IPs and VNets', fw: true }).checks).toEqual(['endpoint-public'])
  })
  it('redundancy: LRS loses a datacenter, ZRS survives it, GRS needs failover unless RA', () => {
    const s = sc('az900-redundancy-sim', 'redundancy')
    expect(s.evaluate(s.initial).stages[2]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, r: 'ZRS' }).outcome.ok).toBe(true)
    const region = { ...s.initial, event: 'Whole primary region outage' }
    expect(s.evaluate({ ...region, r: 'ZRS' }).stages[2]!.ok).toBe(false)
    expect(s.evaluate({ ...region, r: 'GRS' }).stages[3]!.ok).toBe(false)
    expect(s.evaluate({ ...region, r: 'GRS', failover: true }).outcome.ok).toBe(true)
    expect(s.evaluate({ ...region, r: 'RA-GZRS' }).outcome.ok).toBe(true)
    expect(s.evaluate({ ...s.initial, r: 'GRS' }).stages[3]!.ok).toBe(false)
  })
  it('tags are not inherited unless inheritance is enabled', () => {
    const s = sc('az900-costmgmt-sim', 'tags')
    expect(s.evaluate(s.initial).outcome.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, inherit: true }).outcome.ok).toBe(true)
    expect(s.evaluate({ ...s.initial, rgTag: false, inherit: true }).outcome.ok).toBe(false)
  })
  it('requests pass RBAC, then Policy, then locks; locks bind Owners too', () => {
    const s = sc('az900-governance-sim', 'policy-lock')
    expect(s.evaluate(s.initial).checks).toEqual(['gov-lock-blocked'])
    expect(s.evaluate({ ...s.initial, lock: 'None' }).outcome.ok).toBe(true)
    expect(s.evaluate({ ...s.initial, action: 'Change the VM size' }).outcome.ok).toBe(true)
    expect(s.evaluate({ ...s.initial, action: 'Change the VM size', lock: 'ReadOnly' }).outcome.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, action: 'Create a VM in Brazil South', lock: 'None' }).checks).toEqual(['gov-policy-denied'])
    expect(s.evaluate({ ...s.initial, role: 'Reader' }).checks).toEqual(['gov-rbac-denied'])
  })
  it('templates are repeatable; complete mode deletes resources missing from the template', () => {
    const s = sc('az900-iac-sim', 'arm-deploy')
    expect(s.evaluate(s.initial).checks).toEqual(['iac-drift'])
    const tpl = { ...s.initial, approach: 'ARM template / Bicep file' }
    expect(s.evaluate(tpl).outcome.ok).toBe(true)
    expect(s.evaluate({ ...tpl, extra: true }).outcome.ok).toBe(true)
    expect(s.evaluate({ ...tpl, extra: true, mode: 'Complete' }).checks).toEqual(['iac-complete-delete'])
  })
  it('alerts need collected data, the right alert type and an action group', () => {
    const s = sc('az900-monitor-sim', 'alert-pipeline')
    expect(s.evaluate(s.initial).stages[1]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, ama: true }).outcome.ok).toBe(true)
    expect(s.evaluate({ ...s.initial, ama: true, alert: 'Metric alert' }).stages[2]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, src: 'VM CPU percentage (platform metric)', alert: 'Metric alert', ag: false }).stages[3]!.ok).toBe(false)
  })
  it('every AZ-900 lesson group has at least two scenarios', () => {
    for (const grp of groups) expect(grp.scenarios.length, grp.id).toBeGreaterThanOrEqual(2)
  })
})
