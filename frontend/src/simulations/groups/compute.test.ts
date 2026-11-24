import { describe, expect, it } from 'vitest'
import { APP_TIERS, acaReplicas, acrNameValid, adeCheck, availabilityOutcome, deploymentModeEffect, deploymentOrder, groups, resizeCheck, simulateAutoscale } from './compute'

const sc = (g: string, s: string) => groups.find((x) => x.id === g)!.scenarios.find((x) => x.id === s)!

describe('ARM / Bicep', () => {
  it('orders deployments by dependencies and detects cycles', () => {
    expect(deploymentOrder([{ name: 'vnet', dependsOn: [] }, { name: 'nic', dependsOn: ['vnet'] }, { name: 'st', dependsOn: [] }, { name: 'vm', dependsOn: ['nic'] }]).order).toEqual([['vnet', 'st'], ['nic'], ['vm']])
    expect(deploymentOrder([{ name: 'a', dependsOn: ['b'] }, { name: 'b', dependsOn: ['a'] }]).cycle).toBe(true)
  })
  it('Complete mode deletes resources missing from the template; Incremental leaves them', () => {
    expect(deploymentModeEffect('Complete', ['a', 'old'], ['a', 'new']).deleted).toEqual(['old'])
    expect(deploymentModeEffect('Incremental', ['a', 'old'], ['a', 'new']).untouched).toEqual(['old'])
  })
  it('rejects parameter values outside allowedValues', () => {
    const ev = sc('arm-sim', 'deploy').evaluate({ ...sc('arm-sim', 'deploy').initial, storageSku: 'Premium_GRS' })
    expect(ev.outcome.ok).toBe(false)
    expect(ev.stages[1]!.detail).toMatch(/allowedValues/)
  })
})

describe('virtual machines', () => {
  it('availability sets survive rack failures but not zone failures; zones survive both', () => {
    expect(availabilityOutcome({ placement: 'set', vms: 4, failure: 'host', faultDomains: 2, updateDomains: 5 }).running).toBe(2)
    expect(availabilityOutcome({ placement: 'set', vms: 4, failure: 'zone', faultDomains: 2, updateDomains: 5 }).running).toBe(0)
    expect(availabilityOutcome({ placement: 'zones', vms: 3, failure: 'zone', faultDomains: 0, updateDomains: 0 }).running).toBe(2)
    expect(availabilityOutcome({ placement: 'zones', vms: 3, failure: 'region', faultDomains: 0, updateDomains: 0 }).running).toBe(0)
  })
  it('resize needs deallocation when the size is not on the current cluster', () => {
    expect(resizeCheck({ running: true, availableOnCluster: true, inSet: false }).needsDeallocate).toBe(false)
    expect(resizeCheck({ running: true, availableOnCluster: false, inSet: true }).detail).toMatch(/ALL VMs/)
  })
  it('ADE requires a key vault in the same region enabled for disk encryption', () => {
    expect(adeCheck({ vaultRegionMatches: false, enabledForDiskEncryption: false, vmSupported: true })).toHaveLength(2)
  })
  it('VM creation fails on quota and reserved usernames', () => {
    const s = sc('vm-sim', 'create')
    expect(s.evaluate({ ...s.initial, quotaFree: 2 }).stages[0]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, username: 'admin' }).outcome.ok).toBe(false)
  })
})

describe('autoscale and containers', () => {
  it('scales out under load and back in afterwards, within min/max', () => {
    const load = [...Array(30).fill(50), ...Array(60).fill(500), ...Array(60).fill(50)]
    const r = simulateAutoscale(load, { metricAbove: 70, metricBelow: 30, durationMin: 5, cooldownMin: 5, step: 1 }, 2, 10, 2, 60)
    expect(Math.max(...r.instances)).toBeGreaterThan(2)
    expect(Math.max(...r.instances)).toBeLessThanOrEqual(10)
    expect(r.instances.at(-1)).toBeLessThan(Math.max(...r.instances))
  })
  it('Container Apps scales to zero and caps at max replicas', () => {
    expect(acaReplicas(0, 10, 0, 10)).toBe(0)
    expect(acaReplicas(250, 10, 0, 10)).toBe(10)
    expect(acaReplicas(35, 10, 1, 10)).toBe(4)
  })
  it('validates ACR names and requires Premium for geo-replication', () => {
    expect(acrNameValid('acrcontoso01')).toBe(true)
    expect(acrNameValid('acr-contoso')).toBe(false)
    const s = sc('container-sim', 'pipeline')
    expect(s.evaluate({ ...s.initial, geoRep: true }).outcome.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, pullAuth: 'None' }).stages[2]!.ok).toBe(false)
  })
})

describe('App Service', () => {
  it('tier limits', () => {
    expect(APP_TIERS.Basic.maxInstances).toBe(3)
    expect(APP_TIERS.Standard.slots).toBe(5)
    expect(APP_TIERS.Free.customDomain).toBe(false)
  })
  it('apex domains need an A record and wildcard needs a non-managed certificate', () => {
    const s = sc('appservice-sim', 'domain-tls')
    expect(s.evaluate({ ...s.initial, host: 'contoso.com (apex)' }).stages[1]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, host: '*.contoso.com (wildcard)' }).stages[3]!.ok).toBe(false)
    expect(s.evaluate(s.initial).outcome.ok).toBe(true)
  })
  it('slots need Standard; non-sticky connection strings swap into production', () => {
    const s = sc('appservice-sim', 'slots')
    expect(s.evaluate({ ...s.initial, tier: 'Basic' }).stages[0]!.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, dbSticky: false }).outcome.ok).toBe(false)
  })
  it('Basic has no rule-based autoscale', () => {
    const s = sc('appservice-sim', 'plan')
    expect(s.evaluate(s.initial).outcome.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, tier: 'Standard' }).outcome.ok).toBe(true)
  })
})
