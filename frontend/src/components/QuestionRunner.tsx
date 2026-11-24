import { useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import { useApp } from '../services/AppContext'
import { displayOptions, isCorrect, shuffle, type Answer } from '../services/exam'
import type { Question } from '../services/types'
import { Badge } from '../animations/primitives'

export interface RunResult {
  answers: Record<string, Answer>
  correct: Record<string, boolean>
  seconds: number
}

interface Props {
  questions: Question[]
  /** practice: feedback after each question; exam: feedback only in the review at the end. */
  feedback: 'immediate' | 'end'
  recordAs: 'practice' | 'mock' | 'diagnostic' | 'review' | 'lesson'
  timeLimitSeconds?: number
  onFinish?: (r: RunResult) => void
  title?: string
}

function AnswerInput({ q, value, onChange, locked }: { q: Question; value: Answer | undefined; onChange: (a: Answer) => void; locked: boolean }) {
  if (q.answerMode === 'single' || q.answerMode === 'multiple') {
    const sel = (value as string[] | undefined) ?? []
    return (
      <fieldset className="space-y-2" disabled={locked}>
        <legend className="sr-only">{q.answerMode === 'single' ? 'Choose one answer' : 'Choose all that apply'}</legend>
        {q.answerMode === 'multiple' && <p className="text-xs text-slate-500">Select {q.correct.length}.</p>}
        {displayOptions(q).map((o) => {
          const checked = sel.includes(o.id)
          return (
            <label key={o.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${checked ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
              <input type={q.answerMode === 'single' ? 'radio' : 'checkbox'} name={q.id} checked={checked} className="mt-1"
                onChange={() => onChange(q.answerMode === 'single' ? [o.id] : checked ? sel.filter((x) => x !== o.id) : [...sel, o.id])} />
              <span>{o.text}</span>
            </label>
          )
        })}
      </fieldset>
    )
  }
  if (q.answerMode === 'ordering') return <OrderingInput q={q} value={value as string[] | undefined} onChange={onChange} locked={locked} />
  const map = (value as Record<string, string> | undefined) ?? {}
  return (
    <div className="space-y-2">
      {(q.pairs ?? []).map((p) => (
        <label key={p.left} className="flex flex-col gap-1 rounded-lg border border-slate-200 p-2 sm:flex-row sm:items-center dark:border-slate-700">
          <span className="flex-1">{p.left}</span>
          <select className="input" disabled={locked} value={map[p.left] ?? ''} onChange={(e) => onChange({ ...map, [p.left]: e.target.value })}>
            <option value="">Choose…</option>
            {q.options.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
          </select>
        </label>
      ))}
    </div>
  )
}

function OrderingInput({ q, value, onChange, locked }: { q: Question; value: string[] | undefined; onChange: (a: Answer) => void; locked: boolean }) {
  // Start from a deterministic shuffle that is never already the correct order.
  const initial = (() => {
    const ids = q.options.map((o) => o.id)
    for (let seed = 3; seed < 50; seed++) {
      const s = shuffle(ids, seed)
      if (s.join() !== q.correct.join()) return s
    }
    return ids
  })()
  const order = value ?? initial
  useEffect(() => {
    if (!value) onChange(initial)
  }, [q.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const move = (i: number, d: number) => {
      const next = [...order]
      const j = i + d
      if (j < 0 || j >= next.length) return
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      onChange(next)
    }
    return (
      <ol className="space-y-1" aria-label="Order the items">
        {order.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <span className="w-5 text-slate-500">{i + 1}.</span>
            <span className="flex-1">{q.options.find((o) => o.id === id)?.text}</span>
            <button type="button" className="btn-ghost px-2" disabled={locked || i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button type="button" className="btn-ghost px-2" disabled={locked || i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
          </li>
        ))}
      </ol>
    )
}

export function QuestionExplanation({ q, answer }: { q: Question; answer: Answer | undefined }) {
  const ok = isCorrect(q, answer)
  return (
    <div className={`mt-3 rounded-lg border p-3 text-sm ${ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:bg-red-950/30'}`}>
      <p className="mb-1 font-semibold">{ok ? 'Correct' : 'Incorrect'}</p>
      <p className="mb-2">{q.explanation}</p>
      {(q.answerMode === 'single' || q.answerMode === 'multiple') && (
        <ul className="space-y-1">
          {displayOptions(q).map((o) => (
            <li key={o.id}><Badge tone={q.correct.includes(o.id) ? 'allow' : 'muted'}>{q.correct.includes(o.id) ? 'correct' : 'wrong'}</Badge> <span className="font-medium">{o.text}</span>: {o.explanation}</li>
          ))}
        </ul>
      )}
      {q.answerMode === 'ordering' && <p>Correct order: {q.correct.map((id) => q.options.find((o) => o.id === id)?.text).join(' → ')}</p>}
      {q.answerMode === 'matching' && <ul>{q.pairs?.map((p) => <li key={p.left}>{p.left} → <strong>{q.options.find((o) => o.id === p.answer)?.text}</strong></li>)}</ul>}
      <p className="mt-2 text-xs">Docs: {q.docs.map((d) => <a key={d} href={d} target="_blank" rel="noreferrer" className="mr-2 text-sky-700 underline dark:text-sky-400">{new URL(d).pathname.split('/').filter(Boolean).slice(-1)[0]}</a>)}</p>
    </div>
  )
}

export function QuestionRunner({ questions, feedback, recordAs, timeLimitSeconds, onFinish, title }: Props) {
  const { toggleBookmark, isBookmarked, progressChanged, online } = useApp()
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [finished, setFinished] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const qStart = useRef(Date.now())
  const start = useRef(Date.now())

  useEffect(() => {
    if (finished) return
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - start.current) / 1000)), 1000)
    return () => window.clearInterval(t)
  }, [finished])

  const q = questions[i]
  const remaining = timeLimitSeconds ? Math.max(0, timeLimitSeconds - elapsed) : null

  const record = (question: Question, ans: Answer | undefined) => {
    if (!online) return
    void api.attempt({ exam: question.exam, question_id: question.id, objective_id: question.objectiveId, correct: isCorrect(question, ans), confidence: confidence[question.id] ?? 2, seconds: (Date.now() - qStart.current) / 1000, mode: recordAs }).catch(() => undefined)
  }

  const finish = () => {
    if (finished) return
    if (feedback === 'end') questions.forEach((qq) => record(qq, answers[qq.id]))
    const correct = Object.fromEntries(questions.map((qq) => [qq.id, isCorrect(qq, answers[qq.id])]))
    setFinished(true)
    progressChanged()
    onFinish?.({ answers, correct, seconds: Math.floor((Date.now() - start.current) / 1000) })
  }

  useEffect(() => {
    if (remaining === 0 && !finished) finish()
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (questions.length === 0) return <p className="text-sm text-slate-500">No questions are available for this selection yet.</p>

  if (finished) {
    const score = questions.filter((qq) => isCorrect(qq, answers[qq.id])).length
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <h3 className="text-lg font-semibold">{title ?? 'Results'}: {score}/{questions.length} ({Math.round((100 * score) / questions.length)}%)</h3>
          <p className="text-sm text-slate-500">Time: {Math.floor(elapsed / 60)}m {elapsed % 60}s. Practice scores measure your grasp of this platform's questions; they do not predict or guarantee an official exam result.</p>
        </div>
        {questions.map((qq, n) => (
          <details key={qq.id} className="card p-3" open={!isCorrect(qq, answers[qq.id])}>
            <summary className="cursor-pointer text-sm"><Badge tone={isCorrect(qq, answers[qq.id]) ? 'allow' : 'deny'}>{isCorrect(qq, answers[qq.id]) ? '✓' : '✗'}</Badge> Q{n + 1}. {qq.stem}</summary>
            {qq.code && <pre className="code mt-2">{qq.code}</pre>}
            <QuestionExplanation q={qq} answer={answers[qq.id]} />
          </details>
        ))}
      </div>
    )
  }

  if (!q) return null
  const ans = answers[q.id]
  const locked = feedback === 'immediate' && !!checked[q.id]
  const hasAnswer = !!ans && (Array.isArray(ans) ? ans.length > 0 : Object.keys(ans).length === (q.pairs?.length ?? 0))

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Question {i + 1} of {questions.length}</span>
        <Badge tone="muted">{q.objectiveId}</Badge>
        <Badge tone="info">{q.type}</Badge>
        <Badge tone="muted">difficulty {q.difficulty}</Badge>
        {remaining !== null && <span className={`ml-auto font-mono ${remaining < 300 ? 'text-red-600' : ''}`} aria-live="off">⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
        <button type="button" className={`${remaining === null ? 'ml-auto' : ''} text-sky-700 underline dark:text-sky-400`} onClick={() => void toggleBookmark({ kind: 'question', ref: q.id, exam: q.exam, title: q.stem.slice(0, 120) })}>
          {isBookmarked('question', q.id) ? '★ Bookmarked' : '☆ Bookmark'}
        </button>
      </div>
      <p className="mb-3 font-medium">{q.stem}</p>
      {q.code && <pre className="code mb-3">{q.code}</pre>}
      <AnswerInput q={q} value={ans} onChange={(a) => setAnswers({ ...answers, [q.id]: a })} locked={locked} />
      <fieldset className="mt-3 flex flex-wrap items-center gap-3 text-xs" disabled={locked}>
        <legend className="label mb-1">How confident are you?</legend>
        {[[1, 'Guessing'], [2, 'Unsure'], [3, 'Sure']].map(([v, l]) => (
          <label key={v} className="flex items-center gap-1"><input type="radio" name={`conf-${q.id}`} checked={(confidence[q.id] ?? 2) === v} onChange={() => setConfidence({ ...confidence, [q.id]: v as number })} />{l}</label>
        ))}
      </fieldset>
      {locked && <QuestionExplanation q={q} answer={ans} />}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => { setI(i - 1); qStart.current = Date.now() }}>◀ Previous</button>
        {feedback === 'immediate' && !locked && (
          <button type="button" className="btn-primary" disabled={!hasAnswer} onClick={() => { setChecked({ ...checked, [q.id]: true }); record(q, ans) }}>Check answer</button>
        )}
        {i < questions.length - 1 ? (
          <button type="button" className={feedback === 'immediate' && !locked ? 'btn-ghost' : 'btn-primary'} onClick={() => { setI(i + 1); qStart.current = Date.now() }}>Next ▶</button>
        ) : (
          <button type="button" className="btn-primary" onClick={finish}>Finish</button>
        )}
        {feedback === 'end' && <span className="ml-auto self-center text-xs text-slate-500">{Object.keys(answers).length}/{questions.length} answered</span>}
      </div>
    </div>
  )
}
