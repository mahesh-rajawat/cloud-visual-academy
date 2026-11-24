import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lessonsFor } from '../services/curriculum'
import { HandsOnLab } from './HandsOnLab'

const az104 = lessonsFor('az-104')

describe('AZ-104 hands-on labs (content)', () => {
  it('every AZ-104 lesson has a real-portal lab', () => {
    expect(az104.filter((l) => !l.handsOn).map((l) => l.id)).toEqual([])
  })

  it.each(az104.map((l) => [l.id, l] as const))('%s lab is complete and links to Microsoft Learn', (_id, lesson) => {
    const lab = lesson.handsOn!
    expect(lab.steps.length).toBeGreaterThanOrEqual(3)
    expect(lab.check.length).toBeGreaterThan(0)
    expect(lab.cleanup.length).toBeGreaterThan(0)
    expect(lab.cost.length).toBeGreaterThan(0)
    lab.screens.forEach((s) => expect(s.url).toMatch(/^https:\/\/(learn\.microsoft\.com|portal\.azure\.com)\//))
  })
})

describe('HandsOnLab component', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })
  const lesson = az104.find((l) => l.id === 'az104-rbac')!

  it('ticks steps off and remembers them per lesson', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }))
    const { unmount } = render(<HandsOnLab lessonId={lesson.id} lab={lesson.handsOn!} online={true} />)
    expect(screen.getByText(`0 / ${lesson.handsOn!.steps.length} steps done`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Step 1 done' }))
    expect(screen.getByText(`1 / ${lesson.handsOn!.steps.length} steps done`)).toBeInTheDocument()
    unmount()
    render(<HandsOnLab lessonId={lesson.id} lab={lesson.handsOn!} online={true} />)
    expect(screen.getByRole('checkbox', { name: 'Step 1 done' })).toBeChecked()
  })

  it('shows saved screenshots for their step and lets you delete them', async () => {
    const shots = [{ id: 7, lesson_id: lesson.id, step: 2, caption: 'Step 2', mime: 'image/png', created_at: '2026-11-23T10:00:00' }]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (init?.method === 'DELETE') return new Response('{"ok":true}', { status: 200 })
      return new Response(JSON.stringify(String(url).includes('lesson_id') ? shots : []), { status: 200 })
    })
    render(<HandsOnLab lessonId={lesson.id} lab={lesson.handsOn!} online={true} />)
    const img = await screen.findByAltText('Your screenshot: Step 2')
    expect(img).toHaveAttribute('src', '/api/screenshots/7/image')
    fireEvent.click(screen.getByRole('button', { name: 'Delete screenshot Step 2' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/screenshots/7', expect.objectContaining({ method: 'DELETE' })))
  })

  it('asks for screenshots once, even when the backend answers with an error', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }))
    render(<HandsOnLab lessonId={lesson.id} lab={lesson.handsOn!} online={true} />)
    await new Promise((r) => setTimeout(r, 200))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('explains that screenshots need the backend when it is offline', () => {
    render(<HandsOnLab lessonId={lesson.id} lab={lesson.handsOn!} online={false} />)
    expect(screen.getByText('Start the local backend to save screenshots.')).toBeInTheDocument()
    expect(screen.queryByText('+ Screenshot')).toBeNull()
  })
})
