export type ExamSlug = 'az-900' | 'az-104' | 'az-305' | 'ai-901' | 'aws-clf-c02'

export interface Objective {
  id: string
  text: string
  fingerprint: string
  handsOn: boolean
  status: 'active' | 'retired'
  kind?: 'knowledge' | 'skill'
}

export interface Skill {
  id: string
  name: string
  objectives: Objective[]
}

export interface Domain {
  id: string
  name: string
  weight: string
  skills: Skill[]
}

export interface Registry {
  examCode: string
  examName: string
  vendor: 'Microsoft' | 'AWS'
  sourceUrl: string
  skillsMeasuredAsOf: string
  retrievedAt: string
  objectiveCount: number
  domains: Domain[]
  inScopeServices?: Record<string, string[]>
  revisionHistory?: Array<{ version: string; publicationDate: string }>
}

export interface DocLink {
  title: string
  url: string
}

export interface Lesson {
  id: string
  exam: ExamSlug
  title: string
  objectiveIds: string[]
  estimatedMinutes: number
  learningObjective: string
  prerequisites: Array<{ text: string; objectiveId?: string; lessonId?: string }>
  foundation: string[]
  engineer: string[]
  animation: { id: string; caption: string }
  diagram: {
    nodes: Array<{ id: string; label: string; x: number; y: number; kind?: string }>
    edges: Array<{ from: string; to: string; label?: string }>
  }
  example: { title: string; body: string[] }
  configuration: {
    prerequisites: string[]
    permissions: string[]
    limits: string[]
    portal: string[]
    cli: string
    powershell: string
    bicep?: string
    python?: string
  }
  lab: null | {
    type: 'A' | 'B' | 'C'
    simulationId?: string
    objective: string
    duration: number
    steps: string[]
    expected: string[]
    validation: Array<{ id: string; text: string }>
    failureScenarios: string[]
    cleanup: string[]
    cost: string
  }
  troubleshooting: Array<{ symptom: string; cause: string; fix: string }>
  comparisons: Array<{ service: string; difference: string }>
  misconceptions: Array<{ myth: string; reality: string }>
  architectureDecisions: string[]
  docs: DocLink[]
  verification: { status: 'ai-drafted' | 'self-reviewed' | 'human-verified'; reviewedOn: string; notes: string }
  walkthrough?: Walkthrough
  handsOn?: HandsOnLab
}

export interface WalkNode { id: string; label: string; sub?: string; x: number; y: number; kind: string }

/** Lite step-by-step view: each step lists the nodes and edges already on screen (computed by the content builder). */
export interface Walkthrough {
  subtitle: string
  learn: string[]
  nodes: WalkNode[]
  steps: Array<{
    kind: 'problem' | 'concept' | 'technique' | 'case' | 'recap'
    label: string
    title: string
    body: string[]
    callout?: { type: 'key' | 'tip' | 'warn'; text: string }
    show: string[]
    focus: string[]
    edges: Array<{ from: string; to: string; label?: string; fresh?: boolean }>
    learned: number[]
    stats?: Array<{ label: string; value: string }>
    recap?: string[]
  }>
}

export type AnswerMode = 'single' | 'multiple' | 'ordering' | 'matching'
export type QuestionType =
  | 'single'
  | 'multiple'
  | 'scenario'
  | 'configuration'
  | 'troubleshooting'
  | 'architecture'
  | 'command'
  | 'ordering'
  | 'matching'

export interface Question {
  id: string
  exam: ExamSlug
  objectiveId: string
  difficulty: 1 | 2 | 3
  type: QuestionType
  answerMode: AnswerMode
  stem: string
  code?: string
  options: Array<{ id: string; text: string; explanation: string }>
  /** single/multiple: correct option ids; ordering: ids in the correct order. */
  correct: string[]
  /** matching: each left item maps to an option id. */
  pairs?: Array<{ left: string; answer: string }>
  explanation: string
  docs: string[]
  diagnosticFor?: string[] // AZ-104 lesson ids this AZ-900 question gates
  diagnostic?: boolean // part of the short AZ-900 foundations diagnostic
}

export interface AnimationMeta {
  id: string
  title: string
  exam: ExamSlug
  objectiveIds: string[]
  fidelity: 'accurate-model' | 'simplified-illustration'
  testFile: string
  description: string
}

export interface CoverageEntry {
  objectiveId: string
  lesson: boolean
  animation: boolean
  assessment: boolean
  appliedAssessment: boolean
  lab: boolean | null
  docs: boolean
  verification: string | null
  complete: boolean
  missing: string[]
}

export interface CoverageReport {
  generatedAt: string
  exams: Record<
    string,
    {
      total: number
      complete: number
      withLesson: number
      withTestedAnimation: number
      withAssessment: number
      unverified: number
      entries: CoverageEntry[]
    }
  >
  errors: string[]
}

/** A real-portal exercise the learner does in their own Azure account, in plain-language steps. */
export interface HandsOnStep {
  do: string
  see?: string
  tip?: string
  /** Text to type or paste (commands, file contents). */
  code?: string
}

export interface HandsOnLab {
  title: string
  minutes: number
  /** free: no charge; low: cents if cleaned up the same day; watch: billed by the hour, delete straight after. */
  costLevel: 'free' | 'low' | 'watch'
  cost: string
  before: string[]
  steps: HandsOnStep[]
  check: string[]
  cleanup: string[]
  /** Official Microsoft Learn pages that show the real portal screens for these steps. */
  screens: Array<{ title: string; url: string }>
}
