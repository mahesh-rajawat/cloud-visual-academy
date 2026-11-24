import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { findLesson } from '../services/curriculum'
import ExamGuide from './ExamGuide'

describe('Exam-day guide', () => {
  it('links every cheat-sheet topic to a real AZ-104 lesson', () => {
    render(<MemoryRouter><ExamGuide /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'AZ-104 exam-day guide' })).toBeInTheDocument()
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '').filter((h) => h.startsWith('/lesson/'))
    expect(links.length).toBe(7)
    links.forEach((h) => expect(findLesson(h.replace('/lesson/', ''))?.exam).toBe('az-104'))
  })
})
