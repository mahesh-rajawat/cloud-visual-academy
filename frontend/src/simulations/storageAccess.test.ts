import { describe, expect, it } from 'vitest'
import { evaluateStorageRequest, filesAccess, validateIpRule, type AccountAuthConfig, type NetworkConfig, type Request } from './storageAccess'

const net: NetworkConfig = { publicAccess: 'selected', ipRules: ['203.0.113.0/24'], vnetRules: ['snet-app'], allowTrustedServices: true }
const acct: AccountAuthConfig = { allowSharedKeyAccess: true, keyVersion: { key1: 1, key2: 1 }, allowBlobAnonymousAccess: false, containerAnonymousLevel: 'private', storedPolicies: [{ id: 'read-30d', permissions: ['read', 'list'], expiresInHours: 720 }] }
const req = (over: Partial<Request>): Request => ({ source: 'internet', clientIp: '203.0.113.7', https: true, op: 'read', auth: 'account-key', dataRoles: [], ...over })

describe('storage network rules', () => {
  it('allows listed public IPs and blocks others', () => {
    expect(evaluateStorageRequest(req({}), net, acct).allowed).toBe(true)
    expect(evaluateStorageRequest(req({ clientIp: '198.51.100.9' }), net, acct).steps[0]!.ok).toBe(false)
  })
  it('VNet access needs a service endpoint and a VNet rule; private endpoints bypass the firewall', () => {
    expect(evaluateStorageRequest(req({ source: 'vnet-service-endpoint', subnet: 'snet-app' }), net, acct).allowed).toBe(true)
    expect(evaluateStorageRequest(req({ source: 'vnet-no-endpoint' }), net, acct).allowed).toBe(false)
    expect(evaluateStorageRequest(req({ source: 'private-endpoint' }), { ...net, publicAccess: 'disabled' }, acct).allowed).toBe(true)
  })
  it('IP rules do not apply to same-region Azure traffic and reject private ranges', () => {
    expect(evaluateStorageRequest(req({ source: 'same-region-azure' }), net, acct).steps[0]!.detail).toMatch(/same region/)
    expect(validateIpRule('10.0.0.0/16')).toMatch(/public/)
    expect(validateIpRule('203.0.113.0/24')).toBeNull()
  })
})

describe('storage authorization', () => {
  const sas = { type: 'service' as const, signedWith: 'key1' as const, permissions: ['read' as const], expiresInHours: 4, httpsOnly: true, keyVersionAtSigning: 1 }
  it('key rotation invalidates SAS signed with that key', () => {
    expect(evaluateStorageRequest(req({ auth: 'service-sas', sas }), net, acct).allowed).toBe(true)
    expect(evaluateStorageRequest(req({ auth: 'service-sas', sas }), net, { ...acct, keyVersion: { key1: 2, key2: 1 } }).allowed).toBe(false)
  })
  it('enforces SAS permissions, expiry and HTTPS', () => {
    expect(evaluateStorageRequest(req({ auth: 'service-sas', sas, op: 'write' }), net, acct).allowed).toBe(false)
    expect(evaluateStorageRequest(req({ auth: 'service-sas', sas: { ...sas, expiresInHours: -1 } }), net, acct).allowed).toBe(false)
    expect(evaluateStorageRequest(req({ auth: 'service-sas', sas, https: false }), net, acct).allowed).toBe(false)
  })
  it('deleting a stored access policy revokes SAS that reference it', () => {
    const withPolicy = { ...sas, policyId: 'read-30d', permissions: [], expiresInHours: 0 }
    expect(evaluateStorageRequest(req({ auth: 'service-sas', sas: withPolicy }), net, acct).allowed).toBe(true)
    expect(evaluateStorageRequest(req({ auth: 'service-sas', sas: withPolicy }), net, { ...acct, storedPolicies: [] }).allowed).toBe(false)
  })
  it('disabling Shared Key blocks keys and key-signed SAS but not user delegation SAS', () => {
    const off = { ...acct, allowSharedKeyAccess: false }
    expect(evaluateStorageRequest(req({}), net, off).allowed).toBe(false)
    expect(evaluateStorageRequest(req({ auth: 'user-delegation-sas', sas: { ...sas, type: 'user-delegation', signedWith: 'delegation-key' } }), net, off).allowed).toBe(true)
  })
  it('Entra ID needs a data role', () => {
    expect(evaluateStorageRequest(req({ auth: 'entra-id', dataRoles: ['Owner'] }), net, acct).allowed).toBe(false)
    expect(evaluateStorageRequest(req({ auth: 'entra-id', dataRoles: ['Storage Blob Data Reader'] }), net, acct).allowed).toBe(true)
    expect(evaluateStorageRequest(req({ auth: 'entra-id', dataRoles: ['Storage Blob Data Reader'], op: 'write' }), net, acct).allowed).toBe(false)
  })
})

describe('Azure Files identity-based access', () => {
  const base = { identitySource: 'AD DS' as const, userSynced: true, port445Open: true, shareRole: 'Storage File Data SMB Share Contributor' as const, defaultSharePermission: 'none' as const, ntfs: 'modify' as const, op: 'write' as const }
  it('requires both share-level and NTFS permissions', () => {
    expect(filesAccess(base).ok).toBe(true)
    expect(filesAccess({ ...base, ntfs: 'read' }).ok).toBe(false)
    expect(filesAccess({ ...base, shareRole: 'Storage File Data SMB Share Reader' }).ok).toBe(false)
  })
  it('default share-level permission can substitute for a role assignment', () => {
    expect(filesAccess({ ...base, shareRole: 'none', defaultSharePermission: 'Storage File Data SMB Share Contributor' }).ok).toBe(true)
  })
  it('port 445 and synced identities are prerequisites', () => {
    expect(filesAccess({ ...base, port445Open: false }).reasons[0]).toMatch(/445/)
    expect(filesAccess({ ...base, userSynced: false }).ok).toBe(false)
  })
})
