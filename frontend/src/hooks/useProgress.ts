import { api, type ExamSession, type LessonProgress, type MasteryInfo, type Review } from '../services/api'
import { useApp } from '../services/AppContext'
import { EXAMS, allObjectives, registries } from '../services/curriculum'
import type { ExamSlug } from '../services/types'
import { useAsync } from './useAsync'

export interface ProgressData {
  lessons: LessonProgress[]
  mastery: Record<ExamSlug, Record<string, MasteryInfo>>
  sessions: ExamSession[]
  due: Review[]
  upcoming: Review[]
}

const EMPTY: ProgressData = {
  lessons: [],
  mastery: { 'az-900': {}, 'az-104': {}, 'ai-901': {}, 'aws-clf-c02': {} },
  sessions: [],
  due: [],
  upcoming: [],
}

/** Loads all learner history. Returns empty data (never fabricated numbers) when offline. */
export function useProgress() {
  const { online, progressVersion } = useApp()
  const res = useAsync<ProgressData>(async () => {
    if (!online) return EMPTY
    const [lessons, sessions, due, upcoming, ...m] = await Promise.all([
      api.lessons(), api.sessions(), api.dueReviews(), api.upcomingReviews(7), ...EXAMS.map((e) => api.mastery(e)),
    ])
    const mastery = Object.fromEntries(EXAMS.map((e, i) => [e, m[i] ?? {}])) as ProgressData['mastery']
    return { lessons, sessions, due, upcoming, mastery }
  }, [online, progressVersion])
  return { ...res, data: res.data ?? EMPTY }
}

export function studiedObjectives(p: ProgressData, exam: ExamSlug): Set<string> {
  return new Set(p.lessons.filter((l) => l.exam === exam && l.completed).flatMap((l) => l.objective_ids))
}

/** Mean mastery over objectives that have enough evidence; null if none do. */
export function examMastery(p: ProgressData, exam: ExamSlug): { value: number | null; assessed: number } {
  const vals = Object.values(p.mastery[exam]).map((m) => m.mastery).filter((v): v is number => v !== null)
  return { value: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, assessed: vals.length }
}

export function domainMastery(p: ProgressData, exam: ExamSlug) {
  return registries[exam].domains.map((d) => {
    const ids = d.skills.flatMap((s) => s.objectives.map((o) => o.id))
    const vals = ids.map((id) => p.mastery[exam][id]?.mastery).filter((v): v is number => v !== null && v !== undefined)
    return { id: d.id, name: d.name, weight: d.weight, mastery: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, assessed: vals.length, total: ids.length }
  })
}

export function weakObjectives(p: ProgressData, exam?: ExamSlug): Array<{ exam: ExamSlug; id: string; info: MasteryInfo }> {
  return EXAMS.filter((e) => !exam || e === exam).flatMap((e) =>
    Object.entries(p.mastery[e]).filter(([, m]) => m.status === 'weak').map(([id, info]) => ({ exam: e, id, info })),
  )
}

export function overallStudied(p: ProgressData) {
  const total = EXAMS.reduce((s, e) => s + allObjectives(e).length, 0)
  const studied = EXAMS.reduce((s, e) => s + studiedObjectives(p, e).size, 0)
  return { total, studied }
}
