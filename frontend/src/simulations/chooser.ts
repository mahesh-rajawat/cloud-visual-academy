/**
 * "Choose the right option" scenario factory. The learner picks a requirement and an answer; the
 * evaluation explains why the answer fits or not. Used for conceptual objectives (AZ-900, CLF-C02,
 * AI-901) where the skill being tested is selecting the right model, service or tool.
 */
import { chain, type Scenario, type Stage } from './scenario'

export interface ChooserCase {
  value: string
  label: string
  answer: string
  why: string
}

export function chooser(cfg: {
  id: string
  title: string
  description: string
  requirementLabel: string
  answerLabel: string
  cases: ChooserCase[]
  answers: string[]
  /** Short description of each answer, shown when it is chosen. */
  answerNotes: Record<string, string>
  stageLabels?: [string, string, string]
}): Scenario {
  const [a, b, c] = cfg.stageLabels ?? ['Requirement', 'Your choice', 'Fit check']
  const stages: Stage[] = [
    { id: 'req', label: a, kind: 'user' },
    { id: 'choice', label: b, kind: 'service' },
    { id: 'fit', label: c, kind: 'security' },
  ]
  const first = cfg.cases[0]!
  return {
    id: cfg.id,
    kind: 'choice',
    title: cfg.title,
    description: cfg.description,
    stages,
    controls: [
      { type: 'select', key: 'req', label: cfg.requirementLabel, options: cfg.cases.map((x) => ({ value: x.value, label: x.label })) },
      { type: 'select', key: 'choice', label: cfg.answerLabel, options: cfg.answers.map((x) => ({ value: x, label: x })) },
    ],
    initial: { req: first.value, choice: cfg.answers.find((x) => x !== first.answer) ?? cfg.answers[0]! },
    presets: cfg.cases.slice(0, 3).map((x) => ({ label: `Show the answer for: ${x.label}`, values: { req: x.value, choice: x.answer } })),
    evaluate: (s) => {
      const k = cfg.cases.find((x) => x.value === s.req) ?? first
      const choice = String(s.choice)
      const ok = choice === k.answer
      const st = chain(stages, [
        [true, k.label],
        [true, cfg.answerNotes[choice] ?? choice],
        [ok, ok ? k.why : `Not the best fit. ${k.answer} is: ${k.why}`],
      ])
      return {
        stages: st,
        outcome: { ok, title: ok ? 'GOOD FIT' : 'BETTER OPTION EXISTS', detail: ok ? k.why : `Best fit: ${k.answer}.` },
        checks: [ok ? `${cfg.id}-correct` : `${cfg.id}-wrong`],
      }
    },
  }
}
