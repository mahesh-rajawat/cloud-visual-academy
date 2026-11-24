/**
 * Blob access tiers, lifecycle management, versioning, soft delete, object replication and
 * Azure Files snapshots / soft delete.
 *
 *  Tiers (https://learn.microsoft.com/azure/storage/blobs/access-tiers-overview):
 *   Hot, Cool (30-day minimum), Cold (90-day minimum), Archive (180-day minimum, offline).
 *   Moving or deleting a blob before its tier's minimum incurs a prorated early-deletion charge.
 *   Archived blobs must be rehydrated before reading: Standard priority up to 15 hours; High priority
 *   usually under 1 hour for objects under 10 GB.
 *  Lifecycle management (https://learn.microsoft.com/azure/storage/blobs/lifecycle-management-overview):
 *   rules with filters (prefix, blob type) and actions such as tierToCool / tierToCold / tierToArchive /
 *   delete after N days since modification (or last access, if tracking is enabled). When several actions
 *   apply to the same blob, the least expensive action wins. The policy runs about once a day.
 *  Versioning / soft delete (https://learn.microsoft.com/azure/storage/blobs/versioning-overview):
 *   every overwrite or delete keeps the previous version; blob soft delete retains deleted blobs (and
 *   versions/snapshots) for 1–365 days, and without versioning it keeps an overwritten blob's previous
 *   state as a soft-deleted snapshot; container soft delete retains deleted containers.
 *  Object replication (https://learn.microsoft.com/azure/storage/blobs/object-replication-overview):
 *   asynchronous copy of block blobs between containers in two accounts. Needs versioning on both and
 *   change feed on the source. Not supported with hierarchical namespace. Replicated blobs in the
 *   destination container are read-only. Archive-tier blobs are not replicated.
 *  Azure Files (https://learn.microsoft.com/azure/storage/files/storage-snapshots-files):
 *   share snapshots are read-only, incremental, up to 200 per share. Share soft delete (1–365 days,
 *   on by default for new accounts) lets you undelete a deleted share.
 */

export type Tier = 'Hot' | 'Cool' | 'Cold' | 'Archive'
export const MIN_DAYS: Record<Tier, number> = { Hot: 0, Cool: 30, Cold: 90, Archive: 180 }
const COST_RANK: Record<string, number> = { delete: 0, Archive: 1, Cold: 2, Cool: 3, Hot: 4 }

export interface LifecycleRule {
  id: string
  prefix: string
  action: 'Cool' | 'Cold' | 'Archive' | 'delete'
  afterDays: number
  basis: 'modified' | 'lastAccess'
}

export interface BlobState {
  name: string
  tier: Tier
  modifiedDay: number
  lastAccessDay: number
  tierChangedDay: number
  deleted: boolean
}

export interface LifecycleEvent { day: number; blob: string; action: string; earlyDeletionDays: number }

/** Run the daily lifecycle policy from day 1 to `days`. */
export function runLifecycle(blobs: BlobState[], rules: LifecycleRule[], days: number, accessTracking: boolean) {
  const state = blobs.map((b) => ({ ...b }))
  const events: LifecycleEvent[] = []
  for (let day = 1; day <= days; day++) {
    for (const b of state) {
      if (b.deleted) continue
      const due = rules.filter((r) => b.name.startsWith(r.prefix) && (r.basis === 'lastAccess' && accessTracking ? day - b.lastAccessDay : day - b.modifiedDay) > r.afterDays)
      if (!due.length) continue
      // Least expensive action wins.
      const pick = due.sort((a, c) => COST_RANK[a.action]! - COST_RANK[c.action]!)[0]!
      if (pick.action !== 'delete' && COST_RANK[pick.action]! >= COST_RANK[b.tier]!) continue
      const inTier = day - b.tierChangedDay
      const early = Math.max(0, MIN_DAYS[b.tier] - inTier)
      if (pick.action === 'delete') b.deleted = true
      else { b.tier = pick.action; b.tierChangedDay = day }
      events.push({ day, blob: b.name, action: pick.action === 'delete' ? 'deleted' : `moved to ${pick.action}`, earlyDeletionDays: early })
    }
  }
  return { blobs: state, events }
}

export function readBlob(b: BlobState): { ok: boolean; detail: string } {
  if (b.deleted) return { ok: false, detail: '404 BlobNotFound: the blob is deleted (recoverable only if soft delete or versioning was on).' }
  if (b.tier === 'Archive') return { ok: false, detail: '409 BlobArchived: archived blobs are offline. Rehydrate with Set Blob Tier or Copy Blob first.' }
  return { ok: true, detail: `200 OK from the ${b.tier} tier.` }
}

