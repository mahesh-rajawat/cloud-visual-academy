import { describe, expect, it } from 'vitest'
import { downtimeMinutes, groups, parallelSla, serialSla } from './az305'

const sc = (g: string, s: string) => groups.find((x) => x.id === g)!.scenarios.find((x) => x.id === s)!

describe('AZ-305 composite SLA', () => {
  it('multiplies services that must all work', () => {
    expect(serialSla([99.95, 99.99]).toFixed(4)).toBe('99.9400')
    expect(serialSla([99.95, 99.99, 99.9]).toFixed(3)).toBe('99.840')
  })
  it('redundant copies raise availability', () => {
    expect(parallelSla(99.9, 2).toFixed(4)).toBe('99.9999')
    expect(parallelSla(99, 2)).toBeCloseTo(99.99, 6)
  })
  it('converts an SLA to monthly downtime', () => {
    expect(downtimeMinutes(99.9)).toBe(43.2)
    expect(downtimeMinutes(99.99)).toBe(4.3)
  })
  it('the calculator shows a second region lifting a stack above its target', () => {
    const s = sc('az305-ha-sim', 'composite-sla')
    const one = s.evaluate(s.initial)
    expect(one.outcome.ok).toBe(false)
    expect(one.checks).toContain('sla-below')
    const two = s.evaluate({ ...s.initial, regions: '2' })
    expect(two.outcome.ok).toBe(true)
    expect(two.checks).toEqual(['sla-multi-region', 'sla-meets'])
  })
})

describe('AZ-305 design trainers', () => {
  it('every chooser case has an answer that is one of its options, and grades it', () => {
    for (const grp of groups) {
      for (const s of grp.scenarios.filter((x) => x.kind === 'choice')) {
        const req = s.controls.find((c) => c.key === 'req')!
        const choice = s.controls.find((c) => c.key === 'choice')!
        if (req.type !== 'select' || choice.type !== 'select') throw new Error('chooser controls')
        const answers = new Set(choice.options.map((o) => o.value))
        for (const r of req.options) {
          const right = s.presets?.find((p) => p.values.req === r.value)?.values.choice
          if (right) expect(answers.has(String(right)), `${s.id}/${r.value}`).toBe(true)
          // Exactly one option is graded correct for every requirement.
          const correct = [...answers].filter((a) => s.evaluate({ req: r.value, choice: a }).outcome.ok)
          expect(correct, `${s.id}/${r.value}`).toHaveLength(1)
        }
      }
    }
  })
  it('known design answers', () => {
    const pick = (g: string, s: string, req: string) => {
      const scn = sc(g, s)
      const ch = scn.controls.find((c) => c.key === 'choice')!
      if (ch.type !== 'select') throw new Error()
      return ch.options.map((o) => o.value).find((a) => scn.evaluate({ req, choice: a }).outcome.ok)
    }
    expect(pick('az305-authn-sim', 'hybrid-auth', 'simple')).toBe('Password hash sync')
    expect(pick('az305-sql-sim', 'sql-store', 'agent')).toBe('Azure SQL Managed Instance')
    expect(pick('az305-sql-sim', 'sql-tier', 'big')).toBe('Hyperscale')
    expect(pick('az305-messaging-sim', 'messaging', 'telemetry')).toBe('Azure Event Hubs')
    expect(pick('az305-bcdr-sim', 'recovery', 'ransomware')).toBe('Azure Backup')
    expect(pick('az305-net-connect-sim', 'net-connect', 'snat')).toBe('NAT gateway')
  })
})
