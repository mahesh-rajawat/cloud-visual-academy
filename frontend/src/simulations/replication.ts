/**
 * Azure Storage redundancy model.
 * https://learn.microsoft.com/azure/storage/common/storage-redundancy
 * https://learn.microsoft.com/azure/storage/common/storage-disaster-recovery-guidance
 *
 * Modelled behaviour:
 *  - LRS: 3 synchronous copies in one datacenter in the primary region.
 *  - ZRS: 3 synchronous copies across 3 availability zones in the primary region.
 *  - GRS/RA-GRS: LRS in primary + asynchronous copy to the paired secondary region (stored as LRS there).
 *  - GZRS/RA-GZRS: ZRS in primary + asynchronous copy to the secondary region (stored as LRS there).
 *  - RA-* adds a read-only secondary endpoint that is available at all times.
 *  - Geo-replication is asynchronous; Microsoft documents a typical RPO under 15 minutes with no SLA
 *    on replication time. Data written after the Last Sync Time can be lost in an unplanned failover.
 *
 * Simplification: copies are shown as 3 per location; durability figures are the documented
 * annual design targets ("nines"), not measured values.
 */

export type Redundancy = 'LRS' | 'ZRS' | 'GRS' | 'RA-GRS' | 'GZRS' | 'RA-GZRS'
export type Failure = 'none' | 'node' | 'zone' | 'region'

export interface ReplicaLayout {
  primary: Array<{ zone: number; copies: number }>
  secondary: Array<{ zone: number; copies: number }> | null
  sync: 'synchronous'
  geo: 'asynchronous' | null
  readableSecondary: boolean
  durability: string
}

export const LAYOUTS: Record<Redundancy, ReplicaLayout> = {
  LRS: { primary: [{ zone: 1, copies: 3 }], secondary: null, sync: 'synchronous', geo: null, readableSecondary: false, durability: 'at least 11 nines' },
  ZRS: { primary: [{ zone: 1, copies: 1 }, { zone: 2, copies: 1 }, { zone: 3, copies: 1 }], secondary: null, sync: 'synchronous', geo: null, readableSecondary: false, durability: 'at least 12 nines' },
  GRS: { primary: [{ zone: 1, copies: 3 }], secondary: [{ zone: 1, copies: 3 }], sync: 'synchronous', geo: 'asynchronous', readableSecondary: false, durability: 'at least 16 nines' },
  'RA-GRS': { primary: [{ zone: 1, copies: 3 }], secondary: [{ zone: 1, copies: 3 }], sync: 'synchronous', geo: 'asynchronous', readableSecondary: true, durability: 'at least 16 nines' },
  GZRS: { primary: [{ zone: 1, copies: 1 }, { zone: 2, copies: 1 }, { zone: 3, copies: 1 }], secondary: [{ zone: 1, copies: 3 }], sync: 'synchronous', geo: 'asynchronous', readableSecondary: false, durability: 'at least 16 nines' },
  'RA-GZRS': { primary: [{ zone: 1, copies: 1 }, { zone: 2, copies: 1 }, { zone: 3, copies: 1 }], secondary: [{ zone: 1, copies: 3 }], sync: 'synchronous', geo: 'asynchronous', readableSecondary: true, durability: 'at least 16 nines' },
}

export interface FailureOutcome {
  reads: 'available' | 'available-from-secondary' | 'unavailable'
  writes: 'available' | 'unavailable'
  dataLossRisk: 'none' | 'possible-recent-writes' | 'possible-all'
  survivingCopies: number
  summary: string
  recovery: string
}

export function simulate(r: Redundancy, failure: Failure): FailureOutcome {
  const l = LAYOUTS[r]
  const zonal = l.primary.length === 3
  const primaryCopies = l.primary.reduce((s, z) => s + z.copies, 0)
  const secondaryCopies = l.secondary?.reduce((s, z) => s + z.copies, 0) ?? 0

  if (failure === 'none') {
    return { reads: 'available', writes: 'available', dataLossRisk: 'none', survivingCopies: primaryCopies + secondaryCopies, summary: `Writes are committed after all ${primaryCopies} primary copies acknowledge${l.geo ? '; the secondary region is updated asynchronously afterwards' : ''}.`, recovery: 'No action needed.' }
  }
  if (failure === 'node') {
    return { reads: 'available', writes: 'available', dataLossRisk: 'none', survivingCopies: primaryCopies - 1 + secondaryCopies, summary: 'A single disk, node or rack failure is absorbed by the remaining synchronous copies.', recovery: 'Azure rebuilds the lost replica automatically.' }
  }
  if (failure === 'zone') {
    if (zonal) {
      return { reads: 'available', writes: 'available', dataLossRisk: 'none', survivingCopies: primaryCopies - 1 + secondaryCopies, summary: 'Copies in the two remaining zones keep serving reads and writes; Azure updates DNS to route around the failed zone.', recovery: 'Transient errors are possible while DNS is repointed; applications should retry.' }
    }
    return {
      reads: l.readableSecondary ? 'available-from-secondary' : 'unavailable',
      writes: 'unavailable',
      dataLossRisk: l.geo ? 'possible-recent-writes' : 'possible-all',
      survivingCopies: secondaryCopies,
      summary: l.geo
        ? 'All primary copies sit in the failed datacenter. The secondary region still holds the data up to the Last Sync Time.'
        : 'All three copies are in the failed datacenter. Data is unavailable and, if the datacenter is lost permanently, it is lost.',
      recovery: l.geo
        ? `Wait for recovery or initiate a customer-managed failover to the secondary region.${l.readableSecondary ? ' Reads can continue from the secondary endpoint meanwhile.' : ''}`
        : 'Wait for Microsoft to recover the datacenter. Use ZRS or geo-redundancy if this risk is unacceptable.',
    }
  }
  // region
  if (!l.geo) {
    return { reads: 'unavailable', writes: 'unavailable', dataLossRisk: 'possible-all', survivingCopies: 0, summary: 'Every copy is in the affected region. Zone redundancy does not protect against a region-wide outage.', recovery: 'Wait for the region to recover; restore from backups held elsewhere if they exist.' }
  }
  return {
    reads: l.readableSecondary ? 'available-from-secondary' : 'unavailable',
    writes: 'unavailable',
    dataLossRisk: 'possible-recent-writes',
    survivingCopies: secondaryCopies,
    summary: 'The secondary region holds the data up to the Last Sync Time. Writes that had not replicated yet can be lost.',
    recovery: `Check the Last Sync Time, then decide whether to initiate a customer-managed (unplanned) failover. After failover the account is LRS in the new primary until you reconfigure geo-redundancy.${l.readableSecondary ? ' Reads continue from the secondary endpoint without failover.' : ''}`,
  }
}
