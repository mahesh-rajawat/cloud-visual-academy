import { Link } from 'react-router-dom'
import { Badge } from '../animations/primitives'
import { examMastery, overallStudied, studiedObjectives, useProgress, weakObjectives, type ProgressData } from '../hooks/useProgress'
import { useApp } from '../services/AppContext'
import { STATIC_SITE } from '../services/api'
import { EXAMS, EXAM_LABEL, PLAN_EXAMS, examEnabled, RECOMMENDED_SEQUENCE, allObjectives, coverageFor, estimatedHours, findLesson, findObjective, lessonForObjective, lessonsFor, registries } from '../services/curriculum'
import { planStart, useSprintPlan } from './Sprint'
import type { ExamSlug } from '../services/types'

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const d = new Date(`${date}T00:00:00`)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

function CertCard({ exam, priority, data }: { exam: ExamSlug; priority?: boolean; data: ProgressData }) {
  const reg = registries[exam]
  const cov = coverageFor(exam)
  const studied = studiedObjectives(data, exam).size
  const m = examMastery(data, exam)
  const latest = data.sessions.find((s) => s.exam === exam)
  const firstLesson = lessonsFor(exam).find((l) => !data.lessons.some((p) => p.lesson_id === l.id && p.completed)) ?? lessonsFor(exam)[0]
  const color = reg.vendor === 'AWS' ? 'border-t-[var(--color-aws)]' : exam === 'ai-901' ? 'border-t-[var(--color-ai)]' : 'border-t-[var(--color-azure)]'
  return (
    <article className={`card border-t-4 ${color} flex flex-col p-4 ${priority ? 'ring-2 ring-sky-500/40' : ''}`} aria-labelledby={`card-${exam}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500">{reg.examCode}</p>
          <h3 id={`card-${exam}`} className="font-semibold">{EXAM_LABEL[exam]}</h3>
        </div>
        {priority && <Badge tone="info">Current priority</Badge>}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="label">Official objectives</dt><dd>{reg.objectiveCount}</dd>
        <dt className="label">With complete content</dt><dd>{cov?.complete ?? 0} / {cov?.total ?? reg.objectiveCount}</dd>
        <dt className="label">Studied by you</dt><dd>{studied}</dd>
        <dt className="label">Mastery</dt><dd>{m.value === null ? <span className="text-slate-400">not enough evidence</span> : `${m.value}% (${m.assessed} obj.)`}</dd>
        <dt className="label">Est. study time</dt><dd>≈ {estimatedHours(exam)} h</dd>
        <dt className="label">Latest assessment</dt><dd>{latest ? `${latest.score}/${latest.total} (${latest.kind})` : <span className="text-slate-400">none yet</span>}</dd>
      </dl>
      <p className="mt-2 text-xs text-slate-500">Skills measured as of {reg.skillsMeasuredAsOf}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {firstLesson ? <Link className="btn-primary" to={`/lesson/${firstLesson.id}`}>Continue learning</Link> : <Link className="btn-primary" to={`/course/${exam}`}>Open course</Link>}
        <Link className="btn-ghost" to={`/practice?exam=${exam}`}>Start practice exam</Link>
        <Link className="btn-ghost" to={`/coverage?exam=${exam}`}>Coverage report</Link>
      </div>
    </article>
  )
}

export default function Dashboard() {
  const { settings, online, bookmarks } = useApp()
  const { data } = useProgress()
  // The hero follows the first enabled exam that has a study plan (AZ-104 unless it is hidden).
  const focus: ExamSlug = PLAN_EXAMS[0] ?? 'az-104'
  const plan = useSprintPlan(focus)
  const started = !!planStart(settings, focus)
  const examDays = daysUntil(settings.exam_dates[focus] ?? null)
  const overall = overallStudied(data)
  const weak = weakObjectives(data).slice(0, 6)
  const today = plan.todayIndex !== null ? plan.plan.days[plan.todayIndex] : undefined
  const recent = data.lessons.slice(0, 5)

  return (
    <div className="space-y-6">
      <section className="card flex flex-col gap-4 bg-gradient-to-br from-sky-50 to-white p-5 md:flex-row md:items-center dark:from-sky-950/40 dark:to-slate-900">
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-wide text-sky-700 dark:text-sky-300">{registries[focus].examCode} STUDY PLAN</p>
          <h1 className="text-2xl font-semibold">Microsoft {EXAM_LABEL[focus]}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {examDays === null ? <>No exam date set. <Link to="/settings" className="underline">Set it in Settings</Link> to enable the countdown.</> : examDays >= 0 ? <><strong>{examDays}</strong> day(s) until your exam.</> : 'Exam date has passed.'}
            {' '}{plan.todayIndex !== null && plan.todayIndex >= 0 && plan.todayIndex < plan.plan.days.length ? `Day ${plan.todayIndex + 1} of ${plan.plan.days.length}.` : !started ? 'Plan not started.' : ''}
          </p>
          {!plan.plan.realistic && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">⚠ {plan.plan.warnings[0]}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-primary" to={`/sprint?exam=${focus}`}>Open study plan</Link>
          {examEnabled('az-900') && <Link className="btn-ghost" to="/diagnostic">AZ-900 diagnostic</Link>}
          <Link className="btn-ghost" to="/reviews">Daily recall ({data.due.length} due)</Link>
        </div>
      </section>

      {online === false && <p className="card border-amber-300 p-3 text-sm text-amber-800 dark:text-amber-200">{STATIC_SITE
        ? 'This is the read-only online copy. All lessons, walkthroughs and questions work here; progress, scores and lab screenshots are saved only when you run the app on your computer.'
        : <>The local backend is offline, so no learner history can be shown. Start it with <code>uvicorn app.main:app</code> in <code>backend/</code>.</>}</p>}

      <section aria-labelledby="certs" className="space-y-2">
        <h2 id="certs" className="text-lg font-semibold">Certification tracks</h2>
        {RECOMMENDED_SEQUENCE.length > 1 && <p className="text-xs text-slate-500">Recommended sequence: {RECOMMENDED_SEQUENCE.map((e) => registries[e].examCode).join(' → ')}. Each track stays independently accessible.</p>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {EXAMS.map((e) => <CertCard key={e} exam={e} priority={e === 'az-104'} data={data} />)}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4" aria-labelledby="today">
          <h2 id="today" className="mb-2 font-semibold">Today's targets</h2>
          {!today ? <p className="text-sm text-slate-500">{started ? 'Outside the study plan dates.' : `Start the ${registries[focus].examCode} study plan to get daily targets.`}</p> : (
            <>
              <p className="text-sm font-medium">Day {today.day}: {today.title} · {Math.round(today.plannedMinutes / 60 * 10) / 10} h planned</p>
              <ul className="mt-2 space-y-1 text-sm">
                {today.activities.map((a) => <li key={a.id}>• {a.id.replace(/-/g, ' ')} ({a.minutes} min)</li>)}
                {today.items.slice(0, 8).map((it) => {
                  const l = lessonForObjective(it.objectiveId)
                  return <li key={it.objectiveId}>• {l ? <Link className="underline" to={`/lesson/${l.id}`}>{findObjective(it.objectiveId)?.objective.text}</Link> : findObjective(it.objectiveId)?.objective.text} <span className="text-xs text-slate-500">{it.minutes}m{!l && ' · content not authored'}</span></li>
                })}
                {today.items.length > 8 && <li className="text-xs text-slate-500">+{today.items.length - 8} more on the sprint page</li>}
              </ul>
            </>
          )}
        </section>

        <section className="card p-4" aria-labelledby="cal">
          <h2 id="cal" className="mb-2 font-semibold">Study calendar</h2>
          <ol className="grid grid-cols-7 gap-1 text-center text-xs">
            {plan.plan.days.map((d, i) => (
              <li key={d.day} title={d.title} className={`rounded-md border p-1 ${i === plan.todayIndex ? 'border-sky-500 bg-sky-100 dark:bg-sky-900/40' : 'border-slate-200 dark:border-slate-700'} ${d.overBudget ? 'text-red-600' : ''}`}>
                <div className="font-semibold">D{d.day}</div><div className="text-slate-500">{d.date.slice(5)}</div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-slate-500">Overall: {overall.studied} of {overall.total} official objectives studied across all four tracks.</p>
        </section>

        <section className="card p-4" aria-labelledby="weak">
          <h2 id="weak" className="mb-2 font-semibold">Weak topics</h2>
          {weak.length === 0 ? <p className="text-sm text-slate-500">No weak objectives detected yet. Weakness needs at least 3 answers on an objective.</p> : (
            <ul className="space-y-1 text-sm">{weak.map((w) => <li key={w.id}><Badge tone="deny">{w.info.mastery}%</Badge> {findObjective(w.id)?.objective.text}</li>)}</ul>
          )}
          <Link to="/practice?mode=weak" className="btn-ghost mt-3">Practise weak areas</Link>
        </section>

        <section className="card p-4" aria-labelledby="up">
          <h2 id="up" className="mb-2 font-semibold">Upcoming revisions (7 days)</h2>
          {data.upcoming.length === 0 ? <p className="text-sm text-slate-500">Nothing scheduled. Completing a lesson schedules reviews.</p> : (
            <ul className="space-y-1 text-sm">{data.upcoming.slice(0, 6).map((r) => <li key={r.objective_id}>{new Date(r.due_at).toLocaleDateString()}: {findObjective(r.objective_id)?.objective.text}</li>)}</ul>
          )}
        </section>

        <section className="card p-4" aria-labelledby="recent">
          <h2 id="recent" className="mb-2 font-semibold">Recently studied</h2>
          {recent.length === 0 ? <p className="text-sm text-slate-500">No lessons opened yet.</p> : (
            <ul className="space-y-1 text-sm">{recent.map((l) => <li key={l.lesson_id}><Link className="underline" to={`/lesson/${l.lesson_id}`}>{findLesson(l.lesson_id)?.title ?? l.lesson_id}</Link> {l.completed && <Badge tone="allow">done</Badge>}</li>)}</ul>
          )}
        </section>

        <section className="card p-4" aria-labelledby="bm">
          <h2 id="bm" className="mb-2 font-semibold">Bookmarks</h2>
          {bookmarks.length === 0 ? <p className="text-sm text-slate-500">No bookmarks yet.</p> : (
            <ul className="space-y-1 text-sm">{bookmarks.slice(0, 5).map((b) => <li key={`${b.kind}-${b.ref}`}><Badge tone="muted">{b.kind}</Badge> {b.title}</li>)}</ul>
          )}
          <Link to="/bookmarks" className="btn-ghost mt-3">Bookmark library</Link>
        </section>
      </div>
      <p className="text-xs text-slate-500">Objective totals come from the official outlines retrieved on {new Date(registries['az-104'].retrievedAt).toLocaleDateString()}. Coverage counts come from the last validator run. All {allObjectives('az-104').length} AZ-104 objectives are tracked; content is still being authored.</p>
    </div>
  )
}
