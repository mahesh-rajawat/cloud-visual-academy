import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QuestionRunner, type RunResult } from '../components/QuestionRunner'
import { useProgress, weakObjectives } from '../hooks/useProgress'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { useApp } from '../services/AppContext'
import { EXAMS, EXAM_LABEL, findObjective, questionsFor, registries } from '../services/curriculum'
import { breakdownByObjective, selectAdaptive, shuffle } from '../services/exam'
import type { ExamSlug, Question } from '../services/types'

type Mode = 'topic' | 'domain' | 'mock' | 'weak' | 'mistakes' | 'bookmarked'
const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: 'topic', label: 'Topic practice', hint: 'One skill area, immediate feedback' },
  { id: 'domain', label: 'Domain practice', hint: 'One exam domain, immediate feedback' },
  { id: 'mock', label: 'Timed mock exam', hint: 'All available questions, feedback at the end' },
  { id: 'weak', label: 'Weak areas', hint: 'Adaptive: weak objectives, unseen and missed questions first' },
  { id: 'mistakes', label: 'Mistake history', hint: 'Questions whose latest answer was wrong' },
  { id: 'bookmarked', label: 'Bookmarked', hint: 'Questions you bookmarked' },
]

export default function Practice() {
  const [params] = useSearchParams()
  const { bookmarks, online, setError } = useApp()
  const { data } = useProgress()
  const [exam, setExam] = useState<ExamSlug>((params.get('exam') as ExamSlug) || 'az-104')
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) || 'topic')
  const reg = registries[exam]
  const [scope, setScope] = useState<string>('')
  const [run, setRun] = useState<{ qs: Question[]; key: number; timed?: number } | null>(null)
  const mistakes = useAsync(() => (online ? api.mistakes(exam) : Promise.resolve([])), [exam, online, run?.key])

  const pool = questionsFor(exam)
  const skills = reg.domains.flatMap((d) => d.skills)
  const effectiveScope = scope || (mode === 'domain' ? reg.domains[0]?.id : skills[0]?.id) || ''

  const select = (): Question[] => {
    const seed = Date.now() % 100000
    if (mode === 'topic') return shuffle(pool.filter((q) => q.objectiveId.startsWith(effectiveScope + '.')), seed)
    if (mode === 'domain') return shuffle(pool.filter((q) => q.objectiveId.startsWith(effectiveScope + '.')), seed)
    if (mode === 'mock') return shuffle(pool, seed).slice(0, 50)
    if (mode === 'mistakes') { const ids = new Set((mistakes.data ?? []).map((m) => m.questionId)); return pool.filter((q) => ids.has(q.id)) }
    if (mode === 'bookmarked') { const ids = new Set(bookmarks.filter((b) => b.kind === 'question').map((b) => b.ref)); return pool.filter((q) => ids.has(q.id)) }
    const weak = new Set(weakObjectives(data, exam).map((w) => w.id))
    const seen = new Set(Object.keys(data.mastery[exam]))
    const wrong = new Set((mistakes.data ?? []).map((m) => m.questionId))
    const avgMastery = Object.values(data.mastery[exam]).map((m) => m.mastery).filter((v): v is number => v !== null)
    const target = avgMastery.length ? 1 + (avgMastery.reduce((a, b) => a + b, 0) / avgMastery.length) / 50 : 2
    return selectAdaptive(pool, { count: 10, seed, weakObjectives: weak, wrongQuestions: wrong, seenQuestions: seen, targetDifficulty: target })
  }

  const start = () => {
    const qs = select()
    setRun({ qs, key: Date.now(), timed: mode === 'mock' ? qs.length * 120 : undefined })
  }

  const onFinish = async (r: RunResult) => {
    if (!run || !online) return
    const score = Object.values(r.correct).filter(Boolean).length
    try {
      await api.saveSession({ exam, kind: mode === 'bookmarked' || mode === 'mistakes' ? 'topic' : mode, score, total: run.qs.length, seconds: r.seconds, breakdown: breakdownByObjective(run.qs, r.answers) })
    } catch (e) { setError((e as Error).message) }
  }

  if (run) {
    return (
      <div className="space-y-3">
        <button type="button" className="btn-ghost" onClick={() => setRun(null)}>← Back to practice setup</button>
        <QuestionRunner key={run.key} questions={run.qs} feedback={mode === 'mock' ? 'end' : 'immediate'} recordAs={mode === 'mock' ? 'mock' : 'practice'} timeLimitSeconds={run.timed} onFinish={(r) => void onFinish(r)} title={MODES.find((m) => m.id === mode)?.label} />
      </div>
    )
  }

  const preview = select()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Practice exams</h1>
      <p className="text-sm text-slate-500">All questions are original and written for this platform; none are taken from real exams. Practice scores do not guarantee an official result.</p>
      <div className="card space-y-3 p-4">
        <label className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center">Certification
          <select className="input sm:ml-2" value={exam} onChange={(e) => { setExam(e.target.value as ExamSlug); setScope('') }}>
            {EXAMS.map((e) => <option key={e} value={e}>{registries[e].examCode}: {EXAM_LABEL[e]} ({questionsFor(e).length} questions)</option>)}
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Practice mode">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={`rounded-lg border p-3 text-left text-sm ${mode === m.id ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' : 'border-slate-200 dark:border-slate-700'}`} onClick={() => { setMode(m.id); setScope('') }}>
              <span className="font-semibold">{m.label}</span><br /><span className="text-xs text-slate-500">{m.hint}</span>
            </button>
          ))}
        </div>
        {(mode === 'topic' || mode === 'domain') && (
          <label className="flex flex-col gap-1 text-sm">{mode === 'topic' ? 'Skill area' : 'Domain'}
            <select className="input" value={effectiveScope} onChange={(e) => setScope(e.target.value)}>
              {(mode === 'topic' ? skills : reg.domains).map((s) => {
                const n = pool.filter((q) => q.objectiveId.startsWith(s.id + '.')).length
                return <option key={s.id} value={s.id}>{s.name} ({n} question{n === 1 ? '' : 's'})</option>
              })}
            </select>
          </label>
        )}
        <p className="text-sm">{preview.length} question(s) selected{mode === 'mock' && preview.length > 0 ? ` · time limit ${preview.length * 2} min` : ''}.
          {mode === 'mock' && pool.length < 40 && pool.length > 0 && <span className="text-amber-700 dark:text-amber-300"> The {reg.examCode} bank currently has only {pool.length} questions, so this is a short mock and not a full-length exam.</span>}
          {preview.length === 0 && <span className="text-amber-700 dark:text-amber-300"> No questions are available for this selection yet.</span>}
        </p>
        {mode === 'weak' && preview.length > 0 && <p className="text-xs text-slate-500">Covers: {[...new Set(preview.map((q) => findObjective(q.objectiveId)?.objective.text))].join(' · ')}</p>}
        <button type="button" className="btn-primary" disabled={preview.length === 0} onClick={start}>Start</button>
      </div>
    </div>
  )
}
