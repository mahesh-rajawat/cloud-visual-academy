import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ANIMATION_COMPONENTS } from '../animations/registry'
import { Badge } from '../animations/primitives'
import { ArchitectureDiagram } from '../components/ArchitectureDiagram'
import { HandsOnLab } from '../components/HandsOnLab'
import { QuestionRunner } from '../components/QuestionRunner'
import { Walkthrough } from '../components/Walkthrough'
import { useProgress } from '../hooks/useProgress'
import { api } from '../services/api'
import { useApp } from '../services/AppContext'
import { EXAM_LABEL, findLesson, findObjective, lessonForObjective, lessonSequence, questionsFor, registries } from '../services/curriculum'
import type { Lesson } from '../services/types'

const TABS = ['Hands-on (Azure)', 'Lab', 'Configure', 'Troubleshoot', 'Questions', 'Misconceptions', 'Compare', 'Docs & verification'] as const
type Tab = (typeof TABS)[number]
type View = 'lite' | 'full'

const VIEW_KEY = 'cva-lesson-view'

/** Official outline for the lesson's exam; every objective links to the lesson that teaches it. */
const TOPICS_KEY = 'cva-topics-open'
/** Whether the left topic list is open. Remembered per browser; open by default. */
function useTopicsOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(TOPICS_KEY) !== 'false' } catch { return true } })
  const toggle = () => setOpen((o) => {
    try { localStorage.setItem(TOPICS_KEY, String(!o)) } catch { /* per-viewer convenience only */ }
    return !o
  })
  return [open, toggle]
}

