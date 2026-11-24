import { describe, expect, it } from 'vitest'
import { buildSprint, type PlanInput } from './sprint'
import { isCorrect, selectAdaptive, shuffle } from './exam'
import { allObjectives, lessons, questions, registries, sprintPlan, findObjective } from './curriculum'
import type { Question } from './types'

const baseInput = (over: Partial<PlanInput> = {}): PlanInput => ({
  days: sprintPlan.days,
  objectives: allObjectives('az-104').map((o) => ({ id: o.id, skillId: o.id.split('.').slice(0, 2).join('.'), handsOn: o.handsOn, completed: false, weak: false })),
  start: new Date(2026, 10, 18),
  weekdayHours: 1.75,
  weekendHours: 2,
  activityMinutes: sprintPlan.activityMinutes,
  objectiveMinutes: sprintPlan.objectiveMinutes,
  struggleMultiplier: sprintPlan.struggleMultiplier,
  dailyRecallMinutes: sprintPlan.dailyRecallMinutes,
  ...over,
})

describe('curriculum registry', () => {
  it('AZ-104 has 81 objectives across 5 domains', () => {
    expect(registries['az-104'].domains).toHaveLength(5)
    expect(allObjectives('az-104')).toHaveLength(81)
  })
  it('study plan schedules every AZ-104 objective exactly once', () => {
    const planned = sprintPlan.days.flatMap((d) => d.skills).sort()
    const objectives = registries['az-104'].domains.flatMap((d) => d.skills.flatMap((s) => s.objectives.map((o) => o.id))).sort()
    expect(planned).toEqual(objectives)
  })
  it('every lesson and question references a real objective', () => {
    for (const l of lessons) for (const id of l.objectiveIds) expect(findObjective(id), id).toBeDefined()
    for (const q of questions) expect(findObjective(q.objectiveId), q.id).toBeDefined()
  })
})

describe('sprint planner', () => {
  it('schedules every objective or reports it as overflow', () => {
    const plan = buildSprint(baseInput())
    const scheduled = plan.days.flatMap((d) => d.items.map((i) => i.objectiveId))
    expect(scheduled.length + plan.overflow.length).toBe(81)
    expect(new Set(scheduled).size).toBe(scheduled.length)
  })
  it('flags an unrealistic schedule when hours are too low', () => {
    const plan = buildSprint(baseInput({ weekdayHours: 0.75, weekendHours: 1 }))
    expect(plan.realistic).toBe(false)
    expect(plan.overflow.length).toBeGreaterThan(0)
    expect(plan.warnings[0]).toMatch(/do not fit/)
  })
  it.each([0, 1, 2, 3, 4, 5, 6])('fits at the default 1.75 h weekdays and 2 h weekends (start offset %i)', (offset) => {
    const start = new Date(2026, 10, 23 + offset)
    const plan = buildSprint(baseInput({ start, weekdayHours: 1.75, weekendHours: 2 }))
    expect(plan.warnings).toEqual([])
    expect(plan.realistic).toBe(true)
  })
  it('skips the recall check on mock exam days', () => {
    const plan = buildSprint(baseInput({ weekdayHours: 1.75, weekendHours: 2 }))
    const mock = plan.days.find((d) => d.activities.some((a) => a.id === 'mock-exam'))!
    expect(mock.plannedMinutes).toBe(mock.activities.reduce((s, a) => s + a.minutes, 0) + mock.items.reduce((s, i) => s + i.minutes, 0))
  })
  it('gives struggling objectives more time', () => {
    const objs = baseInput().objectives.map((o) => (o.id === 'AZ104-4.2.1' ? { ...o, weak: true } : o))
    const plan = buildSprint(baseInput({ objectives: objs }))
    const item = plan.days.flatMap((d) => d.items).find((i) => i.objectiveId === 'AZ104-4.2.1') ?? plan.overflow.find((i) => i.objectiveId === 'AZ104-4.2.1')
    expect(item?.minutes).toBe(Math.round(sprintPlan.objectiveMinutes.handsOn * sprintPlan.struggleMultiplier))
    expect(item?.reason).toBe('struggling')
  })
})

describe('exam engine', () => {
  const q = (over: Partial<Question>): Question => ({
    id: 'x', exam: 'az-104', objectiveId: 'AZ104-4.2.1', difficulty: 2, type: 'single', answerMode: 'single', stem: '',
    options: [{ id: 'a', text: '', explanation: '' }, { id: 'b', text: '', explanation: '' }], correct: ['a'], explanation: '', docs: [], ...over,
  })
  it('scores single, multiple, ordering and matching', () => {
    expect(isCorrect(q({}), ['a'])).toBe(true)
    expect(isCorrect(q({ answerMode: 'multiple', correct: ['a', 'b'] }), ['b', 'a'])).toBe(true)
    expect(isCorrect(q({ answerMode: 'multiple', correct: ['a', 'b'] }), ['a'])).toBe(false)
    expect(isCorrect(q({ answerMode: 'ordering', correct: ['b', 'a'] }), ['a', 'b'])).toBe(false)
    expect(isCorrect(q({ answerMode: 'matching', pairs: [{ left: 'L', answer: 'b' }] }), { L: 'b' })).toBe(true)
  })
  it('shuffles deterministically', () => {
    expect(shuffle([1, 2, 3, 4, 5], 7)).toEqual(shuffle([1, 2, 3, 4, 5], 7))
  })
  it('prioritises previously wrong questions', () => {
    const pool = [q({ id: 'a' }), q({ id: 'b' }), q({ id: 'c' })]
    const sel = selectAdaptive(pool, { count: 1, seed: 1, weakObjectives: new Set(), wrongQuestions: new Set(['c']), seenQuestions: new Set(['a', 'b', 'c']), targetDifficulty: 2 })
    expect(sel[0]!.id).toBe('c')
  })
})
