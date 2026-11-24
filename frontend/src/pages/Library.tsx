import { Suspense, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge } from '../animations/primitives'
import { ANIMATION_COMPONENTS } from '../animations/registry'
import { useApp } from '../services/AppContext'
import { animations, lessonForObjective, lessons, registries } from '../services/curriculum'

export function AnimationLibrary() {
  const [params, setParams] = useSearchParams()
  const { toggleBookmark, isBookmarked } = useApp()
  const selected = params.get('id') ?? animations[0]?.id
  const meta = animations.find((a) => a.id === selected)
  const Comp = selected ? ANIMATION_COMPONENTS[selected] : undefined
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Animation library</h1>
      <p className="text-sm text-slate-500">Every animation is labelled as an accurate model of documented behaviour or a simplified illustration, and its logic is covered by automated tests.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {animations.map((a) => (
          <button key={a.id} type="button" onClick={() => setParams({ id: a.id })} aria-pressed={a.id === selected}
            className={`card p-3 text-left text-sm ${a.id === selected ? 'ring-2 ring-sky-500' : ''}`}>
            <span className="font-semibold">{a.title}</span>
            <span className="mt-1 block text-xs text-slate-500">{registries[a.exam].examCode} · {a.objectiveIds.join(', ')}</span>
            <span className="mt-1 block"><Badge tone={a.fidelity === 'accurate-model' ? 'info' : 'warn'}>{a.fidelity}</Badge></span>
          </button>
        ))}
      </div>
      {meta && Comp && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{meta.title}</h2>
            <span className="text-sm text-slate-500">{meta.description}</span>
            <button type="button" className="btn-ghost ml-auto" onClick={() => void toggleBookmark({ kind: 'animation', ref: meta.id, exam: meta.exam, title: meta.title })}>{isBookmarked('animation', meta.id) ? '★ Bookmarked' : '☆ Bookmark'}</button>
            {lessonForObjective(meta.objectiveIds[0]!) && <Link className="btn-primary" to={`/lesson/${lessonForObjective(meta.objectiveIds[0]!)!.id}`}>Open lesson</Link>}
          </div>
          <Suspense fallback={<p>Loading…</p>}><Comp /></Suspense>
        </section>
      )}
    </div>
  )
}

export function Labs() {
  const [filter, setFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const withLabs = lessons.filter((l) => l.lab && (filter === 'all' || l.lab.type === filter))
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Practical labs</h1>
      <p className="text-sm text-slate-500">Type A labs run fully in the browser. Type B shows guided portal/CLI/PowerShell/Bicep workflows (in each lesson's Configure tab). Type C real-cloud labs are never started automatically; none are published yet.</p>
      <div className="flex gap-2" role="group" aria-label="Lab type filter">
        {(['all', 'A', 'B', 'C'] as const).map((f) => <button key={f} type="button" aria-pressed={filter === f} className={filter === f ? 'btn-primary' : 'btn-ghost'} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : `Type ${f}`}</button>)}
      </div>
      {withLabs.length === 0 && <p className="text-sm text-slate-500">No labs of this type yet.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {withLabs.map((l) => (
          <article key={l.id} className="card p-4 text-sm">
            <h2 className="font-semibold">{l.title}</h2>
            <p className="mt-1">{l.lab!.objective}</p>
            <p className="mt-2 text-xs text-slate-500">Type {l.lab!.type} · {l.lab!.duration} min · {l.lab!.validation.length} validation checks · Cost: {l.lab!.cost}</p>
            <Link className="btn-primary mt-3" to={`/lesson/${l.id}`}>Open lab</Link>
          </article>
        ))}
      </div>
    </div>
  )
}
