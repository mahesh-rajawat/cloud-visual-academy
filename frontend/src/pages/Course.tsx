import { Link, useParams } from 'react-router-dom'
import { Badge } from '../animations/primitives'
import { studiedObjectives, useProgress } from '../hooks/useProgress'
import { EXAMS, EXAM_LABEL, coverageFor, lessonForObjective, lessonsFor, registries } from '../services/curriculum'
import type { ExamSlug } from '../services/types'

export default function Course() {
  const { exam = 'az-104' } = useParams()
  const { data } = useProgress()
  if (!EXAMS.includes(exam as ExamSlug)) return <p>Unknown course.</p>
  const e = exam as ExamSlug
  const reg = registries[e]
  const cov = coverageFor(e)
  const studied = studiedObjectives(data, e)
  const covById = new Map(cov?.entries.map((x) => [x.objectiveId, x]))
  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold tracking-wide text-slate-500">{reg.examCode} · {reg.vendor}</p>
        <h1 className="text-2xl font-semibold">{EXAM_LABEL[e]}</h1>
        <p className="text-sm text-slate-500">
          Official outline: <a className="underline" href={reg.sourceUrl} target="_blank" rel="noreferrer">{reg.sourceUrl}</a> · skills measured as of {reg.skillsMeasuredAsOf} · retrieved {new Date(reg.retrievedAt).toLocaleString()}
        </p>
        <p className="mt-1 text-sm">{reg.objectiveCount} objectives · {cov?.complete ?? 0} with complete content · {lessonsFor(e).length} lesson(s) authored · {studied.size} studied</p>
        {e === 'ai-901' && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">AI-901 is a separate exam from AI-900. Only the AI-901 outline above is used; AI-900 material is not treated as AI-901 curriculum.</p>}
        {(cov?.complete ?? 0) === 0 && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">No lessons are authored for this track yet. The registry below lists every official objective so nothing is hidden.</p>}
      </header>

      {reg.domains.map((d) => (
        <section key={d.id} className="card p-4" aria-labelledby={d.id}>
          <h2 id={d.id} className="font-semibold">{d.name} <span className="text-sm font-normal text-slate-500">({d.weight})</span></h2>
          {d.skills.map((s) => (
            <div key={s.id} className="mt-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{s.id.split('-')[1]} {s.name}</h3>
              <ul className="mt-1 space-y-1">
                {s.objectives.filter((o) => o.status === 'active').map((o) => {
                  const lesson = lessonForObjective(o.id)
                  const c = covById.get(o.id)
                  const m = data.mastery[e][o.id]
                  return (
                    <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 font-mono text-xs text-slate-500">{o.id}</span>
                      {lesson ? <Link className="underline" to={`/lesson/${lesson.id}#${o.id}`}>{o.text}</Link> : <span>{o.text}</span>}
                      {o.kind && <Badge tone="muted">{o.kind}</Badge>}
                      {o.handsOn && <Badge tone="muted">hands-on</Badge>}
                      {c?.complete ? <Badge tone="allow">content complete</Badge> : <Badge tone="warn" >missing: {c?.missing.join(', ') ?? 'unknown'}</Badge>}
                      {studied.has(o.id) && <Badge tone="info">studied</Badge>}
                      {m?.mastery != null && <Badge tone={m.status === 'weak' ? 'deny' : 'allow'}>mastery {m.mastery}%</Badge>}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}

      {reg.inScopeServices && (
        <section className="card p-4">
          <h2 className="font-semibold">Official in-scope AWS services</h2>
          <p className="text-xs text-slate-500">Guide version {reg.revisionHistory?.at(-1)?.version} ({reg.revisionHistory?.at(-1)?.publicationDate}). AWS describes this list as non-exhaustive.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(reg.inScopeServices).map(([cat, svcs]) => (
              <div key={cat}><h3 className="text-sm font-semibold">{cat}</h3><ul className="text-sm text-slate-600 dark:text-slate-300">{svcs.map((s) => <li key={s}>{s}</li>)}</ul></div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
