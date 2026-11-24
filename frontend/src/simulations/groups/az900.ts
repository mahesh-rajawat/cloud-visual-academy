/**
 * AZ-900 scenarios: cloud concepts, Azure architecture, services, identity/security and governance.
 * Numbers in the cost and capacity models are illustrative (not Azure prices) and are labelled as such.
 */
import { chooser } from '../chooser'
import { allOk, bool, chain, num, opt, str, type Scenario, type ScenarioGroup, type Stage } from '../scenario'

// ------------------------------------------------------------------ shared responsibility
export type Model = 'On-premises' | 'IaaS' | 'PaaS' | 'SaaS'
export type Layer = 'Physical datacenter, hosts and network' | 'Operating system' | 'Network controls' | 'Applications' | 'Identity and directory infrastructure' | 'Information and data' | 'Devices (mobile and PCs)' | 'Accounts and identities'
export type Owner = 'Customer' | 'Microsoft' | 'Shared'

/** Based on Microsoft's shared responsibility model diagram. */
export function responsibility(model: Model, layer: Layer): Owner {
  if (model === 'On-premises') return 'Customer'
  if (layer === 'Information and data' || layer === 'Devices (mobile and PCs)' || layer === 'Accounts and identities') return 'Customer'
  if (layer === 'Physical datacenter, hosts and network') return 'Microsoft'
  if (layer === 'Operating system') return model === 'IaaS' ? 'Customer' : 'Microsoft'
  if (layer === 'Network controls') return model === 'IaaS' ? 'Customer' : model === 'PaaS' ? 'Shared' : 'Microsoft'
  if (layer === 'Applications') return model === 'IaaS' ? 'Customer' : model === 'PaaS' ? 'Shared' : 'Microsoft'
  // Identity and directory infrastructure
  return model === 'IaaS' ? 'Customer' : 'Shared'
}

const LAYERS: Layer[] = ['Information and data', 'Devices (mobile and PCs)', 'Accounts and identities', 'Identity and directory infrastructure', 'Applications', 'Network controls', 'Operating system', 'Physical datacenter, hosts and network']

// ------------------------------------------------------------------ cost and capacity models
/** Fixed on-premises capacity sized for peak vs consumption-based capacity that follows demand. */
export function capacityModel(demand: number[], fixedCapacity: number, unitCostFixed: number, unitCostCloud: number) {
  const onPremCost = demand.length * fixedCapacity * unitCostFixed
  const cloudCost = demand.reduce((s, d) => s + d * unitCostCloud, 0)
  const unmet = demand.filter((d) => d > fixedCapacity).length
  const idle = demand.reduce((s, d) => s + Math.max(0, fixedCapacity - d), 0) / (demand.length * Math.max(1, fixedCapacity))
  return { onPremCost, cloudCost, unmet, idlePct: Math.round(idle * 100) }
}

/** Composite SLA of serial dependencies is the product of the individual SLAs. */
export function compositeSla(slas: number[]): number {
  return slas.reduce((p, s) => p * (s / 100), 1) * 100
}

export function downtimePerMonthMinutes(sla: number): number {
  return Math.round((1 - sla / 100) * 30 * 24 * 60 * 10) / 10
}

export function transferDays(dataTB: number, mbps: number): number {
  return Math.round(((dataTB * 8 * 1e6) / mbps / 86400) * 10) / 10
}

// ------------------------------------------------------------------ groups
const conceptsGroup: ScenarioGroup = {
  id: 'az900-concepts-sim',
  fidelity: 'simplified-illustration',
  fidelityNote: 'Responsibility assignments follow Microsoft\'s shared responsibility diagram. Cost and capacity numbers are illustrative units, not Azure prices.',
  scenarios: [
    {
      id: 'responsibility',
      title: 'Shared responsibility',
      description: 'Pick a service model and a layer, then decide who is responsible. The model checks your answer.',
      stages: [{ id: 'model', label: 'Service model', kind: 'service' }, { id: 'layer', label: 'Layer', kind: 'storage' }, { id: 'owner', label: 'Who is responsible?', kind: 'user' }],
      controls: [
        { type: 'select', key: 'model', label: 'Service model', options: opt('On-premises', 'IaaS', 'PaaS', 'SaaS') },
        { type: 'select', key: 'layer', label: 'Layer', options: opt(...LAYERS) },
        { type: 'select', key: 'answer', label: 'Your answer', options: opt('Customer', 'Microsoft', 'Shared') },
      ],
      initial: { model: 'PaaS', layer: 'Operating system', answer: 'Customer' },
      presets: [{ label: 'SaaS: who owns your data?', values: { model: 'SaaS', layer: 'Information and data', answer: 'Microsoft' } }, { label: 'IaaS: who patches the OS?', values: { model: 'IaaS', layer: 'Operating system', answer: 'Microsoft' } }],
      evaluate: (s) => {
        const owner = responsibility(str(s, 'model') as Model, str(s, 'layer') as Layer)
        const ok = owner === str(s, 'answer')
        const table = LAYERS.map((l) => `${l}: ${responsibility(str(s, 'model') as Model, l)}`)
        const stages = chain([{ id: 'model', label: 'Service model', kind: 'service' }, { id: 'layer', label: 'Layer', kind: 'storage' }, { id: 'owner', label: 'Who is responsible?', kind: 'user' }], [
          [true, str(s, 'model')], [true, str(s, 'layer')],
          [ok, ok ? `Correct: ${owner}.` : `It is ${owner}. ${owner === 'Customer' ? 'Data, endpoints, accounts and access management always stay with the customer in the cloud.' : owner === 'Microsoft' ? 'The provider manages this layer in this model.' : 'Responsibility is split between you and Microsoft.'}`],
        ])
        return { stages, outcome: { ok, title: ok ? 'CORRECT' : 'NOT QUITE', detail: stages[2]!.detail }, checks: [ok ? 'responsibility-correct' : 'responsibility-wrong'], notes: table }
      },
    },
    chooser({
      id: 'cloud-model', title: 'Cloud models', description: 'Match each scenario to public, private or hybrid cloud.',
      requirementLabel: 'Scenario', answerLabel: 'Cloud model', answers: ['Public cloud', 'Private cloud', 'Hybrid cloud'],
      answerNotes: { 'Public cloud': 'Resources owned and run by a provider, shared infrastructure, consumption pricing.', 'Private cloud': 'Cloud resources used by one organisation, often in its own datacenter; full control and CapEx.', 'Hybrid cloud': 'Public and private connected, so workloads and data can use either.' },
      cases: [
        { value: 'startup', label: 'Start-up needs servers today, no hardware purchase, pay only for use', answer: 'Public cloud', why: 'No upfront investment and immediate scale.' },
        { value: 'regulated', label: 'Regulator requires all hardware to be owned and operated in-house', answer: 'Private cloud', why: 'Full control of hardware and location.' },
        { value: 'burst', label: 'Keep a legacy database on-premises, burst web servers to Azure at peak', answer: 'Hybrid cloud', why: 'Combines on-premises systems with public cloud capacity.' },
        { value: 'arc', label: 'Manage on-premises servers and Azure resources together with Azure Arc', answer: 'Hybrid cloud', why: 'Spans environments under one management plane.' },
      ],
    }),
    {
      id: 'pricing',
      title: 'CapEx vs consumption',
      description: 'Compare buying servers for peak demand (CapEx) with paying per use (OpEx, consumption-based). Units are illustrative.',
      stages: [{ id: 'demand', label: 'Monthly demand', kind: 'user' }, { id: 'onprem', label: 'On-premises (fixed)', kind: 'compute' }, { id: 'cloud', label: 'Cloud (consumption)', kind: 'globe' }],
      controls: [
        { type: 'number', key: 'base', label: 'Baseline demand (servers)', min: 1, max: 100 },
        { type: 'number', key: 'peak', label: 'Peak demand (servers)', min: 1, max: 200 },
        { type: 'number', key: 'capacity', label: 'On-premises servers bought', min: 1, max: 200 },
        { type: 'checkbox', key: 'serverless', label: 'Serverless: no charge when demand is zero (nights)' },
      ],
      initial: { base: 10, peak: 40, capacity: 40, serverless: false },
      presets: [{ label: 'Under-buy hardware', values: { capacity: 25 } }],
      evaluate: (s) => {
        const demand = Array.from({ length: 12 }, (_, m) => (m === 10 || m === 11 ? num(s, 'peak') : num(s, 'base')))
        const effective = bool(s, 'serverless') ? demand.map((d) => d * 0.6) : demand
        const r = capacityModel(effective, num(s, 'capacity'), 1, 1.3)
        const stages = chain([{ id: 'demand', label: 'Monthly demand', kind: 'user' }, { id: 'onprem', label: 'On-premises (fixed)', kind: 'compute' }, { id: 'cloud', label: 'Cloud (consumption)', kind: 'globe' }], [
          [true, `Baseline ${num(s, 'base')}, peak ${num(s, 'peak')} in November–December.`],
          [r.unmet === 0, r.unmet === 0 ? `Capital expenditure: ${num(s, 'capacity')} servers paid up front; ${r.idlePct}% capacity idle on average.` : `${r.unmet} month(s) of unmet demand: capacity bought below peak.`],
          [true, `Operational expenditure: pay per server-month used.${bool(s, 'serverless') ? ' Serverless also stops charging when idle.' : ''}`],
        ])
        return {
          stages, outcome: { ok: allOk(stages), title: r.cloudCost < r.onPremCost ? 'CONSUMPTION CHEAPER HERE' : 'FIXED CAPACITY CHEAPER HERE', detail: `Illustrative cost: on-premises ${r.onPremCost} units vs cloud ${Math.round(r.cloudCost)} units (cloud unit price set 30% higher). Variable demand favours consumption pricing.` },
          checks: ['pricing-compared'],
          series: { xLabel: 'month', yLabel: 'servers', lines: [{ label: 'demand', points: effective }, { label: 'on-prem capacity', points: demand.map(() => num(s, 'capacity')), color: '#d23b3b', dashed: true }] },
        }
      },
    },
    {
      id: 'benefits',
      title: 'Availability, scalability, elasticity',
      description: 'Combine services with SLAs and choose elastic or fixed scaling. Composite SLA = product of the dependencies\' SLAs.',
      stages: [{ id: 'web', label: 'Web tier', kind: 'compute' }, { id: 'db', label: 'Database', kind: 'storage' }, { id: 'sla', label: 'Composite SLA', kind: 'security' }, { id: 'scale', label: 'Scaling', kind: 'globe' }],
      controls: [
        { type: 'select', key: 'web', label: 'Web tier SLA', options: opt('99.9', '99.95', '99.99') },
        { type: 'select', key: 'db', label: 'Database SLA', options: opt('99.9', '99.99', '99.995') },
        { type: 'number', key: 'target', label: 'Required availability (%)', min: 90, max: 100, step: 0.01 },
        { type: 'select', key: 'scaling', label: 'Scaling', options: opt('Elastic (autoscale out and in)', 'Scalable but manual', 'Fixed size') },
      ],
      initial: { web: '99.95', db: '99.99', target: 99.9, scaling: 'Elastic (autoscale out and in)' },
      presets: [{ label: 'Weak database SLA', values: { db: '99.9' } }, { label: 'Fixed size under spikes', values: { scaling: 'Fixed size' } }],
      evaluate: (s) => {
        const comp = compositeSla([Number(s.web), Number(s.db)])
        const ok = comp >= num(s, 'target')
        const fixed = str(s, 'scaling') === 'Fixed size'
        const stages = chain([{ id: 'web', label: 'Web tier', kind: 'compute' }, { id: 'db', label: 'Database', kind: 'storage' }, { id: 'sla', label: 'Composite SLA', kind: 'security' }, { id: 'scale', label: 'Scaling', kind: 'globe' }], [
          [true, `${s.web}%`], [true, `${s.db}%`],
          [ok, `${s.web}% × ${s.db}% = ${comp.toFixed(3)}% (≈ ${downtimePerMonthMinutes(comp)} min downtime per 30 days)${ok ? '' : `, below the ${num(s, 'target')}% target. Add redundancy or higher-SLA tiers.`}`],
          [!fixed, fixed ? 'Fixed size cannot absorb spikes (no scalability) and wastes capacity when quiet (no elasticity).' : str(s, 'scaling').startsWith('Elastic') ? 'Elasticity: resources grow and shrink automatically with demand.' : 'Scalable: you can add resources, but someone must do it.'],
        ])
        return { stages, outcome: { ok: allOk(stages), title: allOk(stages) ? 'REQUIREMENTS MET' : 'REQUIREMENTS NOT MET', detail: stages.find((x) => x.ok === false)?.detail ?? `Composite SLA ${comp.toFixed(3)}%.` }, checks: [ok ? 'sla-met' : 'sla-missed'], metrics: [{ label: 'Composite SLA', value: `${comp.toFixed(3)}%` }] }
      },
    },
    chooser({
      id: 'service-type', title: 'IaaS, PaaS, SaaS', description: 'Pick the service type for each workload.', requirementLabel: 'Workload', answerLabel: 'Service type', answers: ['IaaS', 'PaaS', 'SaaS'],
      answerNotes: { IaaS: 'You rent VMs, storage and networking and manage the OS upward.', PaaS: 'You deploy code/data; the provider manages OS, runtime and scaling.', SaaS: 'You use a finished application.' },
      cases: [
        { value: 'lift', label: 'Lift-and-shift a legacy app that needs a custom OS agent', answer: 'IaaS', why: 'Full OS control is required.' },
        { value: 'web', label: 'Developers deploy a web API without patching servers', answer: 'PaaS', why: 'The platform manages the OS and runtime.' },
        { value: 'email', label: 'Company needs email and calendars (Microsoft 365)', answer: 'SaaS', why: 'A complete application delivered as a service.' },
        { value: 'test', label: 'Quickly create test environments with full admin access to the VMs', answer: 'IaaS', why: 'VMs with admin access.' },
      ],
    }),
  ],
}

