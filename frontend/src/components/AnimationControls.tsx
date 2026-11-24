import { useEffect } from 'react'
import type { Stepper } from '../hooks/useStepper'

interface Props {
  stepper: Stepper
  stepLabels: string[]
  /** Keyboard shortcuts are scoped to this element so several animations can coexist. */
  regionLabel: string
}

export function AnimationControls({ stepper, stepLabels, regionLabel }: Props) {
  const { step, playing, toggle, next, prev, restart, speed, setSpeed, last } = stepper
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2 dark:border-slate-800" role="toolbar" aria-label={`${regionLabel} controls`}>
      <button type="button" className="btn-ghost" onClick={restart} aria-label="Restart">⟲ Restart</button>
      <button type="button" className="btn-ghost" onClick={prev} disabled={step === 0} aria-label="Previous step">◀ Prev</button>
      <button type="button" className="btn-primary min-w-20" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
      <button type="button" className="btn-ghost" onClick={next} disabled={step >= last} aria-label="Next step">Next ▶</button>
      <label className="ml-2 flex items-center gap-1 text-xs text-slate-500">
        Speed
        <select className="input py-0.5" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Animation speed">
          {[0.5, 1, 1.5, 2].map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
      <span className="ml-auto text-xs text-slate-500" aria-live="polite">
        Step {Math.min(step + 1, last + 1)} / {last + 1}: {stepLabels[step] ?? ''}
      </span>
    </div>
  )
}

/** Arrow keys / space when the animation region has focus. */
export function useStepperKeys(ref: React.RefObject<HTMLElement | null>, stepper: Stepper) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea,button')) return
      if (e.key === 'ArrowRight') { stepper.next(); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { stepper.prev(); e.preventDefault() }
      else if (e.key === ' ') { stepper.toggle(); e.preventDefault() }
      else if (e.key.toLowerCase() === 'r') stepper.restart()
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [ref, stepper])
}
