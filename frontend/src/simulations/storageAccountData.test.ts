import { describe, expect, it } from 'vitest'
import { buildAzCopy, validateAccount, validateAccountName, validateContainerName, validateShare, type AccountDraft } from './storageAccount'
import { applyOps, objectReplicationCheck, readBlob, rehydrateTime, replicateBlob, runLifecycle, shareRecovery, type BlobState } from './storageData'

const draft: AccountDraft = { name: 'stcontoso01', kind: 'StorageV2', redundancy: 'GZRS', hierarchicalNamespace: false, minimumTls: '1.2', secureTransfer: true, allowBlobAnonymousAccess: false, encryption: { keySource: 'Microsoft-managed', vaultSoftDelete: true, vaultPurgeProtection: true, identityHasKeyAccess: true, infrastructureEncryption: false } }

describe('storage accounts', () => {
  it('validates names', () => {
    expect(validateAccountName('St-Contoso')).toMatch(/lowercase/)
    expect(validateAccountName('ab')).toMatch(/3–24/)
    expect(validateContainerName('my--logs')).not.toBeNull()
    expect(validateContainerName('logs-2026')).toBeNull()
  })
  it('restricts premium redundancy and validates CMK prerequisites', () => {
    expect(validateAccount({ ...draft, kind: 'FileStorage', redundancy: 'GRS' }, { existing: false }).errors[0]).toMatch(/LRS and ZRS/)
    const cmk = validateAccount({ ...draft, encryption: { ...draft.encryption, keySource: 'Customer-managed', vaultPurgeProtection: false } }, { existing: false })
    expect(cmk.errors.join()).toMatch(/purge protection/)
  })
  it('infrastructure encryption cannot be changed after creation', () => {
    expect(validateAccount({ ...draft, encryption: { ...draft.encryption, infrastructureEncryption: true } }, { existing: true, existingInfraEncryption: false }).errors).toHaveLength(1)
  })
  it('validates file shares', () => {
    expect(validateShare({ name: 'data', protocol: 'NFS', tier: 'Hot', quotaGiB: 100 }, 'StorageV2', false).join()).toMatch(/NFS/)
    expect(validateShare({ name: 'data', protocol: 'SMB', tier: 'Hot', quotaGiB: 10000 }, 'StorageV2', false).join()).toMatch(/large file shares/)
    expect(validateShare({ name: 'data', protocol: 'SMB', tier: 'Hot', quotaGiB: 10000 }, 'StorageV2', true)).toEqual([])
  })
  it('builds AzCopy commands and flags missing data roles', () => {
    const r = buildAzCopy({ verb: 'sync', source: 'local', dest: 'blob', auth: 'login', recursive: true, deleteDestination: true, hasDataRole: false })
    expect(r.command).toContain('azcopy sync "C:\\reports" "https://stcontoso.blob.core.windows.net/reports" --recursive --delete-destination=true')
    expect(r.errors[0]).toMatch(/403/)
  })
})

describe('tiers and lifecycle', () => {
  const blob = (name: string): BlobState => ({ name, tier: 'Hot', modifiedDay: 0, lastAccessDay: 0, tierChangedDay: 0, deleted: false })
  it('applies rules over time and the cheapest action wins', () => {
    const rules = [
      { id: 'cool', prefix: 'logs/', action: 'Cool' as const, afterDays: 30, basis: 'modified' as const },
      { id: 'archive', prefix: 'logs/', action: 'Archive' as const, afterDays: 90, basis: 'modified' as const },
      { id: 'del', prefix: 'logs/', action: 'delete' as const, afterDays: 365, basis: 'modified' as const },
    ]
    const r = runLifecycle([blob('logs/a'), blob('img/b')], rules, 400, false)
    expect(r.events.filter((e) => e.blob === 'logs/a').map((e) => [e.day, e.action])).toEqual([[31, 'moved to Cool'], [91, 'moved to Archive'], [366, 'deleted']])
    expect(r.blobs[1]!.tier).toBe('Hot')
  })
  it('reports early deletion when leaving a tier before its minimum', () => {
    const rules = [{ id: 'c', prefix: '', action: 'Cool' as const, afterDays: 1, basis: 'modified' as const }, { id: 'a', prefix: '', action: 'Archive' as const, afterDays: 10, basis: 'modified' as const }]
    const r = runLifecycle([blob('x')], rules, 12, false)
    expect(r.events[1]).toMatchObject({ action: 'moved to Archive', earlyDeletionDays: 21 })
  })
  it('archived blobs must be rehydrated', () => {
    expect(readBlob({ ...blob('x'), tier: 'Archive' }).detail).toMatch(/409/)
    expect(rehydrateTime('High', 2)).toMatch(/under 1 hour/)
    expect(rehydrateTime('Standard', 2)).toMatch(/15 hours/)
  })
})

describe('data protection', () => {
  it('versioning keeps overwritten data; without it overwrites are lost', () => {
    expect(applyOps(['write', 'overwrite', 'overwrite'], { versioning: true, blobSoftDeleteDays: 0, containerSoftDeleteDays: 0 }).versions).toEqual(['v1', 'v2'])
    expect(applyOps(['write', 'overwrite'], { versioning: false, blobSoftDeleteDays: 0, containerSoftDeleteDays: 0 }).lost).toEqual(['v1 (overwritten)'])
    expect(applyOps(['write', 'overwrite'], { versioning: false, blobSoftDeleteDays: 7, containerSoftDeleteDays: 0 }).softDeleted).toEqual(['v1 (snapshot of overwritten state)'])
  })
  it('soft delete recovers deletes; container deletion needs container soft delete', () => {
    expect(applyOps(['write', 'delete-blob'], { versioning: false, blobSoftDeleteDays: 7, containerSoftDeleteDays: 0 }).recoverable[0]).toMatch(/undelete/)
    expect(applyOps(['write', 'delete-container'], { versioning: true, blobSoftDeleteDays: 7, containerSoftDeleteDays: 0 }).lost[0]).toMatch(/entire container/)
  })
  it('object replication prerequisites and behaviour', () => {
    expect(objectReplicationCheck({ versioning: true, changeFeed: false, hierarchicalNamespace: false }, { versioning: false, changeFeed: false, hierarchicalNamespace: false })).toHaveLength(2)
    expect(replicateBlob('Archive', 'write').replicated).toBe(false)
    expect(replicateBlob('Hot', 'write-to-destination').detail).toMatch(/read-only/)
  })
  it('Azure Files recovery depends on snapshots vs share soft delete', () => {
    expect(shareRecovery({ snapshots: 0, shareSoftDeleteDays: 7, event: 'file-deleted' }).ok).toBe(false)
    expect(shareRecovery({ snapshots: 3, shareSoftDeleteDays: 0, event: 'file-deleted' }).ok).toBe(true)
    expect(shareRecovery({ snapshots: 3, shareSoftDeleteDays: 7, event: 'share-deleted' }).ok).toBe(true)
  })
})
