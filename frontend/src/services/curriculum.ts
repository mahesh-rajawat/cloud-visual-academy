import type { AnimationMeta, CoverageReport, ExamSlug, Lesson, Objective, Question, Registry } from './types'
import az900 from '@curriculum/az-900/objectives.json'
import az104 from '@curriculum/az-104/objectives.json'
import ai901 from '@curriculum/ai-901/objectives.json'
import clf from '@curriculum/aws-clf-c02/objectives.json'
import animationsJson from '@curriculum/animations.json'
import coverageJson from '@curriculum/coverage-report.json'
import sprintJson from '@curriculum/az-104/sprint-plan.json'

export const EXAMS: ExamSlug[] = ['az-104', 'az-900', 'ai-901', 'aws-clf-c02']
export const RECOMMENDED_SEQUENCE: ExamSlug[] = ['az-900', 'az-104', 'ai-901', 'aws-clf-c02']

export const registries: Record<ExamSlug, Registry> = {
  'az-900': az900 as Registry,
  'az-104': az104 as Registry,
  'ai-901': ai901 as Registry,
  'aws-clf-c02': clf as Registry,
}

export const EXAM_LABEL: Record<ExamSlug, string> = {
  'az-900': 'Azure Fundamentals',
  'az-104': 'Azure Administrator',
  'ai-901': 'Azure AI Fundamentals',
  'aws-clf-c02': 'AWS Cloud Practitioner',
}

const lessonModules = import.meta.glob<Lesson>('../../../curriculum/*/lessons/*.json', { eager: true, import: 'default' })
const questionModules = import.meta.glob<Question[]>('../../../curriculum/*/questions.json', { eager: true, import: 'default' })

export const lessons: Lesson[] = Object.values(lessonModules)
export const questions: Question[] = Object.values(questionModules).flat()
export const animations = animationsJson as AnimationMeta[]
export const coverage = coverageJson as unknown as CoverageReport
export const sprintPlan = sprintJson

export function examOf(objectiveId: string): ExamSlug | undefined {
  return EXAMS.find((e) => objectiveId.startsWith(registries[e].examCode.replace('-', '')))
}

export function allObjectives(exam: ExamSlug): Objective[] {
  return registries[exam].domains.flatMap((d) => d.skills.flatMap((s) => s.objectives)).filter((o) => o.status === 'active')
}

const objectiveIndex = new Map<string, { objective: Objective; exam: ExamSlug; skill: string; domain: string }>()
for (const exam of EXAMS) {
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
export function baseMinutes(o: Objective): number {
  return o.handsOn ? sprintPlan.objectiveMinutes.handsOn : sprintPlan.objectiveMinutes.conceptual
}

export function estimatedHours(exam: ExamSlug): number {
  return Math.round(allObjectives(exam).reduce((s, o) => s + baseMinutes(o), 0) / 60)
}
