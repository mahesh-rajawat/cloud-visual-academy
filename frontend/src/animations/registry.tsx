import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import animations from '@curriculum/animations.json'
import type { ScenarioGroup } from '../simulations/scenario'
import type { SimulationProps } from './types'

type Lazy = LazyExoticComponent<ComponentType<SimulationProps>>

/** Hand-built simulations with bespoke visuals. */
const CUSTOM: Record<string, Lazy> = {
  'nsg-packet-sim': lazy(() => import('./NsgSimulation')),
  'rbac-scope-sim': lazy(() => import('./RbacSimulation')),
  'storage-replication': lazy(() => import('./ReplicationSimulation')),
  'subnet-calculator': lazy(() => import('./SubnetPlanner')),
  'governance-sim': lazy(() => import('./GovernanceSimulation')),
  'hierarchy-sim': lazy(() => import('./HierarchySimulation')),
  'budget-sim': lazy(() => import('./BudgetSimulation')),
  'identity-sim': lazy(() => import('./IdentitySimulation')),
  'storage-access-sim': lazy(() => import('./StorageAccessSimulation')),
  'storage-account-sim': lazy(() => import('./StorageAccountSimulation')),
  'storage-data-sim': lazy(() => import('./StorageDataSimulation')),
}

/** Scenario-based simulations: every module in simulations/groups exports `groups: ScenarioGroup[]`. */
const groupModules = import.meta.glob<{ groups: ScenarioGroup[] }>(['../simulations/groups/*.ts', '!../simulations/groups/*.test.ts'])

function scenarioSim(id: string): Lazy {
  return lazy(async () => {
    const [{ ScenarioLab }, ...mods] = await Promise.all([import('./ScenarioLab'), ...Object.values(groupModules).map((load) => load())])
    const group = mods.flatMap((m) => m.groups).find((g) => g.id === id)
    if (!group) throw new Error(`Scenario group ${id} not found`)
    const Component = (p: SimulationProps) => <ScenarioLab group={group} {...p} />
    return { default: Component }
  })
}

/** Maps every animation id in curriculum/animations.json to a component. */
export const ANIMATION_COMPONENTS: Record<string, Lazy> = Object.fromEntries(
  (animations as Array<{ id: string }>).map((a) => [a.id, CUSTOM[a.id] ?? scenarioSim(a.id)]),
)