export function rehydrateTime(priority: 'Standard' | 'High', sizeGB: number): string {
  if (priority === 'High' && sizeGB < 10) return 'usually under 1 hour'
  return 'up to 15 hours'
}

// ------------------------------------------------------------ versioning and soft delete
export interface ProtectionConfig {
  versioning: boolean
  blobSoftDeleteDays: number // 0 = off
  containerSoftDeleteDays: number
}

export type DataOp = 'write' | 'overwrite' | 'delete-blob' | 'delete-container'

export interface ProtectionTimeline {
  current: string | null
  versions: string[]
  softDeleted: string[]
  containerDeleted: boolean
  recoverable: string[]
  lost: string[]
}

export function applyOps(ops: DataOp[], cfg: ProtectionConfig): ProtectionTimeline {
  let current: string | null = null
  let n = 0
  const versions: string[] = []
  const softDeleted: string[] = []
  const lost: string[] = []
  let containerDeleted = false
  for (const op of ops) {
    if (containerDeleted) break
    if (op === 'write' || op === 'overwrite') {
      // Without versioning, blob soft delete keeps the overwritten state as a soft-deleted snapshot.
      if (current) cfg.versioning ? versions.push(current) : cfg.blobSoftDeleteDays > 0 ? softDeleted.push(`${current} (snapshot of overwritten state)`) : lost.push(`${current} (overwritten)`)
      current = `v${++n}`
    } else if (op === 'delete-blob' && current) {
      if (cfg.versioning) versions.push(current)
      else if (cfg.blobSoftDeleteDays > 0) softDeleted.push(current)
      else lost.push(`${current} (deleted)`)
      current = null
    } else if (op === 'delete-container') {
      containerDeleted = true
    }
  }
  const recoverable: string[] = []
  if (containerDeleted) {
    if (cfg.containerSoftDeleteDays > 0) recoverable.push(`whole container (restore within ${cfg.containerSoftDeleteDays} days)`)
    else lost.push('entire container and every blob, version and snapshot in it')
  }
  if (!containerDeleted) {
    versions.forEach((v) => recoverable.push(`${v} (previous version: copy it over the base blob)`))
    softDeleted.forEach((v) => recoverable.push(`${v} (soft-deleted: undelete within ${cfg.blobSoftDeleteDays} days)`))
  }
  return { current: containerDeleted ? null : current, versions, softDeleted, containerDeleted, recoverable, lost }
}

// ------------------------------------------------------------ object replication
export interface ReplicationAccount { versioning: boolean; changeFeed: boolean; hierarchicalNamespace: boolean }

export function objectReplicationCheck(source: ReplicationAccount, dest: ReplicationAccount): string[] {
  const errors: string[] = []
  if (!source.versioning || !dest.versioning) errors.push('Blob versioning must be enabled on both the source and destination accounts.')
  if (!source.changeFeed) errors.push('Change feed must be enabled on the source account.')
  if (source.hierarchicalNamespace || dest.hierarchicalNamespace) errors.push('Object replication is not supported on accounts with a hierarchical namespace.')
  return errors
}

export function replicateBlob(tier: Tier, op: 'write' | 'write-to-destination'): { replicated: boolean; detail: string } {
  if (op === 'write-to-destination') return { replicated: false, detail: 'Writes to replicated blobs in the destination container fail: they are read-only while the policy is in place.' }
  if (tier === 'Archive') return { replicated: false, detail: 'Blobs in the Archive tier are not replicated.' }
  return { replicated: true, detail: 'Copied asynchronously to the destination container; there is no SLA on replication time.' }
}

// ------------------------------------------------------------ Azure Files snapshots / soft delete
export const MAX_SHARE_SNAPSHOTS = 200

export function shareRecovery(input: { snapshots: number; shareSoftDeleteDays: number; event: 'file-overwritten' | 'file-deleted' | 'share-deleted' }): { ok: boolean; how: string } {
  if (input.event === 'share-deleted') {
    return input.shareSoftDeleteDays > 0
      ? { ok: true, how: `Undelete the share within ${input.shareSoftDeleteDays} days (share soft delete), including its snapshots.` }
      : { ok: false, how: 'Share soft delete is off: the share and its snapshots are gone.' }
  }
  return input.snapshots > 0
    ? { ok: true, how: 'Restore the file from a share snapshot (portal, or Windows "Previous versions").' }
    : { ok: false, how: 'No snapshot exists. Share soft delete does not protect individual files.' }
}