const archGroup: ScenarioGroup = {
  id: 'az900-architecture-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'Failure scopes of zones, regions and region pairs, and the management-group hierarchy rules, follow Microsoft documentation.',
  scenarios: [
    {
      id: 'regions',
      title: 'Regions, zones and pairs',
      description: 'Deploy an app and inject failures at different scopes.',
      stages: [{ id: 'deploy', label: 'Deployment', kind: 'compute' }, { id: 'event', label: 'Failure', kind: 'security' }, { id: 'up', label: 'App available?', kind: 'globe' }],
      controls: [
        { type: 'select', key: 'deploy', label: 'Deployment', options: opt('Single datacenter', 'Across availability zones', 'Two regions (region pair)') },
        { type: 'select', key: 'event', label: 'Failure', options: opt('Server rack failure', 'Datacenter / zone failure', 'Whole region outage') },
        { type: 'checkbox', key: 'sovereign', label: 'Data must stay in a sovereign cloud (e.g. Azure Government)' },
      ],
      initial: { deploy: 'Across availability zones', event: 'Datacenter / zone failure', sovereign: false },
      presets: [{ label: 'Region outage with zones only', values: { event: 'Whole region outage' } }],
      evaluate: (s) => {
        const d = str(s, 'deploy'); const e = str(s, 'event')
        const up = e.startsWith('Server') ? true : e.startsWith('Datacenter') ? d !== 'Single datacenter' : d.startsWith('Two regions')
        const detail = e.startsWith('Server') ? 'Rack failures are absorbed by redundancy inside a datacenter (for example availability sets).' : e.startsWith('Datacenter') ? (up ? 'Other zones keep running: zones have independent power, cooling and networking.' : 'Everything was in one datacenter.') : up ? 'The paired region takes over. Pairs are in the same geography, are updated one at a time, and are prioritised for recovery.' : 'Zones are all inside one region, so a regional outage affects them all.'
        const stages = chain([{ id: 'deploy', label: 'Deployment', kind: 'compute' }, { id: 'event', label: 'Failure', kind: 'security' }, { id: 'up', label: 'App available?', kind: 'globe' }], [
          [true, `${d}${bool(s, 'sovereign') ? ' in a sovereign region (physically and logically isolated instance of Azure)' : ''}`], [true, e], [up, detail]])
        return { stages, outcome: { ok: up, title: up ? 'AVAILABLE' : 'OUTAGE', detail }, checks: [up ? 'region-survived' : 'region-outage'] }
      },
    },
    {
      id: 'hierarchy',
      title: 'Resource hierarchy',
      description: 'Apply a policy or role at a scope and see which resources it reaches.',
      stages: [{ id: 'mg', label: 'Management group', kind: 'security' }, { id: 'sub', label: 'Subscription', kind: 'service' }, { id: 'rg', label: 'Resource group', kind: 'storage' }, { id: 'res', label: 'Resource', kind: 'compute' }],
      controls: [
        { type: 'select', key: 'scope', label: 'Assign at', options: opt('Management group', 'Subscription', 'Resource group', 'Resource') },
        { type: 'select', key: 'target', label: 'Does it apply to…', options: opt('Management group', 'Subscription', 'Resource group', 'Resource') },
        { type: 'checkbox', key: 'nest', label: 'Try to put a resource group inside another resource group' },
      ],
      initial: { scope: 'Subscription', target: 'Resource', nest: false },
      presets: [{ label: 'Nested resource groups', values: { nest: true } }, { label: 'Child to parent', values: { scope: 'Resource group', target: 'Subscription' } }],
      evaluate: (s) => {
        const order = ['Management group', 'Subscription', 'Resource group', 'Resource']
        const applies = order.indexOf(str(s, 'target')) >= order.indexOf(str(s, 'scope'))
        const nest = bool(s, 'nest')
        const stages = chain([{ id: 'mg', label: 'Management group', kind: 'security' }, { id: 'sub', label: 'Subscription', kind: 'service' }, { id: 'rg', label: 'Resource group', kind: 'storage' }, { id: 'res', label: 'Resource', kind: 'compute' }], [
          [true, 'Management groups contain subscriptions (and other management groups, up to six levels).'], [true, 'A subscription is a billing and access boundary; it contains resource groups.'],
          [!nest, nest ? 'Resource groups cannot be nested, and each resource belongs to exactly one resource group.' : 'Resource groups contain resources; deleting a group deletes its resources.'],
          [applies, applies ? `An assignment at ${str(s, 'scope')} is inherited by ${str(s, 'target')}.` : `Inheritance flows down only: ${str(s, 'scope')} does not affect ${str(s, 'target')}.`],
        ])
        return { stages, outcome: { ok: allOk(stages), title: allOk(stages) ? 'APPLIES' : 'DOES NOT APPLY', detail: stages.find((x) => x.ok === false)?.detail ?? stages[3]!.detail }, checks: [allOk(stages) ? 'hierarchy-applies' : 'hierarchy-blocked'] }
      },
    },
  ],
}

const servicesGroup: ScenarioGroup = {
  id: 'az900-services-sim',
  fidelity: 'simplified-illustration',
  fidelityNote: 'Service selections reflect documented primary use cases. Transfer times are simple arithmetic estimates.',
  scenarios: [
    chooser({
      id: 'compute', title: 'Compute choice', description: 'Pick the compute option for each requirement.', requirementLabel: 'Requirement', answerLabel: 'Compute option',
      answers: ['Azure Virtual Machines', 'Virtual Machine Scale Sets', 'Azure Virtual Desktop', 'Azure Container Instances', 'Azure Functions', 'Azure App Service'],
      answerNotes: { 'Azure Virtual Machines': 'IaaS VMs with full OS control.', 'Virtual Machine Scale Sets': 'Groups of identical, load-balanced VMs that autoscale.', 'Azure Virtual Desktop': 'Desktop and app virtualisation in the cloud.', 'Azure Container Instances': 'Run a container without managing servers.', 'Azure Functions': 'Event-driven serverless code, billed per execution.', 'Azure App Service': 'Managed hosting for web apps and APIs.' },
      cases: [
        { value: 'custom-os', label: 'Install custom software that needs admin rights on Windows Server', answer: 'Azure Virtual Machines', why: 'Full control of the OS.' },
        { value: 'autoscale', label: 'Hundreds of identical VMs that scale with demand', answer: 'Virtual Machine Scale Sets', why: 'Manage and autoscale a group of identical VMs.' },
        { value: 'desktops', label: 'Give contractors a secure Windows desktop from any device', answer: 'Azure Virtual Desktop', why: 'Cloud-hosted desktops and apps.' },
        { value: 'event', label: 'Run code when a file lands in storage, pay only per run', answer: 'Azure Functions', why: 'Serverless, event-triggered, consumption billing.' },
        { value: 'web', label: 'Host a web app with deployment slots and no OS patching', answer: 'Azure App Service', why: 'PaaS web hosting.' },
        { value: 'container', label: 'Run a single container for a short task quickly', answer: 'Azure Container Instances', why: 'Fastest way to run a container.' },
      ],
    }),
    chooser({
      id: 'networking', title: 'Networking choice', description: 'Pick the networking service for each connectivity need.', requirementLabel: 'Requirement', answerLabel: 'Service',
      answers: ['Virtual network peering', 'VPN Gateway', 'ExpressRoute', 'Azure DNS', 'Private endpoint', 'Public endpoint'],
      answerNotes: { 'Virtual network peering': 'Connects VNets over the Microsoft backbone.', 'VPN Gateway': 'Encrypted tunnels over the internet (site-to-site, point-to-site).', ExpressRoute: 'Private dedicated connection through a connectivity provider, not over the internet.', 'Azure DNS': 'Hosts DNS zones on Azure name servers.', 'Private endpoint': 'Private IP in your VNet for a PaaS service.', 'Public endpoint': 'Internet-reachable address of a service.' },
      cases: [
        { value: 'vnets', label: 'Two VNets must talk privately with low latency', answer: 'Virtual network peering', why: 'Peering connects VNets directly.' },
        { value: 'office', label: 'Branch office connects to Azure over an encrypted internet tunnel', answer: 'VPN Gateway', why: 'Site-to-site VPN over the internet.' },
        { value: 'private', label: 'Datacenter needs a private, predictable connection that does not use the internet', answer: 'ExpressRoute', why: 'Dedicated private connectivity.' },
        { value: 'dns', label: 'Host the contoso.com zone in Azure', answer: 'Azure DNS', why: 'DNS hosting.' },
        { value: 'pe', label: 'Reach a storage account only from inside the VNet', answer: 'Private endpoint', why: 'A private IP for the service.' },
      ],
    }),
    chooser({
      id: 'storage', title: 'Storage choice', description: 'Pick the storage service, tier or redundancy.', requirementLabel: 'Requirement', answerLabel: 'Option',
      answers: ['Blob Storage', 'Azure Files', 'Queue Storage', 'Table Storage', 'Azure Disk Storage', 'Archive tier', 'GRS redundancy'],
      answerNotes: { 'Blob Storage': 'Massive unstructured object storage (images, video, backups).', 'Azure Files': 'Managed SMB/NFS file shares.', 'Queue Storage': 'Messages between application components.', 'Table Storage': 'NoSQL key/attribute store.', 'Azure Disk Storage': 'Block disks for VMs.', 'Archive tier': 'Lowest cost, offline, hours to retrieve.', 'GRS redundancy': 'Copies data to a secondary region.' },
      cases: [
        { value: 'media', label: 'Store millions of images served over HTTPS', answer: 'Blob Storage', why: 'Object storage for unstructured data.' },
        { value: 'share', label: 'Replace an on-premises SMB file share', answer: 'Azure Files', why: 'Managed SMB file shares.' },
        { value: 'decouple', label: 'Decouple a web front end from a background worker', answer: 'Queue Storage', why: 'Asynchronous messaging.' },
        { value: 'vmdisk', label: 'Persistent disk for a database VM', answer: 'Azure Disk Storage', why: 'Block storage attached to VMs.' },
        { value: 'retain', label: 'Keep compliance data 7 years, rarely read', answer: 'Archive tier', why: 'Cheapest storage for rarely accessed data.' },
        { value: 'region', label: 'Survive the loss of the primary region', answer: 'GRS redundancy', why: 'Geo-redundancy to the paired region.' },
      ],
    }),
    {
      id: 'migration',
      title: 'Moving data and migrating',
      description: 'Estimate how long an online transfer takes and pick the right tool.',
      stages: [{ id: 'data', label: 'Data to move', kind: 'storage' }, { id: 'link', label: 'Network link', kind: 'network' }, { id: 'tool', label: 'Tool', kind: 'service' }],
      controls: [
        { type: 'number', key: 'tb', label: 'Data size (TB)', min: 0.1, max: 1000, step: 0.1 },
        { type: 'number', key: 'mbps', label: 'Available bandwidth (Mbps)', min: 10, max: 10000 },
        { type: 'select', key: 'tool', label: 'Tool', options: opt('AzCopy', 'Azure Storage Explorer', 'Azure File Sync', 'Azure Data Box', 'Azure Migrate') },
        { type: 'select', key: 'goal', label: 'Goal', options: opt('One-off bulk copy', 'Keep on-premises file server in sync with Azure Files', 'Assess and migrate servers and databases') },
      ],
      initial: { tb: 80, mbps: 100, tool: 'AzCopy', goal: 'One-off bulk copy' },
      presets: [{ label: 'Small copy over fast link', values: { tb: 0.5, mbps: 1000 } }, { label: 'Server migration', values: { goal: 'Assess and migrate servers and databases', tool: 'Azure Migrate' } }],
      evaluate: (s) => {
        const days = transferDays(num(s, 'tb'), num(s, 'mbps'))
        const goal = str(s, 'goal'); const tool = str(s, 'tool')
        const right = goal.startsWith('Keep') ? 'Azure File Sync' : goal.startsWith('Assess') ? 'Azure Migrate' : days > 7 ? 'Azure Data Box' : 'AzCopy'
        const ok = tool === right || (right === 'AzCopy' && tool === 'Azure Storage Explorer')
        const stages = chain([{ id: 'data', label: 'Data to move', kind: 'storage' }, { id: 'link', label: 'Network link', kind: 'network' }, { id: 'tool', label: 'Tool', kind: 'service' }], [
          [true, `${num(s, 'tb')} TB`], [true, `≈ ${days} days at ${num(s, 'mbps')} Mbps fully used.`],
          [ok, ok ? `${tool} fits.` : `${right} fits better: ${right === 'Azure Data Box' ? 'an offline appliance shipped to Azure when online transfer would take too long' : right === 'Azure File Sync' ? 'continuous sync with cloud tiering for Windows file servers' : right === 'Azure Migrate' ? 'discovery, assessment and migration of servers, databases and apps' : 'online copy tool'}.`],
        ])
        return { stages, outcome: { ok, title: ok ? 'GOOD CHOICE' : 'BETTER TOOL EXISTS', detail: stages[2]!.detail }, checks: [ok ? 'migration-correct' : 'migration-wrong'] }
      },
    },
  ],
}

