import type { ExamSlug } from './types'

export interface MasteryInfo {
  attempts: number
  mastery: number | null
  status: 'not-assessed' | 'insufficient-evidence' | 'weak' | 'proficient'
  repeatedMistakes: number
  confidentWrong: number
  lastAttemptAt: string
}

export interface LessonProgress {
  exam: ExamSlug
  lesson_id: string
  objective_ids: string[]
  seconds_spent: number
  completed: boolean
  lab_passed: boolean
  last_studied_at: string
}

export interface ExamSession {
  id: number
  exam: ExamSlug
  kind: 'mock' | 'domain' | 'topic' | 'diagnostic' | 'weak' | 'review'
  score: number
  total: number
  seconds: number
  breakdown: Record<string, [number, number]>
  created_at: string
}

export interface Review {
  exam: ExamSlug
  objective_id: string
  stage: number
  due_at: string
  lapses: number
  reason: string
}

export interface Bookmark {
  id: number
  kind: 'lesson' | 'question' | 'animation'
  ref: string
  exam: ExamSlug
  title: string
  created_at: string
}

export interface Settings {
  exam_dates: Partial<Record<ExamSlug, string | null>>
  sprint_start: string | null
  /** Plan start dates for exams other than AZ-104 (AZ-104 uses sprint_start). */
  sprint_starts?: Record<string, string | null>
  weekday_hours: number
  weekend_hours: number
  mode: 'sprint' | 'complete'
  depth: 'foundation' | 'engineer'
  theme: 'dark' | 'light' | 'system'
  reduced_motion: boolean
}

export interface Screenshot {
  id: number
  lesson_id: string
  step: number | null
  caption: string
  mime: string
  created_at: string
}

export class ApiError extends Error {}

// The GitHub Pages build has no backend, so lessons are read-only there.
export const STATIC_SITE = import.meta.env.VITE_STATIC === '1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (STATIC_SITE) throw new ApiError('Read-only online copy: progress and screenshots are saved only when you run the app on your computer.')
  let res: Response
  try {
    res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new ApiError('The local progress server is not reachable. Start the backend to save progress.')
  }
  if (!res.ok) throw new ApiError(`${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

const json = (body: unknown) => ({ body: JSON.stringify(body) })

export const api = {
  health: () => request<{ status: string }>('/health'),
  lessonVisit: (body: { exam: ExamSlug; lesson_id: string; objective_ids: string[]; seconds_spent: number; completed?: boolean; lab_passed?: boolean }) =>
    request<LessonProgress>('/lessons/visit', { method: 'POST', ...json(body) }),
  lessons: (exam?: ExamSlug) => request<LessonProgress[]>(`/lessons${exam ? `?exam=${exam}` : ''}`),
  attempt: (body: { exam: ExamSlug; question_id: string; objective_id: string; correct: boolean; confidence: number; seconds: number; mode: string }) =>
    request<{ ok: boolean }>('/attempts', { method: 'POST', ...json(body) }),
  mastery: (exam: ExamSlug) => request<Record<string, MasteryInfo>>(`/mastery/${exam}`),
  mistakes: (exam: ExamSlug) => request<Array<{ questionId: string; objectiveId: string; timesWrong: number }>>(`/attempts/mistakes?exam=${exam}`),
  dueReviews: () => request<Review[]>('/reviews/due'),
  upcomingReviews: (days = 7) => request<Review[]>(`/reviews/upcoming?days=${days}`),
  saveSession: (body: Omit<ExamSession, 'id' | 'created_at'>) => request<ExamSession>('/exam-sessions', { method: 'POST', ...json(body) }),
  sessions: (exam?: ExamSlug) => request<ExamSession[]>(`/exam-sessions${exam ? `?exam=${exam}` : ''}`),
  bookmarks: () => request<Bookmark[]>('/bookmarks'),
  addBookmark: (b: Omit<Bookmark, 'id' | 'created_at'>) => request<Bookmark>('/bookmarks', { method: 'POST', ...json(b) }),
  removeBookmark: (kind: string, ref: string) => request<{ ok: boolean }>(`/bookmarks/${kind}/${encodeURIComponent(ref)}`, { method: 'DELETE' }),
  screenshots: (lessonId: string) => request<Screenshot[]>(`/screenshots?lesson_id=${encodeURIComponent(lessonId)}`),
  addScreenshot: (b: { lesson_id: string; step: number | null; caption: string; data_url: string }) => request<Screenshot>('/screenshots', { method: 'POST', ...json(b) }),
  removeScreenshot: (id: number) => request<{ ok: boolean }>(`/screenshots/${id}`, { method: 'DELETE' }),
  screenshotUrl: (id: number) => `/api/screenshots/${id}/image`,
  settings: () => request<Settings>('/settings'),
  saveSettings: (s: Settings) => request<Settings>('/settings', { method: 'PUT', ...json(s) }),
  resetProgress: () => request<{ ok: boolean }>('/progress?confirm=RESET', { method: 'DELETE' }),
}
