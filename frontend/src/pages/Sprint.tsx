import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../animations/primitives'
import { studiedObjectives, useProgress } from '../hooks/useProgress'
import { useApp } from '../services/AppContext'
import { allObjectives, findObjective, lessonForObjective, sprintPlan } from '../services/curriculum'
import { buildSprint, sprintDayIndex } from '../services/sprint'

export function useSprintPlan() {
  const { settings } = useApp()
  const { data } = useProgress()
  return useMemo(() => {
    const studied = studiedObjectives(data, 'az-104')
    const mastery = data.mastery['az-104']
    const start = settings.sprint_start ? new Date(`${settings.sprint_start}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0))
    const plan = buildSprint({
      days: sprintPlan.days,
      objectives: allObjectives('az-104').map((o) => ({ id: o.id, skillId: o.id.split('.').slice(0, 2).join('.'), handsOn: o.handsOn, completed: studied.has(o.id), weak: mastery[o.id]?.status === 'weak' })),
      start,
      weekdayHours: settings.weekday_hours,
      weekendHours: settings.weekend_hours,
      activityMinutes: sprintPlan.activityMinutes,
      objectiveMinutes: sprintPlan.objectiveMinutes,
      struggleMultiplier: sprintPlan.struggleMultiplier,
      dailyRecallMinutes: sprintPlan.dailyRecallMinutes,
    })
    const idx = settings.sprint_start ? sprintDayIndex(start, new Date()) : null
    return { plan, todayIndex: idx, started: !!settings.sprint_start }
  }, [settings, data])
}

const ACTIVITY_LINK: Record<string, string> = {
  diagnostic: '/diagnostic',
  'weekly-assessment': '/practice?exam=az-104&mode=mock',
  'mock-exam': '/practice?exam=az-104&mode=mock',
  'weak-revision': '/practice?exam=az-104&mode=weak',
  'readiness-report': '/analytics',
  'exam-day-prep': '/exam-guide',
}

export default function Sprint() {
  const { settings, saveSettings } = useApp()
  const { plan, todayIndex, started } = useSprintPlan()
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">AZ-104 study plan: {plan.days.length} days</h1>
          <p className="text-sm text-slate-500">About 1¾ hours on weekdays and 2 hours at weekends. Every one of the 81 official AZ-104 objectives is scheduled, with its easy walkthrough, hands-on Azure lab and questions. Weak objectives get {sprintPlan.struggleMultiplier}× time automatically. <Link className="underline" to="/exam-guide">Exam-day guide</Link></p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col"><span className="label">Start date</span><input type="date" className="input" value={settings.sprint_start ?? ''} onChange={(e) => void saveSettings({ ...settings, sprint_start: e.target.value || null })} /></label>
          <label className="flex flex-col"><span className="label">Weekday hours</span><input type="number" step={0.25} min={0.5} max={12} className="input w-24" value={settings.weekday_hours} onChange={(e) => void saveSettings({ ...settings, weekday_hours: Number(e.target.value) || 0.5 })} /></label>
          <label className="flex flex-col"><span className="label">Weekend hours</span><input type="number" step={0.25} min={0.5} max={14} className="input w-24" value={settings.weekend_hours} onChange={(e) => void saveSettings({ ...settings, weekend_hours: Number(e.target.value) || 0.5 })} /></label>
          {!started && <button type="button" className="btn-primary" onClick={() => void saveSettings({ ...settings, sprint_start: today })}>Start the plan today</button>}
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
              {!d.activities.some((a) => a.id === 'mock-exam') && <li className="text-slate-500">• Daily recall check ({sprintPlan.dailyRecallMinutes} min) · <Link className="underline" to="/reviews">open</Link></li>}
              {d.activities.map((a) => <li key={a.id}>• <Link className="underline" to={ACTIVITY_LINK[a.id] ?? '/practice'}>{a.id.replace(/-/g, ' ')}</Link> ({a.minutes} min)</li>)}
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
