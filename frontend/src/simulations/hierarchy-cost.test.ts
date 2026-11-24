import { describe, expect, it } from 'vitest'
import { canCreateManagementGroup, depthOf, moveSubscription, planResourceMove, type AzResource, type MgNode } from './hierarchy'
import { advisorCostRecommendations, simulateBudget } from './cost'

const tree: MgNode[] = [
  { id: 'root', name: 'Tenant Root Group', kind: 'managementGroup', parent: null, assigned: ['Allowed locations'] },
  { id: 'lz', name: 'Landing zones', kind: 'managementGroup', parent: 'root', assigned: [] },
  { id: 'prod', name: 'Prod', kind: 'managementGroup', parent: 'lz', assigned: ['Require costCenter tag'] },
  { id: 'sandbox', name: 'Sandbox', kind: 'managementGroup', parent: 'root', assigned: ['Budget 200 USD'] },
  { id: 'sub1', name: 'sub-app1', kind: 'subscription', parent: 'sandbox', assigned: [] },
]
const allPerms = { ownerOnSubscription: true, writeOnTargetMg: true, writeOnCurrentParentMg: true }

describe('management groups', () => {
  it('computes depth and enforces the six-level limit', () => {
    expect(depthOf(tree, 'prod')).toBe(2)
    const deep: MgNode[] = [{ id: 'l0', name: 'root', kind: 'managementGroup', parent: null, assigned: [] }]
    for (let i = 1; i <= 6; i++) deep.push({ id: `l${i}`, name: `L${i}`, kind: 'managementGroup', parent: `l${i - 1}`, assigned: [] })
    expect(canCreateManagementGroup(deep, 'l5').ok).toBe(true)
    expect(canCreateManagementGroup(deep, 'l6').ok).toBe(false)
  })

  it('moving a subscription changes inherited assignments', () => {
    const r = moveSubscription(tree, 'sub1', 'prod', allPerms)
    expect(r.ok).toBe(true)
    expect(r.before.map((x) => x.item)).toEqual(['Budget 200 USD', 'Allowed locations'])
    expect(r.after.map((x) => x.item)).toEqual(['Require costCenter tag', 'Allowed locations'])
  })

  it('requires permissions on the subscription, target and current parent', () => {
    const r = moveSubscription(tree, 'sub1', 'prod', { ownerOnSubscription: false, writeOnTargetMg: true, writeOnCurrentParentMg: false })
    expect(r.ok).toBe(false)
    expect(r.errors).toHaveLength(2)
  })
})

describe('resource moves', () => {
  const res: AzResource[] = [
    { id: 'vm', name: 'vm1', type: 'Microsoft.Compute/virtualMachines', resourceGroup: 'rg-a', subscription: 's1', location: 'westeurope', dependsOn: ['disk', 'nic'], movable: true, directRoleAssignments: 1 },
    { id: 'disk', name: 'vm1-osdisk', type: 'Microsoft.Compute/disks', resourceGroup: 'rg-a', subscription: 's1', location: 'westeurope', dependsOn: [], movable: true, directRoleAssignments: 0 },
    { id: 'nic', name: 'vm1-nic', type: 'Microsoft.Network/networkInterfaces', resourceGroup: 'rg-a', subscription: 's1', location: 'westeurope', dependsOn: [], movable: true, directRoleAssignments: 0 },
    { id: 'aks', name: 'aks1', type: 'Microsoft.ContainerService/managedClusters', resourceGroup: 'rg-a', subscription: 's1', location: 'westeurope', dependsOn: [], movable: false, directRoleAssignments: 0 },
  ]
  it('requires dependent resources to move together', () => {
    const r = planResourceMove(res, ['vm'], { resourceGroup: 'rg-b', subscription: 's1' })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toMatch(/vm1-osdisk/)
  })
  it('warns about orphaned role assignments and unchanged region', () => {
    const r = planResourceMove(res, ['vm', 'disk', 'nic'], { resourceGroup: 'rg-b', subscription: 's1' })
    expect(r.ok).toBe(true)
    expect(r.warnings.join()).toMatch(/not moved/)
    expect(r.warnings.join()).toMatch(/keep their region/)
    expect(r.newIds[0]!.to).toContain('rg-b')
  })
  it('rejects unsupported types', () => {
    expect(planResourceMove(res, ['aks'], { resourceGroup: 'rg-b', subscription: 's1' }).ok).toBe(false)
  })
})

describe('budgets and Advisor', () => {
  const base = { amount: 300, days: 30, dailySpend: Array(30).fill(12), dataDelayDays: 1 }
  it('forecast alerts fire before actual alerts, after the data delay', () => {
    const r = simulateBudget({ ...base, conditions: [{ id: 'f100', type: 'Forecasted', percent: 100 }, { id: 'a80', type: 'Actual', percent: 80 }] })
    const f = r.fired.find((x) => x.conditionId === 'f100')!
    const a = r.fired.find((x) => x.conditionId === 'a80')!
    expect(f.day).toBeLessThan(a.day)
    expect(a.observedOn).toBe(a.day + 1)
    expect(r.overBudget).toBe(true)
  })
  it('a budget alone does not reduce spend; automation does', () => {
    const conds = [{ id: 'a80', type: 'Actual' as const, percent: 80 }]
    const plain = simulateBudget({ ...base, conditions: conds })
    const auto = simulateBudget({ ...base, conditions: conds, automation: { conditionId: 'a80', reduceTo: 0.1 } })
    expect(plain.total).toBe(360)
    expect(auto.total).toBeLessThan(plain.total)
    expect(auto.overBudget).toBe(false)
  })
  it('Advisor flags only VMs under the CPU threshold', () => {
    const recs = advisorCostRecommendations([{ name: 'a', size: 'D4', avgCpu: 2, monthlyCost: 140 }, { name: 'b', size: 'D4', avgCpu: 8, monthlyCost: 140 }, { name: 'c', size: 'D4', avgCpu: 40, monthlyCost: 140 }], 10)
    expect(recs.map((r) => r.vm)).toEqual(['a', 'b'])
    expect(recs[0]!.recommendation).toMatch(/Shut down/)
  })
})
