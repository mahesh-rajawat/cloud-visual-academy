import type { AnimationMeta, CoverageReport, ExamSlug, Lesson, Objective, Question, Registry } from './types'
import az900 from '@curriculum/az-900/objectives.json'
import az104 from '@curriculum/az-104/objectives.json'
import ai901 from '@curriculum/ai-901/objectives.json'
import clf from '@curriculum/aws-clf-c02/objectives.json'
import az305 from '@curriculum/az-305/objectives.json'
import animationsJson from '@curriculum/animations.json'
import coverageJson from '@curriculum/coverage-report.json'

export const ALL_EXAMS: ExamSlug[] = ['az-104', 'az-305', 'az-900', 'ai-901', 'aws-clf-c02']

/**
 * Exams the app shows. Set VITE_EXAMS at build time to a comma-separated list (for example
 * "az-104,az-305") or "all". Default: AZ-104 only. Hidden exams keep their content in the repo.
 */
export function parseExams(value: string | undefined): ExamSlug[] {
  const v = (value ?? '').trim().toLowerCase()
  if (v === 'all') return [...ALL_EXAMS]
  const wanted = v.split(',').map((x) => x.trim()).filter(Boolean)
  const picked = ALL_EXAMS.filter((e) => wanted.includes(e))
  return picked.length ? picked : ['az-104']
}
export const EXAMS: ExamSlug[] = parseExams(import.meta.env.VITE_EXAMS)
export const examEnabled = (exam: ExamSlug) => EXAMS.includes(exam)
export const RECOMMENDED_SEQUENCE: ExamSlug[] = (['az-900', 'az-104', 'az-305', 'ai-901', 'aws-clf-c02'] as ExamSlug[]).filter(examEnabled)

export const registries: Record<ExamSlug, Registry> = {
  'az-900': az900 as Registry,
  'az-104': az104 as Registry,
  'ai-901': ai901 as Registry,
  'aws-clf-c02': clf as Registry,
  'az-305': az305 as Registry,
}

export const EXAM_LABEL: Record<ExamSlug, string> = {
  'az-900': 'Azure Fundamentals',
  'az-104': 'Azure Administrator',
  'ai-901': 'Azure AI Fundamentals',
  'aws-clf-c02': 'AWS Cloud Practitioner',
  'az-305': 'Azure Solutions Architect Expert',
}

const lessonModules = import.meta.glob<Lesson>('../../../curriculum/*/lessons/*.json', { eager: true, import: 'default' })
const questionModules = import.meta.glob<Question[]>('../../../curriculum/*/questions.json', { eager: true, import: 'default' })

/** Every lesson, including hidden exams' (used for refreshers of prerequisite topics). */
export const allLessons: Lesson[] = Object.values(lessonModules)
export const lessons: Lesson[] = allLessons.filter((l) => examEnabled(l.exam))
export const questions: Question[] = Object.values(questionModules).flat().filter((q) => examEnabled(q.exam))
export const animations = (animationsJson as AnimationMeta[]).filter((a) => examEnabled(a.exam as ExamSlug))
export const coverage = coverageJson as unknown as CoverageReport

export type SprintPlanData = {
  exam: string; weeks: number
  activityMinutes: Record<string, number>; objectiveMinutes: { handsOn: number; conceptual: number }
  struggleMultiplier: number; dailyRecallMinutes: number
  days: Array<{ day: number; title: string; skills: string[]; activities: string[] }>
}
const planModules = import.meta.glob<SprintPlanData>('../../../curriculum/*/sprint-plan.json', { eager: true, import: 'default' })
/** Study plans by exam (curriculum/<exam>/sprint-plan.json, built by scripts/build_sprint_plan.py). */
export const sprintPlans: Partial<Record<ExamSlug, SprintPlanData>> = Object.fromEntries(Object.values(planModules).map((p) => [p.exam, p]))
export const sprintPlan = sprintPlans['az-104']!
/** Enabled exams that have a study plan. */
export const PLAN_EXAMS: ExamSlug[] = EXAMS.filter((e) => sprintPlans[e])

export function examOf(objectiveId: string): ExamSlug | undefined {
  return ALL_EXAMS.find((e) => objectiveId.startsWith(registries[e].examCode.replace('-', '')))
}

export function allObjectives(exam: ExamSlug): Objective[] {
  return registries[exam].domains.flatMap((d) => d.skills.flatMap((s) => s.objectives)).filter((o) => o.status === 'active')
}

const objectiveIndex = new Map<string, { objective: Objective; exam: ExamSlug; skill: string; domain: string }>()
for (const exam of ALL_EXAMS) {
  for (const d of registries[exam].domains) {
    for (const s of d.skills) {
      for (const o of s.objectives) objectiveIndex.set(o.id, { objective: o, exam, skill: s.name, domain: d.name })
    }
  }
}

export function findObjective(id: string) {
  return objectiveIndex.get(id)
}

export function lessonsFor(exam: ExamSlug): Lesson[] {
  return lessons.filter((l) => l.exam === exam)
}

export function lessonForObjective(objectiveId: string): Lesson | undefined {
  return lessons.find((l) => l.objectiveIds.includes(objectiveId))
}

/** Lessons in the order their first objective appears in the official outline. */
export function lessonSequence(exam: ExamSlug): Lesson[] {
  const seen = new Set<string>()
  const out: Lesson[] = []
  for (const o of allObjectives(exam)) {
    const l = lessonForObjective(o.id)
    if (l && !seen.has(l.id)) { seen.add(l.id); out.push(l) }
  }
  return out
}

export function findLesson(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id)
}

export function questionsFor(exam: ExamSlug, objectiveIds?: string[]): Question[] {
  return questions.filter((q) => q.exam === exam && (!objectiveIds || objectiveIds.includes(q.objectiveId)))
}

export function domainOfObjective(exam: ExamSlug, objectiveId: string) {
  return registries[exam].domains.find((d) => d.skills.some((s) => s.objectives.some((o) => o.id === objectiveId)))
}

export function coverageFor(exam: ExamSlug) {
  return coverage.exams[exam]
}

/** Minutes the sprint planner budgets for one objective before adaptation. */
export function baseMinutes(o: Objective, exam: ExamSlug = 'az-104'): number {
  const p = sprintPlans[exam] ?? sprintPlan
  return o.handsOn ? p.objectiveMinutes.handsOn : p.objectiveMinutes.conceptual
}

export function estimatedHours(exam: ExamSlug): number {
  return Math.round(allObjectives(exam).reduce((s, o) => s + baseMinutes(o, exam), 0) / 60)
}

/**
 * A prerequisite from an exam that is hidden in this build (for example AZ-900 while only AZ-104 is shown):
 * returns the lesson that teaches it, so the page can show a short refresher instead of a dead link.
 */
export function hiddenPrerequisiteLesson(p: { objectiveId?: string; lessonId?: string }): Lesson | undefined {
  const l = p.lessonId ? allLessons.find((x) => x.id === p.lessonId) : p.objectiveId ? allLessons.find((x) => x.objectiveIds.includes(p.objectiveId!)) : undefined
  return l && !examEnabled(l.exam) ? l : undefined
}
