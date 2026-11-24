/**
 * Azure Storage data-plane access: network rules, account keys, SAS, stored access policies,
 * Entra ID (RBAC data roles) and identity-based access for Azure Files.
 *
 * Modelled behaviour:
 *  - Network: public network access Enabled (all networks), Enabled from selected networks
 *    (default action Deny + IP rules + VNet rules), or Disabled. IP rules accept public addresses only
 *    and do not apply to requests from the same Azure region. VNet rules need a Microsoft.Storage
 *    service endpoint on the subnet. Private endpoint traffic is not subject to the firewall.
 *    Trusted Azure services can be allowed as an exception.
 *    https://learn.microsoft.com/azure/storage/common/storage-network-security
 *  - Authorization: Shared Key (account key), account SAS and service SAS are signed with an account key.
 *    Rotating that key invalidates them. allowSharedKeyAccess=false rejects them, while user delegation
 *    SAS and Entra ID still work. A service SAS can reference a stored access policy; deleting or changing
 *    the policy revokes or changes every SAS that uses it.
 *    https://learn.microsoft.com/azure/storage/common/storage-sas-overview
 *  - Entra ID requests need a data role (for example Storage Blob Data Reader); control-plane roles such
 *    as Owner do not grant data access.
 *  - Azure Files over SMB with identity-based auth: share-level permission (RBAC role or default
 *    share-level permission) AND NTFS ACLs must both allow the operation.
 *    https://learn.microsoft.com/azure/storage/files/storage-files-active-directory-overview
 */

export type Source = 'internet' | 'same-region-azure' | 'vnet-service-endpoint' | 'vnet-no-endpoint' | 'private-endpoint' | 'trusted-service'
export type AuthMethod = 'account-key' | 'account-sas' | 'service-sas' | 'user-delegation-sas' | 'entra-id' | 'anonymous'
export type Op = 'read' | 'write' | 'delete' | 'list'

export interface NetworkConfig {
  publicAccess: 'all' | 'selected' | 'disabled'
  ipRules: string[] // public IPs / CIDRs
  vnetRules: string[] // subnet names that have a service endpoint and are allowed
  allowTrustedServices: boolean
}

export interface SasToken {
  type: 'account' | 'service' | 'user-delegation'
  signedWith: 'key1' | 'key2' | 'delegation-key'
  permissions: Op[]
  expiresInHours: number // negative = expired
  allowedIp?: string
  httpsOnly: boolean
  policyId?: string // service SAS only
}

export interface StoredAccessPolicy {
  id: string
  permissions: Op[]
  expiresInHours: number
}

export interface AccountAuthConfig {
  allowSharedKeyAccess: boolean
  /** Key versions currently valid; rotating key1 bumps keyVersion.key1. */
  keyVersion: { key1: number; key2: number }
  allowBlobAnonymousAccess: boolean
  containerAnonymousLevel: 'private' | 'blob' | 'container'
  storedPolicies: StoredAccessPolicy[]
}

export interface Request {
  source: Source
  clientIp: string
  subnet?: string
  https: boolean
  op: Op
  auth: AuthMethod
  sas?: SasToken & { keyVersionAtSigning: number }
  /** Data roles held by the Entra principal. */
  dataRoles: string[]
}

export interface AccessStep { layer: 'network' | 'authorization'; ok: boolean; detail: string }
export interface AccessResult { allowed: boolean; status: number; steps: AccessStep[] }

function ipInList(ip: string, list: string[]): boolean {
  const toInt = (s: string) => s.split('.').reduce((a, b) => (a << 8) + Number(b), 0) >>> 0
  return list.some((r) => {
    const [base, bits] = r.split('/')
    const mask = bits ? (0xffffffff << (32 - Number(bits))) >>> 0 : 0xffffffff
    return (toInt(ip) & mask) === (toInt(base!) & mask)
  })
}

export function isPrivateIp(ip: string) {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
}

