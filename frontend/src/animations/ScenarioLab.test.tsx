import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { chooser } from '../simulations/chooser'
import type { ScenarioGroup } from '../simulations/scenario'
import { ScenarioLab } from './ScenarioLab'

const group: ScenarioGroup = {
  id: 'g', fidelity: 'simplified-illustration', fidelityNote: 'note',
  scenarios: [chooser({
    id: 'pick', title: 'Pick storage', description: 'Choose storage.', requirementLabel: 'Requirement', answerLabel: 'Service',
    cases: [{ value: 'a', label: 'Store photos', answer: 'S3', why: 'Object storage.' }, { value: 'b', label: 'Shared file system', answer: 'EFS', why: 'NFS file system.' }],
    answers: ['S3', 'EFS'], answerNotes: {},
  })],
}

describe('ScenarioLab choice scenarios', () => {
  it('renders a practice card without the pipeline animation and gives feedback', () => {
    const onLabCheck = vi.fn()
    const { container } = render(<ScenarioLab group={group} onLabCheck={onLabCheck} />)
    expect(container.querySelector('svg')).toBeNull()
    expect(screen.queryByRole('button', { name: /Play/ })).toBeNull()
    expect(screen.getByText('Store photos')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'EFS' }))
    expect(screen.getByText('✗ Not the best fit. Best: S3')).toBeInTheDocument()
    expect(onLabCheck).toHaveBeenCalledWith('pick-wrong')

    fireEvent.click(screen.getByRole('button', { name: 'S3' }))
    expect(screen.getByText('✓ Good fit')).toBeInTheDocument()
    expect(onLabCheck).toHaveBeenCalledWith('pick-correct')

    fireEvent.click(screen.getAllByRole('button', { name: 'Next requirement →' })[0]!)
    expect(screen.getByText('Shared file system')).toBeInTheDocument()
    expect(screen.queryByText('✓ Good fit')).toBeNull()
  })
})
