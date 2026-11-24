import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../animations/primitives'
import { domainMastery, studiedObjectives, useProgress, weakObjectives } from '../hooks/useProgress'
import { useApp } from '../services/AppContext'
import { EXAMS, allObjectives, findLesson, findObjective, lessonForObjective, lessons, questions, registries } from '../services/curriculum'
import type { ExamSlug } from '../services/types'

export function Analytics() {
  const { data } = useProgress()
  const [exam, setExam] = useState<ExamSlug>('az-104')
  const dm = domainMastery(data, exam).map((d) => ({ name: d.name.replace(/^(Describe|Manage|Implement|Deploy|Monitor|Identify) (and manage )?/, ''), mastery: d.mastery ?? 0, assessed: d.assessed }))
  const sessions = data.sessions.filter((s) => s.exam === exam).slice().reverse().map((s, i) => ({ n: i + 1, pct: Math.round((100 * s.score) / s.total), kind: s.kind }))
  const total = allObjectives(exam).length
  const studied = studiedObjectives(data, exam).size
  const weak = weakObjectives(data, exam)
  const assessed = Object.values(data.mastery[exam]).filter((m) => m.mastery !== null).length
  const studyMinutes = Math.round(data.lessons.filter((l) => l.exam === exam).reduce((s, l) => s + l.seconds_spent, 0) / 60)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Learning analytics & readiness</h1>
      <select className="input" value={exam} onChange={(e) => setExam(e.target.value as ExamSlug)} aria-label="Certification">
        {EXAMS.map((e) => <option key={e} value={e}>{registries[e].examCode}</option>)}
      </select>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-3"><p className="label">Objectives studied</p><p className="text-2xl font-semibold">{studied}/{total}</p></div>
        <div className="card p-3"><p className="label">Objectives with mastery evidence</p><p className="text-2xl font-semibold">{assessed}/{total}</p></div>
        <div className="card p-3"><p className="label">Weak objectives</p><p className="text-2xl font-semibold">{weak.length}</p></div>
        <div className="card p-3"><p className="label">Lesson study time</p><p className="text-2xl font-semibold">{studyMinutes} min</p></div>
      </div>
      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Readiness report</h2>
        <ul className="ml-5 list-disc text-sm">
          <li>{total - studied} official objective(s) not yet studied.</li>
          <li>{total - assessed} objective(s) have no mastery evidence (fewer than 3 answers).</li>
          {weak.map((w) => <li key={w.id}>Weak: {findObjective(w.id)?.objective.text} ({w.info.mastery}%{w.info.confidentWrong ? `, ${w.info.confidentWrong} confident-wrong` : ''})</li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-500">This report reflects only questions on this platform. High practice scores do not guarantee passing the official exam, and the official outline cannot cover every question you might see.</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Mastery by domain</h2>
          {dm.every((d) => d.assessed === 0) ? <p className="text-sm text-slate-500">No evidence yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dm} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} /><Tooltip />
                <Bar dataKey="mastery" fill="#0a7cd6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Assessment history</h2>
          {sessions.length === 0 ? <p className="text-sm text-slate-500">No assessments yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={sessions}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="n" /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="pct" stroke="#15935a" /></LineChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>
    </div>
  )
}

export function Bookmarks() {
  const { bookmarks, toggleBookmark } = useApp()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Bookmark library</h1>
      {bookmarks.length === 0 && <p className="text-sm text-slate-500">Nothing bookmarked yet. Use ☆ Bookmark on lessons, questions and animations.</p>}
      <ul className="space-y-2">
        {bookmarks.map((b) => {
          const to = b.kind === 'lesson' ? `/lesson/${b.ref}` : b.kind === 'animation' ? `/animations?id=${b.ref}` : `/practice?exam=${b.exam}&mode=bookmarked`
          return (
            <li key={`${b.kind}-${b.ref}`} className="card flex items-center gap-2 p-3 text-sm">
              <Badge tone="muted">{b.kind}</Badge><Link className="flex-1 underline" to={to}>{b.title}</Link>
              <span className="text-xs text-slate-500">{registries[b.exam].examCode}</span>
              <button type="button" className="text-red-600" onClick={() => void toggleBookmark(b)} aria-label={`Remove bookmark ${b.title}`}>Remove</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Search() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim().toLowerCase()
  const objs = q ? EXAMS.flatMap((e) => allObjectives(e).filter((o) => o.text.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)).map((o) => ({ e, o }))) : []
  const ls = q ? lessons.filter((l) => [l.title, ...l.foundation, ...l.engineer].join(' ').toLowerCase().includes(q)) : []
  const qs = q ? questions.filter((x) => x.stem.toLowerCase().includes(q)) : []
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Search{q && `: "${q}"`}</h1>
      {!q && <p className="text-sm text-slate-500">Type in the search box above.</p>}
      {q && <p className="text-sm text-slate-500">{objs.length} objectives · {ls.length} lessons · {qs.length} questions</p>}
      {ls.length > 0 && <section><h2 className="font-semibold">Lessons</h2><ul className="ml-5 list-disc">{ls.map((l) => <li key={l.id}><Link className="underline" to={`/lesson/${l.id}`}>{l.title}</Link></li>)}</ul></section>}
      {objs.length > 0 && <section><h2 className="font-semibold">Official objectives</h2><ul className="space-y-1 text-sm">{objs.slice(0, 100).map(({ e, o }) => { const l = lessonForObjective(o.id); return <li key={o.id}><span className="font-mono text-xs text-slate-500">{o.id}</span> {l ? <Link className="underline" to={`/lesson/${l.id}`}>{o.text}</Link> : <Link className="underline" to={`/course/${e}`}>{o.text}</Link>}</li> })}</ul></section>}
      {qs.length > 0 && <section><h2 className="font-semibold">Questions</h2><ul className="space-y-1 text-sm">{qs.map((x) => <li key={x.id}><Badge tone="muted">{x.objectiveId}</Badge> {x.stem.slice(0, 140)} <Link className="underline" to={`/practice?exam=${x.exam}`}>practice</Link>{lessonForObjective(x.objectiveId) && <> · <Link className="underline" to={`/lesson/${findLesson(lessonForObjective(x.objectiveId)!.id)!.id}`}>lesson</Link></>}</li>)}</ul></section>}
    </div>
  )
}

export function SettingsPage() {
  const { settings, saveSettings, online, progressChanged, setError } = useApp()
  const [confirming, setConfirming] = useState(false)
  const [text, setText] = useState('')
  const set = (patch: Partial<typeof settings>) => void saveSettings({ ...settings, ...patch })
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="card space-y-3 p-4 text-sm">
        <label className="flex items-center justify-between">Theme
          <select className="input" value={settings.theme} onChange={(e) => set({ theme: e.target.value as typeof settings.theme })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
        </label>
        <label className="flex items-center justify-between">Default explanation depth
          <select className="input" value={settings.depth} onChange={(e) => set({ depth: e.target.value as typeof settings.depth })}><option value="foundation">Foundation</option><option value="engineer">Engineer</option></select>
        </label>
        <label className="flex items-center justify-between">Learning mode
          <select className="input" value={settings.mode} onChange={(e) => set({ mode: e.target.value as typeof settings.mode })}><option value="sprint">A: AZ-104 study plan (7 weeks)</option><option value="complete">B: Complete cloud learning</option></select>
        </label>
        {EXAMS.map((e) => (
          <label key={e} className="flex items-center justify-between">{registries[e].examCode} exam date
            <input type="date" className="input" value={settings.exam_dates[e] ?? ''} onChange={(ev) => set({ exam_dates: { ...settings.exam_dates, [e]: ev.target.value || null } })} />
          </label>
        ))}
        <p className="text-xs text-slate-500">Animations follow your operating system's reduced-motion setting automatically.</p>
        {!online && <p className="text-amber-700">Backend offline: changes apply to this session only.</p>}
      </section>
      <section className="card space-y-2 p-4 text-sm">
        <h2 className="font-semibold text-red-700">Reset learning history</h2>
        <p>Permanently deletes lesson progress, answers, exam sessions, reviews and bookmarks from the local database. This cannot be undone.</p>
        {!confirming ? <button type="button" className="btn-ghost text-red-700" onClick={() => setConfirming(true)}>Reset…</button> : (
          <div className="flex flex-wrap items-center gap-2">
            <label>Type RESET to confirm <input className="input" value={text} onChange={(e) => setText(e.target.value)} /></label>
            <button type="button" className="btn bg-red-600 text-white" disabled={text !== 'RESET' || !online} onClick={async () => { try { const { api } = await import('../services/api'); await api.resetProgress(); progressChanged(); setConfirming(false); setText('') } catch (err) { setError((err as Error).message) } }}>Delete everything</button>
            <button type="button" className="btn-ghost" onClick={() => { setConfirming(false); setText('') }}>Cancel</button>
          </div>
        )}
      </section>
    </div>
  )
}