export function validateIpRule(rule: string): string | null {
  if (!/^\d+\.\d+\.\d+\.\d+(\/\d{1,2})?$/.test(rule)) return 'Use an IPv4 address or CIDR range.'
  if (isPrivateIp(rule)) return 'IP network rules accept public addresses only; use virtual network rules or private endpoints for private ranges.'
  const bits = Number(rule.split('/')[1] ?? 32)
  if (bits === 31 || bits === 32 && rule.includes('/')) return '/31 and /32 prefixes are not supported; enter a single address without a prefix.'
  return null
}

export function checkNetwork(req: Request, net: NetworkConfig): AccessStep {
  if (req.source === 'private-endpoint') {
    return { layer: 'network', ok: true, detail: 'Arrives through a private endpoint (private IP in your VNet); storage firewall rules do not apply.' }
  }
  if (net.publicAccess === 'disabled') return { layer: 'network', ok: false, detail: 'Public network access is Disabled; only private endpoint traffic is accepted.' }
  if (net.publicAccess === 'all') return { layer: 'network', ok: true, detail: 'Public network access is enabled from all networks.' }
  if (req.source === 'trusted-service') {
    return net.allowTrustedServices
      ? { layer: 'network', ok: true, detail: 'Allowed by the exception for Azure services on the trusted services list.' }
      : { layer: 'network', ok: false, detail: 'Trusted-services exception is off, and the service is not otherwise allowed.' }
  }
  if (req.source === 'vnet-service-endpoint') {
    return req.subnet && net.vnetRules.includes(req.subnet)
      ? { layer: 'network', ok: true, detail: `Subnet ${req.subnet} has a Microsoft.Storage service endpoint and a virtual network rule.` }
      : { layer: 'network', ok: false, detail: `Subnet ${req.subnet ?? '?'} has a service endpoint but no virtual network rule on the account.` }
  }
  if (req.source === 'vnet-no-endpoint') {
    return { layer: 'network', ok: false, detail: 'Traffic from the VNet without a service endpoint reaches the public endpoint from an Azure-internal address. A VNet rule needs a service endpoint, and IP rules do not match same-region Azure traffic.' }
  }
  if (req.source === 'same-region-azure') {
    return { layer: 'network', ok: false, detail: 'IP network rules have no effect on requests from Azure services in the same region; use VNet rules, private endpoints or resource instance / trusted service exceptions.' }
  }
  return ipInList(req.clientIp, net.ipRules)
    ? { layer: 'network', ok: true, detail: `Client IP ${req.clientIp} matches an IP network rule.` }
    : { layer: 'network', ok: false, detail: `Client IP ${req.clientIp} is not in the IP rules and the default action is Deny.` }
}

export function checkAuthorization(req: Request, acct: AccountAuthConfig): AccessStep {
  const deny = (detail: string): AccessStep => ({ layer: 'authorization', ok: false, detail })
  const allow = (detail: string): AccessStep => ({ layer: 'authorization', ok: true, detail })
  const keyBased = req.auth === 'account-key' || req.auth === 'account-sas' || req.auth === 'service-sas'
  if (keyBased && !acct.allowSharedKeyAccess) return deny('Shared Key authorization is disallowed on this account, so account keys and key-signed SAS tokens are rejected.')
  switch (req.auth) {
    case 'anonymous':
      if (!acct.allowBlobAnonymousAccess) return deny('Anonymous access is disallowed at the account level.')
      if (acct.containerAnonymousLevel === 'private') return deny('The container access level is Private.')
      if (req.op === 'list' && acct.containerAnonymousLevel !== 'container') return deny('Blob-level anonymous access allows reading blobs but not listing the container.')
      return req.op === 'read' || req.op === 'list' ? allow(`Anonymous ${req.op} allowed by container access level "${acct.containerAnonymousLevel}".`) : deny('Anonymous access is read-only.')
    case 'account-key':
      return allow('Shared Key gives full access to the whole account. Treat keys like root passwords.')
    case 'entra-id': {
      const write = req.op === 'write' || req.op === 'delete'
      const ok = req.dataRoles.some((r) => r === 'Storage Blob Data Owner' || r === 'Storage Blob Data Contributor' || (!write && r === 'Storage Blob Data Reader'))
      return ok ? allow(`Entra ID token accepted; ${req.dataRoles.join(', ')} grants ${req.op}.`) : deny(`No data role grants ${req.op}. Control-plane roles such as Owner or Contributor do not grant data access.`)
    }
    default: {
      const sas = req.sas!
      if (sas.signedWith !== 'delegation-key') {
        const current = acct.keyVersion[sas.signedWith]
        if (sas.keyVersionAtSigning !== current) return deny(`The SAS was signed with ${sas.signedWith}, which has been rotated since; the signature no longer validates (403).`)
      }
      let perms = sas.permissions
      let expires = sas.expiresInHours
      if (sas.policyId) {
        const p = acct.storedPolicies.find((x) => x.id === sas.policyId)
        if (!p) return deny(`Stored access policy "${sas.policyId}" no longer exists, so every SAS that references it is revoked.`)
        perms = p.permissions
        expires = p.expiresInHours
      }
      if (expires <= 0) return deny('The SAS (or its stored access policy) has expired.')
      if (sas.httpsOnly && !req.https) return deny('The SAS allows HTTPS only (spr=https).')
      if (sas.allowedIp && sas.allowedIp !== req.clientIp) return deny(`The SAS is restricted to IP ${sas.allowedIp} (sip).`)
      if (!perms.includes(req.op)) return deny(`The SAS grants ${perms.join(', ')} but not ${req.op}.`)
      return allow(`${sas.type === 'user-delegation' ? 'User delegation SAS (signed with an Entra-issued delegation key)' : sas.type === 'account' ? 'Account SAS' : 'Service SAS'}${sas.policyId ? ` using stored access policy "${sas.policyId}"` : ''} grants ${req.op}.`)
    }
  }
}

