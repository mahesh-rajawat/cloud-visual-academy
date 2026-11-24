import type { Question } from './types'

export type Answer = string[] | Record<string, string>

/** Deterministic PRNG so a mock exam can be reproduced from its seed. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], seed: number): T[] {
  const rnd = mulberry32(seed)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Options in the order a learner sees them. Single and multiple choice options are shuffled with a
 * seed from the question id, so the right answer is not always in the same place (stable between visits).
 */
export function displayOptions(q: Question): Question['options'] {
  return q.answerMode === 'single' || q.answerMode === 'multiple' ? shuffle(q.options, hashSeed(q.id)) : q.options
}

export function isCorrect(q: Question, answer: Answer | undefined): boolean {
  if (!answer) return false
  if (q.answerMode === 'matching') {
    const a = answer as Record<string, string>
    return (q.pairs ?? []).every((p) => a[p.left] === p.answer)
  }
  const a = answer as string[]
  if (q.answerMode === 'ordering') return a.length === q.correct.length && a.every((id, i) => id === q.correct[i])
  return a.length === q.correct.length && [...a].sort().join() === [...q.correct].sort().join()
}

/**
 * Adaptive selection: prefer questions the learner got wrong or never answered, from weak
 * objectives, at a difficulty near their current level. Never returns duplicates.
 */
export function selectAdaptive(
  pool: Question[],
  opts: { count: number; seed: number; weakObjectives: Set<string>; wrongQuestions: Set<string>; seenQuestions: Set<string>; targetDifficulty: number },
): Question[] {
  const rnd = mulberry32(opts.seed)
  const scored = pool.map((q) => {
    let s = rnd() * 0.5
    if (opts.wrongQuestions.has(q.id)) s += 3
    if (!opts.seenQuestions.has(q.id)) s += 2
    if (opts.weakObjectives.has(q.objectiveId)) s += 2
    s -= Math.abs(q.difficulty - opts.targetDifficulty) * 0.75
    return { q, s }
  })
  return scored.sort((a, b) => b.s - a.s).slice(0, opts.count).map((x) => x.q)
}

export function nextDifficulty(current: number, lastCorrect: boolean): number {
  return Math.min(3, Math.max(1, current + (lastCorrect ? 0.5 : -0.5)))
}

export interface DomainScore {
  domainId: string
  correct: number
  total: number
}

export function breakdownByObjective(qs: Question[], answers: Record<string, Answer>): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {}
  for (const q of qs) {
    const cur = out[q.objectiveId] ?? [0, 0]
    out[q.objectiveId] = [cur[0] + (isCorrect(q, answers[q.id]) ? 1 : 0), cur[1] + 1]
  }
  return out
}
