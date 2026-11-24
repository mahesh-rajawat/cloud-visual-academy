import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../animations/primitives'
import { QuestionRunner, type RunResult } from '../components/QuestionRunner'
import { api } from '../services/api'
import { useApp } from '../services/AppContext'
import { findLesson, findObjective, questionsFor } from '../services/curriculum'
import { breakdownByObjective } from '../services/exam'

export default function Diagnostic() {
  const { online, settings, saveSettings, setError } = useApp()
  const qs = questionsFor('az-900').filter((q) => q.diagnostic)
  const [result, setResult] = useState<RunResult | null>(null)
  const [runKey, setRunKey] = useState(0)

  const finish = async (r: RunResult) => {
    setResult(r)
    if (!online) return
    const score = Object.values(r.correct).filter(Boolean).length
    try { await api.saveSession({ exam: 'az-900', kind: 'diagnostic', score, total: qs.length, seconds: r.seconds, breakdown: breakdownByObjective(qs, r.answers) }) } catch (e) { setError((e as Error).message) }
  }

  const missed = result ? qs.filter((q) => !result.correct[q.id]) : []
  const recommendedLessons = [...new Set(missed.flatMap((q) => q.diagnosticFor ?? []))]
  const gapsWithoutLesson = missed.filter((q) => !(q.diagnosticFor ?? []).length)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">AZ-900 prerequisite diagnostic</h1>
        <p className="text-sm text-slate-500">{qs.length} original questions on the AZ-900 concepts that AZ-104 builds on. AZ-104 is never locked: results only tell you which foundations to review first, using the Foundation depth of the related AZ-104 lessons.</p>
      </header>
      {result && (
        <>
          <section className="card space-y-3 p-4">
            <h2 className="font-semibold">Your foundation plan</h2>
            {missed.length === 0 ? <p>No gaps found in the diagnosed areas. Go straight to AZ-104 at Engineer depth.</p> : (
              <>
                <p>You missed {missed.length} of {qs.length}. Gaps by AZ-900 objective:</p>
                <ul className="ml-5 list-disc text-sm">{missed.map((q) => <li key={q.id}><Badge tone="muted">{q.objectiveId}</Badge> {findObjective(q.objectiveId)?.objective.text}</li>)}</ul>
                {recommendedLessons.length > 0 && (
                  <div>
                    <p className="font-medium">Review these AZ-104 lessons in Foundation depth first:</p>
                    <ul className="ml-5 list-disc text-sm">{recommendedLessons.map((id) => <li key={id}><Link className="underline" to={`/lesson/${id}`} onClick={() => void saveSettings({ ...settings, depth: 'foundation' })}>{findLesson(id)?.title ?? id}</Link></li>)}</ul>
                  </div>
                )}
                {gapsWithoutLesson.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">{gapsWithoutLesson.length} gap(s) have no condensed AZ-900 lesson authored yet. Use the documentation links in the review below.</p>}
              </>
            )}
            <button type="button" className="btn-ghost" onClick={() => { setResult(null); setRunKey((k) => k + 1) }}>Retake diagnostic</button>
          </section>
        </>
      )}
      <QuestionRunner key={runKey} questions={qs} feedback="end" recordAs="diagnostic" onFinish={(r) => void finish(r)} title="Diagnostic" />
    </div>
  )
}