const identityStages: Stage[] = [
  { id: 'user', label: 'User sign-in', kind: 'user' },
  { id: 'authn', label: 'Authentication', kind: 'identity' },
  { id: 'ca', label: 'Conditional Access', kind: 'security' },
  { id: 'authz', label: 'Authorization (RBAC)', kind: 'security' },
  { id: 'res', label: 'Azure resource', kind: 'compute' },
]

const identityGroup: ScenarioGroup = {
  id: 'az900-identity-sim',
  fidelity: 'simplified-illustration',
  fidelityNote: 'Authentication, Conditional Access, RBAC, Zero Trust and defense-in-depth concepts follow Microsoft documentation; real Conditional Access evaluates many more signals.',
  scenarios: [
    {
      id: 'signin',
      title: 'Sign-in and access',
      description: 'A user signs in and requests a resource: authentication proves who they are, Conditional Access checks the conditions, RBAC decides what they can do.',
      stages: identityStages,
      controls: [
        { type: 'select', key: 'userType', label: 'Identity', options: opt('Employee (member)', 'External partner (B2B guest)') },
        { type: 'select', key: 'method', label: 'Authentication', options: opt('Password only', 'Password + MFA', 'Passwordless (Windows Hello / FIDO2 / Authenticator)') },
        { type: 'select', key: 'location', label: 'Location', options: opt('Corporate network', 'Unknown country') },
        { type: 'checkbox', key: 'caMfa', label: 'Conditional Access: require MFA outside the corporate network' },
        { type: 'checkbox', key: 'sso', label: 'Single sign-on to other apps after sign-in' },
        { type: 'select', key: 'role', label: 'Azure role on the resource group', options: opt('None', 'Reader', 'Contributor') },
        { type: 'select', key: 'action', label: 'Action', options: opt('View VM', 'Restart VM') },
      ],
      initial: { userType: 'Employee (member)', method: 'Password only', location: 'Unknown country', caMfa: true, sso: true, role: 'Reader', action: 'Restart VM' },
      presets: [{ label: 'Fix: use MFA and Contributor', values: { method: 'Password + MFA', role: 'Contributor' } }, { label: 'Guest without a role', values: { userType: 'External partner (B2B guest)', role: 'None', method: 'Password + MFA', action: 'View VM' } }],
      evaluate: (s) => {
        const strong = !str(s, 'method').startsWith('Password only')
        const caOk = !(bool(s, 'caMfa') && str(s, 'location') === 'Unknown country' && !strong)
        const role = str(s, 'role')
        const authzOk = role === 'Contributor' || (role === 'Reader' && str(s, 'action') === 'View VM')
        const stages = chain(identityStages, [
          [true, `${str(s, 'userType')}${str(s, 'userType').includes('guest') ? ': external identity invited with B2B, signs in with their own account' : ''}.`],
          [true, `${str(s, 'method')}${bool(s, 'sso') ? '; SSO lets the same identity reach other apps without signing in again' : ''}. Authentication proves identity (Microsoft Entra ID).`],
          [caOk, caOk ? 'Conditional Access conditions satisfied.' : 'Conditional Access requires MFA from this location: blocked until MFA is completed.'],
          [authzOk, authzOk ? `${role} allows "${str(s, 'action')}".` : role === 'None' ? 'Authenticated but not authorized: no role assignment.' : `${role} does not allow "${str(s, 'action')}".`],
          [true, 'Access granted.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'ACCESS GRANTED' : 'ACCESS DENIED', detail: ok ? 'Verified explicitly, least privilege applied: Zero Trust in action.' : stages.find((x) => x.ok === false)!.detail }, checks: [ok ? 'signin-ok' : 'signin-blocked'] }
      },
    },
    {
      id: 'defense',
      title: 'Defense in depth',
      description: 'An attacker attempts to reach data. Enable controls at each layer; one failing layer should not expose everything.',
      stages: [{ id: 'phys', label: 'Physical security', kind: 'security' }, { id: 'id', label: 'Identity & access', kind: 'identity' }, { id: 'perim', label: 'Perimeter', kind: 'security' }, { id: 'net', label: 'Network', kind: 'network' }, { id: 'compute', label: 'Compute', kind: 'compute' }, { id: 'app', label: 'Application', kind: 'service' }, { id: 'data', label: 'Data', kind: 'storage' }],
      controls: [
        { type: 'checkbox', key: 'mfa', label: 'Identity: MFA + Conditional Access' },
        { type: 'checkbox', key: 'ddos', label: 'Perimeter: DDoS protection + firewall' },
        { type: 'checkbox', key: 'nsg', label: 'Network: NSGs, no open management ports' },
        { type: 'checkbox', key: 'patch', label: 'Compute: patched VMs, endpoint protection' },
        { type: 'checkbox', key: 'appsec', label: 'Application: secure code, secrets in Key Vault' },
        { type: 'checkbox', key: 'enc', label: 'Data: encryption and access controls' },
        { type: 'checkbox', key: 'defender', label: 'Microsoft Defender for Cloud: posture management and threat protection' },
      ],
      initial: { mfa: true, ddos: true, nsg: false, patch: true, appsec: false, enc: true, defender: false },
      presets: [{ label: 'Only a perimeter firewall', values: { mfa: false, ddos: true, nsg: false, patch: false, appsec: false, enc: false, defender: false } }],
      evaluate: (s) => {
        const keys = ['mfa', 'ddos', 'nsg', 'patch', 'appsec', 'enc'] as const
        const layers = keys.map((k) => bool(s, k))
        const score = layers.filter(Boolean).length
        const stages = [
          { id: 'phys', ok: true, detail: 'Microsoft secures datacenter buildings and hardware.' },
          ...keys.map((_k, i) => ({ id: ['id', 'perim', 'net', 'compute', 'app', 'data'][i]!, ok: layers[i]!, detail: layers[i] ? 'Control in place.' : 'Gap: an attacker passing the previous layer is not slowed here.' })),
        ]
        const breached = layers.every((x) => !x) || (!bool(s, 'mfa') && !bool(s, 'enc'))
        return {
          stages: stages.map((x, i) => (i > 0 && stages.slice(0, i).some((y) => !y.ok) ? { ...x, ok: x.ok ? true : false } : x)).map((x) => x),
          outcome: { ok: false, title: breached ? 'DATA EXPOSED' : `${score}/6 LAYERS PROTECTED`, detail: `${breached ? 'Without identity or data protection, one stolen password can reach the data.' : 'Each gap is a place where a single failure is not contained.'}${bool(s, 'defender') ? ' Defender for Cloud gives a secure score and recommendations to close gaps.' : ' Enable Defender for Cloud to find these gaps automatically.'}` },
          checks: [score === 6 ? 'defense-complete' : 'defense-gaps'],
          metrics: [{ label: 'Layers protected', value: `${score} of 6` }],
        }
      },
    },
  ],
}
// Defense in depth intentionally reports every layer (not stop-at-first-failure), so patch its outcome
// to keep the shared invariant: outcome.ok is true only when every layer passes.
const defense = identityGroup.scenarios[1]!
const defenseEval = defense.evaluate
defense.evaluate = (s) => {
  const ev = defenseEval(s)
  const firstFail = ev.stages.findIndex((x) => x.ok === false)
  const stages = ev.stages.map((x, i) => (firstFail >= 0 && i > firstFail ? { ...x, ok: null, detail: `${x.ok ? 'Control in place' : 'Gap'} (shown after the first gap).` } : x))
  return { ...ev, stages, outcome: { ...ev.outcome, ok: firstFail < 0 } }
}

const govGroup: ScenarioGroup = {
  id: 'az900-governance-sim',
  fidelity: 'simplified-illustration',
  fidelityNote: 'Cost factors, governance tools, management tools and monitoring services follow Microsoft documentation. Estimated prices are illustrative units, not Azure prices; use the Azure pricing calculator for real estimates.',
  scenarios: [
    {
      id: 'cost',
      title: 'Cost factors and estimates',
      description: 'See how resource type, usage, region, reservations and egress change a monthly estimate (illustrative units).',
      stages: [{ id: 'res', label: 'Resources', kind: 'compute' }, { id: 'factors', label: 'Cost factors', kind: 'service' }, { id: 'est', label: 'Estimate', kind: 'storage' }, { id: 'budget', label: 'Budget', kind: 'security' }],
      controls: [
        { type: 'number', key: 'vms', label: 'VMs', min: 0, max: 50 },
        { type: 'number', key: 'hours', label: 'Hours per month each VM runs', min: 0, max: 730 },
        { type: 'select', key: 'region', label: 'Region price level', options: opt('Lower-cost region', 'Higher-cost region') },
        { type: 'checkbox', key: 'reserved', label: '3-year reservation (commitment discount)' },
        { type: 'number', key: 'egress', label: 'Outbound data transfer (GB)', min: 0, max: 100000 },
        { type: 'number', key: 'budget', label: 'Monthly budget (units)', min: 0, max: 100000 },
        { type: 'checkbox', key: 'tags', label: 'Tag resources with costCenter for reporting' },
      ],
      initial: { vms: 4, hours: 730, region: 'Lower-cost region', reserved: false, egress: 500, budget: 600, tags: true },
      presets: [{ label: 'Shut down dev VMs at night', values: { hours: 300 } }, { label: 'Use a reservation', values: { reserved: true } }],
      evaluate: (s) => {
        const rate = (str(s, 'region').startsWith('Higher') ? 0.24 : 0.2) * (bool(s, 'reserved') ? 0.4 : 1)
        const compute = num(s, 'vms') * num(s, 'hours') * rate
        const egress = Math.max(0, num(s, 'egress') - 100) * 0.08
        const total = Math.round(compute + egress)
        const ok = total <= num(s, 'budget')
        const stages = chain([{ id: 'res', label: 'Resources', kind: 'compute' }, { id: 'factors', label: 'Cost factors', kind: 'service' }, { id: 'est', label: 'Estimate', kind: 'storage' }, { id: 'budget', label: 'Budget', kind: 'security' }], [
          [true, `${num(s, 'vms')} VMs × ${num(s, 'hours')} h.`],
          [true, `Region price level, ${bool(s, 'reserved') ? 'reservation discount, ' : ''}and outbound bandwidth (inbound is generally free). ${bool(s, 'tags') ? 'Tags let Cost Management group spend by costCenter.' : ''}`],
          [true, `≈ ${total} units/month (compute ${Math.round(compute)}, egress ${Math.round(egress)}).`],
          [ok, ok ? 'Within budget.' : 'Over budget: a budget alert would notify you (budgets do not stop resources).'],
        ])
        return { stages, outcome: { ok, title: ok ? 'WITHIN BUDGET' : 'OVER BUDGET', detail: stages[3]!.detail }, checks: ['cost-estimated', ...(ok ? [] : ['cost-over'])], metrics: [{ label: 'Estimate', value: `${total} units` }] }
      },
    },
    chooser({
      id: 'governance', title: 'Governance tools', description: 'Pick the governance or compliance tool for each need.', requirementLabel: 'Need', answerLabel: 'Tool',
      answers: ['Azure Policy', 'Resource locks', 'Microsoft Purview', 'Tags', 'Azure RBAC'],
      answerNotes: { 'Azure Policy': 'Evaluates and enforces rules on resource properties (deny, audit, modify).', 'Resource locks': 'Prevent deletion (CanNotDelete) or changes (ReadOnly) for everyone.', 'Microsoft Purview': 'Data governance, risk and compliance: discover, classify and map data across sources.', Tags: 'Name/value metadata for organising and reporting.', 'Azure RBAC': 'Grants who can do what at which scope.' },
      cases: [
        { value: 'regions', label: 'Block resources outside approved regions', answer: 'Azure Policy', why: 'Policy denies non-compliant deployments.' },
        { value: 'delete', label: 'Stop anyone deleting the production database by accident', answer: 'Resource locks', why: 'A CanNotDelete lock applies to all users.' },
        { value: 'data', label: 'Discover and classify sensitive data across Azure, on-premises and SaaS', answer: 'Microsoft Purview', why: 'Unified data governance and compliance.' },
        { value: 'cost', label: 'Report costs by department', answer: 'Tags', why: 'Cost Management groups costs by tag.' },
        { value: 'access', label: 'Let the network team manage only network resources', answer: 'Azure RBAC', why: 'Assign Network Contributor at the right scope.' },
      ],
    }),
    chooser({
      id: 'tools', title: 'Management tools', description: 'Pick the tool for each management task.', requirementLabel: 'Task', answerLabel: 'Tool',
      answers: ['Azure portal', 'Azure Cloud Shell', 'Azure CLI / PowerShell scripts', 'Azure Arc', 'ARM templates / Bicep'],
      answerNotes: { 'Azure portal': 'Web-based GUI for managing Azure.', 'Azure Cloud Shell': 'Browser-based shell with Azure CLI and PowerShell preinstalled and authenticated.', 'Azure CLI / PowerShell scripts': 'Command-line automation, run anywhere.', 'Azure Arc': 'Extends Azure management to servers, Kubernetes and data services outside Azure.', 'ARM templates / Bicep': 'Declarative infrastructure as code.' },
      cases: [
        { value: 'explore', label: 'Explore services visually and build dashboards', answer: 'Azure portal', why: 'GUI and dashboards.' },
        { value: 'locked', label: 'Run az commands from a locked-down PC where nothing can be installed', answer: 'Azure Cloud Shell', why: 'Runs in the browser, no local install.' },
        { value: 'onprem', label: 'Apply Azure Policy and monitoring to on-premises and AWS servers', answer: 'Azure Arc', why: 'Projects external resources into Azure Resource Manager.' },
        { value: 'repeat', label: 'Deploy identical environments repeatedly and consistently', answer: 'ARM templates / Bicep', why: 'Declarative, repeatable IaC.' },
        { value: 'nightly', label: 'A nightly scheduled job that stops dev VMs', answer: 'Azure CLI / PowerShell scripts', why: 'Imperative automation.' },
      ],
    }),
    chooser({
      id: 'monitoring', title: 'Monitoring tools', description: 'Pick the monitoring service for each question.', requirementLabel: 'Question', answerLabel: 'Service',
      answers: ['Azure Advisor', 'Azure Service Health', 'Azure Monitor metrics/alerts', 'Log Analytics', 'Application Insights'],
      answerNotes: { 'Azure Advisor': 'Personalised recommendations: reliability, security, performance, cost, operational excellence.', 'Azure Service Health': 'Azure status for your services and regions: incidents, planned maintenance, health advisories.', 'Azure Monitor metrics/alerts': 'Collects metrics and fires alerts.', 'Log Analytics': 'Query collected logs with KQL.', 'Application Insights': 'Application performance monitoring for apps.' },
      cases: [
        { value: 'save', label: 'How can I reduce cost and improve reliability?', answer: 'Azure Advisor', why: 'Advisor recommendations.' },
        { value: 'outage', label: 'Is there an Azure incident affecting my region right now?', answer: 'Azure Service Health', why: 'Personalised view of Azure platform health.' },
        { value: 'cpu', label: 'Email me when VM CPU stays above 90%', answer: 'Azure Monitor metrics/alerts', why: 'Metric alert rule with an action group.' },
        { value: 'query', label: 'Search all sign-in failures in the last week', answer: 'Log Analytics', why: 'KQL over collected logs.' },
        { value: 'app', label: 'Find slow pages and exceptions in my web app', answer: 'Application Insights', why: 'APM telemetry for apps.' },
      ],
    }),
  ],
}


// ================================================================== focused lesson groups
// Each AZ-900 lesson has its own group so the animation shows only the scenarios for that lesson.
const pick = (g: ScenarioGroup, id: string) => g.scenarios.find((x) => x.id === id)!
const doc = 'simplified-illustration' as const
const docNote = 'Choices and outcomes follow Microsoft Learn documentation for AZ-900 topics; real services have more options.'
type C = { value: string; label: string; answer: string; why: string }
const cases = (rows: Array<[string, string, string, string]>): C[] => rows.map(([value, label, answer, why]) => ({ value, label, answer, why }))

// ------------------------------------------------------------------ new staged scenarios
const vmStages: Stage[] = [
  { id: 'size', label: 'VM size (vCPU, memory)', kind: 'compute' },
  { id: 'disk', label: 'Image + OS disk', kind: 'storage' },
  { id: 'net', label: 'VNet, subnet, NIC', kind: 'network' },
  { id: 'access', label: 'Remote access', kind: 'security' },
  { id: 'run', label: 'VM running', kind: 'compute' },
]
const vmBuild: Scenario = {
  id: 'vm-build',
  title: 'Resources a VM needs',
  description: 'Choose the resources for a new VM and see which ones are required.',
  stages: vmStages,
  controls: [
    { type: 'select' as const, key: 'size', label: 'Size', options: opt('Not chosen', 'Standard_B2s (2 vCPU, 4 GiB)', 'Standard_D4s_v5 (4 vCPU, 16 GiB)') },
    { type: 'select' as const, key: 'image', label: 'Image', options: opt('Windows Server 2022', 'Ubuntu 24.04 LTS') },
    { type: 'checkbox' as const, key: 'osDisk', label: 'Managed OS disk' },
    { type: 'checkbox' as const, key: 'vnet', label: 'Virtual network and subnet' },
    { type: 'checkbox' as const, key: 'nic', label: 'Network interface (NIC)' },
    { type: 'select' as const, key: 'access', label: 'Admin access', options: opt('Not needed from the internet', 'RDP/SSH from the internet') },
    { type: 'checkbox' as const, key: 'pip', label: 'Public IP address' },
    { type: 'checkbox' as const, key: 'nsg', label: 'NSG rule allows RDP/SSH from my IP only' },
  ],
  initial: { size: 'Standard_B2s (2 vCPU, 4 GiB)', image: 'Ubuntu 24.04 LTS', osDisk: true, vnet: true, nic: false, access: 'RDP/SSH from the internet', pip: true, nsg: true },
  presets: [
    { label: 'Add the network interface', values: { nic: true } },
    { label: 'No size chosen', values: { nic: true, size: 'Not chosen' } },
    { label: 'Internet access without an NSG rule', values: { nic: true, nsg: false } },
  ],
  evaluate: (s: Record<string, string | number | boolean>) => {
    const internet = str(s, 'access').startsWith('RDP')
    const accessOk = !internet || (bool(s, 'pip') && bool(s, 'nsg'))
    const stages = chain(vmStages, [
      [str(s, 'size') !== 'Not chosen', str(s, 'size') !== 'Not chosen' ? `${str(s, 'size')}: the size sets vCPUs, memory and price per hour.` : 'Every VM needs a size: it decides CPU, memory and cost.'],
      [bool(s, 'osDisk'), bool(s, 'osDisk') ? `${str(s, 'image')} on a managed OS disk (disks are billed separately and remain if the VM is deleted, unless you choose to delete them).` : 'A VM needs an OS disk created from an image.'],
      [bool(s, 'vnet') && bool(s, 'nic'), bool(s, 'vnet') && bool(s, 'nic') ? 'The NIC connects the VM to a subnet of the virtual network and gets a private IP.' : 'A VM must have a NIC in a subnet of a virtual network. The portal creates these for you, but they are separate resources.'],
      [accessOk, !internet ? 'No public IP: reach the VM privately (for example through Azure Bastion or VPN). Optional resources: public IP, NSG.' : accessOk ? 'Public IP plus an NSG rule limited to your IP allows RDP/SSH. Opening it to everyone is a common risk.' : !bool(s, 'pip') ? 'Internet access needs a public IP address.' : 'Without an NSG rule allowing the port, traffic is blocked.'],
      [true, 'The VM runs and is billed per second while running; deallocating stops compute charges but disks still cost.'],
    ])
    const ok = allOk(stages)
    return { stages, outcome: { ok, title: ok ? 'VM DEPLOYED' : 'DEPLOYMENT INCOMPLETE', detail: stages.find((x) => x.ok === false)?.detail ?? 'Required: size, image + OS disk, VNet/subnet and NIC. Optional: public IP, NSG, data disks.' }, checks: [ok ? 'vm-deployed' : 'vm-blocked'] }
  },
}

const epStages: Stage[] = [
  { id: 'client', label: 'Client', kind: 'user' },
  { id: 'path', label: 'Endpoint used', kind: 'network' },
  { id: 'rules', label: 'Network rules', kind: 'security' },
  { id: 'svc', label: 'Storage account', kind: 'storage' },
]
const endpointReach: Scenario = {
  id: 'endpoint-reach',
  title: 'Public vs private endpoint',
  description: 'Connect to a storage account from different places with different endpoint settings.',
  stages: epStages,
  controls: [
    { type: 'select' as const, key: 'from', label: 'Client location', options: opt('Internet', 'VM in the same VNet', 'On-premises over VPN or ExpressRoute') },
    { type: 'select' as const, key: 'pub', label: 'Public network access', options: opt('Enabled from all networks', 'Enabled from selected IPs and VNets', 'Disabled') },
    { type: 'checkbox' as const, key: 'pe', label: 'Private endpoint in the VNet' },
    { type: 'checkbox' as const, key: 'fw', label: 'Firewall allows this client' },
  ],
  initial: { from: 'Internet', pub: 'Disabled', pe: true, fw: false },
  presets: [
    { label: 'Connect from a VM in the VNet', values: { from: 'VM in the same VNet' } },
    { label: 'Allow selected networks', values: { pub: 'Enabled from selected IPs and VNets', fw: true } },
    { label: 'Remove the private endpoint', values: { from: 'VM in the same VNet', pe: false } },
  ],
  evaluate: (s: Record<string, string | number | boolean>) => {
    const from = str(s, 'from'); const pub = str(s, 'pub')
    const viaPrivate = bool(s, 'pe') && from !== 'Internet'
    const rulesOk = viaPrivate || pub.startsWith('Enabled from all') || (pub.startsWith('Enabled from selected') && bool(s, 'fw'))
    const stages = chain(epStages, [
      [true, from],
      [true, viaPrivate ? 'Private endpoint: a private IP from your subnet; traffic stays on the Microsoft network.' : 'Public endpoint: the service\'s internet-facing address (contoso.blob.core.windows.net).'],
      [rulesOk, viaPrivate ? 'Private endpoint traffic is allowed even when public access is disabled.' : pub === 'Disabled' ? 'Public network access is disabled, and the internet cannot use a private endpoint.' : rulesOk ? `Public endpoint allowed (${pub}). The request must still be authenticated.` : 'This client is not in the firewall\'s allowed IPs or VNets.'],
      [true, 'Request authorised and served.'],
    ])
    const ok = allOk(stages)
    return { stages, outcome: { ok, title: ok ? 'CONNECTED' : 'BLOCKED', detail: stages.find((x) => x.ok === false)?.detail ?? stages[1]!.detail }, checks: [ok ? (viaPrivate ? 'endpoint-private' : 'endpoint-public') : 'endpoint-blocked'] }
  },
}

const redStages: Stage[] = [
  { id: 'copies', label: 'Copies', kind: 'storage' },
  { id: 'event', label: 'Failure', kind: 'security' },
  { id: 'survive', label: 'Data survives?', kind: 'storage' },
  { id: 'read', label: 'Readable now?', kind: 'user' },
]
const COPIES: Record<string, string> = {
  LRS: '3 copies in one datacenter in the primary region.',
  ZRS: '3 copies across 3 availability zones in the primary region.',
  GRS: '3 copies (LRS) in the primary region + 3 copies (LRS) in the secondary region.',
  'RA-GRS': 'Like GRS, plus read access to the secondary region at any time.',
  GZRS: '3 copies across zones (ZRS) in the primary + 3 copies (LRS) in the secondary region.',
  'RA-GZRS': 'Like GZRS, plus read access to the secondary region at any time.',
}
const redundancy: Scenario = {
  id: 'redundancy',
  title: 'Storage redundancy',
  description: 'Choose a redundancy option and inject a failure.',
  stages: redStages,
  controls: [
    { type: 'select' as const, key: 'r', label: 'Redundancy', options: opt('LRS', 'ZRS', 'GRS', 'RA-GRS', 'GZRS', 'RA-GZRS') },
    { type: 'select' as const, key: 'event', label: 'Failure', options: opt('Disk or rack failure', 'Whole datacenter (zone) fails', 'Whole primary region outage') },
    { type: 'checkbox' as const, key: 'failover', label: 'Initiate customer-managed account failover' },
  ],
  initial: { r: 'LRS', event: 'Whole datacenter (zone) fails', failover: false },
  presets: [
    { label: 'Use ZRS', values: { r: 'ZRS' } },
    { label: 'Region outage with GRS', values: { r: 'GRS', event: 'Whole primary region outage' } },
    { label: 'Region outage with RA-GZRS', values: { r: 'RA-GZRS', event: 'Whole primary region outage' } },
  ],
  evaluate: (s: Record<string, string | number | boolean>) => {
    const r = str(s, 'r'); const e = str(s, 'event')
    const geo = r.includes('G'); const zonal = r.includes('Z'); const ra = r.startsWith('RA-')
    const survives = e.startsWith('Disk') || (e.startsWith('Whole datacenter') ? r !== 'LRS' : geo)
    const primaryUp = e.startsWith('Disk') || (e.startsWith('Whole datacenter') && zonal)
    const readable = primaryUp || ra || bool(s, 'failover')
    const stages = chain(redStages, [
      [true, COPIES[r] ?? r],
      [true, e],
      [survives, survives ? (primaryUp ? 'The primary region still has healthy copies.' : 'Copies in the secondary region survive.') : r === 'LRS' ? 'All three LRS copies are in the failed datacenter: data can be unavailable or lost.' : 'All copies were in the failed primary region.'],
      [readable, primaryUp ? 'Reads and writes continue in the primary region.' : ra ? 'Read-access geo-redundancy lets apps read from the secondary endpoint right away.' : bool(s, 'failover') ? 'After failover the secondary becomes the new primary (some recent writes can be lost).' : 'Data is safe in the secondary region but not readable until failover, or use an RA- option.'],
    ])
    const ok = allOk(stages)
    return { stages, outcome: { ok, title: ok ? 'DATA AVAILABLE' : survives ? 'DATA SAFE, NOT AVAILABLE' : 'DATA AT RISK', detail: stages.find((x) => x.ok === false)?.detail ?? stages[3]!.detail }, checks: [ok ? 'redundancy-survived' : 'redundancy-lost'] }
  },
}

const tagStages: Stage[] = [
  { id: 'rg', label: 'Resource group tags', kind: 'storage' },
  { id: 'res', label: 'VM tags', kind: 'compute' },
  { id: 'report', label: 'Cost report', kind: 'service' },
]
const tagScenario: Scenario = {
  id: 'tags',
  title: 'Tags and cost reports',
  description: 'Finance wants costs by department. See whether the VM\'s cost shows up under dept=finance.',
  stages: tagStages,
  controls: [
    { type: 'checkbox' as const, key: 'rgTag', label: 'Resource group tagged dept=finance' },
    { type: 'checkbox' as const, key: 'resTag', label: 'VM tagged dept=finance' },
    { type: 'checkbox' as const, key: 'inherit', label: 'Tag inheritance enabled (Azure Policy "Inherit a tag from the resource group" or Cost Management tag inheritance)' },
    { type: 'select' as const, key: 'group', label: 'Group cost analysis by', options: opt('Tag: dept', 'Resource group') },
  ],
  initial: { rgTag: true, resTag: false, inherit: false, group: 'Tag: dept' },
  presets: [
    { label: 'Enable tag inheritance', values: { inherit: true } },
    { label: 'Tag the VM directly', values: { resTag: true } },
    { label: 'Group by resource group instead', values: { group: 'Resource group' } },
  ],
  evaluate: (s: Record<string, string | number | boolean>) => {
    const byTag = str(s, 'group').startsWith('Tag')
    const has = bool(s, 'resTag') || (bool(s, 'rgTag') && bool(s, 'inherit'))
    const stages = chain(tagStages, [
      [true, bool(s, 'rgTag') ? 'Resource group: dept=finance.' : 'Resource group has no tags.'],
      [!byTag || has, !byTag ? 'Not needed when grouping by resource group.' : bool(s, 'resTag') ? 'VM has its own dept=finance tag.' : has ? 'Inheritance applies the resource group tag to the VM\'s costs.' : 'Tags are NOT inherited by default: the VM has no dept tag.'],
      [true, byTag ? 'VM cost appears under dept=finance.' : 'VM cost appears under its resource group.'],
    ])
    const ok = allOk(stages)
    return { stages, outcome: { ok, title: ok ? 'COST ATTRIBUTED' : 'COST UNTAGGED', detail: stages.find((x) => x.ok === false)?.detail ?? stages[2]!.detail }, checks: [ok ? 'tags-reported' : 'tags-missing'] }
  },
}

const govStages: Stage[] = [
  { id: 'rbac', label: 'RBAC: may you?', kind: 'identity' },
  { id: 'policy', label: 'Azure Policy: is it allowed?', kind: 'security' },
  { id: 'lock', label: 'Resource lock', kind: 'security' },
  { id: 'done', label: 'Result', kind: 'compute' },
]
const policyLock: Scenario = {
  id: 'policy-lock',
  title: 'RBAC, Policy and locks together',
  description: 'Every request passes RBAC, then Azure Policy, then resource locks.',
  stages: govStages,
  controls: [
    { type: 'select' as const, key: 'action', label: 'Action', options: opt('Create a VM in East US', 'Create a VM in Brazil South', 'Delete the production database', 'Change the VM size') },
    { type: 'select' as const, key: 'role', label: 'Your role', options: opt('Owner', 'Contributor', 'Reader') },
    { type: 'checkbox' as const, key: 'policy', label: 'Policy: allowed locations = East US, West Europe (effect: Deny)' },
    { type: 'select' as const, key: 'lock', label: 'Lock on the resource group', options: opt('None', 'CanNotDelete (Delete)', 'ReadOnly') },
  ],
  initial: { action: 'Delete the production database', role: 'Owner', policy: true, lock: 'CanNotDelete (Delete)' },
  presets: [
    { label: 'Create outside the allowed regions', values: { action: 'Create a VM in Brazil South', lock: 'None' } },
    { label: 'Reader tries to resize', values: { role: 'Reader', action: 'Change the VM size' } },
    { label: 'Allowed change', values: { action: 'Create a VM in East US', lock: 'None' } },
  ],
  evaluate: (s: Record<string, string | number | boolean>) => {
    const a = str(s, 'action'); const lock = str(s, 'lock')
    const rbacOk = str(s, 'role') !== 'Reader'
    const policyOk = !(bool(s, 'policy') && a.includes('Brazil'))
    const lockBlocks = lock === 'ReadOnly' || (lock.startsWith('CanNotDelete') && a.startsWith('Delete'))
    const stages = chain(govStages, [
      [rbacOk, rbacOk ? `${str(s, 'role')} can perform write and delete actions.` : 'Reader can only view: RBAC denies the request.'],
      [policyOk, policyOk ? (bool(s, 'policy') ? 'The request complies with the allowed-locations policy.' : 'No policy assigned.') : 'Azure Policy denies resources outside East US and West Europe, whatever your role.'],
      [!lockBlocks, lockBlocks ? `${lock} lock blocks this for everyone, even Owners. An Owner must remove the lock first.` : lock === 'None' ? 'No lock.' : 'A CanNotDelete lock still allows changes.'],
      [true, `${a}: done.`],
    ])
    const ok = allOk(stages)
    const fail = stages.findIndex((x) => x.ok === false)
    return { stages, outcome: { ok, title: ok ? 'ALLOWED' : 'BLOCKED', detail: stages.find((x) => x.ok === false)?.detail ?? stages[3]!.detail }, checks: [ok ? 'gov-allowed' : (['gov-rbac-denied', 'gov-policy-denied', 'gov-lock-blocked'][fail] ?? 'gov-lock-blocked')] }
  },
}

const iacStages: Stage[] = [
  { id: 'author', label: 'Define', kind: 'user' },
  { id: 'validate', label: 'Validate / preview', kind: 'security' },
  { id: 'deploy', label: 'Deploy', kind: 'service' },
  { id: 'result', label: 'Environment', kind: 'compute' },
]
const armDeploy: Scenario = {
  id: 'arm-deploy',
  title: 'Manual steps vs ARM templates',
  description: 'Build environments by hand or with a declarative template.',
  stages: iacStages,
  controls: [
    { type: 'select' as const, key: 'approach', label: 'Approach', options: opt('Manual portal steps', 'ARM template / Bicep file') },
    { type: 'select' as const, key: 'target', label: 'Deployment', options: opt('Dev (first deployment)', 'Same environment again', 'New test environment') },
    { type: 'select' as const, key: 'mode', label: 'Deployment mode', options: opt('Incremental', 'Complete') },
    { type: 'checkbox' as const, key: 'extra', label: 'Resource group also contains a resource that is not in the template' },
    { type: 'checkbox' as const, key: 'whatIf', label: 'Run what-if first' },
  ],
  initial: { approach: 'Manual portal steps', target: 'New test environment', mode: 'Incremental', extra: false, whatIf: false },
  presets: [
    { label: 'Use a Bicep template', values: { approach: 'ARM template / Bicep file' } },
    { label: 'Complete mode with an extra resource', values: { approach: 'ARM template / Bicep file', mode: 'Complete', extra: true } },
    { label: 'Run the template again', values: { approach: 'ARM template / Bicep file', target: 'Same environment again' } },
  ],
  evaluate: (s: Record<string, string | number | boolean>) => {
    const tpl = str(s, 'approach').startsWith('ARM'); const t = str(s, 'target')
    const manualDrift = !tpl && t === 'New test environment'
    const deletes = tpl && str(s, 'mode') === 'Complete' && bool(s, 'extra')
    const stages = chain(iacStages, [
      [true, tpl ? 'Declarative: the file describes the desired resources; Azure Resource Manager works out the steps and order.' : 'Imperative clicks: each setting is chosen by hand.'],
      [true, tpl ? (bool(s, 'whatIf') ? 'Resource Manager validated the template; what-if previews creates, changes and deletes.' : 'Resource Manager validates the template before deploying.') : 'No preview: mistakes are found after the fact.'],
      [!manualDrift, manualDrift ? 'Repeating dozens of manual steps for a new environment easily misses a setting: test no longer matches dev.' : tpl ? (t === 'Same environment again' ? 'Idempotent: running again with no changes leaves the resources as they are.' : 'Same template, same result, deployed in parallel where possible.') : 'Created by hand.'],
      [!deletes, deletes ? `Complete mode deleted the resource that is not in the template${bool(s, 'whatIf') ? ' (what-if warned you)' : ''}. Incremental mode leaves it alone.` : 'Environment matches the definition.'],
    ])
    const ok = allOk(stages)
    return { stages, outcome: { ok, title: ok ? 'CONSISTENT ENVIRONMENT' : deletes ? 'RESOURCE DELETED' : 'ENVIRONMENTS DRIFTED', detail: stages.find((x) => x.ok === false)?.detail ?? stages[2]!.detail }, checks: [ok ? 'iac-repeatable' : deletes ? 'iac-complete-delete' : 'iac-drift'] }
  },
}

const monStages: Stage[] = [
  { id: 'src', label: 'Data source', kind: 'compute' },
  { id: 'collect', label: 'Collected into', kind: 'storage' },
  { id: 'alert', label: 'Alert rule', kind: 'security' },
  { id: 'notify', label: 'Action group', kind: 'user' },
]
const SOURCES: Record<string, { needs: 'none' | 'ama' | 'ai'; store: string; alerts: string[] }> = {
  'VM CPU percentage (platform metric)': { needs: 'none', store: 'Azure Monitor Metrics (collected automatically)', alerts: ['Metric alert'] },
  'Errors in the VM\'s guest OS event log': { needs: 'ama', store: 'Log Analytics workspace via the Azure Monitor Agent and a data collection rule', alerts: ['Log search alert'] },
  'Web app exceptions and slow requests': { needs: 'ai', store: 'Application Insights (workspace-based)', alerts: ['Metric alert', 'Log search alert'] },
  'Someone deletes a resource (Activity log)': { needs: 'none', store: 'Azure Activity log (collected automatically for the subscription)', alerts: ['Activity log alert'] },
}
const alertPipeline: Scenario = {
  id: 'alert-pipeline',
  title: 'From data to alert',
  description: 'Collect the right data, choose the alert type and notify people.',
  stages: monStages,
  controls: [
    { type: 'select' as const, key: 'src', label: 'What to watch', options: opt(...Object.keys(SOURCES)) },
    { type: 'checkbox' as const, key: 'ama', label: 'Azure Monitor Agent + data collection rule on the VM' },
    { type: 'checkbox' as const, key: 'ai', label: 'Application Insights enabled for the app' },
    { type: 'select' as const, key: 'alert', label: 'Alert type', options: opt('Metric alert', 'Log search alert', 'Activity log alert') },
    { type: 'checkbox' as const, key: 'ag', label: 'Action group (email/SMS/webhook)' },
  ],
  initial: { src: 'Errors in the VM\'s guest OS event log', ama: false, ai: false, alert: 'Log search alert', ag: true },
  presets: [
    { label: 'Install the agent', values: { ama: true } },
    { label: 'CPU with a metric alert', values: { src: 'VM CPU percentage (platform metric)', alert: 'Metric alert' } },
    { label: 'Deleted resource, no action group', values: { src: 'Someone deletes a resource (Activity log)', alert: 'Activity log alert', ag: false } },
  ],
  evaluate: (s: Record<string, string | number | boolean>) => {
    const src = SOURCES[str(s, 'src')] ?? SOURCES['VM CPU percentage (platform metric)']!
    const collected = src.needs === 'none' || (src.needs === 'ama' ? bool(s, 'ama') : bool(s, 'ai'))
    const alertOk = src.alerts.includes(str(s, 'alert'))
    const stages = chain(monStages, [
      [true, str(s, 'src')],
      [collected, collected ? src.store : src.needs === 'ama' ? 'Guest OS logs are not collected until the Azure Monitor Agent and a data collection rule send them to a Log Analytics workspace.' : 'App telemetry needs Application Insights.'],
      [alertOk, alertOk ? `${str(s, 'alert')} evaluates this data.` : `Use a ${src.alerts.join(' or ')} for this data.`],
      [bool(s, 'ag'), bool(s, 'ag') ? 'The action group emails the on-call team.' : 'The alert fires and shows in the portal, but nobody is notified without an action group.'],
    ])
    const ok = allOk(stages)
    return { stages, outcome: { ok, title: ok ? 'ALERT WORKS' : 'ALERT GAP', detail: stages.find((x) => x.ok === false)?.detail ?? 'Data collected, rule evaluates it, people are notified.' }, checks: [ok ? 'monitor-alert-ok' : 'monitor-alert-broken'] }
  },
}

// ------------------------------------------------------------------ new choosers
const ch = (id: string, title: string, description: string, req: string, ans: string, answers: Record<string, string>, rows: Array<[string, string, string, string]>) =>
  chooser({ id, title, description, requirementLabel: req, answerLabel: ans, answers: Object.keys(answers), answerNotes: answers, cases: cases(rows) })

const cloudTraits = ch('cloud-traits', 'Cloud characteristics', 'Match each situation to a characteristic of cloud computing.', 'Situation', 'Characteristic', {
  'On-demand self-service': 'Provision resources yourself, when you need them, without a request to the provider.',
  'Broad network access': 'Services are reachable over the network from many kinds of devices.',
  'Resource pooling': 'The provider shares physical resources among many customers, kept isolated.',
  'Rapid elasticity': 'Capacity can grow and shrink quickly, often automatically.',
  'Measured service': 'Usage is metered and you pay for what you use.',
}, [
  ['self', 'A developer creates a database in minutes from the portal, without raising a ticket', 'On-demand self-service', 'No human approval or procurement is needed.'],
  ['net', 'Staff reach the same app from laptops, phones and tablets over the internet', 'Broad network access', 'Access over standard networks from any device.'],
  ['pool', 'Many customers run on the provider\'s servers, isolated from each other', 'Resource pooling', 'Multi-tenant pooling lowers cost for everyone.'],
  ['elastic', 'Capacity grows during a sale and shrinks afterwards automatically', 'Rapid elasticity', 'Resources follow demand.'],
  ['meter', 'You are billed per GB stored and per second of compute', 'Measured service', 'Metering makes consumption-based billing possible.'],
])

const hybridTools = ch('hybrid-tools', 'Hybrid and multicloud tools', 'Pick the Azure option that supports each hybrid or multicloud need.', 'Need', 'Azure option', {
  'Azure Arc': 'Manages servers, Kubernetes and data services outside Azure (on-premises or other clouds) through Azure Resource Manager.',
  'Azure VMware Solution': 'Runs VMware workloads in Azure on dedicated hosts.',
  ExpressRoute: 'Private, dedicated connection between your network and Azure.',
  'Azure Local': 'Azure-connected infrastructure that runs in your own datacenter (formerly Azure Stack HCI).',
}, [
  ['arc', 'Apply Azure Policy and monitoring to on-premises and AWS servers from one place', 'Azure Arc', 'Arc projects external resources into Azure for management.'],
  ['avs', 'Move VMware VMs to Azure without changing how they are run', 'Azure VMware Solution', 'Keep VMware tools and skills in Azure.'],
  ['er', 'A predictable private link between the datacenter and Azure, not over the internet', 'ExpressRoute', 'Private connectivity through a provider.'],
  ['local', 'Run virtual machines on hardware in your own building, managed with Azure', 'Azure Local', 'Hybrid infrastructure on-premises.'],
])

const pricingModel = ch('pricing-model', 'Pricing models', 'Pick the pricing option for each workload.', 'Workload', 'Pricing option', {
  'Pay-as-you-go': 'Per-second/hour consumption pricing, no commitment.',
  'Azure Reservations': 'Commit to a specific resource (for example a VM size in a region) for 1 or 3 years for a discount.',
  'Azure savings plan for compute': 'Commit to an hourly spend on compute for 1 or 3 years; applies across sizes and regions.',
  'Spot VMs': 'Unused capacity at a deep discount; Azure can evict the VM when it needs the capacity.',
  'Azure Hybrid Benefit': 'Use existing Windows Server/SQL Server licences with Software Assurance to cut costs.',
  'Serverless (consumption)': 'Pay per execution; no cost when idle.',
}, [
  ['new', 'A new project with unknown usage that may be stopped at any time', 'Pay-as-you-go', 'No commitment while usage is unknown.'],
  ['steady', 'One VM size in one region runs 24/7 for three years', 'Azure Reservations', 'Steady, predictable use of a specific resource.'],
  ['flex', 'Compute spend is steady, but VM sizes and regions keep changing', 'Azure savings plan for compute', 'Flexible commitment to spend.'],
  ['batch', 'Rendering jobs that can be interrupted and restarted', 'Spot VMs', 'Interruptible workloads suit spot pricing.'],
  ['lic', 'You already own Windows Server licences with Software Assurance', 'Azure Hybrid Benefit', 'Reuse licences instead of paying for them again.'],
  ['event', 'Code runs a few hundred times a day for seconds and is otherwise idle', 'Serverless (consumption)', 'Pay only while code runs.'],
])

const benefitChoice = ch('benefit', 'Which benefit?', 'Match each situation to a cloud benefit.', 'Situation', 'Benefit', {
  'High availability': 'Keeps services running despite failures, backed by SLAs.',
  Scalability: 'Add resources to handle more load: scale up (bigger) or out (more instances).',
  Elasticity: 'Automatically add and remove resources as demand changes.',
  Reliability: 'Recover from failures and keep working; global regions enable disaster recovery.',
  Predictability: 'Predictable performance (autoscale, load balancing) and predictable cost (forecasts, TCO, budgets).',
}, [
  ['ha', 'The app stays up when a VM or zone fails, with a 99.99% SLA', 'High availability', 'Redundancy plus an SLA.'],
  ['scale', 'Move to a VM with more memory as the database grows', 'Scalability', 'Vertical scaling (scale up).'],
  ['elastic', 'Instances are added automatically at 9 a.m. and removed at night', 'Elasticity', 'Automatic matching of demand.'],
  ['rel', 'Data is replicated to another region so the business recovers from a disaster', 'Reliability', 'Decentralised design for recovery.'],
  ['pred', 'Finance forecasts next quarter\'s cloud spend with confidence', 'Predictability', 'Cost predictability with cost tools.'],
])

const manageChoice = ch('manageability', 'Security, governance, manageability', 'Match each capability to the benefit it represents.', 'Capability', 'Benefit', {
  Security: 'Protection you get from the platform: physical security, DDoS protection, patched PaaS/SaaS.',
  Governance: 'Keeping deployments compliant with corporate and regulatory standards (templates, policies, auditing).',
  'Management of the cloud': 'Managing resources: autoscale, templates, health monitoring, automatic replacement, alerts.',
  'Management in the cloud': 'How you manage: portal, CLI, APIs, PowerShell.',
}, [
  ['patch', 'With PaaS, the provider patches and maintains the operating system for you', 'Security', 'Platform security responsibilities shift to the provider.'],
  ['audit', 'Auditing flags resources that do not follow company standards', 'Governance', 'Compliance through policy and auditing.'],
  ['auto', 'Resources are replaced automatically when they fail, and you are alerted', 'Management of the cloud', 'Managing the resources themselves.'],
  ['tools', 'Manage everything through a web portal, a command line or REST APIs', 'Management in the cloud', 'The tools you use to manage.'],
  ['ddos', 'Basic DDoS protection is built into the Azure platform', 'Security', 'Built-in platform protection.'],
])

const complianceChoice = ch('compliance', 'Where to get assurance', 'Pick the resource for each security or compliance question.', 'Question', 'Resource', {
  'Service Trust Portal': 'Microsoft audit reports (ISO, SOC, PCI) and compliance documents.',
  'Azure Policy': 'Enforces and audits rules on your resources.',
  'Microsoft Defender for Cloud': 'Secure score, recommendations and threat protection for your workloads.',
}, [
  ['reports', 'Your auditor wants Microsoft\'s SOC 2 report', 'Service Trust Portal', 'Microsoft publishes audit reports there.'],
  ['https', 'Every storage account must allow HTTPS only', 'Azure Policy', 'Policy can deny or audit non-compliant settings.'],
  ['score', 'How secure are our resources, and what should we fix first?', 'Microsoft Defender for Cloud', 'Secure score and prioritised recommendations.'],
])

const serviceExamples = ch('service-examples', 'Azure services by type', 'Classify each product as IaaS, PaaS or SaaS.', 'Product', 'Service type', {
  IaaS: 'You rent infrastructure and manage the OS and everything above it.',
  PaaS: 'You deploy apps and data; the provider manages the OS and runtime.',
  SaaS: 'A finished application you use; you manage data, users and settings.',
}, [
  ['vm', 'Azure Virtual Machines', 'IaaS', 'You patch the OS and install software.'],
  ['app', 'Azure App Service', 'PaaS', 'Deploy code; Azure manages the platform.'],
  ['m365', 'Microsoft 365 (Outlook, Teams)', 'SaaS', 'A complete application.'],
  ['sql', 'Azure SQL Database', 'PaaS', 'Managed database engine: no OS or patching to manage.'],
  ['func', 'Azure Functions', 'PaaS', 'Serverless is usually grouped with PaaS: you deploy only code.'],
  ['d365', 'Dynamics 365', 'SaaS', 'Business applications delivered as a service.'],
])

const geography = ch('geography', 'Regions, zones and datacenters', 'Name the part of Azure\'s physical infrastructure.', 'Description', 'Term', {
  Region: 'A geographical area with one or more datacenters connected by a low-latency network.',
  'Region pair': 'Two regions in the same geography; updates roll out to one at a time and recovery is prioritised.',
  'Availability zone': 'A physically separate group of datacenters within a region, with independent power, cooling and networking.',
  Datacenter: 'A facility with racks of servers. You do not choose datacenters directly.',
  'Sovereign region': 'An isolated instance of Azure for compliance or legal needs (Azure Government, Azure operated by 21Vianet in China).',
}, [
  ['region', 'You choose this when you create most resources, such as "West Europe"', 'Region', 'Most resources are deployed to a region.'],
  ['pair', 'Planned platform updates are not applied to both of these at once', 'Region pair', 'Sequential updates limit impact.'],
  ['zone', 'Spread VMs across these to survive a datacenter failure inside one region', 'Availability zone', 'Zones isolate datacenter failures.'],
  ['dc', 'The building that houses servers; Azure decides which one is used', 'Datacenter', 'Abstracted behind regions and zones.'],
  ['gov', 'US federal agencies need a physically isolated instance of Azure', 'Sovereign region', 'Azure Government.'],
  ['cn', 'Azure services in mainland China, operated by a local company', 'Sovereign region', 'Azure operated by 21Vianet.'],
])

const scopeLevel = ch('scope-level', 'Which level of the hierarchy?', 'Pick the level that fits each need.', 'Need', 'Level', {
  Resource: 'A single manageable item: VM, storage account, database.',
  'Resource group': 'A container for resources that share a lifecycle. No nesting; each resource is in exactly one group.',
  Subscription: 'A unit of billing and access control that contains resource groups.',
  'Management group': 'A container for subscriptions so policies and access apply to many at once.',
}, [
  ['delete', 'Delete everything for a finished project in one action', 'Resource group', 'Deleting a resource group deletes its resources.'],
  ['bill', 'Bill the marketing department separately', 'Subscription', 'Subscriptions are billing boundaries.'],
  ['many', 'Apply one policy to 40 subscriptions at once', 'Management group', 'Assign once at the management group; it is inherited.'],
  ['single', 'Change one storage account\'s settings', 'Resource', 'The individual item.'],
  ['dev', 'Separate development and production with different access and spending limits', 'Subscription', 'Access and billing boundaries.'],
])

const vmOptions = ch('vm-options', 'VM availability and scale options', 'Pick the VM option for each requirement.', 'Requirement', 'Option', {
  'Single VM': 'One VM: simplest, no redundancy.',
  'Availability set': 'Spreads VMs across fault domains (racks) and update domains in one datacenter.',
  'VMs across availability zones': 'VMs in separate zones survive a datacenter failure.',
  'Virtual Machine Scale Sets': 'Identical, load-balanced VMs that scale automatically.',
  'Azure Virtual Desktop': 'Cloud-hosted Windows desktops and apps, including multi-session Windows 11.',
}, [
  ['as', 'Keep the app up during a rack failure or host maintenance in one datacenter', 'Availability set', 'Fault and update domains.'],
  ['vmss', 'Add identical VMs automatically when CPU rises', 'Virtual Machine Scale Sets', 'Autoscale for a group of VMs.'],
  ['avd', 'Contractors need a secure Windows desktop from their own devices', 'Azure Virtual Desktop', 'Desktop virtualisation.'],
  ['zones', 'Survive the loss of a whole datacenter in the region', 'VMs across availability zones', 'Zones are physically separate.'],
  ['test', 'A test server where downtime is acceptable', 'Single VM', 'Redundancy costs more and is not needed.'],
])

const hosting = ch('hosting', 'Application hosting', 'Pick where to host each app.', 'App', 'Hosting option', {
  'Azure App Service': 'PaaS for web apps and APIs: autoscale, deployment slots, no OS to manage.',
  'Azure Container Instances': 'Run a single container quickly, no orchestration.',
  'Azure Container Apps': 'Serverless containers for microservices, scale to zero, Kubernetes managed for you.',
  'Azure Kubernetes Service': 'Managed Kubernetes for full control of container orchestration.',
  'Azure Virtual Machines': 'Full OS control for apps with special requirements.',
}, [
  ['web', 'A .NET web app with staging slots and no servers to patch', 'Azure App Service', 'Managed web hosting.'],
  ['aci', 'Run one container for a short batch task', 'Azure Container Instances', 'Simplest way to run a container.'],
  ['aca', 'Several microservices in containers that scale to zero, without managing Kubernetes', 'Azure Container Apps', 'Serverless containers.'],
  ['aks', 'Hundreds of containers needing custom Kubernetes configuration', 'Azure Kubernetes Service', 'Full orchestration control.'],
  ['legacy', 'A legacy app needs a specific OS configuration and installed agents', 'Azure Virtual Machines', 'IaaS for full control.'],
])

const vnetConcepts = ch('vnet-concepts', 'Virtual networking concepts', 'Pick the networking concept for each need.', 'Need', 'Concept', {
  'Virtual network': 'A private network in Azure with your own address space.',
  Subnet: 'A range of addresses inside a VNet to group and isolate resources.',
  'Virtual network peering': 'Connects two VNets privately over the Microsoft backbone, in the same or different regions.',
  'Azure DNS': 'Hosts DNS domains on Azure name servers.',
  'VPN Gateway': 'Encrypted connections over the internet: site-to-site (office) or point-to-site (single device).',
  ExpressRoute: 'Private connection through a connectivity provider that does not go over the public internet.',
}, [
  ['vnet', 'Give Azure VMs a private network with the address range 10.1.0.0/16', 'Virtual network', 'VNets provide isolation and private addressing.'],
  ['subnet', 'Separate web servers and databases into different address ranges in one network', 'Subnet', 'Subnets segment a VNet.'],
  ['p2s', 'Remote workers connect their laptops securely to the VNet', 'VPN Gateway', 'Point-to-site VPN.'],
  ['global', 'Connect a VNet in West Europe to one in East US privately', 'Virtual network peering', 'Global VNet peering.'],
  ['zone', 'Manage records for contoso.com using Azure credentials and billing', 'Azure DNS', 'DNS hosting.'],
  ['er', 'High-bandwidth private connection with predictable latency, not over the internet', 'ExpressRoute', 'Dedicated private connectivity.'],
])

const endpoints = ch('endpoints', 'Public or private endpoint?', 'Pick the endpoint type for each requirement.', 'Requirement', 'Endpoint', {
  'Public endpoint': 'An internet-reachable address for the service (can be limited with firewall rules).',
  'Private endpoint': 'A network interface with a private IP from your VNet that connects privately to the service.',
}, [
  ['site', 'A public website must be reachable by anyone', 'Public endpoint', 'Internet users need a public address.'],
  ['ip', 'A storage account must have an IP address from the VNet', 'Private endpoint', 'The private endpoint gets a VNet IP.'],
  ['nointernet', 'Traffic from VMs to a SQL database must not use the public internet, and public access will be disabled', 'Private endpoint', 'Private Link keeps traffic private.'],
  ['partners', 'Partners call your API from their own networks over the internet', 'Public endpoint', 'External clients use the public endpoint.'],
])

const accountType = ch('account-type', 'Storage account types', 'Pick the storage account type.', 'Requirement', 'Account type', {
  'Standard general-purpose v2': 'Blobs, Data Lake Storage, queues, tables and file shares. Recommended for most scenarios. Supports all redundancy options.',
  'Premium block blobs': 'SSD-backed blob storage for low latency and high transaction rates. LRS or ZRS.',
  'Premium file shares': 'SSD-backed SMB and NFS file shares. LRS or ZRS.',
  'Premium page blobs': 'Premium page blobs only (for example VHD files). LRS or ZRS.',
}, [
  ['gp', 'Store blobs, queues and tables in one account with geo-redundancy', 'Standard general-purpose v2', 'The default for most scenarios.'],
  ['fastblob', 'Many small objects with very low latency, such as IoT telemetry', 'Premium block blobs', 'High transaction rates on SSD.'],
  ['files', 'High-performance enterprise SMB shares', 'Premium file shares', 'Premium Azure Files.'],
  ['page', 'Only page blobs are needed, on premium storage', 'Premium page blobs', 'Specialised account type.'],
])

const tiers = ch('tier', 'Access tiers', 'Pick the blob access tier.', 'Data', 'Tier', {
  Hot: 'Frequently accessed data. Highest storage cost, lowest access cost.',
  Cool: 'Infrequently accessed data kept at least 30 days.',
  Cold: 'Rarely accessed data kept at least 90 days, still online.',
  Archive: 'Offline; kept at least 180 days; must be rehydrated (hours) before reading. Set per blob.',
}, [
  ['web', 'Website images read many times a day', 'Hot', 'Frequent access.'],
  ['backup', 'Short-term backups rarely read, kept for 30+ days', 'Cool', 'Infrequent access, online.'],
  ['cold', 'Data read a few times a year, kept 90+ days, must be readable immediately', 'Cold', 'Online, cheaper than Cool.'],
  ['legal', 'Compliance records kept 7 years; waiting hours to read is fine', 'Archive', 'Lowest storage cost, offline.'],
])

const moveTools = ch('move-tools', 'Moving files and migrating', 'Pick the tool.', 'Task', 'Tool', {
  AzCopy: 'Command-line utility to copy blobs and files to, from and between storage accounts.',
  'Azure Storage Explorer': 'Free graphical app (Windows, macOS, Linux) to manage storage; uses AzCopy underneath.',
  'Azure File Sync': 'Syncs Windows file servers with Azure Files, with cloud tiering.',
  'Azure Migrate': 'Hub to discover, assess and migrate servers, databases, web apps and data to Azure.',
  'Azure Data Box': 'Physical device shipped to you to move large amounts of data offline.',
}, [
  ['script', 'Script a nightly copy of blobs between two storage accounts', 'AzCopy', 'Command-line, scriptable.'],
  ['gui', 'Browse containers and upload files in a desktop app', 'Azure Storage Explorer', 'GUI tool.'],
  ['sync', 'Keep the on-premises file server but cache and sync it with Azure Files', 'Azure File Sync', 'Hybrid file sync.'],
  ['servers', 'Assess 200 on-premises servers for Azure readiness and cost, then migrate them', 'Azure Migrate', 'Discovery, assessment and migration.'],
  ['ship', 'Move 80 TB with a slow internet connection', 'Azure Data Box', 'Offline transfer is faster than the network.'],
])

const directory = ch('directory', 'Directory and external identities', 'Pick the identity service.', 'Need', 'Service', {
  'Microsoft Entra ID': 'Cloud identity and access management for users, groups, apps and devices.',
  'Microsoft Entra Domain Services': 'Managed domain services (domain join, Group Policy, LDAP, Kerberos/NTLM) without running domain controllers.',
  'B2B collaboration': 'Invite partners as guests who sign in with their own identities.',
  'External ID for customers': 'Consumer sign-up and sign-in for your apps (email, social accounts) in an external tenant.',
}, [
  ['staff', 'Employees sign in to Microsoft 365 and the Azure portal', 'Microsoft Entra ID', 'Workforce identity.'],
  ['legacy', 'A legacy app needs LDAP and Kerberos, but you do not want to run domain controllers', 'Microsoft Entra Domain Services', 'Managed domain.'],
  ['partner', 'A partner\'s staff use your app with their own work accounts', 'B2B collaboration', 'Guest access.'],
  ['shop', 'Shoppers sign up for your app with email or a social account', 'External ID for customers', 'Customer identity.'],
  ['sync', 'Synchronise on-premises Active Directory users to the cloud', 'Microsoft Entra ID', 'With Microsoft Entra Connect sync.'],
])

const authMethods = ch('auth-methods', 'Authentication methods', 'Pick the method that matches each description.', 'Description', 'Method', {
  'Single sign-on (SSO)': 'Sign in once to use many applications.',
  'Multifactor authentication (MFA)': 'Two or more of: something you know, have, or are.',
  Passwordless: 'No password: Windows Hello for Business, Microsoft Authenticator, FIDO2 security keys, passkeys.',
}, [
  ['sso', 'One sign-in gives access to many apps', 'Single sign-on (SSO)', 'One identity, many apps.'],
  ['mfa', 'Password plus a code from the Authenticator app', 'Multifactor authentication (MFA)', 'Know + have.'],
  ['pwless', 'Sign in with a FIDO2 key or face recognition, no password at all', 'Passwordless', 'Removes the password.'],
  ['stolen', 'A stolen password alone is not enough to sign in', 'Multifactor authentication (MFA)', 'A second factor is required.'],
  ['fewer', 'Users have fewer passwords to remember and reset', 'Single sign-on (SSO)', 'Fewer credentials.'],
])

const rbacRole = ch('rbac-role', 'Built-in Azure roles', 'Pick the least-privileged built-in role.', 'Requirement', 'Role', {
  Owner: 'Full access, including assigning roles to others.',
  Contributor: 'Create and manage all resources, but cannot grant access.',
  Reader: 'View resources only.',
  'User Access Administrator': 'Manage user access to resources, without managing the resources.',
}, [
  ['view', 'Auditors must view resources but change nothing', 'Reader', 'Read-only.'],
  ['manage', 'Developers create and manage resources but must not grant access', 'Contributor', 'Manage, not grant.'],
  ['full', 'The project lead manages resources and grants access to the team', 'Owner', 'Everything including access.'],
  ['access', 'Security team manages who has access, not the resources', 'User Access Administrator', 'Access only.'],
])

const zeroTrust = ch('zero-trust', 'Zero Trust principles', 'Match each practice to a Zero Trust principle.', 'Practice', 'Principle', {
  'Verify explicitly': 'Authenticate and authorise using all available signals: identity, location, device, risk.',
  'Use least privilege access': 'Just-in-time and just-enough access, risk-based policies.',
  'Assume breach': 'Minimise blast radius: segment, encrypt end to end, use analytics to detect threats.',
}, [
  ['device', 'Check user, device health and location on every sign-in', 'Verify explicitly', 'All signals, every time.'],
  ['jit', 'Give admin rights only for the hour they are needed', 'Use least privilege access', 'Just-in-time access.'],
  ['segment', 'Segment networks and encrypt data so one breach cannot reach everything', 'Assume breach', 'Limit blast radius.'],
  ['inside', 'Require MFA even on the corporate network', 'Verify explicitly', 'Location alone does not grant trust.'],
  ['detect', 'Use analytics to detect threats and improve defences', 'Assume breach', 'Plan for compromise.'],
])

const defenseLayer = ch('defense-layer', 'Defense-in-depth layers', 'Match each control to its layer.', 'Control', 'Layer', {
  'Physical security': 'Securing datacenter buildings and hardware.',
  'Identity and access': 'Controlling access: SSO, MFA, auditing.',
  Perimeter: 'Protecting the edge: DDoS protection, perimeter firewalls.',
  Network: 'Limiting communication between resources: segmentation, NSGs.',
  Compute: 'Securing VMs: patching, endpoint protection, closing ports.',
  Application: 'Secure code, secrets stored safely.',
  Data: 'Protecting the data itself: encryption, access to databases and storage.',
}, [
  ['badge', 'Biometric access to datacenter buildings', 'Physical security', 'Microsoft handles this layer.'],
  ['mfa', 'MFA and Conditional Access for administrators', 'Identity and access', 'Controls who gets in.'],
  ['ddos', 'DDoS protection and a firewall at the network edge', 'Perimeter', 'Filters attacks before they reach resources.'],
  ['nsg', 'NSGs allow only the web subnet to reach the database subnet', 'Network', 'Segmentation.'],
  ['patch', 'Patch VMs and close unused ports', 'Compute', 'Harden the hosts.'],
  ['kv', 'Keep connection strings in Key Vault, not in code', 'Application', 'Secure application design.'],
  ['enc', 'Encrypt the database and storage accounts', 'Data', 'Protect the data itself.'],
])

const costFactor = ch('cost-factor', 'What affects cost?', 'Match each situation to the cost factor.', 'Situation', 'Factor', {
  'Resource type and size': 'Different services, tiers and sizes have different prices.',
  Consumption: 'Pay for what you use; commit (reservations) for discounts.',
  Maintenance: 'Unused or leftover resources (disks, IPs) keep costing money.',
  Geography: 'Prices differ between regions.',
  'Network traffic': 'Data leaving Azure (egress) and between regions is billed; most inbound data is free.',
  'Subscription type': 'Some subscriptions (for example free accounts) include allowances.',
  'Azure Marketplace': 'Third-party solutions can add their own charges.',
}, [
  ['region', 'The same VM size costs more in one region than another', 'Geography', 'Prices vary by region.'],
  ['egress', 'Users download large videos from Azure; uploads were free', 'Network traffic', 'Outbound data transfer is billed.'],
  ['leftover', 'A VM was deleted but its disk and public IP still appear on the bill', 'Maintenance', 'Clean up associated resources.'],
  ['free', 'A free account includes credit and some free services', 'Subscription type', 'Subscription offers differ.'],
  ['market', 'A third-party firewall appliance adds licence charges', 'Azure Marketplace', 'Vendor pricing applies.'],
  ['ssd', 'Premium SSD disks cost more than Standard HDD', 'Resource type and size', 'Tier and size drive price.'],
])

const costTools = ch('cost-tools', 'Cost management tools', 'Pick the tool for each cost task.', 'Task', 'Tool', {
  'Pricing calculator': 'Estimate the cost of resources before you deploy them.',
  'Cost analysis': 'Explore and report actual and forecast spend by service, resource group or tag.',
  Budgets: 'Set a spending threshold and get alerts (and optionally trigger actions).',
  'Cost alerts': 'Budget, credit, quota and anomaly alerts in one view.',
  'Azure Advisor': 'Recommendations such as resizing or shutting down underused resources.',
}, [
  ['estimate', 'Estimate the monthly cost of a design before deploying', 'Pricing calculator', 'Pre-deployment estimates.'],
  ['spend', 'See last month\'s spend by service and resource group', 'Cost analysis', 'Analyse actual costs.'],
  ['limit', 'Email finance when spend reaches 80% of the monthly amount', 'Budgets', 'Threshold notifications.'],
  ['resize', 'Find VMs that are too big for their workload', 'Azure Advisor', 'Cost recommendations.'],
  ['anomaly', 'Be warned when spending suddenly changes', 'Cost alerts', 'Anomaly alerts.'],
])

const cliOrPs = ch('cli-or-ps', 'Azure CLI, PowerShell, Cloud Shell', 'Identify the tool.', 'Command or description', 'Tool', {
  'Azure CLI': 'Cross-platform commands that start with az.',
  'Azure PowerShell': 'PowerShell cmdlets in verb-noun form (Get-AzVM).',
  'Azure Cloud Shell': 'Browser-based, already-authenticated shell with Bash or PowerShell and both tools installed.',
}, [
  ['azlist', 'az vm list --output table', 'Azure CLI', 'az commands are Azure CLI.'],
  ['getvm', 'Get-AzVM | Select-Object Name', 'Azure PowerShell', 'Verb-noun cmdlets.'],
  ['browser', 'A shell in the browser, already signed in, nothing to install', 'Azure Cloud Shell', 'Runs from the portal or shell.azure.com.'],
  ['newrg', 'New-AzResourceGroup -Name rg1 -Location eastus', 'Azure PowerShell', 'Az PowerShell module.'],
  ['azrg', 'az group create --name rg1 --location eastus', 'Azure CLI', 'Azure CLI.'],
])

const iacBenefit = ch('iac-benefit', 'Benefits of ARM templates', 'Match each statement to an ARM template benefit.', 'Statement', 'Benefit', {
  'Declarative syntax': 'Describe what to deploy, not how.',
  'Repeatable results': 'Deploy the same template many times and get the same result.',
  Orchestration: 'Resource Manager orders dependent resources and deploys in parallel when possible.',
  'Built-in validation': 'The template is checked before deployment starts.',
  'Modular files': 'Break templates into smaller, reusable linked or nested pieces.',
}, [
  ['what', 'You describe the resources you want, not the commands to create them', 'Declarative syntax', 'Desired state.'],
  ['same', 'Dev, test and production are deployed from one file and match', 'Repeatable results', 'Consistency.'],
  ['order', 'The VNet is created before the VM that depends on it, automatically', 'Orchestration', 'Dependency handling.'],
  ['check', 'A typo in a property is caught before any resource is created', 'Built-in validation', 'Validation step.'],
  ['split', 'The network and the app are in separate template files', 'Modular files', 'Reusable components.'],
])

const advisorCategory = ch('advisor-category', 'Azure Advisor categories', 'Match each recommendation to an Advisor category.', 'Recommendation', 'Category', {
  Reliability: 'Keep business-critical apps running (formerly High Availability).',
  Security: 'Detect threats and vulnerabilities (from Defender for Cloud).',
  Performance: 'Improve speed and responsiveness.',
  Cost: 'Reduce overall spend.',
  'Operational excellence': 'Process and workflow efficiency, manageability, deployment best practices.',
}, [
  ['resize', 'Shut down or resize underused virtual machines', 'Cost', 'Saves money.'],
  ['zones', 'Use availability zones for this critical VM', 'Reliability', 'Improves continuity.'],
  ['vuln', 'Remediate vulnerabilities found on your VMs', 'Security', 'Security recommendations.'],
  ['speed', 'Upgrade to Premium SSD for better disk throughput', 'Performance', 'Improves speed.'],
  ['ops', 'Create Service Health alerts for your subscriptions', 'Operational excellence', 'Operational best practice.'],
])

const healthScope = ch('health-scope', 'Azure status, Service Health, Resource Health', 'Pick the right health view.', 'Question', 'Service', {
  'Azure status': 'Public, global view of Azure service health across all regions.',
  'Service Health': 'Personalised view of incidents, planned maintenance and advisories for the services and regions you use.',
  'Resource Health': 'Health of your individual resources, including past platform-caused problems.',
}, [
  ['global', 'Is there a widespread Azure outage? (No sign-in required)', 'Azure status', 'Public status page.'],
  ['mine', 'Notify me of planned maintenance that affects my subscriptions', 'Service Health', 'Personalised notifications.'],
  ['vm', 'Was my specific VM unavailable last night because of a platform issue?', 'Resource Health', 'Per-resource health history.'],
  ['retire', 'Which upcoming retirements and health advisories affect my services?', 'Service Health', 'Health advisories.'],
])

// ------------------------------------------------------------------ groups, one per lesson
const g = (id: string, scenarios: ScenarioGroup['scenarios'], fidelity: ScenarioGroup['fidelity'] = doc, fidelityNote = docNote): ScenarioGroup => ({ id, fidelity, fidelityNote, scenarios })

export const groups: ScenarioGroup[] = [
  g('az900-cloud-basics-sim', [cloudTraits, pick(conceptsGroup, 'responsibility')], 'accurate-model', 'The shared responsibility table follows Microsoft\'s documented diagram; characteristics follow the NIST definition used in Microsoft Learn.'),
  g('az900-cloud-models-sim', [pick(conceptsGroup, 'cloud-model'), hybridTools]),
  g('az900-pricing-sim', [pick(conceptsGroup, 'pricing'), pricingModel], doc, 'Cost numbers are illustrative units, not Azure prices. Pricing options follow Microsoft documentation.'),
  g('az900-benefits-sim', [pick(conceptsGroup, 'benefits'), benefitChoice], doc, 'Composite SLA is the product of the dependent SLAs; SLA figures are examples.'),
  g('az900-manage-sim', [manageChoice, complianceChoice]),
  g('az900-service-types-sim', [pick(conceptsGroup, 'service-type'), serviceExamples]),
  g('az900-regions-sim', [pick(archGroup, 'regions'), geography], 'accurate-model', 'Failure scopes of zones, regions and region pairs follow Microsoft documentation.'),
  g('az900-hierarchy-sim', [pick(archGroup, 'hierarchy'), scopeLevel], 'accurate-model', 'Hierarchy and inheritance rules follow Microsoft documentation.'),
  g('az900-compute-sim', [pick(servicesGroup, 'compute'), vmOptions]),
  g('az900-vm-hosting-sim', [vmBuild, hosting]),
  g('az900-vnet-sim', [vnetConcepts, pick(servicesGroup, 'networking')]),
  g('az900-endpoints-sim', [endpointReach, endpoints], 'accurate-model', 'Public network access, firewall rules and private endpoints behave as documented for Azure Storage; DNS details are simplified.'),
  g('az900-storage-sim', [pick(servicesGroup, 'storage'), accountType]),
  g('az900-redundancy-sim', [redundancy, tiers], 'accurate-model', 'Copy placement and failover behaviour follow Azure Storage redundancy documentation.'),
  g('az900-migration-sim', [pick(servicesGroup, 'migration'), moveTools], doc, 'Transfer times are simple arithmetic estimates.'),
  g('az900-entra-sim', [directory, authMethods, pick(identityGroup, 'signin')]),
  g('az900-access-sim', [pick(identityGroup, 'signin'), rbacRole], doc, 'Real Conditional Access evaluates many more signals; RBAC roles are the documented built-in roles.'),
  g('az900-defense-sim', [defense, zeroTrust, defenseLayer]),
  g('az900-cost-sim', [pick(govGroup, 'cost'), costFactor], doc, 'Cost numbers are illustrative units, not Azure prices.'),
  g('az900-costmgmt-sim', [tagScenario, costTools], 'accurate-model', 'Tags are not inherited by default; inheritance needs Azure Policy or Cost Management tag inheritance, as documented.'),
  g('az900-governance-sim', [policyLock, pick(govGroup, 'governance')], 'accurate-model', 'Order of evaluation (RBAC, then Policy, then locks) and lock behaviour follow Microsoft documentation.'),
  g('az900-tools-sim', [pick(govGroup, 'tools'), cliOrPs]),
  g('az900-iac-sim', [armDeploy, iacBenefit], 'accurate-model', 'Incremental and complete deployment modes behave as documented for ARM.'),
  g('az900-health-sim', [advisorCategory, healthScope]),
  g('az900-monitor-sim', [alertPipeline, pick(govGroup, 'monitoring')]),
]