export function evaluateStorageRequest(req: Request, net: NetworkConfig, acct: AccountAuthConfig): AccessResult {
  const n = checkNetwork(req, net)
  if (!n.ok) return { allowed: false, status: 403, steps: [n] }
  const a = checkAuthorization(req, acct)
  return { allowed: a.ok, status: a.ok ? 200 : 403, steps: [n, a] }
}

// ------------------------------------------------------------ Azure Files identity-based access
export type ShareRole = 'none' | 'Storage File Data SMB Share Reader' | 'Storage File Data SMB Share Contributor' | 'Storage File Data SMB Share Elevated Contributor'
export type NtfsRight = 'none' | 'read' | 'modify' | 'full'

export function filesAccess(input: {
  identitySource: 'none' | 'AD DS' | 'Microsoft Entra Domain Services' | 'Microsoft Entra Kerberos'
  userSynced: boolean
  port445Open: boolean
  shareRole: ShareRole
  defaultSharePermission: ShareRole
  ntfs: NtfsRight
  op: 'read' | 'write' | 'change-acl'
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!input.port445Open) reasons.push('Outbound TCP 445 is blocked, so SMB cannot reach the share (common with ISPs and some corporate networks).')
  if (input.identitySource === 'none') reasons.push('No identity source is enabled on the storage account, so only the storage account key can mount the share.')
  if ((input.identitySource === 'AD DS' || input.identitySource === 'Microsoft Entra Kerberos') && !input.userSynced) reasons.push(`${input.identitySource} authentication requires hybrid identities synced to Microsoft Entra ID.`)
  const rank: Record<ShareRole, number> = { none: 0, 'Storage File Data SMB Share Reader': 1, 'Storage File Data SMB Share Contributor': 2, 'Storage File Data SMB Share Elevated Contributor': 3 }
  const share = Math.max(rank[input.shareRole], rank[input.defaultSharePermission])
  const need = input.op === 'read' ? 1 : input.op === 'write' ? 2 : 3
  if (share < need) reasons.push(`Share-level permission is insufficient for ${input.op} (needs ${Object.keys(rank)[need]}).`)
  const ntfsRank: Record<NtfsRight, number> = { none: 0, read: 1, modify: 2, full: 3 }
  if (ntfsRank[input.ntfs] < need) reasons.push(`NTFS (directory/file) permission "${input.ntfs}" does not allow ${input.op}. Both share-level and NTFS permissions must allow it.`)
  return { ok: reasons.length === 0, reasons }
}
