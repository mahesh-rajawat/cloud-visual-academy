import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '../animations/primitives'
import { studiedObjectives, useProgress } from '../hooks/useProgress'
import { useApp } from '../services/AppContext'
import { PLAN_EXAMS, allObjectives, findObjective, lessonForObjective, registries, sprintPlans } from '../services/curriculum'
import type { ExamSlug } from '../services/types'
import type { Settings } from '../services/api'
import { buildSprint, sprintDayIndex } from '../services/sprint'

/** AZ-104 keeps its start date in sprint_start; other exams use sprint_starts[exam]. */
export const planStart = (settings: Settings, exam: ExamSlug) => (exam === 'az-104' ? settings.sprint_start : settings.sprint_starts?.[exam]) ?? null
const withStart = (settings: Settings, exam: ExamSlug, date: string | null): Settings =>
  exam === 'az-104' ? { ...settings, sprint_start: date } : { ...settings, sprint_starts: { ...settings.sprint_starts, [exam]: date } }

export function useSprintPlan(exam: ExamSlug = 'az-104') {
  const { settings } = useApp()
  const { data } = useProgress()
  return useMemo(() => {
    const sp = sprintPlans[exam]!
    const studied = studiedObjectives(data, exam)
    const mastery = data.mastery[exam]
    const startStr = planStart(settings, exam)
    const start = startStr ? new Date(`${startStr}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0))
    const plan = buildSprint({
      days: sp.days,
      objectives: allObjectives(exam).map((o) => ({ id: o.id, skillId: o.id.split('.').slice(0, 2).join('.'), handsOn: o.handsOn, completed: studied.has(o.id), weak: mastery[o.id]?.status === 'weak' })),
      start,
      weekdayHours: settings.weekday_hours,
      weekendHours: settings.weekend_hours,
      activityMinutes: sp.activityMinutes,
      objectiveMinutes: sp.objectiveMinutes,
      struggleMultiplier: sp.struggleMultiplier,
      dailyRecallMinutes: sp.dailyRecallMinutes,
    })
    const idx = startStr ? sprintDayIndex(start, new Date()) : null
    return { plan, todayIndex: idx, started: !!startStr, sp }
  }, [settings, data, exam])
}

const activityLink = (exam: ExamSlug, id: string): string => ({
  diagnostic: '/diagnostic',
  'weekly-assessment': `/practice?exam=${exam}&mode=mock`,
  'mock-exam': `/practice?exam=${exam}&mode=mock`,
  'weak-revision': `/practice?exam=${exam}&mode=weak`,
  'readiness-report': '/analytics',
  'exam-day-prep': exam === 'az-104' ? '/exam-guide' : `/practice?exam=${exam}&mode=weak`,
  'drill-deploy': '/clear-up?tab=deploy',
  'drill-network': '/clear-up?tab=network',
  'drill-lookalikes': '/clear-up?tab=drill',
} as Record<string, string>)[id] ?? `/practice?exam=${exam}`

export default function Sprint() {
  const { settings, saveSettings } = useApp()
  const [params, setParams] = useSearchParams()
  const exam = (PLAN_EXAMS.find((e) => e === params.get('exam')) ?? PLAN_EXAMS[0]!) as ExamSlug
  const { plan, todayIndex, started, sp } = useSprintPlan(exam)
  const today = new Date().toISOString().slice(0, 10)
  const code = registries[exam].examCode

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {PLAN_EXAMS.length > 1 && (
            <div className="mb-2 flex gap-2" role="tablist" aria-label="Exam">
              {PLAN_EXAMS.map((e) => <button key={e} type="button" role="tab" aria-selected={e === exam} className={e === exam ? 'btn-primary' : 'btn-ghost'} onClick={() => setParams({ exam: e })}>{registries[e].examCode}</button>)}
            </div>
          )}
          <h1 className="text-2xl font-semibold">{code} study plan: {plan.days.length} days</h1>
          <p className="text-sm text-slate-500">About 1¾ hours on weekdays and 2 hours at weekends. Every one of the {allObjectives(exam).length} official {code} objectives is scheduled in weeks 1–{sp.weeks - 1}; week {sp.weeks} is mock exams and revision. Weak objectives get {sp.struggleMultiplier}× time automatically.{exam === 'az-104' && <> <Link className="underline" to="/exam-guide">Exam-day guide</Link></>}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col"><span className="label">Start date</span><input type="date" className="input" value={planStart(settings, exam) ?? ''} onChange={(e) => void saveSettings(withStart(settings, exam, e.target.value || null))} /></label>
          <label className="flex flex-col"><span className="label">Weekday hours</span><input type="number" step={0.25} min={0.5} max={12} className="input w-24" value={settings.weekday_hours} onChange={(e) => void saveSettings({ ...settings, weekday_hours: Number(e.target.value) || 0.5 })} /></label>
          <label className="flex flex-col"><span className="label">Weekend hours</span><input type="number" step={0.25} min={0.5} max={14} className="input w-24" value={settings.weekend_hours} onChange={(e) => void saveSettings({ ...settings, weekend_hours: Number(e.target.value) || 0.5 })} /></label>
          {!started && <button type="button" className="btn-primary" onClick={() => void saveSettings(withStart(settings, exam, today))}>Start the plan today</button>}
        </div>
      </header>

      <div className={`card p-3 text-sm ${plan.realistic ? '' : 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'}`} role={plan.realistic ? undefined : 'alert'}>
        <p>Required ≈ <strong>{Math.round(plan.totalRequiredMinutes / 60)} h</strong> · available <strong>{Math.round(plan.totalBudgetMinutes / 60)} h</strong> · {plan.realistic ? <Badge tone="allow">schedule fits</Badge> : <Badge tone="warn">schedule is unrealistic</Badge>}</p>
        {plan.warnings.map((w) => <p key={w} className="mt-1">⚠ {w}</p>)}
        {plan.overflow.length > 0 && (
          <details className="mt-1"><summary className="cursor-pointer">Objectives that do not fit ({plan.overflow.length})</summary>
            <ul className="ml-5 list-disc">{plan.overflow.map((o) => <li key={o.objectiveId}>{o.objectiveId}: {findObjective(o.objectiveId)?.objective.text}</li>)}</ul>
          </details>
        )}
      </div>

      <ol className="space-y-3">
        {plan.days.map((d, i) => (
          <li key={d.day} className={`card p-3 ${i === todayIndex ? 'ring-2 ring-sky-500' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Day {d.day} · {d.date}{d.isWeekend ? ' (weekend)' : ''}</h2>
              {i === todayIndex && <Badge tone="info">today</Badge>}
              <span className="text-sm text-slate-600 dark:text-slate-300">{d.title}</span>
              <span className={`ml-auto text-xs ${d.overBudget ? 'text-red-600' : 'text-slate-500'}`}>{Math.round(d.plannedMinutes)} / {d.budgetMinutes} min</span>
            </div>
            <ul className="mt-2 grid gap-1 text-sm md:grid-cols-2">
              {!d.activities.some((a) => a.id === 'mock-exam') && <li className="text-slate-500">• Daily recall check ({sp.dailyRecallMinutes} min) · <Link className="underline" to="/reviews">open</Link></li>}
              {d.activities.map((a) => <li key={a.id}>• <Link className="underline" to={activityLink(exam, a.id)}>{a.id.replace(/-/g, ' ')}</Link> ({a.minutes} min)</li>)}
              {d.items.map((it) => {
                const l = lessonForObjective(it.objectiveId)
                return (
                  <li key={it.objectiveId} className="flex gap-1">
                    <span>•</span>
                    <span>
                      {l ? <Link className="underline" to={`/lesson/${l.id}`}>{findObjective(it.objectiveId)?.objective.text}</Link> : findObjective(it.objectiveId)?.objective.text}
                      <span className="ml-1 text-xs text-slate-500">{it.minutes}m</span>
                      {it.reason === 'struggling' && <Badge tone="deny">struggling</Badge>}
                      {it.reason === 'review' && <Badge tone="allow">review</Badge>}
                      {it.rolledFrom && <Badge tone="warn">from day {it.rolledFrom}</Badge>}
                      {!l && <Badge tone="muted">content not authored yet</Badge>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
