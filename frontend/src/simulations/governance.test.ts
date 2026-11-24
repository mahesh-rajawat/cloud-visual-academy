import { describe, expect, it } from 'vitest'
import { complianceScan, evaluateLocks, evaluatePolicy, type GovScope, type PolicyAssignment, type ResourceState } from './governance'

const scopes: GovScope[] = [
  { id: 'mg', name: 'MG Contoso', kind: 'managementGroup', parent: null },
  { id: 'sub', name: 'Sub Prod', kind: 'subscription', parent: 'mg' },
  { id: 'rg-prod', name: 'rg-prod', kind: 'resourceGroup', parent: 'sub', tags: { costCenter: 'CC-100' } },
  { id: 'rg-sandbox', name: 'rg-sandbox', kind: 'resourceGroup', parent: 'sub', tags: {} },
  { id: 'vm1', name: 'vm1', kind: 'resource', parent: 'rg-prod' },
  { id: 'st1', name: 'st1', kind: 'resource', parent: 'rg-prod' },
]
const vm = (over: Partial<ResourceState> = {}): ResourceState => ({ type: 'Microsoft.Compute/virtualMachines', name: 'vm2', location: 'westeurope', tags: {}, vmSize: 'Standard_B2s', ...over })
const assign = (over: Partial<PolicyAssignment>): PolicyAssignment => ({ id: 'a', definitionId: 'allowed-locations', scopeId: 'mg', notScopes: [], params: ['westeurope'], enforcement: 'Default', ...over })

describe('Azure Policy evaluation', () => {
  it('denies a disallowed location, inherited from the management group', () => {
    const r = evaluatePolicy({ scopes, method: 'PUT', resourceGroupId: 'rg-prod', resource: vm({ location: 'eastus' }), assignments: [assign({})], exemptions: [] })
    expect(r.allowed).toBe(false)
    expect(r.events[0]!.outcome).toBe('denied')
  })

  it('respects notScopes exclusions and exemptions', () => {
    const excluded = evaluatePolicy({ scopes, method: 'PUT', resourceGroupId: 'rg-sandbox', resource: vm({ location: 'eastus' }), assignments: [assign({ notScopes: ['rg-sandbox'] })], exemptions: [] })
    expect(excluded.allowed).toBe(true)
    expect(excluded.events[0]!.outcome).toBe('excluded')
    const exempt = evaluatePolicy({ scopes, method: 'PUT', resourceGroupId: 'rg-prod', resource: vm({ location: 'eastus' }), assignments: [assign({})], exemptions: [{ id: 'e', assignmentId: 'a', scopeId: 'rg-prod', category: 'Waiver' }] })
    expect(exempt.allowed).toBe(true)
  })

  it('applies Modify before Deny, so an inherited tag satisfies a require-tag policy', () => {
    const assignments = [
      assign({ id: 'req', definitionId: 'require-tag', params: ['costCenter'] }),
      assign({ id: 'inh', definitionId: 'inherit-tag', params: ['costCenter'] }),
    ]
    const r = evaluatePolicy({ scopes, method: 'PUT', resourceGroupId: 'rg-prod', resource: vm(), assignments, exemptions: [] })
    expect(r.allowed).toBe(true)
    expect(r.resource.tags.costCenter).toBe('CC-100')
    expect(r.events.map((e) => e.outcome)).toEqual(['modified', 'compliant'])
    // In a resource group without the tag there is nothing to inherit, so Deny fires.
    const r2 = evaluatePolicy({ scopes, method: 'PUT', resourceGroupId: 'rg-sandbox', resource: vm(), assignments, exemptions: [] })
    expect(r2.allowed).toBe(false)
  })

  it('DoNotEnforce reports but does not block', () => {
    const r = evaluatePolicy({ scopes, method: 'PUT', resourceGroupId: 'rg-prod', resource: vm({ location: 'eastus' }), assignments: [assign({ enforcement: 'DoNotEnforce' })], exemptions: [] })
    expect(r.allowed).toBe(true)
    expect(r.events[0]!.outcome).toBe('not-enforced')
  })

  it('Audit allows the request and Disabled skips it', () => {
    const audit = evaluatePolicy({ scopes, method: 'PUT', resourceGroupId: 'rg-prod', resource: vm(), assignments: [assign({ definitionId: 'audit-tag', params: ['environment'] })], exemptions: [] })
    expect(audit.allowed).toBe(true)
    expect(audit.events[0]!.outcome).toBe('audited')
    const off = evaluatePolicy({ scopes, method: 'PUT', resourceGroupId: 'rg-prod', resource: vm({ location: 'eastus' }), assignments: [assign({ effect: 'Disabled' })], exemptions: [] })
    expect(off.allowed).toBe(true)
  })

  it('does not evaluate deletes or POST actions', () => {
    expect(evaluatePolicy({ scopes, method: 'DELETE', resourceGroupId: 'rg-prod', resource: vm({ location: 'eastus' }), assignments: [assign({})], exemptions: [] }).evaluated).toBe(false)
  })

  it('compliance scan reports existing resources without changing them', () => {
    const existing = vm({ name: 'old', location: 'eastus' })
    const [row] = complianceScan({ scopes, resources: [{ resourceGroupId: 'rg-prod', resource: existing }], assignments: [assign({})], exemptions: [] })
    expect(row!.compliant).toBe(false)
    expect(row!.resource).toBe(existing)
  })
})

describe('Resource locks', () => {
  it('CanNotDelete blocks only deletes; ReadOnly blocks writes and POST actions', () => {
    const cnd = [{ id: 'l', scopeId: 'rg-prod', level: 'CanNotDelete' as const }]
    expect(evaluateLocks(scopes, 'vm1', 'DELETE', cnd).blocked).toBe(true)
    expect(evaluateLocks(scopes, 'vm1', 'PUT', cnd).blocked).toBe(false)
    const ro = [{ id: 'l', scopeId: 'rg-prod', level: 'ReadOnly' as const }]
    expect(evaluateLocks(scopes, 'vm1', 'POST', ro).blocked).toBe(true)
    expect(evaluateLocks(scopes, 'vm1', 'GET', ro).blocked).toBe(false)
    expect(evaluateLocks(scopes, 'vm1', 'PUT', ro).reason).toMatch(/inherited/)
  })

  it('most restrictive lock wins', () => {
    const locks = [{ id: 'a', scopeId: 'sub', level: 'CanNotDelete' as const }, { id: 'b', scopeId: 'vm1', level: 'ReadOnly' as const }]
    expect(evaluateLocks(scopes, 'vm1', 'DELETE', locks).lock!.id).toBe('b')
  })

  it('a resource group cannot be deleted while a child resource is locked', () => {
    const r = evaluateLocks(scopes, 'rg-prod', 'DELETE', [{ id: 'l', scopeId: 'st1', level: 'CanNotDelete' }])
    expect(r.blocked).toBe(true)
    expect(r.reason).toMatch(/inside it/)
  })
})
