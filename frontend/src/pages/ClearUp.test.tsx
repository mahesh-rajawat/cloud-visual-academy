import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LOOKALIKES } from '../services/clarity'
import { findLesson } from '../services/curriculum'
import ClearUp from './ClearUp'

const renderAt = (url: string) => render(<MemoryRouter initialEntries={[url]}><ClearUp /></MemoryRouter>)

describe('Clear the confusion content', () => {
  it('every group has a rule, at least two options and two drills, and links to a real AZ-104 lesson', () => {
    for (const g of LOOKALIKES) {
      expect(g.rule.length, g.id).toBeGreaterThan(20)
      expect(g.options.length, g.id).toBeGreaterThanOrEqual(2)
      expect(g.drills.length, g.id).toBeGreaterThanOrEqual(2)
      expect(findLesson(g.lesson)?.exam, g.id).toBe('az-104')
    }
  })
  it('every drill answer is one of its group\'s options', () => {
    for (const g of LOOKALIKES) {
      const names = new Set(g.options.map((o) => o.name))
      for (const d of g.drills) expect(names.has(d.answer), `${g.id}: ${d.answer}`).toBe(true)
    }
  })
  it('covers deploying and networking in depth', () => {
    expect(LOOKALIKES.filter((g) => g.area === 'Deploying').length).toBeGreaterThanOrEqual(5)
    expect(LOOKALIKES.filter((g) => g.area === 'Networking').length).toBeGreaterThanOrEqual(7)
  })
})

describe('Clear the confusion page', () => {
  it('shows the same template as Bicep, ARM JSON and CLI', () => {
    renderAt('/clear-up')
    expect(screen.getByText(/param storageName string/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'ARM template (JSON)' }))
    expect(screen.getByText(/"contentVersion": "1.0.0.0"/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Azure CLI' }))
    expect(screen.getByText(/az storage account create/)).toBeInTheDocument()
  })
  it('a drill marks the right answer and explains why', () => {
    renderAt('/clear-up?tab=network')
    const card = screen.getByText(/Servers in your datacenter, connected by VPN/).closest('div')!
    fireEvent.click(within(card).getByRole('button', { name: 'Service endpoint' }))
    expect(within(card).getByText(/Not quite: the answer is Private endpoint/)).toBeInTheDocument()
    expect(within(card).getAllByRole('button').every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })
  it('the mixed drill keeps score', () => {
    renderAt('/clear-up?tab=drill')
    expect(screen.getByText('Score: 0 / 0 answered of 12')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button').find((b) => b.closest('.card') && b.textContent !== 'New round')!)
    expect(screen.getByText(/Score: [01] \/ 1 answered of 12/)).toBeInTheDocument()
  })
})
