import { useCallback, useEffect, useState, type ClipboardEvent } from 'react'
import { Badge } from '../animations/primitives'
import { api, type Screenshot } from '../services/api'
import type { HandsOnLab as Lab } from '../services/types'

const COST_TONE = { free: 'allow', low: 'info', watch: 'warn' } as const
const COST_LABEL = { free: 'Free', low: 'Low cost', watch: 'Billed hourly: delete right after' } as const

const doneKey = (lessonId: string) => `cva-handson-${lessonId}`
function readDone(lessonId: string): number[] {
  try { return JSON.parse(localStorage.getItem(doneKey(lessonId)) ?? '[]') as number[] } catch { return [] }
}

function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

/**
 * A hands-on exercise in the learner's own Azure account: easy numbered steps they tick off, what they
 * should see, and space for their own screenshots (saved by the local backend, never uploaded anywhere).
 * The app itself never creates cloud resources.
 */
export function HandsOnLab({ lessonId, lab, online }: { lessonId: string; lab: Lab; online: boolean | null }) {
  const [done, setDone] = useState<number[]>(() => readDone(lessonId))
  const [shots, setShots] = useState<Screenshot[]>([])
  const [active, setActive] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setDone(readDone(lessonId)) }, [lessonId])
  const reload = useCallback(() => {
    if (online) api.screenshots(lessonId).then(setShots).catch(() => setShots([]))
  }, [lessonId, online])
  useEffect(reload, [reload])

  const toggle = (i: number) => setDone((d) => {
    const next = d.includes(i) ? d.filter((x) => x !== i) : [...d, i]
    try { localStorage.setItem(doneKey(lessonId), JSON.stringify(next)) } catch { /* per-viewer convenience only */ }
    return next
  })

  const save = async (file: Blob, step: number | null) => {
    setError(null)
    if (!file.type.startsWith('image/')) { setError('Only images can be saved as screenshots.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('That image is larger than 5 MB. Crop it or save it as JPEG.'); return }
    try {
      await api.addScreenshot({ lesson_id: lessonId, step, caption: step ? `Step ${step}` : 'Lab', data_url: await toDataUrl(file) })
      reload()
    } catch (e) { setError((e as Error).message) }
  }
  const onPaste = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
    if (file && active !== null) { e.preventDefault(); void save(file, active) }
  }
  const remove = async (id: number) => { await api.removeScreenshot(id).catch(() => undefined); reload() }

  const shotsFor = (step: number | null) => shots.filter((s) => s.step === step)
  const Shots = ({ step }: { step: number | null }) => shotsFor(step).length ? (
    <div className="mt-2 flex flex-wrap gap-2">
      {shotsFor(step).map((s) => (
        <figure key={s.id} className="relative">
          <a href={api.screenshotUrl(s.id)} target="_blank" rel="noreferrer"><img src={api.screenshotUrl(s.id)} alt={`Your screenshot: ${s.caption}`} className="h-24 rounded border border-slate-200 object-cover dark:border-slate-700" /></a>
          <button type="button" className="absolute right-1 top-1 rounded bg-white/90 px-1 text-xs text-red-700 dark:bg-slate-900/90" onClick={() => void remove(s.id)} aria-label={`Delete screenshot ${s.caption}`}>✕</button>
        </figure>
      ))}
    </div>
  ) : null

  return (
    <section className="card space-y-4 p-4 text-sm" aria-labelledby="handson-h" onPaste={onPaste}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 id="handson-h" className="text-base font-semibold">Hands-on in Azure: {lab.title}</h2>
        <Badge tone="muted">{lab.minutes} min</Badge>
        <Badge tone={COST_TONE[lab.costLevel]}>{COST_LABEL[lab.costLevel]}</Badge>
        <span className="ml-auto text-xs text-slate-500">{done.length} / {lab.steps.length} steps done</span>
      </header>
      <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        You do this in your own Azure account (portal.azure.com). This app never creates anything in Azure. Cost: {lab.cost}
      </p>

      {lab.before.length > 0 && (
        <div><h3 className="font-semibold">Before you start</h3><ul className="ml-5 list-disc">{lab.before.map((b) => <li key={b}>{b}</li>)}</ul></div>
      )}

      <ol className="space-y-2">
        {lab.steps.map((s, i) => {
          const n = i + 1
          const isDone = done.includes(n)
          return (
            <li key={i} className={`rounded-lg border p-3 ${active === n ? 'border-sky-400' : 'border-slate-200 dark:border-slate-700'} ${isDone ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={isDone} onChange={() => toggle(n)} aria-label={`Step ${n} done`} />
                <div className="min-w-0 flex-1">
                  <p><span className="font-semibold">Step {n}.</span> {s.do}</p>
                  {s.code && <pre className="code mt-1 overflow-x-auto text-xs">{s.code}</pre>}
                  {s.see && <p className="mt-1 text-slate-600 dark:text-slate-300"><span className="font-medium text-emerald-700 dark:text-emerald-400">You should see:</span> {s.see}</p>}
                  {s.tip && <p className="mt-1 text-xs text-slate-500">Tip: {s.tip}</p>}
                  <Shots step={n} />
                </div>
                {online && (
                  <label className={`btn-ghost cursor-pointer whitespace-nowrap text-xs ${active === n ? 'ring-1 ring-sky-400' : ''}`} onClick={() => setActive(n)} title="Choose an image, or click here and then paste (Ctrl+V)">
                    + Screenshot
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void save(f, n); e.target.value = '' }} />
                  </label>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
      {online && <p className="text-xs text-slate-500">Screenshots: click "+ Screenshot" on a step to choose an image, or click it and press Ctrl+V to paste one. They are saved on this computer only.</p>}
      {online === false && <p className="text-xs text-slate-500">Start the local backend to save screenshots.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <div><h3 className="font-semibold">Check it worked</h3><ul className="ml-5 list-disc">{lab.check.map((c) => <li key={c}>{c}</li>)}</ul></div>
        <div className="rounded-lg border border-red-200 p-2 dark:border-red-900"><h3 className="font-semibold text-red-800 dark:text-red-300">Clean up (don't skip)</h3><ul className="ml-5 list-disc">{lab.cleanup.map((c) => <li key={c}>{c}</li>)}</ul></div>
      </div>
      <div>
        <h3 className="font-semibold">See the real portal screens</h3>
        <p className="text-xs text-slate-500">Microsoft's own step-by-step pages, with up-to-date screenshots of the Azure portal:</p>
        <ul className="ml-5 list-disc">{lab.screens.map((d) => <li key={d.url}><a className="text-sky-700 underline dark:text-sky-400" href={d.url} target="_blank" rel="noreferrer">{d.title}</a></li>)}</ul>
      </div>
    </section>
  )
}
