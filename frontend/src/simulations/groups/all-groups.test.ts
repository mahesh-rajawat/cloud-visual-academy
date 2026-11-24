import { describe, expect, it } from 'vitest'
import type { ScenarioGroup } from '../scenario'

/** Structural checks for every scenario in every group module (each module has its own behaviour tests). */
const mods = import.meta.glob<{ groups: ScenarioGroup[] }>('./*.ts', { eager: true })
const groups = Object.entries(mods).filter(([p]) => !p.endsWith('.test.ts')).flatMap(([, m]) => m.groups)

describe('all scenario groups', () => {
  it('has unique group ids', () => {
    const ids = groups.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  for (const g of groups) {
    for (const sc of g.scenarios) {
      it(`${g.id}/${sc.id}: initial state and presets evaluate consistently`, () => {
        for (const st of [sc.initial, ...(sc.presets ?? []).map((p) => ({ ...sc.initial, ...p.values }))]) {
          for (const c of sc.controls) expect(st, `${c.key} missing in initial`).toHaveProperty(c.key)
          const ev = sc.evaluate(st)
          expect(ev.stages.map((x) => x.id)).toEqual(sc.stages.map((x) => x.id))
          expect(ev.outcome.title.length).toBeGreaterThan(0)
          // Once a stage fails, later stages are not reached.
          const firstFail = ev.stages.findIndex((x) => x.ok === false)
          if (firstFail >= 0) expect(ev.stages.slice(firstFail + 1).every((x) => x.ok === null)).toBe(true)
          if (firstFail >= 0) expect(ev.outcome.ok).toBe(false)
        }
      })
      it(`${g.id}/${sc.id}: presets change the outcome or the details`, () => {
        const base = JSON.stringify(sc.evaluate(sc.initial).stages)
        for (const p of sc.presets ?? []) expect(JSON.stringify(sc.evaluate({ ...sc.initial, ...p.values }).stages)).not.toBe(base)
      })
    }
  }
})