function CurriculumNav({ lesson, open, onToggle }: { lesson: Lesson; open: boolean; onToggle: () => void }) {
  const reg = registries[lesson.exam]
  const current = useRef<HTMLAnchorElement>(null)
  useEffect(() => { if (open) current.current?.scrollIntoView({ block: 'nearest' }) }, [lesson.id, open])
  if (!open) {
    return (
      <div className="hidden xl:sticky xl:top-16 xl:block xl:self-start">
        <button type="button" className="card flex h-40 w-10 flex-col items-center justify-start gap-2 p-2 text-xs hover:border-sky-400" onClick={onToggle} aria-label="Show topic list" title="Show topic list">
          <span aria-hidden>»</span>
          <span className="[writing-mode:vertical-rl]">Topics</span>
        </button>
      </div>
    )
  }
  return (
    <nav aria-label="Curriculum" className="card hidden max-h-[calc(100vh-7rem)] overflow-y-auto p-3 text-xs xl:sticky xl:top-16 xl:block">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold"><Link className="hover:underline" to={`/course/${lesson.exam}`}>{reg.examCode} curriculum</Link></p>
        <button type="button" className="btn-ghost px-2 py-0.5 text-xs" onClick={onToggle} aria-label="Hide topic list" title="Hide topic list">« Hide</button>
      </div>
      {reg.domains.map((d) => (
        <details key={d.id} open={d.skills.some((s) => s.objectives.some((o) => lesson.objectiveIds.includes(o.id)))}>
          <summary className="cursor-pointer py-1 font-medium">{d.name}</summary>
          {d.skills.map((s) => (
            <div key={s.id} className="ml-2">
              <p className="mt-1 text-slate-500">{s.name}</p>
              <ul>
                {s.objectives.map((o) => {
                  const here = lesson.objectiveIds.includes(o.id)
                  const target = lessonForObjective(o.id)
                  if (!target) return <li key={o.id} className="ml-2 py-0.5 text-slate-400">{o.text}</li>
                  return (
                    <li key={o.id}>
                      <Link ref={here ? current : undefined} to={`/lesson/${target.id}#${o.id}`} aria-current={here ? 'page' : undefined}
                        className={`-mx-1 ml-1 block rounded px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${here ? 'bg-sky-50 font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'text-slate-600 hover:text-sky-700 dark:text-slate-400'}`}>
                        {o.text}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </details>
      ))}
    </nav>
  )
}

function PrevNext({ lesson }: { lesson: Lesson }) {
  const seq = lessonSequence(lesson.exam)
  const i = seq.findIndex((l) => l.id === lesson.id)
  const prev = i > 0 ? seq[i - 1] : undefined
  const next = i >= 0 ? seq[i + 1] : undefined
  return (
    <nav aria-label="Lesson navigation" className="grid gap-3 sm:grid-cols-2">
      {prev ? <Link to={`/lesson/${prev.id}`} className="card block p-3 text-sm hover:border-sky-400"><span className="text-xs text-slate-500">← Previous lesson</span><span className="block font-medium">{prev.title}</span></Link> : <span />}
      {next && <Link to={`/lesson/${next.id}`} className="card block p-3 text-right text-sm hover:border-sky-400"><span className="text-xs text-slate-500">Next lesson →</span><span className="block font-medium">{next.title}</span></Link>}
    </nav>
  )
}
function readView(): View {
  try { return localStorage.getItem(VIEW_KEY) === 'full' ? 'full' : 'lite' } catch { return 'lite' }
}

export default function LessonPage() {
  const { lessonId = '' } = useParams()
  const lesson = findLesson(lessonId)
  const { settings, saveSettings, online, toggleBookmark, isBookmarked, progressChanged, setError } = useApp()
  const { data } = useProgress()
  const [tab, setTab] = useState<Tab>('Lab')
  useEffect(() => { setTab(findLesson(lessonId)?.handsOn ? 'Hands-on (Azure)' : 'Lab') }, [lessonId])
  const [labChecks, setLabChecks] = useState<Set<string>>(new Set())
  const [cfgView, setCfgView] = useState<'portal' | 'cli' | 'powershell' | 'bicep' | 'python'>('cli')
  const opened = useRef(Date.now())
  const [view, setViewState] = useState<View>(readView)
  const [topicsOpen, toggleTopics] = useTopicsOpen()
  const setView = (v: View) => {
    setViewState(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* per-viewer convenience only */ }
  }

  const progress = data.lessons.find((l) => l.lesson_id === lessonId)

  // Moving to another lesson from the outline or prev/next starts at the top.
  useEffect(() => { window.scrollTo({ top: 0 }) }, [lessonId])

  // Record study time when leaving the lesson (and every 2 minutes while open).
  useEffect(() => {
    if (!lesson || !online) return
    opened.current = Date.now()
    const flush = () => {
      const secs = Math.round((Date.now() - opened.current) / 1000)
      opened.current = Date.now()
      if (secs > 5) void api.lessonVisit({ exam: lesson.exam, lesson_id: lesson.id, objective_ids: lesson.objectiveIds, seconds_spent: secs }).catch(() => undefined)
    }
    void api.lessonVisit({ exam: lesson.exam, lesson_id: lesson.id, objective_ids: lesson.objectiveIds, seconds_spent: 0 }).catch(() => undefined)
    const t = window.setInterval(flush, 120_000)
    return () => { window.clearInterval(t); flush() }
  }, [lesson, online])

  if (!lesson) return <p>Lesson not found. <Link className="underline" to="/">Back to dashboard</Link></p>

  const Anim = ANIMATION_COMPONENTS[lesson.animation.id]
  const qs = questionsFor(lesson.exam, lesson.objectiveIds)
  const labDone = !!lesson.lab && lesson.lab.validation.every((v) => labChecks.has(v.id))
  const depth = settings.depth

  const onLabCheck = (id: string) => setLabChecks((s) => (s.has(id) ? s : new Set(s).add(id)))

  const markComplete = async () => {
    try {
      await api.lessonVisit({ exam: lesson.exam, lesson_id: lesson.id, objective_ids: lesson.objectiveIds, seconds_spent: Math.round((Date.now() - opened.current) / 1000), completed: true, lab_passed: labDone || progress?.lab_passed })
      opened.current = Date.now()
      progressChanged()
    } catch (e) { setError((e as Error).message) }
  }

  const viewToggle = lesson.walkthrough && (
    <div className="flex gap-1" role="group" aria-label="Lesson view">
      {(['lite', 'full'] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'btn-primary' : 'btn-ghost'} onClick={() => setView(v)}>{v === 'lite' ? 'Lite walkthrough' : 'Full lesson'}</button>
      ))}
    </div>
  )

  if (lesson.walkthrough && view === 'lite') {
    const w = lesson.walkthrough
    return (
      <div className={`grid gap-4 ${topicsOpen ? 'xl:grid-cols-[260px_minmax(0,1fr)]' : 'xl:grid-cols-[40px_minmax(0,1fr)]'}`}>
      <CurriculumNav lesson={lesson} open={topicsOpen} onToggle={toggleTopics} />
      <div className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-start gap-2">
          <div className="min-w-[min(100%,30rem)] flex-1">
            <p className="text-xs text-slate-500"><Link className="underline" to={`/course/${lesson.exam}`}>{EXAM_LABEL[lesson.exam]}</Link> · {w.steps.length} steps · {lesson.estimatedMinutes} min</p>
            <h1 className="text-2xl font-semibold">{lesson.title}</h1>
            <p className="text-sm text-slate-500">{w.subtitle}</p>
          </div>
          {viewToggle}
          <button type="button" className="btn-ghost" onClick={() => void toggleBookmark({ kind: 'lesson', ref: lesson.id, exam: lesson.exam, title: lesson.title })}>{isBookmarked('lesson', lesson.id) ? '★ Bookmarked' : '☆ Bookmark'}</button>
          <button type="button" className="btn-primary" onClick={() => void markComplete()} disabled={!online}>{progress?.completed ? '✓ Completed (update)' : 'Mark lesson complete'}</button>
        </header>
        <Walkthrough key={lesson.id} data={w} />
        {Anim && (
          <section aria-labelledby="lite-sim-h">
            <h2 id="lite-sim-h" className="mb-1 text-base font-semibold">Try it yourself in the simulator</h2>
            <p className="mb-2 text-sm text-slate-500">{lesson.animation.caption} Nothing here touches Azure.</p>
            <Suspense fallback={<p>Loading simulation…</p>}><Anim onLabCheck={onLabCheck} /></Suspense>
          </section>
        )}
        {lesson.handsOn && <HandsOnLab key={`ho-${lesson.id}`} lessonId={lesson.id} lab={lesson.handsOn} online={online} />}
        <section className="card p-4 text-sm" aria-label="Quick check">
          <QuestionRunner key={lesson.id} questions={qs} feedback="immediate" recordAs="lesson" title="Quick check" />
        </section>
        <section className="card p-4 text-sm" aria-labelledby="lite-docs">
          <h2 id="lite-docs" className="font-semibold">Read more in the official docs</h2>
          <ul className="ml-5 list-disc">{lesson.docs.map((d) => <li key={d.url}><a className="text-sky-700 underline dark:text-sky-400" href={d.url} target="_blank" rel="noreferrer">{d.title}</a></li>)}</ul>
          <p className="mt-2 text-slate-500">Want the interactive lab, CLI commands, troubleshooting and comparisons? <button type="button" className="text-sky-700 underline dark:text-sky-400" onClick={() => setView('full')}>Open the full lesson</button>.</p>
          <p className="mt-1 text-xs text-slate-500">{lesson.verification.status} · {lesson.verification.reviewedOn}: {lesson.verification.notes}</p>
        </section>
        <PrevNext lesson={lesson} />
      </div>
      </div>
    )
  }

  return (
    <div className={`grid gap-4 ${topicsOpen ? 'xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_480px]' : 'xl:grid-cols-[40px_minmax(0,1fr)_440px] 2xl:grid-cols-[40px_minmax(0,1fr)_540px]'}`}>
      <CurriculumNav lesson={lesson} open={topicsOpen} onToggle={toggleTopics} />

      {/* Center: animation */}
      <div className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-start gap-2">
          <div className="flex-1">
            <p className="text-xs text-slate-500"><Link className="underline" to={`/course/${lesson.exam}`}>{EXAM_LABEL[lesson.exam]}</Link> · {lesson.estimatedMinutes} min</p>
            <h1 className="text-xl font-semibold">{lesson.title}</h1>
            <div className="mt-1 flex flex-wrap gap-1">{lesson.objectiveIds.map((id) => <Badge key={id} tone="info"><span id={id}>{id}</span>: {findObjective(id)?.objective.text}</Badge>)}</div>
          </div>
          {viewToggle}
          <button type="button" className="btn-ghost" onClick={() => void toggleBookmark({ kind: 'lesson', ref: lesson.id, exam: lesson.exam, title: lesson.title })}>{isBookmarked('lesson', lesson.id) ? '★ Bookmarked' : '☆ Bookmark'}</button>
          <button type="button" className="btn-primary" onClick={() => void markComplete()} disabled={!online}>{progress?.completed ? '✓ Completed (update)' : 'Mark lesson complete'}</button>
        </header>
        <section aria-labelledby="anim-h">
          <h2 id="anim-h" className="mb-1 text-sm font-semibold">Try it yourself</h2>
          <p className="mb-2 text-sm text-slate-500">{lesson.animation.caption}</p>
          {Anim ? <Suspense fallback={<p>Loading simulation…</p>}><Anim onLabCheck={onLabCheck} /></Suspense> : <p className="text-red-600">Animation {lesson.animation.id} is not registered.</p>}
        </section>
        <section className="card p-4" aria-labelledby="arch-h">
          <h2 id="arch-h" className="mb-2 text-sm font-semibold">Architecture diagram</h2>
          <ArchitectureDiagram diagram={lesson.diagram} />
        </section>

        {/* Bottom: experiments, troubleshooting, questions, verification */}
        <section className="card" aria-label="Lesson activities">
          <div role="tablist" className="flex flex-wrap gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
            {TABS.filter((t) => t !== 'Hands-on (Azure)' || lesson.handsOn).map((t) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} className={tab === t ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab(t)}>
                {t}{t === 'Lab' && lesson.lab ? ` (${labChecks.size}/${lesson.lab.validation.length})` : ''}{t === 'Questions' ? ` (${qs.length})` : ''}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="p-4 text-sm">
            {tab === 'Hands-on (Azure)' && lesson.handsOn && <HandsOnLab key={lesson.id} lessonId={lesson.id} lab={lesson.handsOn} online={online} />}

            {tab === 'Lab' && (lesson.lab ? (
              <div className="space-y-3">
                <p><Badge tone="info">Type {lesson.lab.type}: {lesson.lab.type === 'A' ? 'fully simulated' : lesson.lab.type === 'B' ? 'guided configuration' : 'optional real cloud'}</Badge> · {lesson.lab.duration} min · Cost: {lesson.lab.cost}</p>
                <p><strong>Objective:</strong> {lesson.lab.objective}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><h3 className="font-semibold">Steps (use the simulation above)</h3><ol className="ml-5 list-decimal">{lesson.lab.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
                  <div>
                    <h3 className="font-semibold">Validation checks</h3>
                    <ul>{lesson.lab.validation.map((v) => <li key={v.id}>{labChecks.has(v.id) ? '✅' : '⬜'} {v.text}</li>)}</ul>
                    {labDone && <p className="mt-2 font-semibold text-emerald-700">All checks passed. Mark the lesson complete to record it.</p>}
                    <h3 className="mt-2 font-semibold">Expected results</h3><ul className="ml-5 list-disc">{lesson.lab.expected.map((s) => <li key={s}>{s}</li>)}</ul>
                    <h3 className="mt-2 font-semibold">Failure scenarios to try</h3><ul className="ml-5 list-disc">{lesson.lab.failureScenarios.map((s) => <li key={s}>{s}</li>)}</ul>
                    <h3 className="mt-2 font-semibold">Cleanup</h3><ul className="ml-5 list-disc">{lesson.lab.cleanup.map((s) => <li key={s}>{s}</li>)}</ul>
                  </div>
                </div>
              </div>
            ) : <p>This objective is conceptual; no lab is required.</p>)}

            {tab === 'Configure' && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div><h3 className="font-semibold">Prerequisites</h3><ul className="ml-5 list-disc">{lesson.configuration.prerequisites.map((s) => <li key={s}>{s}</li>)}</ul></div>
                  <div><h3 className="font-semibold">Permissions</h3><ul className="ml-5 list-disc">{lesson.configuration.permissions.map((s) => <li key={s}>{s}</li>)}</ul></div>
                  <div><h3 className="font-semibold">Limits & dependencies</h3><ul className="ml-5 list-disc">{lesson.configuration.limits.map((s) => <li key={s}>{s}</li>)}</ul></div>
                </div>
                <div className="flex gap-1" role="group" aria-label="Configuration method">
                  {(['portal', 'cli', 'powershell', 'bicep', 'python'] as const).filter((v) => (v !== 'bicep' || lesson.configuration.bicep) && (v !== 'python' || lesson.configuration.python)).map((v) => (
                    <button key={v} type="button" aria-pressed={cfgView === v} className={cfgView === v ? 'btn-primary' : 'btn-ghost'} onClick={() => setCfgView(v)}>{{ portal: 'Portal', cli: 'Azure CLI', powershell: 'PowerShell', bicep: 'Bicep', python: 'Python' }[v]}</button>
                  ))}
                </div>
                {cfgView === 'portal' ? <ol className="ml-5 list-decimal">{lesson.configuration.portal.map((s) => <li key={s}>{s}</li>)}</ol>
                  : <pre className="code">{cfgView === 'cli' ? lesson.configuration.cli : cfgView === 'powershell' ? lesson.configuration.powershell : cfgView === 'python' ? lesson.configuration.python : lesson.configuration.bicep}</pre>}
                <p className="text-xs text-slate-500">Guided configuration (lab type B). Nothing here runs against Azure; copy commands into your own subscription only if you accept the cost.</p>
              </div>
            )}

            {tab === 'Troubleshoot' && (
              <div className="space-y-2">
                {lesson.troubleshooting.map((t) => (
                  <details key={t.symptom} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    <summary className="cursor-pointer font-medium">Symptom: {t.symptom}</summary>
                    <p className="mt-1"><strong>Cause:</strong> {t.cause}</p><p><strong>Fix:</strong> {t.fix}</p>
                  </details>
                ))}
              </div>
            )}

            {tab === 'Questions' && <QuestionRunner key={lesson.id} questions={qs} feedback="immediate" recordAs="lesson" title="Knowledge check" />}

            {tab === 'Misconceptions' && (
              <ul className="space-y-2">{lesson.misconceptions.map((m) => <li key={m.myth}><p className="text-red-700 dark:text-red-400">✗ {m.myth}</p><p className="text-emerald-700 dark:text-emerald-400">✓ {m.reality}</p></li>)}</ul>
            )}

            {tab === 'Compare' && (
              <dl className="space-y-2">{lesson.comparisons.map((c) => <div key={c.service}><dt className="font-semibold">{c.service}</dt><dd>{c.difference}</dd></div>)}</dl>
            )}

            {tab === 'Docs & verification' && (
              <div className="space-y-2">
                <ul className="ml-5 list-disc">{lesson.docs.map((d) => <li key={d.url}><a className="text-sky-700 underline dark:text-sky-400" href={d.url} target="_blank" rel="noreferrer">{d.title}</a></li>)}</ul>
                <p><Badge tone={lesson.verification.status === 'human-verified' ? 'allow' : 'warn'}>{lesson.verification.status}</Badge> reviewed {lesson.verification.reviewedOn}: {lesson.verification.notes}</p>
                <p className="text-xs text-slate-500">Progress: {progress ? `${Math.round(progress.seconds_spent / 60)} min studied${progress.completed ? ', completed' : ''}${progress.lab_passed ? ', lab passed' : ''}` : 'not recorded yet'}.</p>
              </div>
            )}
          </div>
        </section>
        <PrevNext lesson={lesson} />
      </div>

      {/* Right: explanations and settings (below the animation until the screen is wide enough for three columns) */}
      <aside className={`space-y-4 break-words ${topicsOpen ? 'xl:col-start-2 2xl:col-start-auto 2xl:sticky 2xl:top-16 2xl:max-h-[calc(100vh-7rem)] 2xl:overflow-y-auto 2xl:overflow-x-hidden' : 'xl:sticky xl:top-16 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:overflow-x-hidden'}`} aria-label="Explanation">
        <div className="card p-5 text-[15px] leading-relaxed">
          <div className="mb-3 flex gap-1" role="group" aria-label="Explanation depth">
            {(['foundation', 'engineer'] as const).map((d) => (
              <button key={d} type="button" aria-pressed={depth === d} className={depth === d ? 'btn-primary' : 'btn-ghost'} onClick={() => void saveSettings({ ...settings, depth: d })}>{d === 'foundation' ? 'Foundation' : 'Engineer'}</button>
            ))}
          </div>
          <h2 className="font-semibold">Learning objective</h2>
          <p className="mb-3">{lesson.learningObjective}</p>
          <h2 className="font-semibold">Before you start</h2>
          <ul className="mb-3 ml-5 list-disc">
            {lesson.prerequisites.map((p) => <li key={p.text}>{p.lessonId ? <Link className="underline" to={`/lesson/${p.lessonId}`}>{p.text}</Link> : p.text}{p.objectiveId && <span className="text-xs text-slate-500"> ({p.objectiveId})</span>}</li>)}
          </ul>
          <h2 className="font-semibold">{depth === 'foundation' ? 'Simple explanation' : 'Deep technical explanation'}</h2>
          <div className="prose-cva">{(depth === 'foundation' ? lesson.foundation : lesson.engineer).map((p) => <p key={p}>{p}</p>)}</div>
          {depth === 'foundation' && <button type="button" className="text-xs text-sky-700 underline" onClick={() => void saveSettings({ ...settings, depth: 'engineer' })}>Go deeper: Engineer view →</button>}
        </div>
        <div className="card p-5 text-[15px] leading-relaxed">
          <h2 className="font-semibold">Real-world example: {lesson.example.title}</h2>
          <div className="prose-cva">{lesson.example.body.map((p) => <p key={p}>{p}</p>)}</div>
          <h2 className="font-semibold">Architecture decisions</h2>
          <ul className="ml-5 list-disc">{lesson.architectureDecisions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      </aside>
    </div>
  )
}
