import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProvider } from '../services/AppContext'
import { lessons } from '../services/curriculum'
import LessonPage from './Lesson'

describe('Lesson page views', () => {
  Element.prototype.scrollIntoView = () => undefined
  window.scrollTo = () => undefined
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  it('keeps the walkthrough step after switching to the full lesson and back', () => {
    const lesson = lessons.find((l) => l.walkthrough && l.walkthrough.steps.length > 2)!
    localStorage.setItem('cva-lesson-view', 'lite')
    render(<MemoryRouter initialEntries={[`/lesson/${lesson.id}`]}><AppProvider><Routes><Route path="/lesson/:lessonId" element={<LessonPage />} /></Routes></AppProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Step 3: `) }))
    expect(screen.getByText('Step 3 of ' + lesson.walkthrough!.steps.length)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Full lesson' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lite walkthrough' }))
    expect(screen.getByText('Step 3 of ' + lesson.walkthrough!.steps.length)).toBeVisible()
  })
})
