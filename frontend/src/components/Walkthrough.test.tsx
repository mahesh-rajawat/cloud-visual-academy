import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { lessonsFor } from '../services/curriculum'
import { nodeWidth, Walkthrough } from './Walkthrough'

const aws = lessonsFor('aws-clf-c02')
const az104 = lessonsFor('az-104')

describe('Lite walkthroughs (content)', () => {
  it('every CLF-C02 and AZ-104 lesson has one', () => {
    expect(aws.length).toBeGreaterThan(0)
    expect(az104.length).toBeGreaterThan(0)
    expect([...aws, ...az104].filter((l) => !l.walkthrough).map((l) => l.id)).toEqual([])
  })

  it.each([...aws, ...az104].map((l) => [l.id, l] as const))('%s is consistent', (_id, lesson) => {
    const w = lesson.walkthrough!
    const ids = new Set(w.nodes.map((n) => n.id))
    expect(w.steps[0]!.kind).toBe('problem')
    expect(w.steps.at(-1)!.kind).toBe('recap')
    expect(w.steps.at(-1)!.recap?.length).toBeGreaterThan(0)
    expect(w.steps.at(-1)!.learned).toEqual(w.learn.map((_, i) => i))
    w.steps.forEach((s, i) => {
      expect(s.body.length).toBeGreaterThan(0)
      s.show.forEach((n) => expect(ids.has(n)).toBe(true))
      s.focus.forEach((n) => expect(s.show).toContain(n))
      s.edges.forEach((e) => { expect(s.show).toContain(e.from); expect(s.show).toContain(e.to) })
      if (i > 0) expect(s.learned).toEqual(expect.arrayContaining(w.steps[i - 1]!.learned))
      // Visible nodes stay on the 800-wide canvas.
      w.nodes.filter((n) => s.show.includes(n.id)).forEach((n) => {
        expect(n.x - nodeWidth(n) / 2).toBeGreaterThanOrEqual(0)
        expect(n.x + nodeWidth(n) / 2).toBeLessThanOrEqual(800)
      })
    })
  })
})

describe('Walkthrough component', () => {
  const lesson = aws.find((l) => l.id === 'clf-shared-responsibility')!
  const w = lesson.walkthrough!

  it('steps forward and back with buttons and keys, ticking off what you learn', () => {
    render(<Walkthrough data={w} />)
    expect(screen.getByRole('heading', { name: w.steps[0]!.title })).toBeInTheDocument()
    expect(screen.queryAllByText('(covered)')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: `Next: ${w.steps[1]!.label} →` }))
    expect(screen.getByRole('heading', { name: w.steps[1]!.title })).toBeInTheDocument()
    expect(screen.queryAllByText('(covered)')).toHaveLength(w.steps[1]!.learned.length)

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { name: w.steps[2]!.title })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByRole('heading', { name: w.steps[1]!.title })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByRole('heading', { name: w.steps[0]!.title })).toBeInTheDocument()
  })

  it('jumps from the stepper to the recap and shows every learn item covered', () => {
    render(<Walkthrough data={w} />)
    const n = w.steps.length
    fireEvent.click(screen.getByRole('button', { name: `Step ${n}: ${w.steps[n - 1]!.label}` }))
    expect(screen.getByRole('heading', { name: w.steps[n - 1]!.title })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
    expect(screen.queryAllByText('(covered)')).toHaveLength(w.learn.length)
    w.steps[n - 1]!.recap!.forEach((r) => expect(screen.getByText(r)).toBeInTheDocument())
  })

  it('draws the nodes each step makes visible', () => {
    const { container } = render(<Walkthrough data={w} />)
    const labels = () => [...container.querySelectorAll('svg text')].map((t) => t.textContent)
    const first = w.nodes.filter((x) => w.steps[0]!.show.includes(x.id))
    first.forEach((x) => expect(labels()).toContain(x.label))
    const later = w.nodes.find((x) => !w.steps[0]!.show.includes(x.id))!
    expect(labels()).not.toContain(later.label)
  })
})
