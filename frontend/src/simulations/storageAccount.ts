/**
 * Storage account creation, encryption, containers, file shares and AzCopy commands.
 * https://learn.microsoft.com/azure/storage/common/storage-account-overview
 * https://learn.microsoft.com/azure/storage/common/customer-managed-keys-overview
 * https://learn.microsoft.com/azure/storage/common/storage-use-azcopy-v10
 *
 * Modelled rules:
 *  - Account names: 3–24 characters, lowercase letters and numbers only, globally unique.
 *  - Account types and the redundancy they support: Standard general-purpose v2 (LRS, ZRS, GRS, RA-GRS,
 *    GZRS, RA-GZRS); Premium block blobs and Premium file shares (LRS, ZRS).
 *  - Container and share names: 3–63 characters, lowercase letters, numbers and hyphens, starting with a
 *    letter or number, no consecutive hyphens.
 *  - Customer-managed keys need a key vault with soft delete and purge protection, and an identity with
 *    access to the key (wrap/unwrap). Infrastructure (double) encryption can only be enabled at creation.
 *  - NFS file shares need a Premium file share account.
 */

export type AccountKind = 'StorageV2' | 'BlockBlobStorage' | 'FileStorage'
export type Redundancy = 'LRS' | 'ZRS' | 'GRS' | 'RA-GRS' | 'GZRS' | 'RA-GZRS'

export const KIND_INFO: Record<AccountKind, { label: string; performance: 'Standard' | 'Premium'; redundancy: Redundancy[]; services: string[] }> = {
  StorageV2: { label: 'Standard general-purpose v2', performance: 'Standard', redundancy: ['LRS', 'ZRS', 'GRS', 'RA-GRS', 'GZRS', 'RA-GZRS'], services: ['Blob', 'Files (SMB)', 'Queue', 'Table', 'Data Lake Gen2'] },
  BlockBlobStorage: { label: 'Premium block blobs', performance: 'Premium', redundancy: ['LRS', 'ZRS'], services: ['Blob (block and append)', 'Data Lake Gen2'] },
  FileStorage: { label: 'Premium file shares', performance: 'Premium', redundancy: ['LRS', 'ZRS'], services: ['Files (SMB and NFS)'] },
}

export function validateAccountName(name: string, taken: string[] = []): string | null {
  if (name.length < 3 || name.length > 24) return 'Storage account names must be 3–24 characters.'
  if (!/^[a-z0-9]+$/.test(name)) return 'Only lowercase letters and numbers are allowed (no hyphens or capitals).'
  if (taken.includes(name)) return 'This name is already taken. Names are globally unique because they form the endpoint DNS name.'
  return null
}

export function validateContainerName(name: string): string | null {
  if (name.length < 3 || name.length > 63) return 'Names must be 3–63 characters.'
  if (!/^[a-z0-9](?!.*--)[a-z0-9-]*[a-z0-9]$/.test(name)) return 'Use lowercase letters, numbers and single hyphens; start and end with a letter or number.'
  return null
}

export interface EncryptionConfig {
  keySource: 'Microsoft-managed' | 'Customer-managed'
  vaultSoftDelete: boolean
  vaultPurgeProtection: boolean
  identityHasKeyAccess: boolean
  infrastructureEncryption: boolean
}

export interface AccountDraft {
  name: string
  kind: AccountKind
  redundancy: Redundancy
  hierarchicalNamespace: boolean
  minimumTls: '1.0' | '1.1' | '1.2'
  secureTransfer: boolean
  allowBlobAnonymousAccess: boolean
  encryption: EncryptionConfig
}

export function validateAccount(d: AccountDraft, opts: { existing: boolean; existingInfraEncryption?: boolean; taken?: string[] }): { errors: string[]; warnings: string[]; endpoints: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const nameErr = opts.existing ? null : validateAccountName(d.name, opts.taken)
  if (nameErr) errors.push(nameErr)
  const info = KIND_INFO[d.kind]
  if (!info.redundancy.includes(d.redundancy)) errors.push(`${info.label} supports ${info.redundancy.join(' and ')} only.`)
  if (d.encryption.keySource === 'Customer-managed') {
    if (!d.encryption.vaultSoftDelete || !d.encryption.vaultPurgeProtection) errors.push('Customer-managed keys require soft delete and purge protection on the key vault.')
    if (!d.encryption.identityHasKeyAccess) errors.push('The storage account\'s managed identity needs get, wrapKey and unwrapKey on the key (for example the Key Vault Crypto Service Encryption User role).')
  }
  if (opts.existing && d.encryption.infrastructureEncryption !== !!opts.existingInfraEncryption) errors.push('Infrastructure encryption can only be enabled when the account is created.')
  if (d.minimumTls !== '1.2') warnings.push('Use minimum TLS version 1.2; older versions are being retired.')
  if (!d.secureTransfer) warnings.push('Secure transfer required is off: HTTP and unencrypted SMB connections will be accepted.')
  if (d.allowBlobAnonymousAccess) warnings.push('Anonymous blob access is allowed at account level; containers can then be made public.')
  if (d.hierarchicalNamespace) warnings.push('Hierarchical namespace (Data Lake Storage Gen2) changes feature support; some blob features behave differently.')
  const services = d.kind === 'FileStorage' ? ['file'] : d.kind === 'BlockBlobStorage' ? ['blob', 'dfs'] : ['blob', 'file', 'queue', 'table', ...(d.hierarchicalNamespace ? ['dfs'] : [])]
  return { errors, warnings, endpoints: services.map((s) => `https://${d.name || '<name>'}.${s}.core.windows.net`) }
}

