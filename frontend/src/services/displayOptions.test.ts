import { describe, expect, it } from 'vitest'
import { EXAMS, questions } from './curriculum'
import { displayOptions } from './exam'

describe('displayOptions', () => {
  it('keeps every option and is stable for the same question', () => {
    const q = questions.find((x) => x.answerMode === 'single')!
    const a = displayOptions(q)
    expect(a.map((o) => o.id).sort()).toEqual(q.options.map((o) => o.id).sort())
    expect(displayOptions(q)).toEqual(a)
  })

  it.each(EXAMS)('%s: the correct answer is not usually in the first position', (exam) => {
    const singles = questions.filter((q) => q.exam === exam && q.answerMode === 'single')
    const first = singles.filter((q) => q.correct.includes(displayOptions(q)[0]!.id)).length
    expect(first / singles.length).toBeLessThan(0.4)
  })

  it('leaves ordering questions in authored order (they shuffle themselves)', () => {
    const q = questions.find((x) => x.answerMode === 'ordering')!
    expect(displayOptions(q)).toBe(q.options)
  })
})

describe('question bank quality', () => {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2))
  const jaccard = (a: Set<string>, b: Set<string>) => {
    let inter = 0
    a.forEach((w) => { if (b.has(w)) inter++ })
    return inter / (a.size + b.size - inter || 1)
  }
  it.each(EXAMS)('%s has no near-duplicate questions within an objective', (exam) => {
    const byObj = new Map<string, typeof questions>()
    questions.filter((q) => q.exam === exam).forEach((q) => byObj.set(q.objectiveId, [...(byObj.get(q.objectiveId) ?? []), q]))
    const dups: string[] = []
    byObj.forEach((qs) => qs.forEach((a, i) => qs.slice(i + 1).forEach((b) => {
      const answer = (q: typeof a) => words(q.options.filter((o) => q.correct.includes(o.id)).map((o) => o.text).join(' '))
      if (jaccard(words(a.stem), words(b.stem)) > 0.75 && jaccard(answer(a), answer(b)) > 0.75) dups.push(`${a.id} ~ ${b.id}`)
    })))
    expect(dups).toEqual([])
  })
})
