import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NsgSimulation from './NsgSimulation'
import RbacSimulation from './RbacSimulation'
import ReplicationSimulation from './ReplicationSimulation'
import SubnetPlanner from './SubnetPlanner'
import { QuestionRunner } from '../components/QuestionRunner'
import { AppProvider } from '../services/AppContext'
import { questionsFor } from '../services/curriculum'

beforeEach(() => {
  vi.useFakeTimers()
  // Backend offline in unit tests: the UI must still work without saving.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const runAnimation = () => { for (let i = 0; i < 20; i++) act(() => { vi.advanceTimersByTime(1500) }) }

describe('NSG simulation', () => {
  it('denies by default, then allows after adding a rule, and reports lab checks', () => {
    const checks: string[] = []
    render(<NsgSimulation onLabCheck={(c) => checks.push(c)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send packet' }))
    runAnimation()
    expect(screen.getByRole('status')).toHaveTextContent(/DENIED.*DenyAllInBound/)
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send packet' }))
    runAnimation()
    expect(screen.getByRole('status')).toHaveTextContent(/ALLOWED.*Allow-HTTPS/)
    fireEvent.click(screen.getByRole('button', { name: 'Add NIC NSG with default rules only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send packet' }))
    runAnimation()
    expect(screen.getByRole('status')).toHaveTextContent(/NIC NSG/)
    expect(checks).toEqual(['observed-default-deny', 'allowed-https', 'observed-default-deny', 'observed-nic-deny'])
  })

  it('step controls move through the timeline', () => {
    render(<NsgSimulation />)
    fireEvent.click(screen.getByRole('button', { name: 'Send packet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByText(/Step 1 \//)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(screen.getByText(/Step 2 \//)).toBeInTheDocument()
  })
})

describe('RBAC simulation', () => {
  it('shows inherited group access', () => {
    const checks: string[] = []
    render(<RbacSimulation onLabCheck={(c) => checks.push(c)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check access' }))
    runAnimation()
    expect(screen.getByRole('status')).toHaveTextContent(/ALLOWED.*inherited/)
    expect(checks).toContain('inherited-allow')
  })
})

describe('Replication simulation', () => {
  it('reports read-only secondary for RA-GZRS region failure', () => {
    render(<ReplicationSimulation />)
    fireEvent.click(screen.getByRole('button', { name: 'RA-GZRS' }))
    fireEvent.click(screen.getByRole('button', { name: 'Primary region' }))
    expect(screen.getByText(/Reads: available from secondary/)).toBeInTheDocument()
    expect(screen.getByText(/Data-loss risk: possible recent writes/)).toBeInTheDocument()
  })
})

describe('Subnet planner', () => {
  it('flags overlap and computes usable addresses', () => {
    render(<SubnetPlanner />)
    expect(screen.getByText('251')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add subnet' }))
    expect(screen.getByText(/overlaps 10.10.1.0\/24/)).toBeInTheDocument()
  })
})

describe('QuestionRunner', () => {
  it('gives immediate feedback with option explanations', () => {
    const q = questionsFor('az-104').find((x) => x.id === 'az104-q-nsg-01')!
    render(<MemoryRouter><AppProvider><QuestionRunner questions={[q]} feedback="immediate" recordAs="practice" /></AppProvider></MemoryRouter>)
    fireEvent.click(screen.getByLabelText(/Denied by Deny-All-TCP/))
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText(/Specificity is irrelevant/)).toBeInTheDocument()
  })
})

describe('Governance simulation', () => {
  it('denies by policy, then blocks a locked resource group delete', async () => {
    const { default: GovernanceSimulation } = await import('./GovernanceSimulation')
    const checks: string[] = []
    render(<GovernanceSimulation onLabCheck={(c) => checks.push(c)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Assign policy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    runAnimation()
    expect(screen.getByRole('status')).toHaveTextContent(/REJECTED.*Allowed locations/)
    fireEvent.click(screen.getByRole('button', { name: 'Run compliance scan' }))
    expect(screen.getByText(/Allowed locations: non-compliant/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete RG that contains a locked resource' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    runAnimation()
    expect(screen.getByRole('status')).toHaveTextContent(/inside it/)
    expect(checks).toEqual(expect.arrayContaining(['policy-deny', 'compliance-scan', 'rg-delete-child-lock', 'lock-delete-blocked']))
  })
})

describe('Hierarchy, budget and identity simulations', () => {
  it('moves a subscription once permissions are complete', async () => {
    const { default: HierarchySimulation } = await import('./HierarchySimulation')
    const checks: string[] = []
    render(<HierarchySimulation onLabCheck={(c) => checks.push(c)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Move subscription' }))
    expect(screen.getByRole('status')).toHaveTextContent(/current parent/)
    fireEvent.click(screen.getByLabelText('MG write on current parent'))
    fireEvent.click(screen.getByRole('button', { name: 'Move subscription' }))
    expect(screen.getByRole('status')).toHaveTextContent(/Deny public IPs/)
    fireEvent.click(screen.getByRole('tab', { name: 'Move resources' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validate and move' }))
    expect(screen.getByRole('status')).toHaveTextContent(/VALIDATION FAILED/)
    expect(checks).toEqual(['moved-subscription', 'move-validation-failed'])
  })

  it('budget alone overspends; automation keeps it under', async () => {
    const { default: BudgetSimulation } = await import('./BudgetSimulation')
    render(<BudgetSimulation />)
    expect(screen.getByText(/month ends over budget/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/runs a runbook/))
    expect(screen.getByText(/month ends at/)).toBeInTheDocument()
  })

  it('explains SSPR and licence failures', async () => {
    const { default: IdentitySimulation } = await import('./IdentitySimulation')
    const checks: string[] = []
    render(<IdentitySimulation onLabCheck={(c) => checks.push(c)} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Licences' }))
    expect(screen.getByText('MissingUsageLocation')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Self-service password reset (SSPR)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try to reset password' }))
    expect(screen.getByRole('status')).toHaveTextContent(/requires 2 method/)
    expect(checks).toContain('sspr-blocked')
  })
})

describe('Storage simulations', () => {
  it('storage access: firewall blocks, then SAS permission is enforced', async () => {
    const { default: StorageAccessSimulation } = await import('./StorageAccessSimulation')
    const checks: string[] = []
    render(<StorageAccessSimulation onLabCheck={(c) => checks.push(c)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Generate SAS' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    runAnimation()
    expect(screen.getByRole('status')).toHaveTextContent(/HTTP 403.*not in the IP rules/)
    fireEvent.change(screen.getByLabelText('Public network access'), { target: { value: 'all' } })
    fireEvent.change(screen.getByLabelText('Operation'), { target: { value: 'write' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    runAnimation()
    expect(screen.getByRole('status')).toHaveTextContent(/but not write/)
    expect(checks).toEqual(['net-blocked', 'sas-denied-permission'])
  })

  it('storage account: invalid name and premium redundancy are rejected', async () => {
    const { default: StorageAccountSimulation } = await import('./StorageAccountSimulation')
    render(<StorageAccountSimulation />)
    fireEvent.click(screen.getByRole('button', { name: 'Review + create' }))
    expect(screen.getByRole('status')).toHaveTextContent(/lowercase/)
  })

  it('storage data: versioning makes overwrites recoverable', async () => {
    const { default: StorageDataSimulation } = await import('./StorageDataSimulation')
    render(<StorageDataSimulation />)
    fireEvent.click(screen.getByRole('tab', { name: 'Versioning & soft delete' }))
    expect(screen.getByText(/v1 \(overwritten\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Blob versioning'))
    expect(screen.getByText(/previous version: copy it over/)).toBeInTheDocument()
  })
})
