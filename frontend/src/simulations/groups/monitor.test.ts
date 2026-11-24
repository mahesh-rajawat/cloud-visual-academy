import { describe, expect, it } from 'vitest'
import { aggregate, alertFiresAt, CPU_SERIES, groups, kqlText, policyIssues, runKql, VAULT_FOR } from './monitor'

const sc = (g: string, s: string) => groups.find((x) => x.id === g)!.scenarios.find((x) => x.id === s)!

describe('monitor models', () => {
  it('long-grain averages hide short spikes; Maximum shows them', () => {
    expect(Math.max(...aggregate(CPU_SERIES, 60, 'Average'))).toBeLessThan(90)
    expect(Math.max(...aggregate(CPU_SERIES, 60, 'Maximum'))).toBe(97)
    expect(aggregate(CPU_SERIES, 15, 'Average')).toHaveLength(4)
  })
  it('KQL evaluator summarises and orders', () => {
    const q = { table: 'Perf' as const, counter: '% Processor Time', computer: 'all', summarize: 'avg by Computer' as const, minValue: 0, orderDesc: true, take: 10 }
    const r = runKql(q)
    expect(r.rows[0]![0]).toBe('vm-db1')
    expect(r.columns).toEqual(['Computer', 'AvgValue'])
    expect(kqlText(q)).toContain('| summarize AvgValue = avg(CounterValue) by Computer')
    expect(runKql({ ...q, table: 'Heartbeat' }).error).toMatch(/CounterName/)
    expect(runKql({ ...q, summarize: 'none', minValue: 80 }).rows.every((x) => Number(x[2]) > 80)).toBe(true)
  })
  it('metric alert timing depends on window and aggregation', () => {
    expect(alertFiresAt(CPU_SERIES, 80, 60, 'Average', 1)).toBe(-1)
    expect(alertFiresAt(CPU_SERIES, 80, 5, 'Average', 1)).toBe(44)
    expect(alertFiresAt(CPU_SERIES, 90, 5, 'Maximum', 1)).toBe(41)
  })
  it('alert processing rule suppresses notifications in the window', () => {
    const a = sc('monitor-sim', 'alerts')
    expect(a.evaluate({ ...a.initial, window: '5' }).checks).toContain('alert-notified')
    expect(a.evaluate({ ...a.initial, window: '5', suppress: true }).checks).toContain('alert-suppressed')
  })
})

describe('backup models', () => {
  it('vault types', () => {
    expect(VAULT_FOR['Azure VM']).toBe('Recovery Services vault')
    expect(VAULT_FOR['Azure Blobs']).toBe('Backup vault')
  })
  it('policy rules', () => {
    const base = { type: 'Standard' as const, frequency: 'Daily' as const, dailyDays: 30, weeklyWeeks: 0, monthlyMonths: 12, yearlyYears: 0, instantRestoreDays: 2 }
    expect(policyIssues(base, false)).toEqual([])
    expect(policyIssues({ ...base, frequency: 'Hourly' }, false)).toHaveLength(1)
    expect(policyIssues(base, true)[0]).toMatch(/Trusted Launch/)
    expect(policyIssues({ ...base, instantRestoreDays: 7 }, false)[0]).toMatch(/1–5/)
  })
  it('Cross Region Restore needs CRR on a GRS vault; ASR vault must be in the target region', () => {
    const r = sc('backup-dr-sim', 'restore')
    expect(r.evaluate({ ...r.initial, incident: 'Primary region outage', option: 'Cross Region Restore' }).outcome.ok).toBe(false)
    expect(r.evaluate({ ...r.initial, incident: 'Primary region outage', option: 'Cross Region Restore', redundancy: 'GRS with Cross Region Restore enabled' }).outcome.ok).toBe(true)
    const a = sc('backup-dr-sim', 'asr')
    expect(a.evaluate(a.initial).stages[0]!.ok).toBe(false)
  })
})
