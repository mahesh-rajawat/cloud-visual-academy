/**
 * Adaptive study planner (the AZ-104 plan runs 7 weeks). Pure functions so the schedule is deterministic and testable.
 *
 * Each objective gets a base estimate (hands-on vs conceptual). Weak objectives get the struggle
 * multiplier. Completed objectives (lesson completed and not weak) drop to a short review slot.
 * Work that does not fit in a day's budget rolls over to the next study day; anything that still
 * does not fit before the final mock days is reported as overflow, and the plan is flagged unrealistic.
 */

export interface PlanObjective {
  id: string
  skillId: string
  handsOn: boolean
  completed: boolean
  weak: boolean
}

export interface PlanInput {
  /** skills holds skill ids (AZ104-1.1) or single objective ids (AZ104-1.1.1). */
  days: Array<{ day: number; title: string; skills: string[]; activities: string[] }>
  objectives: PlanObjective[]
  start: Date
  weekdayHours: number
  weekendHours: number
  activityMinutes: Record<string, number>
  objectiveMinutes: { handsOn: number; conceptual: number }
  struggleMultiplier: number
  dailyRecallMinutes: number
  today?: Date
}

export interface PlannedItem {
  objectiveId: string
  minutes: number
  rolledFrom?: number
  reason: 'new' | 'struggling' | 'review'
}

export interface PlannedDay {
  day: number
  date: string
  title: string
  isWeekend: boolean
  budgetMinutes: number
  plannedMinutes: number
  items: PlannedItem[]
  activities: Array<{ id: string; minutes: number }>
  overBudget: boolean
}

export interface SprintPlan {
  days: PlannedDay[]
  overflow: PlannedItem[]
  realistic: boolean
  totalRequiredMinutes: number
  totalBudgetMinutes: number
  warnings: string[]
}

export function minutesFor(o: PlanObjective, input: PlanInput): number {
  const base = o.handsOn ? input.objectiveMinutes.handsOn : input.objectiveMinutes.conceptual
  if (o.completed && !o.weak) return 5
  return Math.round(o.weak ? base * input.struggleMultiplier : base)
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function buildSprint(input: PlanInput): SprintPlan {
  const queue: PlannedItem[] = []
  const days: PlannedDay[] = []
  const warnings: string[] = []
  let totalRequired = 0

  input.days.forEach((d, idx) => {
    const date = new Date(input.start)
    date.setDate(date.getDate() + idx)
    const weekend = date.getDay() === 0 || date.getDay() === 6
    const budget = Math.round((weekend ? input.weekendHours : input.weekdayHours) * 60)
    const activities = d.activities.map((a) => ({ id: a, minutes: input.activityMinutes[a] ?? 30 }))
    // A mock exam replaces that day's recall check.
    const recall = d.activities.includes('mock-exam') ? 0 : input.dailyRecallMinutes
    const fixed = activities.reduce((s, a) => s + a.minutes, 0) + recall
    totalRequired += fixed

    const fresh: PlannedItem[] = input.objectives
      .filter((o) => d.skills.includes(o.skillId) || d.skills.includes(o.id))
      .map((o) => {
        const minutes = minutesFor(o, input)
        totalRequired += minutes
        return { objectiveId: o.id, minutes, reason: o.completed && !o.weak ? 'review' : o.weak ? 'struggling' : 'new' }
      })
    // Carried-over work first so nothing is silently pushed back forever.
    const candidates = [...queue.splice(0), ...fresh]
    const items: PlannedItem[] = []
    let used = fixed
    for (const c of candidates) {
      if (used + c.minutes <= budget) {
        items.push(c)
        used += c.minutes
      } else {
        queue.push({ ...c, rolledFrom: c.rolledFrom ?? d.day })
      }
    }
    days.push({
      day: d.day, date: isoDate(date), title: d.title, isWeekend: weekend, budgetMinutes: budget,
      plannedMinutes: used, items, activities, overBudget: used > budget,
    })
  })

  const totalBudget = days.reduce((s, d) => s + d.budgetMinutes, 0)
  const overflow = queue
  if (overflow.length) {
    warnings.push(`${overflow.length} objective(s) do not fit into the ${days.length} days at the current daily hours. Increase study time, or accept that these objectives will not be studied before the exam.`)
  }
  const over = days.filter((d) => d.overBudget)
  if (over.length) warnings.push(`Days ${over.map((d) => d.day).join(', ')} exceed their time budget.`)
  if (totalRequired > totalBudget) {
    warnings.push(`The plan needs about ${Math.round(totalRequired / 60)} h but only ${Math.round(totalBudget / 60)} h are available.`)
  }
  return { days, overflow, realistic: overflow.length === 0 && over.length === 0, totalRequiredMinutes: totalRequired, totalBudgetMinutes: totalBudget, warnings }
}

export function sprintDayIndex(start: Date, today: Date): number {
  const ms = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  return Math.floor(ms / 86_400_000)
}