export interface ShareDraft {
  name: string
  protocol: 'SMB' | 'NFS'
  tier: 'Transaction optimized' | 'Hot' | 'Cool' | 'Premium (provisioned)'
  quotaGiB: number
}

export function validateShare(s: ShareDraft, kind: AccountKind, largeFileShares: boolean): string[] {
  const errors: string[] = []
  const n = validateContainerName(s.name)
  if (n) errors.push(`Share name: ${n}`)
  if (kind === 'BlockBlobStorage') errors.push('Premium block blob accounts do not support Azure Files.')
  if (s.protocol === 'NFS' && kind !== 'FileStorage') errors.push('NFS file shares require a Premium file share (FileStorage) account.')
  if (kind === 'FileStorage' && s.tier !== 'Premium (provisioned)') errors.push('Premium file share accounts use provisioned premium shares.')
  if (kind === 'StorageV2' && s.tier === 'Premium (provisioned)') errors.push('Standard accounts use the Transaction optimized, Hot or Cool tiers.')
  const max = kind === 'FileStorage' || largeFileShares ? 102400 : 5120
  if (s.quotaGiB < 1 || s.quotaGiB > max) errors.push(`Quota must be 1–${max} GiB${max === 5120 ? ' (enable large file shares for up to 100 TiB)' : ''}.`)
  return errors
}

export interface AzCopyDraft {
  verb: 'copy' | 'sync'
  source: 'local' | 'blob' | 'other-account'
  dest: 'blob' | 'local' | 'file-share'
  auth: 'login' | 'sas'
  recursive: boolean
  deleteDestination: boolean
  hasDataRole: boolean
}

export function buildAzCopy(d: AzCopyDraft): { command: string; notes: string[]; errors: string[] } {
  const errors: string[] = []
  const notes: string[] = []
  const sas = d.auth === 'sas' ? '?<SAS>' : ''
  const path = (p: AzCopyDraft['source'] | AzCopyDraft['dest'], isDest: boolean) => {
    if (p === 'local') return isDest ? '"C:\\restore"' : '"C:\\reports"'
    if (p === 'file-share') return `"https://stcontoso.file.core.windows.net/share/reports${d.auth === 'sas' ? '?<SAS>' : ''}"`
    if (p === 'other-account') return `"https://stsource.blob.core.windows.net/reports${sas}"`
    return `"https://stcontoso.blob.core.windows.net/reports${sas}"`
  }
  if (d.source === 'local' && d.dest === 'local') errors.push('Use local tools for local-to-local copies.')
  if (d.dest === 'file-share' && d.auth === 'login') notes.push('SAS is the most common way to authorize AzCopy against Azure Files; check the AzCopy documentation for Entra ID support with file shares in your AzCopy version.')
  if (d.auth === 'login') {
    notes.push('Run azcopy login first. The signed-in identity needs a data role such as Storage Blob Data Contributor; Owner alone is not enough.')
    if (!d.hasDataRole) errors.push('azcopy login succeeds, but transfers fail with 403 because the identity has no Storage Blob Data role.')
  }
  if (d.verb === 'sync') notes.push('sync compares last-modified times and copies only changes; --delete-destination=true also removes files missing at the source.')
  if (d.source === 'other-account') notes.push('Account-to-account copies are server-side: data moves between storage services, not through your machine.')
  const flags = [d.recursive ? '--recursive' : '', d.verb === 'sync' && d.deleteDestination ? '--delete-destination=true' : ''].filter(Boolean).join(' ')
  const command = `${d.auth === 'login' ? 'azcopy login\n' : ''}azcopy ${d.verb} ${path(d.source, false)} ${path(d.dest, true)} ${flags}`.trim()
  return { command, notes, errors }
}
