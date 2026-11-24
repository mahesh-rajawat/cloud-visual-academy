import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../animations/primitives'
import { QuestionRunner } from '../components/QuestionRunner'
import { useProgress } from '../hooks/useProgress'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { useApp } from '../services/AppContext'
import { findObjective, lessonForObjective, questions } from '../services/curriculum'
import { selectAdaptive } from '../services/exam'
import type { Question } from '../services/types'

export default function Reviews() {
  const { online } = useApp()
  const { data } = useProgress()
  const [run, setRun] = useState<{ qs: Question[]; key: number } | null>(null)
  const mistakes = useAsync(() => (online ? api.mistakes('az-104') : Promise.resolve([])), [online])

  const due = data.due
  const withQuestions = due.filter((r) => questions.some((q) => q.objectiveId === r.objective_id))
  const withoutQuestions = due.filter((r) => !withQuestions.includes(r))

  const start = () => {
    // One question per due objective, preferring ones not answered before so reviews do not just repeat.
    const wrong = new Set((mistakes.data ?? []).map((m) => m.questionId))
    const qs = withQuestions.flatMap((r, i) => selectAdaptive(questions.filter((q) => q.objectiveId === r.objective_id), {
      count: 1, seed: Date.now() + i, weakObjectives: new Set(), wrongQuestions: wrong, seenQuestions: new Set(), targetDifficulty: 1 + Math.min(r.stage, 2),
    }))
    setRun({ qs, key: Date.now() })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Daily recall check</h1>
      <p className="text-sm text-slate-500">Spaced repetition: same day, next day, 3 days, 7 days, and again the day before your exam date. A wrong answer resets an objective to tomorrow.</p>
      {!online && <p className="text-amber-700">The backend is offline, so there is no review schedule to show.</p>}
      {run ? (
        <>
          <button type="button" className="btn-ghost" onClick={() => setRun(null)}>← Back</button>
          <QuestionRunner key={run.key} questions={run.qs} feedback="immediate" recordAs="review" title="Recall check" />
        </>
      ) : (
        <div className="card space-y-3 p-4">
          <p>{due.length} objective(s) due for review.</p>
          <ul className="space-y-1 text-sm">
            {due.map((r) => (
              <li key={`${r.exam}-${r.objective_id}`}>
                <Badge tone={r.reason === 'lapsed' ? 'deny' : r.reason === 'pre-exam' ? 'warn' : 'info'}>{r.reason}</Badge> {findObjective(r.objective_id)?.objective.text}
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary" disabled={withQuestions.length === 0} onClick={start}>Start recall check ({withQuestions.length} question{withQuestions.length === 1 ? '' : 's'})</button>
          {withoutQuestions.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {withoutQuestions.length} due objective(s) have no questions yet; re-read their lessons instead:{' '}
              {withoutQuestions.map((r) => { const l = lessonForObjective(r.objective_id); return l ? <Link key={r.objective_id} className="mr-2 underline" to={`/lesson/${l.id}`}>{r.objective_id}</Link> : <span key={r.objective_id} className="mr-2">{r.objective_id}</span> })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
