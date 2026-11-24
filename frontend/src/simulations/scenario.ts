/**
 * Data-driven scenario model used by the generic ScenarioLab component.
 * A scenario is a set of controls plus a pure `evaluate` function. The function returns, for each
 * stage of a pipeline, whether it passed, plus an outcome, optional metrics and time series, and lab
 * check ids. Keeping evaluate pure makes every scenario unit-testable and deterministic.
 */

export type ControlValue = string | number | boolean

export type Control =
  | { type: 'select'; key: string; label: string; options: Array<{ value: string; label: string }> }
  | { type: 'checkbox'; key: string; label: string }
  | { type: 'number'; key: string; label: string; min?: number; max?: number; step?: number }

export type StageKind = 'user' | 'compute' | 'network' | 'security' | 'storage' | 'identity' | 'service' | 'globe' | 'ai'

export interface Stage { id: string; label: string; kind: StageKind }

export interface StageResult { id: string; ok: boolean | null; detail: string }

export interface Series { label: string; points: number[]; color?: string; dashed?: boolean }

export interface Evaluation {
  stages: StageResult[]
  outcome: { ok: boolean; title: string; detail: string }
  checks: string[]
  metrics?: Array<{ label: string; value: string }>
  series?: { xLabel: string; yLabel: string; lines: Series[]; markers?: Array<{ x: number; label: string }> }
  notes?: string[]
}

export type State = Record<string, ControlValue>

export interface Scenario {
  id: string
  /** 'choice': pick the best option for a requirement. Shown as a practice card, without the pipeline animation. */
  kind?: 'flow' | 'choice'
  title: string
  description: string
  stages: Stage[]
  controls: Control[]
  initial: State
  presets?: Array<{ label: string; values: State }>
  evaluate: (s: State) => Evaluation
}

export interface ScenarioGroup {
  id: string
  fidelity: 'accurate-model' | 'simplified-illustration'
  fidelityNote: string
  scenarios: Scenario[]
}

// Helpers for writing evaluate functions concisely.
export const opt = (...values: string[]) => values.map((v) => ({ value: v, label: v }))

/** Builds stage results: stages after the first failure are not reached (ok = null). */
export function chain(stages: Stage[], checks: Array<[boolean, string]>): StageResult[] {
  let failed = false
  return stages.map((st, i) => {
    const c = checks[i]
    if (failed || !c) return { id: st.id, ok: null, detail: failed ? 'Not reached.' : '' }
    if (!c[0]) failed = true
    return { id: st.id, ok: c[0], detail: c[1] }
  })
}

export function allOk(r: StageResult[]): boolean {
  return r.every((x) => x.ok !== false)
}

export const str = (s: State, k: string) => String(s[k])
export const num = (s: State, k: string) => Number(s[k])
export const bool = (s: State, k: string) => Boolean(s[k])
