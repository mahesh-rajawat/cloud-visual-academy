import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Drives a step-based animation: play/pause, next/previous, restart and speed.
 * Steps are data, so the same timeline powers the SVG, the text transcript and tests.
 */
export function useStepper(stepCount: number, opts: { baseMs?: number; autoPlay?: boolean } = {}) {
  const baseMs = opts.baseMs ?? 1400
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(!!opts.autoPlay)
  const [speed, setSpeed] = useState(1)
  const timer = useRef<number | undefined>(undefined)

  const last = Math.max(0, stepCount - 1)

  useEffect(() => {
    if (step > last) setStep(last)
  }, [last, step])

  useEffect(() => {
    if (!playing) return
    if (step >= last) {
      setPlaying(false)
      return
    }
    timer.current = window.setTimeout(() => setStep((s) => Math.min(s + 1, last)), baseMs / speed)
    return () => window.clearTimeout(timer.current)
  }, [playing, step, last, baseMs, speed])

  const next = useCallback(() => setStep((s) => Math.min(s + 1, last)), [last])
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), [])
  const restart = useCallback(() => {
    setStep(0)
    setPlaying(false)
  }, [])
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && step >= last) setStep(0)
      return !p
    })
  }, [step, last])
  const play = useCallback(() => {
    setStep(0)
    setPlaying(true)
  }, [])

  return { step, setStep, playing, toggle, play, next, prev, restart, speed, setSpeed, last, atEnd: step >= last }
}

export type Stepper = ReturnType<typeof useStepper>

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const fn = () => setReduced(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return reduced
}
