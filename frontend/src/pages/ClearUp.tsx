import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { CLI_GRAMMAR, LOOKALIKES, NETWORK_STORY, READ_A_TEMPLATE, SAME_THING_THREE_WAYS, TROUBLESHOOT_ORDER, type LookalikeGroup } from '../services/clarity'
import { hashSeed } from '../services/exam'

type Tab = 'deploy' | 'network' | 'lookalikes' | 'drill'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'deploy', label: 'Templates and CLI, simply' },
  { id: 'network', label: 'Networking, simply' },
  { id: 'lookalikes', label: 'Look-alike services' },
  { id: 'drill', label: 'Mixed "which one?" drill' },
]

/** Deterministic shuffle so a drill round keeps its order while you answer. */
function shuffled<T>(items: T[], seed: number): T[] {
  const a = [...items]
  let s = seed || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function DrillCard({ group, index, seed }: { group: LookalikeGroup; index: number; seed: number }) {
  const drill = group.drills[index]!
  const [picked, setPicked] = useState<string | null>(null)
  const options = useMemo(() => shuffled(group.options.map((o) => o.name), seed), [group, seed])
  const right = picked === drill.answer
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="font-medium">{drill.scenario}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose a service">
        {options.map((name) => (
          <button key={name} type="button" disabled={picked !== null}
            className={`rounded-md border px-3 py-1.5 text-sm ${picked === null ? 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
              : name === drill.answer ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : name === picked ? 'border-rose-500 bg-rose-50 dark:bg-rose-950' : 'border-slate-200 opacity-60 dark:border-slate-700'}`}
            onClick={() => setPicked(name)}>{name}</button>
        ))}
      </div>
      {picked !== null && (
        <p className={`mt-2 text-sm ${right ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
          <strong>{right ? 'Correct.' : `Not quite: the answer is ${drill.answer}.`}</strong> {drill.why}
        </p>
      )}
    </div>
  )
}

function GroupCard({ group }: { group: LookalikeGroup }) {
  return (
    <section id={group.id} className="card space-y-3 p-4">
      <header>
        <p className="text-xs font-medium uppercase text-slate-500">{group.area}</p>
        <h2 className="text-lg font-semibold">{group.title}</h2>
      </header>
      <p className="rounded-md bg-sky-50 p-3 text-[15px] leading-relaxed dark:bg-sky-950"><strong>Remember: </strong>{group.rule}</p>
      {group.analogy && <p className="text-sm italic text-slate-600 dark:text-slate-300">Think of it like this: {group.analogy}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="text-left text-slate-500"><th className="p-2">Service</th><th className="p-2">What it is</th><th className="p-2">Choose it when</th><th className="p-2">Clue words in a question</th></tr></thead>
          <tbody>
            {group.options.map((o) => (
              <tr key={o.name} className="border-t border-slate-200 align-top dark:border-slate-800">
                <td className="p-2 font-medium">{o.name}</td>
                <td className="p-2">{o.what}</td>
                <td className="p-2">{o.pick}</td>
                <td className="p-2"><div className="flex flex-wrap gap-1">{o.clues.map((c) => <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{c}</span>)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Try it: which one?</h3>
        {group.drills.map((_, i) => <DrillCard key={i} group={group} index={i} seed={hashSeed(`${group.id}-${i}`)} />)}
      </div>
      <Link className="text-sm text-sky-700 underline dark:text-sky-400" to={`/lesson/${group.lesson}`}>Open the full lesson →</Link>
    </section>
  )
}

function DeployTab() {
  const [view, setView] = useState<'bicep' | 'arm' | 'cli'>('bicep')
  return (
    <div className="space-y-4">
      <section className="card space-y-2 p-4 text-[15px] leading-relaxed">
        <h2 className="text-lg font-semibold">The idea in one minute</h2>
        <p>There are two ways to build things in Azure:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Step by step (imperative):</strong> you run commands — <code>az vm create</code>, <code>New-AzVM</code>, or clicks in the portal. Good for one-off jobs.</li>
          <li><strong>Describe the result (declarative):</strong> you write a template (ARM JSON or Bicep) that lists what should exist. Azure Resource Manager compares it with what is there and creates or updates the difference. Run it again and nothing changes — that is what makes templates repeatable.</li>
        </ul>
        <p>Bicep is simply an easier way to write an ARM template. When you deploy a Bicep file, it is converted to ARM JSON first. Same engine, same result.</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-semibold">The same storage account, three ways</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">The numbers (1)–(4) mark the same part in each version: (1) parameters, (2) variables, (3) the resource, (4) outputs.</p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Format">
          {(['bicep', 'arm', 'cli'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} type="button" onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm ${view === v ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{v === 'arm' ? 'ARM template (JSON)' : v === 'bicep' ? 'Bicep' : 'Azure CLI'}</button>
          ))}
        </div>
        <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{SAME_THING_THREE_WAYS[view]}</code></pre>
      </section>

      <section className="card space-y-2 p-4 text-[15px] leading-relaxed">
        <h2 className="text-lg font-semibold">How to read any template in 4 passes</h2>
        <ol className="ml-5 list-decimal space-y-2">
          {READ_A_TEMPLATE.map((s) => <li key={s.step}><strong>{s.step}.</strong> {s.detail}</li>)}
        </ol>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-lg font-semibold">Reading CLI commands</h2>
        <p className="text-[15px]">Every Azure CLI command reads like a sentence: <code>az</code> + <em>service</em> + <em>thing</em> + <em>action</em> + <code>--options</code>. Short options: <code>-g</code> resource group, <code>-n</code> name, <code>-l</code> location, <code>-f</code> file, <code>-p</code> parameters.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody>{CLI_GRAMMAR.map((c) => <tr key={c.pattern} className="border-t border-slate-200 align-top dark:border-slate-800"><td className="p-2"><code className="text-xs">{c.pattern}</code></td><td className="p-2">{c.meaning}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {LOOKALIKES.filter((g) => g.area === 'Deploying').map((g) => <GroupCard key={g.id} group={g} />)}
    </div>
  )
}

function NetworkTab() {
  return (
    <div className="space-y-4">
      <section className="card space-y-2 p-4 text-[15px] leading-relaxed">
        <h2 className="text-lg font-semibold">One picture for all of networking</h2>
        <p>Imagine your Azure network as a private housing estate. Every networking topic is one part of that picture:</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <tbody>{NETWORK_STORY.map((n) => <tr key={n.term} className="border-t border-slate-200 align-top dark:border-slate-800"><td className="w-56 p-2 font-medium">{n.term}</td><td className="p-2">{n.plain}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-2 p-4 text-[15px] leading-relaxed">
        <h2 className="text-lg font-semibold">"It can't connect" — check in this order</h2>
        <ol className="ml-5 list-decimal space-y-2">
          {TROUBLESHOOT_ORDER.map((t) => <li key={t.check}><strong>{t.check}</strong> <span className="text-slate-600 dark:text-slate-300">→ {t.tool}</span></li>)}
        </ol>
        <p className="text-sm text-slate-600 dark:text-slate-300">Most exam troubleshooting questions are answered at step 2 (routes) or step 3 (NSG rules and their priority).</p>
      </section>

      {LOOKALIKES.filter((g) => g.area === 'Networking').map((g) => <GroupCard key={g.id} group={g} />)}
    </div>
  )
}

function LookalikesTab() {
  const areas = [...new Set(LOOKALIKES.map((g) => g.area))]
  const [area, setArea] = useState<string>('All')
  const groups = LOOKALIKES.filter((g) => area === 'All' || g.area === area)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by area">
        {['All', ...areas].map((a) => (
          <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(a)}
            className={`rounded-full px-3 py-1 text-sm ${area === a ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{a}</button>
        ))}
      </div>
      <nav className="card p-3 text-sm" aria-label="Groups">
        <ul className="grid gap-1 sm:grid-cols-2">{groups.map((g) => <li key={g.id}><a className="text-sky-700 underline dark:text-sky-400" href={`#${g.id}`}>{g.title}</a></li>)}</ul>
      </nav>
      {groups.map((g) => <GroupCard key={g.id} group={g} />)}
    </div>
  )
}

function MixedDrill() {
  const [round, setRound] = useState(1)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const items = useMemo(() => shuffled(LOOKALIKES.flatMap((g) => g.drills.map((d) => ({ g, d }))), hashSeed(`round-${round}`)).slice(0, 12), [round])
  const done = Object.keys(answers).length
  const score = items.filter((it, i) => answers[i] === it.d.answer).length
  return (
    <div className="space-y-3">
      <p className="text-[15px]">12 scenarios from all areas, mixed together — like the real exam. Pick the service that fits. Clue words are your friend: underline them in your head.</p>
      {items.map((it, i) => {
        const picked = answers[i]
        const opts = shuffled(it.g.options.map((o) => o.name), hashSeed(`${round}-${i}`))
        return (
          <div key={`${round}-${i}`} className="card space-y-2 p-3">
            <p className="text-xs text-slate-500">{i + 1}. {it.g.area}</p>
            <p className="font-medium">{it.d.scenario}</p>
            <div className="flex flex-wrap gap-2">
              {opts.map((name) => (
                <button key={name} type="button" disabled={picked !== undefined} onClick={() => setAnswers((a) => ({ ...a, [i]: name }))}
                  className={`rounded-md border px-3 py-1.5 text-sm ${picked === undefined ? 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
                    : name === it.d.answer ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : name === picked ? 'border-rose-500 bg-rose-50 dark:bg-rose-950' : 'border-slate-200 opacity-60 dark:border-slate-700'}`}>{name}</button>
              ))}
            </div>
            {picked !== undefined && <p className="text-sm"><strong>{picked === it.d.answer ? 'Correct.' : `Answer: ${it.d.answer}.`}</strong> {it.d.why} <Link className="text-sky-700 underline dark:text-sky-400" to={`/clear-up?tab=lookalikes#${it.g.id}`}>Compare the options</Link></p>}
          </div>
        )
      })}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <span className="font-medium">Score: {score} / {done} answered of {items.length}</span>
        <button type="button" className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white" onClick={() => { setAnswers({}); setRound((r) => r + 1) }}>New round</button>
      </div>
    </div>
  )
}

export default function ClearUp() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'deploy') as Tab
  const { hash } = useLocation()
  // Links from lessons point at one group (#id); scroll to it once the tab has rendered.
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }) }, [hash, tab])
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Clear the confusion</h1>
        <p className="text-sm text-slate-500">Deploying with templates and CLI, networking, and the services that look alike — in plain words, with quick "which one?" practice. Each section links to its full lesson.</p>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setParams({ tab: t.id })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-sky-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'deploy' && <DeployTab />}
      {tab === 'network' && <NetworkTab />}
      {tab === 'lookalikes' && <LookalikesTab />}
      {tab === 'drill' && <MixedDrill />}
    </div>
  )
}
