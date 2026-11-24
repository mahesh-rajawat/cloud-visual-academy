/**
 * AZ-104 compute scenarios: ARM/Bicep deployments, virtual machines, scale sets and autoscale,
 * containers (ACR, ACI, Container Apps) and App Service.
 * Each evaluate() encodes documented behaviour; see the doc links in the related lessons.
 */
import { allOk, bool, chain, num, opt, str, type ScenarioGroup, type Stage } from '../scenario'

// ------------------------------------------------------------------ ARM / Bicep
const armStages: Stage[] = [
  { id: 'author', label: 'Template / Bicep file', kind: 'service' },
  { id: 'params', label: 'Parameters', kind: 'service' },
  { id: 'validate', label: 'ARM validation', kind: 'security' },
  { id: 'order', label: 'Dependency graph', kind: 'network' },
  { id: 'deploy', label: 'Resource providers', kind: 'compute' },
]

export function deploymentOrder(resources: Array<{ name: string; dependsOn: string[] }>): { order: string[][]; cycle: boolean } {
  const remaining = new Map(resources.map((r) => [r.name, new Set(r.dependsOn.filter((d) => resources.some((x) => x.name === d)))]))
  const order: string[][] = []
  while (remaining.size) {
    const ready = [...remaining].filter(([, deps]) => deps.size === 0).map(([n]) => n)
    if (!ready.length) return { order, cycle: true }
    order.push(ready)
    ready.forEach((n) => remaining.delete(n))
    remaining.forEach((deps) => ready.forEach((n) => deps.delete(n)))
  }
  return { order, cycle: false }
}

export function deploymentModeEffect(mode: 'Incremental' | 'Complete', existing: string[], inTemplate: string[]) {
  const created = inTemplate.filter((r) => !existing.includes(r))
  const updated = inTemplate.filter((r) => existing.includes(r))
  const deleted = mode === 'Complete' ? existing.filter((r) => !inTemplate.includes(r)) : []
  const untouched = mode === 'Incremental' ? existing.filter((r) => !inTemplate.includes(r)) : []
  return { created, updated, deleted, untouched }
}

const armGroup: ScenarioGroup = {
  id: 'arm-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'Deployment ordering follows dependsOn / symbolic references (parallel where possible), validation rules, and Incremental vs Complete semantics as documented. Real validation checks many more properties.',
  scenarios: [
    {
      id: 'deploy',
      title: 'Deploy a template',
      description: 'A template creates a VNet, a NIC that depends on it, a storage account and a VM that depends on the NIC. Edit it and deploy.',
      stages: armStages,
      controls: [
        { type: 'select', key: 'format', label: 'Authoring format', options: opt('ARM JSON', 'Bicep') },
        { type: 'checkbox', key: 'nicDependsOnVnet', label: 'NIC declares its dependency on the VNet (dependsOn / symbolic reference)' },
        { type: 'checkbox', key: 'cycle', label: 'Edit: VNet also depends on the VM (introduces a cycle)' },
        { type: 'checkbox', key: 'adminPasswordProvided', label: 'Secure parameter adminPassword supplied' },
        { type: 'select', key: 'location', label: 'location parameter', options: opt('resourceGroup().location', 'westeurope', 'mars-central') },
        { type: 'select', key: 'storageSku', label: 'storageSku parameter (allowedValues: Standard_LRS, Standard_ZRS)', options: opt('Standard_LRS', 'Standard_ZRS', 'Premium_GRS') },
        { type: 'checkbox', key: 'whatIf', label: 'Run what-if first' },
      ],
      initial: { format: 'Bicep', nicDependsOnVnet: true, cycle: false, adminPasswordProvided: true, location: 'resourceGroup().location', storageSku: 'Standard_LRS', whatIf: true },
      presets: [
        { label: 'Missing dependency (NIC deployed before VNet)', values: { nicDependsOnVnet: false, format: 'ARM JSON' } },
        { label: 'Circular dependency', values: { cycle: true } },
        { label: 'Parameter not in allowedValues', values: { storageSku: 'Premium_GRS' } },
      ],
      evaluate: (s) => {
        const bicep = str(s, 'format') === 'Bicep'
        const res = [
          { name: 'vnet', dependsOn: bool(s, 'cycle') ? ['vm'] : [] },
          { name: 'nic', dependsOn: bool(s, 'nicDependsOnVnet') ? ['vnet'] : [] },
          { name: 'storage', dependsOn: [] },
          { name: 'vm', dependsOn: ['nic'] },
        ]
        const { order, cycle } = deploymentOrder(res)
        const paramOk = bool(s, 'adminPasswordProvided') && str(s, 'storageSku') !== 'Premium_GRS'
        const locOk = str(s, 'location') !== 'mars-central'
        const raceRisk = !bool(s, 'nicDependsOnVnet')
        const stages = chain(armStages, [
          [true, bicep ? 'Bicep compiles to ARM JSON (az bicep build); symbolic references create implicit dependencies.' : 'ARM JSON: $schema, contentVersion, parameters, variables, resources, outputs.'],
          [paramOk, !bool(s, 'adminPasswordProvided') ? 'adminPassword (@secure) has no default and was not supplied: deployment cannot start.' : str(s, 'storageSku') === 'Premium_GRS' ? 'Premium_GRS is not in allowedValues: InvalidTemplate.' : 'All parameters resolved; secure values are not logged in deployment history.'],
          [!cycle && locOk, cycle ? 'Circular dependency detected: InvalidTemplate. Remove the dependency that loops back.' : !locOk ? 'LocationNotAvailableForResourceType: invalid location.' : 'Template is syntactically valid; preflight checks passed.'],
          [!raceRisk, raceRisk ? 'Without the dependency ARM may create the NIC in parallel with the VNet, so it fails with a not-found error (or works by luck).' : `Deployed in waves: ${order.map((w) => `[${w.join(', ')}]`).join(' → ')}. Independent resources deploy in parallel.`],
          [true, 'Resources created. Deployment history records each operation.'],
        ])
        const ok = allOk(stages)
        return {
          stages,
          outcome: { ok, title: ok ? 'DEPLOYMENT SUCCEEDED' : 'DEPLOYMENT FAILED', detail: ok ? 'All four resources provisioned in dependency order.' : stages.find((x) => x.ok === false)!.detail },
          checks: [ok ? 'arm-deployed' : 'arm-failed', ...(bicep ? ['bicep-used'] : [])],
          metrics: [{ label: 'Deployment waves', value: cycle ? 'cycle' : String(order.length) }, { label: 'What-if', value: bool(s, 'whatIf') ? 'Shows Create ×4 before deploying' : 'skipped' }],
        }
      },
    },
    {
      id: 'mode',
      title: 'Incremental vs Complete',
      description: 'The resource group already contains vnet, nic, vm and an old storage account "stlegacy". The template contains vnet, nic, vm and "stnew".',
      stages: [
        { id: 'tpl', label: 'Template', kind: 'service' },
        { id: 'mode', label: 'Deployment mode', kind: 'security' },
        { id: 'rg', label: 'Resource group result', kind: 'storage' },
      ],
      controls: [
        { type: 'select', key: 'mode', label: 'Mode', options: opt('Incremental', 'Complete') },
        { type: 'checkbox', key: 'lock', label: 'stlegacy has a CanNotDelete lock' },
      ],
      initial: { mode: 'Incremental', lock: false },
      evaluate: (s) => {
        const mode = str(s, 'mode') as 'Incremental' | 'Complete'
        const e = deploymentModeEffect(mode, ['vnet', 'nic', 'vm', 'stlegacy'], ['vnet', 'nic', 'vm', 'stnew'])
        const lockBlocks = mode === 'Complete' && bool(s, 'lock')
        const stages = chain([{ id: 'tpl', label: 'Template', kind: 'service' }, { id: 'mode', label: 'Deployment mode', kind: 'security' }, { id: 'rg', label: 'Resource group result', kind: 'storage' }], [
          [true, 'Template defines vnet, nic, vm, stnew.'],
          [true, mode === 'Incremental' ? 'Incremental (default): resources not in the template are left unchanged.' : 'Complete: resources in the resource group that are not in the template are deleted.'],
          [!lockBlocks, lockBlocks ? 'Deletion of stlegacy fails because of the lock; the deployment reports an error.' : `Created: ${e.created.join(', ') || '-'} · Updated: ${e.updated.join(', ')} · Deleted: ${e.deleted.join(', ') || '-'} · Untouched: ${e.untouched.join(', ') || '-'}`],
        ])
        return {
          stages,
          outcome: { ok: allOk(stages), title: e.deleted.length && !lockBlocks ? 'RESOURCES DELETED' : allOk(stages) ? 'DEPLOYED' : 'FAILED', detail: stages[2]!.detail },
          checks: mode === 'Complete' ? ['complete-mode'] : ['incremental-mode'],
          notes: ['Always run what-if before a Complete-mode deployment.', 'Complete mode applies only at resource group scope.'],
        }
      },
    },
    {
      id: 'export',
      title: 'Export and convert',
      description: 'Capture existing infrastructure as code, then convert ARM JSON to Bicep.',
      stages: [
        { id: 'src', label: 'Existing resources', kind: 'compute' },
        { id: 'export', label: 'Export template', kind: 'service' },
        { id: 'decompile', label: 'az bicep decompile', kind: 'service' },
        { id: 'review', label: 'Review and parameterise', kind: 'user' },
      ],
      controls: [
        { type: 'select', key: 'source', label: 'Export from', options: opt('Resource group (current state)', 'Deployment history (original template)') },
        { type: 'checkbox', key: 'unsupported', label: 'Group contains a resource type that cannot be exported' },
        { type: 'checkbox', key: 'decompile', label: 'Convert the exported JSON to Bicep' },
      ],
      initial: { source: 'Resource group (current state)', unsupported: false, decompile: true },
      evaluate: (s) => {
        const fromRg = str(s, 'source').startsWith('Resource group')
        const stages = chain([{ id: 'src', label: 'Existing resources', kind: 'compute' }, { id: 'export', label: 'Export template', kind: 'service' }, { id: 'decompile', label: 'az bicep decompile', kind: 'service' }, { id: 'review', label: 'Review and parameterise', kind: 'user' }], [
          [true, '3 resources in rg-app.'],
          [true, fromRg ? `Export template captures the current state with values hard-coded${bool(s, 'unsupported') ? '; the unsupported resource type is skipped with a warning' : ''}.` : 'The deployment history holds the exact template and parameters that were deployed.'],
          [true, bool(s, 'decompile') ? 'Decompile is best-effort: the output can need fixes (warnings for unsupported expressions).' : 'Kept as ARM JSON.'],
          [true, 'Replace hard-coded names, locations and secrets with parameters before reuse.'],
        ])
        return {
          stages,
          outcome: { ok: true, title: 'TEMPLATE CAPTURED', detail: bool(s, 'unsupported') && fromRg ? 'Some resources were not exported: add them manually.' : 'Template ready for review.' },
          checks: ['template-exported', ...(bool(s, 'decompile') ? ['template-decompiled'] : [])],
        }
      },
    },
  ],
}

// ------------------------------------------------------------------ Virtual machines
export const SLA = { single: '99.9% (Premium SSD / Ultra for all disks)', set: '99.95%', zones: '99.99%' }

export function availabilityOutcome(p: { placement: 'single' | 'set' | 'zones'; vms: number; failure: 'none' | 'host' | 'maintenance' | 'zone' | 'region'; faultDomains: number; updateDomains: number }) {
  const v = Math.max(1, p.vms)
  if (p.failure === 'none') return { running: v, detail: 'All instances running.' }
  if (p.failure === 'region') return { running: 0, detail: 'A regional outage affects all zones; use a second region (Site Recovery) for this.' }
  if (p.placement === 'single') return { running: 0, detail: 'The only VM is affected; it restarts on healthy hardware (host failure) or reboots (maintenance).' }
  if (p.placement === 'set') {
    if (p.failure === 'zone') return { running: 0, detail: 'Availability sets live in one datacenter/zone; a zone failure can take down every VM in the set.' }
    const domains = p.failure === 'host' ? Math.min(p.faultDomains, v) : Math.min(p.updateDomains, v)
    const lost = Math.ceil(v / domains)
    return { running: v - lost, detail: `${p.failure === 'host' ? 'Fault domain (rack: power + network) failure' : 'Planned maintenance reboots one update domain at a time'}: ${lost} of ${v} VMs affected.` }
  }
  const zones = Math.min(3, v)
  const lost = Math.ceil(v / zones)
  return { running: v - lost, detail: p.failure === 'zone' ? `One zone lost: ${lost} of ${v} VMs affected; the others serve traffic.` : `Only VMs on the affected host/update batch in one zone restart: ${lost} of ${v} at most.` }
}

export function resizeCheck(p: { running: boolean; availableOnCluster: boolean; inSet: boolean }) {
  if (p.availableOnCluster) return { ok: true, needsDeallocate: false, detail: 'The new size is available on the current hardware cluster: resize while running (the VM restarts).' }
  if (!p.running) return { ok: true, needsDeallocate: true, detail: 'VM is deallocated, so any size available in the region can be selected.' }
  return { ok: false, needsDeallocate: true, detail: p.inSet ? 'Size not available on the current cluster: deallocate ALL VMs in the availability set, then resize.' : 'Size not available on the current cluster: deallocate the VM first.' }
}

// Encryption at host replaces Azure Disk Encryption (ADE retires 15 Sep 2028).
export function hostEncryptionCheck(p: { featureRegistered: boolean; sizeSupported: boolean; running: boolean; hadAde: boolean }) {
  const errors: string[] = []
  if (p.hadAde) errors.push('Encryption at host cannot be enabled on a VM that has, or ever had, Azure Disk Encryption. Migrate to a new VM with new disks.')
  if (!p.featureRegistered) errors.push('Register the EncryptionAtHost feature for the subscription first (az feature register --namespace Microsoft.Compute --name EncryptionAtHost).')
  if (!p.sizeSupported) errors.push('This VM size does not support encryption at host (check the EncryptionAtHostSupported capability); resize first.')
  if (p.running) errors.push('Deallocate the VM first: an existing VM must be deallocated to turn encryption at host on or off.')
  return errors
}

const vmStages: Stage[] = [
  { id: 'quota', label: 'Subscription quota', kind: 'security' },
  { id: 'sku', label: 'Size availability', kind: 'compute' },
  { id: 'image', label: 'Image + credentials', kind: 'identity' },
  { id: 'net', label: 'VNet / NIC / NSG', kind: 'network' },
  { id: 'vm', label: 'Running VM', kind: 'compute' },
]

const vmGroup: ScenarioGroup = {
  id: 'vm-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'Provisioning checks, resize rules, availability placement outcomes and SLA figures follow Microsoft documentation. Quota numbers and capacity are illustrative.',
  scenarios: [
    {
      id: 'create',
      title: 'Create a VM',
      description: 'Walk a VM creation request through the checks that commonly fail.',
      stages: vmStages,
      controls: [
        { type: 'select', key: 'size', label: 'Size', options: opt('Standard_B2s (2 vCPU)', 'Standard_D4s_v5 (4 vCPU)', 'Standard_E16s_v5 (16 vCPU)') },
        { type: 'number', key: 'quotaFree', label: 'Free regional vCPU quota for the family', min: 0, max: 100 },
        { type: 'checkbox', key: 'zoneHasSku', label: 'Size offered in the chosen zone' },
        { type: 'select', key: 'username', label: 'Admin username', options: opt('azureuser', 'admin', 'administrator') },
        { type: 'select', key: 'auth', label: 'Authentication', options: opt('SSH public key', 'Password (12+ chars, 3 of 4 classes)', 'Password "Passw0rd"') },
        { type: 'select', key: 'publicInbound', label: 'Public inbound ports', options: opt('None (use Bastion)', 'Allow SSH 22 from any') },
      ],
      initial: { size: 'Standard_D4s_v5 (4 vCPU)', quotaFree: 10, zoneHasSku: true, username: 'azureuser', auth: 'SSH public key', publicInbound: 'None (use Bastion)' },
      presets: [
        { label: 'Quota exhausted', values: { quotaFree: 2, size: 'Standard_E16s_v5 (16 vCPU)' } },
        { label: 'Reserved username', values: { username: 'admin' } },
        { label: 'Size not offered in zone', values: { zoneHasSku: false } },
      ],
      evaluate: (s) => {
        const vcpu = Number(/\((\d+) vCPU\)/.exec(str(s, 'size'))![1])
        const quotaOk = vcpu <= num(s, 'quotaFree')
        const userOk = str(s, 'username') === 'azureuser'
        const pwOk = !str(s, 'auth').includes('Passw0rd')
        const stages = chain(vmStages, [
          [quotaOk, quotaOk ? `${vcpu} vCPU fits in ${num(s, 'quotaFree')} free.` : `OperationNotAllowed: needs ${vcpu} vCPU, only ${num(s, 'quotaFree')} free. Request a quota increase (Usage + quotas).`],
          [bool(s, 'zoneHasSku'), bool(s, 'zoneHasSku') ? 'SKU available (check with az vm list-skus).' : 'SkuNotAvailable in this zone/region; pick another size, zone or region.'],
          [userOk && pwOk, !userOk ? `"${str(s, 'username')}" is a reserved username.` : !pwOk ? 'Password does not meet complexity (12–123 chars, 3 of: lower, upper, digit, special) and is a disallowed value.' : 'Credentials accepted.'],
          [true, str(s, 'publicInbound').startsWith('None') ? 'NIC in snet-app, no public IP. Connect through Azure Bastion.' : 'Warning: SSH open to the internet. Prefer Bastion or just-in-time access.'],
          [true, 'VM running with OS disk, NIC and (optionally) data disks.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'VM CREATED' : 'CREATION FAILED', detail: ok ? 'Deployment succeeded.' : stages.find((x) => x.ok === false)!.detail }, checks: [ok ? 'vm-created' : 'vm-create-failed'] }
      },
    },
    {
      id: 'availability',
      title: 'Availability sets vs zones',
      description: 'Place web VMs and inject failures. Compare running instances and SLAs.',
      stages: [
        { id: 'place', label: 'Placement', kind: 'compute' },
        { id: 'fail', label: 'Failure event', kind: 'security' },
        { id: 'svc', label: 'Service still up?', kind: 'globe' },
      ],
      controls: [
        { type: 'select', key: 'placement', label: 'Placement', options: [{ value: 'single', label: 'Single VM' }, { value: 'set', label: 'Availability set' }, { value: 'zones', label: 'Across availability zones' }] },
        { type: 'number', key: 'vms', label: 'Number of VMs', min: 1, max: 12 },
        { type: 'number', key: 'faultDomains', label: 'Fault domains (set: max 3)', min: 1, max: 3 },
        { type: 'number', key: 'updateDomains', label: 'Update domains (set: max 20)', min: 1, max: 20 },
        { type: 'select', key: 'failure', label: 'Inject', options: [{ value: 'none', label: 'Nothing' }, { value: 'host', label: 'Rack / host failure' }, { value: 'maintenance', label: 'Planned maintenance' }, { value: 'zone', label: 'Zone (datacenter) failure' }, { value: 'region', label: 'Region outage' }] },
      ],
      initial: { placement: 'set', vms: 4, faultDomains: 2, updateDomains: 5, failure: 'host' },
      evaluate: (s) => {
        const placement = str(s, 'placement') as 'single' | 'set' | 'zones'
        const r = availabilityOutcome({ placement, vms: num(s, 'vms'), failure: str(s, 'failure') as 'none', faultDomains: num(s, 'faultDomains'), updateDomains: num(s, 'updateDomains') })
        const up = r.running > 0
        const stages = chain([{ id: 'place', label: 'Placement', kind: 'compute' }, { id: 'fail', label: 'Failure event', kind: 'security' }, { id: 'svc', label: 'Service still up?', kind: 'globe' }], [
          [true, placement === 'set' ? `${num(s, 'vms')} VMs over ${num(s, 'faultDomains')} FDs / ${num(s, 'updateDomains')} UDs. Must be chosen at VM creation.` : placement === 'zones' ? `${num(s, 'vms')} VMs spread over zones 1–3.` : 'One VM.'],
          [true, r.detail],
          [up, up ? `${r.running} of ${num(s, 'vms')} VMs serving behind the load balancer.` : 'No healthy VM: outage.'],
        ])
        if (placement !== 'single' && num(s, 'vms') < 2) stages[2]!.detail += ' The multi-VM SLA needs at least 2 VMs.'
        return {
          stages,
          outcome: { ok: up, title: up ? 'SERVICE AVAILABLE' : 'OUTAGE', detail: r.detail },
          checks: [`placement-${placement}`, ...(str(s, 'failure') === 'zone' && placement === 'zones' && up ? ['zone-survived'] : [])],
          metrics: [{ label: 'Compute SLA', value: placement === 'single' ? SLA.single : placement === 'set' ? SLA.set : SLA.zones }, { label: 'Running', value: `${r.running}/${num(s, 'vms')}` }],
        }
      },
    },
    {
      id: 'resize-disks',
      title: 'Resize, disks and encryption',
      description: 'Change VM size, add or expand disks, and enable disk encryption.',
      stages: [
        { id: 'size', label: 'Resize', kind: 'compute' },
        { id: 'disk', label: 'Managed disks', kind: 'storage' },
        { id: 'enc', label: 'Encryption', kind: 'security' },
      ],
      controls: [
        { type: 'checkbox', key: 'running', label: 'VM is running' },
        { type: 'checkbox', key: 'availableOnCluster', label: 'New size available on the current hardware cluster' },
        { type: 'checkbox', key: 'inSet', label: 'VM is in an availability set' },
        { type: 'select', key: 'diskOp', label: 'Disk operation', options: opt('Expand data disk 128 → 256 GiB', 'Shrink data disk 256 → 128 GiB', 'Change Standard SSD → Premium SSD', 'Add data disk beyond the size\'s max data disks') },
        { type: 'select', key: 'encryption', label: 'Encryption', options: opt('SSE with platform-managed keys (default)', 'SSE with customer-managed keys (disk encryption set)', 'Encryption at host', 'Azure Disk Encryption (retiring 15 Sep 2028)') },
        { type: 'checkbox', key: 'featureRegistered', label: 'Host encryption: EncryptionAtHost feature registered' },
        { type: 'checkbox', key: 'sizeSupported', label: 'Host encryption: VM size supports it' },
        { type: 'checkbox', key: 'hadAde', label: 'VM has or ever had Azure Disk Encryption' },
      ],
      initial: { running: true, availableOnCluster: false, inSet: false, diskOp: 'Expand data disk 128 → 256 GiB', encryption: 'Encryption at host', featureRegistered: false, sizeSupported: true, hadAde: false },
      evaluate: (s) => {
        const rz = resizeCheck({ running: bool(s, 'running'), availableOnCluster: bool(s, 'availableOnCluster'), inSet: bool(s, 'inSet') })
        const op = str(s, 'diskOp')
        const diskOk = !op.startsWith('Shrink') && !op.startsWith('Add data disk beyond') && !(op.startsWith('Change') && bool(s, 'running'))
        const diskMsg = op.startsWith('Expand') ? 'Data disks can be expanded (often without downtime); then extend the partition in the OS.' : op.startsWith('Shrink') ? 'Managed disks cannot be shrunk. Create a smaller disk and copy data.' : op.startsWith('Change') ? (bool(s, 'running') ? 'Changing the disk type requires the VM to be deallocated.' : 'Disk type changed while deallocated.') : 'Each VM size has a maximum number of data disks; choose a larger size.'
        const enc = str(s, 'encryption')
        const isHost = enc === 'Encryption at host'
        const host = isHost ? hostEncryptionCheck({ featureRegistered: bool(s, 'featureRegistered'), sizeSupported: bool(s, 'sizeSupported'), running: bool(s, 'running'), hadAde: bool(s, 'hadAde') }) : []
        const encMsg = isHost ? (host.length ? host.join(' ') : 'Encryption at host on: temp disk, ephemeral OS disk and disk caches are encrypted on the host, and data flows encrypted to storage. Start the VM again.')
          : enc.startsWith('SSE with platform') ? 'Always on: server-side encryption with platform-managed keys.'
          : enc.startsWith('SSE with customer') ? 'Disk encryption set points to a Key Vault key; its managed identity needs key access.'
          : 'Azure Disk Encryption (BitLocker / DM-Crypt inside the guest) retires on 15 Sep 2028. Use encryption at host for new VMs.'
        const stages = chain([{ id: 'size', label: 'Resize', kind: 'compute' }, { id: 'disk', label: 'Managed disks', kind: 'storage' }, { id: 'enc', label: 'Encryption', kind: 'security' }], [[rz.ok, rz.detail], [diskOk, diskMsg], [host.length === 0, encMsg]])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'CHANGES APPLIED' : 'OPERATION BLOCKED', detail: ok ? 'All operations succeeded.' : stages.find((x) => x.ok === false)!.detail }, checks: [rz.needsDeallocate ? 'resize-deallocate' : 'resize-online', ...(ok && isHost ? ['host-encryption'] : []), ...(diskOk ? [] : ['disk-blocked'])] }
      },
    },
    {
      id: 'move',
      title: 'Move a VM',
      description: 'Choose how to move a VM to another resource group, subscription or region.',
      stages: [
        { id: 'target', label: 'Target', kind: 'globe' },
        { id: 'tool', label: 'Method', kind: 'service' },
        { id: 'deps', label: 'Dependencies', kind: 'network' },
        { id: 'done', label: 'VM in new location', kind: 'compute' },
      ],
      controls: [
        { type: 'select', key: 'target', label: 'Move to', options: opt('Another resource group', 'Another subscription (same tenant)', 'Another region') },
        { type: 'select', key: 'tool', label: 'Method', options: opt('Resource move (portal Move / az resource move)', 'Azure Resource Mover', 'Azure Site Recovery') },
        { type: 'checkbox', key: 'withDeps', label: 'Include disks, NIC and other dependencies' },
      ],
      initial: { target: 'Another region', tool: 'Resource move (portal Move / az resource move)', withDeps: true },
      evaluate: (s) => {
        const region = str(s, 'target') === 'Another region'
        const tool = str(s, 'tool')
        const toolOk = region ? !tool.startsWith('Resource move') : tool.startsWith('Resource move')
        const stages = chain([{ id: 'target', label: 'Target', kind: 'globe' }, { id: 'tool', label: 'Method', kind: 'service' }, { id: 'deps', label: 'Dependencies', kind: 'network' }, { id: 'done', label: 'VM in new location', kind: 'compute' }], [
          [true, str(s, 'target')],
          [toolOk, toolOk ? (region ? `${tool} replicates and recreates the VM in the target region.` : 'Resource move changes the resource ID only; the VM keeps its region.') : region ? 'Resource move cannot change regions.' : `${tool} is for region moves; use resource move for RG/subscription changes.`],
          [bool(s, 'withDeps'), bool(s, 'withDeps') ? 'Dependent resources move with the VM.' : 'Validation fails: dependent resources must be moved together.'],
          [true, 'VM available in the target. Update scripts that used the old resource ID.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'MOVE COMPLETE' : 'MOVE NOT POSSIBLE', detail: ok ? stages[1]!.detail : stages.find((x) => x.ok === false)!.detail }, checks: ok ? [region ? 'vm-moved-region' : 'vm-moved-rg'] : ['vm-move-failed'] }
      },
    },
  ],
}

// ------------------------------------------------------------------ Autoscale (VMSS + containers)
export interface AutoscaleRule { metricAbove: number; metricBelow: number; durationMin: number; cooldownMin: number; step: number }

export function simulateAutoscale(load: number[], rule: AutoscaleRule, min: number, max: number, start: number, perInstanceCapacity: number) {
  let inst = Math.min(max, Math.max(min, start))
  let lastAction = -Infinity
  const instances: number[] = []
  const metric: number[] = []
  const events: Array<{ x: number; label: string }> = []
  for (let t = 0; t < load.length; t++) {
    const util = Math.min(100, (load[t]! / (inst * perInstanceCapacity)) * 100)
    metric.push(util)
    const window = metric.slice(Math.max(0, t - rule.durationMin + 1))
    const avg = window.reduce((a, b) => a + b, 0) / window.length
    const coolOk = t - lastAction >= rule.cooldownMin
    if (window.length >= rule.durationMin && coolOk) {
      // Scale-out wins over scale-in; scale-in happens only when the average is below the threshold.
      if (avg > rule.metricAbove && inst < max) { inst = Math.min(max, inst + rule.step); lastAction = t; events.push({ x: t, label: `+${rule.step} → ${inst}` }) }
      else if (avg < rule.metricBelow && inst > min) { inst = Math.max(min, inst - rule.step); lastAction = t; events.push({ x: t, label: `-${rule.step} → ${inst}` }) }
    }
    instances.push(inst)
  }
  return { instances, metric, events }
}

export function acaReplicas(concurrentRequests: number, targetPerReplica: number, minReplicas: number, maxReplicas: number) {
  if (concurrentRequests === 0) return minReplicas
  return Math.min(maxReplicas, Math.max(minReplicas, Math.ceil(concurrentRequests / targetPerReplica)))
}

const loadProfile = (peak: number) => Array.from({ length: 120 }, (_, t) => (t < 20 ? 20 : t < 60 ? 20 + ((peak - 20) * (t - 20)) / 40 : t < 80 ? peak : Math.max(20, peak - ((peak - 20) * (t - 80)) / 20)))

const autoscaleGroup: ScenarioGroup = {
  id: 'autoscale-sim',
  fidelity: 'simplified-illustration',
  fidelityNote: 'The autoscale engine averages the metric over the rule duration, respects cooldown, min/max/default counts, and lets scale-out win over scale-in. Metric math and timing are simplified (1 tick = 1 minute); Container Apps uses KEDA-based concurrency scaling.',
  scenarios: [
    {
      id: 'vmss',
      title: 'VM Scale Set autoscale',
      description: 'A web tier gets a traffic peak. Tune the CPU rules and watch instances follow (each tick = 1 minute).',
      stages: [{ id: 'metric', label: 'Azure Monitor metric', kind: 'service' }, { id: 'rule', label: 'Autoscale rule', kind: 'security' }, { id: 'vmss', label: 'Scale set instances', kind: 'compute' }],
      controls: [
        { type: 'number', key: 'peak', label: 'Peak load (requests/s ×10)', min: 20, max: 1000 },
        { type: 'number', key: 'out', label: 'Scale out when avg CPU >', min: 10, max: 95 },
        { type: 'number', key: 'in', label: 'Scale in when avg CPU <', min: 5, max: 90 },
        { type: 'number', key: 'duration', label: 'Duration (min)', min: 1, max: 30 },
        { type: 'number', key: 'cooldown', label: 'Cooldown (min)', min: 1, max: 30 },
        { type: 'number', key: 'min', label: 'Minimum instances', min: 0, max: 20 },
        { type: 'number', key: 'max', label: 'Maximum instances', min: 1, max: 100 },
        { type: 'select', key: 'mode', label: 'Orchestration mode', options: opt('Flexible', 'Uniform') },
        { type: 'select', key: 'upgrade', label: 'Upgrade policy', options: opt('Rolling', 'Automatic', 'Manual') },
      ],
      initial: { peak: 600, out: 70, in: 30, duration: 10, cooldown: 5, min: 2, max: 10, mode: 'Flexible', upgrade: 'Rolling' },
      presets: [{ label: 'Flapping: thresholds too close', values: { out: 55, in: 50 } }, { label: 'Max too low for the peak', values: { max: 3 } }],
      evaluate: (s) => {
        const r = simulateAutoscale(loadProfile(num(s, 'peak')), { metricAbove: num(s, 'out'), metricBelow: num(s, 'in'), durationMin: num(s, 'duration'), cooldownMin: num(s, 'cooldown'), step: 1 }, num(s, 'min'), num(s, 'max'), num(s, 'min'), 60)
        const saturated = r.metric.filter((m) => m >= 99).length
        const flaps = r.events.length
        const stages = chain([{ id: 'metric', label: 'Azure Monitor metric', kind: 'service' }, { id: 'rule', label: 'Autoscale rule', kind: 'security' }, { id: 'vmss', label: 'Scale set instances', kind: 'compute' }], [
          [true, `Percentage CPU averaged over ${num(s, 'duration')} min.`],
          [num(s, 'out') - num(s, 'in') >= 20, num(s, 'out') - num(s, 'in') >= 20 ? `Out > ${num(s, 'out')}%, in < ${num(s, 'in')}%, cooldown ${num(s, 'cooldown')} min.` : 'Scale-out and scale-in thresholds are too close: autoscale may flap (Azure has flapping protection, but the rules are still poor).'],
          [saturated < 10, saturated < 10 ? `Peak handled with up to ${Math.max(...r.instances)} instances.` : `CPU saturated for ${saturated} minutes: raise the maximum or scale earlier.`],
        ])
        const ok = allOk(stages)
        return {
          stages, outcome: { ok, title: ok ? 'AUTOSCALE HEALTHY' : 'AUTOSCALE NEEDS TUNING', detail: ok ? `${flaps} scale actions; instances between ${Math.min(...r.instances)} and ${Math.max(...r.instances)}.` : stages.find((x) => x.ok === false)!.detail },
          checks: ok ? ['autoscale-tuned'] : ['autoscale-problem'],
          series: { xLabel: 'minutes', yLabel: 'CPU % / instances ×10', lines: [{ label: 'avg CPU %', points: r.metric }, { label: 'instances ×10', points: r.instances.map((i) => i * 10), color: '#15935a' }], markers: r.events.slice(0, 12) },
          notes: [`${str(s, 'mode')} orchestration${str(s, 'mode') === 'Flexible' ? ': standard VMs, can mix sizes, spread across fault domains/zones' : ': identical instances from one model'}. Upgrade policy ${str(s, 'upgrade')}: ${str(s, 'upgrade') === 'Manual' ? 'you upgrade instances yourself' : str(s, 'upgrade') === 'Automatic' ? 'all instances updated in random order at once' : 'batches with health checks'}.`],
        }
      },
    },
    {
      id: 'containers',
      title: 'Container sizing and scaling',
      description: 'Compare Azure Container Instances (fixed size, no autoscale) with Azure Container Apps scale rules.',
      stages: [{ id: 'svc', label: 'Service', kind: 'service' }, { id: 'size', label: 'CPU / memory', kind: 'compute' }, { id: 'scale', label: 'Scaling', kind: 'security' }],
      controls: [
        { type: 'select', key: 'service', label: 'Service', options: opt('Azure Container Apps', 'Azure Container Instances') },
        { type: 'select', key: 'cpuMem', label: 'Per container CPU / memory', options: opt('0.5 vCPU / 1 GiB', '1 vCPU / 2 GiB', '2 vCPU / 4 GiB', '1 vCPU / 8 GiB') },
        { type: 'number', key: 'concurrent', label: 'Concurrent HTTP requests', min: 0, max: 2000 },
        { type: 'number', key: 'target', label: 'ACA HTTP rule: concurrent requests per replica', min: 1, max: 500 },
        { type: 'number', key: 'minR', label: 'ACA min replicas', min: 0, max: 30 },
        { type: 'number', key: 'maxR', label: 'ACA max replicas', min: 1, max: 300 },
      ],
      initial: { service: 'Azure Container Apps', cpuMem: '0.5 vCPU / 1 GiB', concurrent: 250, target: 10, minR: 0, maxR: 10 },
      presets: [{ label: 'Idle (scale to zero)', values: { concurrent: 0 } }, { label: 'ACI under load', values: { service: 'Azure Container Instances', concurrent: 800 } }],
      evaluate: (s) => {
        const aca = str(s, 'service') === 'Azure Container Apps'
        const [cpu, mem] = str(s, 'cpuMem').split(' / ').map((x) => parseFloat(x))
        // Container Apps (Consumption) requires memory = 2 × CPU (GiB per vCPU).
        const ratioOk = !aca || mem === cpu! * 2
        const replicas = aca ? acaReplicas(num(s, 'concurrent'), num(s, 'target'), num(s, 'minR'), num(s, 'maxR')) : 1
        const needed = aca ? Math.ceil(num(s, 'concurrent') / num(s, 'target')) : 0
        const capped = aca && needed > num(s, 'maxR')
        const stages = chain([{ id: 'svc', label: 'Service', kind: 'service' }, { id: 'size', label: 'CPU / memory', kind: 'compute' }, { id: 'scale', label: 'Scaling', kind: 'security' }], [
          [true, aca ? 'Serverless containers with revisions, ingress and KEDA scale rules.' : 'A container group with fixed CPU/memory; restart policy Always/OnFailure/Never.'],
          [ratioOk, ratioOk ? `${str(s, 'cpuMem')} per container${aca ? '' : ' (change requires redeploying the group)'}.` : 'Container Apps Consumption profile needs memory = 2 × vCPU (for example 1 vCPU / 2 GiB).'],
          [aca ? !capped : num(s, 'concurrent') < 300, aca ? (capped ? `Rule wants ${needed} replicas but max is ${num(s, 'maxR')}: requests queue.` : `${replicas} replica(s)${replicas === 0 ? ': scaled to zero, no compute charge while idle' : ''}.`) : num(s, 'concurrent') < 300 ? 'One container group handles the load.' : 'ACI has no autoscale: deploy more container groups behind a load balancer, or use Container Apps / AKS.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'SIZED CORRECTLY' : 'SIZING PROBLEM', detail: ok ? stages[2]!.detail : stages.find((x) => x.ok === false)!.detail }, checks: [aca ? (replicas === 0 ? 'aca-scale-zero' : 'aca-scaled') : 'aci-fixed'], metrics: [{ label: 'Replicas', value: String(replicas) }] }
      },
    },
  ],
}

// ------------------------------------------------------------------ Containers: ACR, ACI, ACA
const containerStages: Stage[] = [
  { id: 'build', label: 'Build image', kind: 'service' },
  { id: 'acr', label: 'Azure Container Registry', kind: 'storage' },
  { id: 'auth', label: 'Pull authentication', kind: 'identity' },
  { id: 'run', label: 'Run (ACI / Container Apps)', kind: 'compute' },
  { id: 'expose', label: 'Network exposure', kind: 'globe' },
]

export function acrNameValid(n: string) { return /^[a-zA-Z0-9]{5,50}$/.test(n) }

const containerGroup: ScenarioGroup = {
  id: 'container-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'Registry SKU features, authentication options (admin user, AcrPull for managed identities/service principals), ACI restart policies and DNS labels, and Container Apps ingress/revisions follow Microsoft documentation.',
  scenarios: [
    {
      id: 'pipeline',
      title: 'Build, push, pull, run',
      description: 'Build an image into ACR and run it on ACI or Container Apps.',
      stages: containerStages,
      controls: [
        { type: 'select', key: 'registryName', label: 'Registry name', options: opt('acrcontoso01', 'acr-contoso', 'cr1') },
        { type: 'select', key: 'sku', label: 'ACR SKU', options: opt('Basic', 'Standard', 'Premium') },
        { type: 'checkbox', key: 'geoRep', label: 'Need geo-replication to a second region' },
        { type: 'select', key: 'build', label: 'Build with', options: opt('az acr build (ACR Tasks, no local Docker)', 'docker build + docker push after az acr login') },
        { type: 'select', key: 'pullAuth', label: 'Runtime pull credentials', options: opt('Managed identity with AcrPull', 'Admin user (username/password)', 'None') },
        { type: 'select', key: 'runtime', label: 'Run on', options: opt('Azure Container Instances', 'Azure Container Apps') },
        { type: 'select', key: 'exposure', label: 'Exposure', options: opt('Public: DNS name label / external ingress', 'Private: VNet / internal ingress') },
        { type: 'select', key: 'restart', label: 'ACI restart policy', options: opt('Always', 'OnFailure', 'Never') },
      ],
      initial: { registryName: 'acrcontoso01', sku: 'Standard', geoRep: false, build: 'az acr build (ACR Tasks, no local Docker)', pullAuth: 'Managed identity with AcrPull', runtime: 'Azure Container Instances', exposure: 'Public: DNS name label / external ingress', restart: 'OnFailure' },
      presets: [{ label: 'No pull credentials', values: { pullAuth: 'None' } }, { label: 'Geo-replication on Standard', values: { geoRep: true } }, { label: 'Invalid registry name', values: { registryName: 'acr-contoso' } }],
      evaluate: (s) => {
        const nameOk = acrNameValid(str(s, 'registryName'))
        const skuOk = !bool(s, 'geoRep') || str(s, 'sku') === 'Premium'
        const authOk = str(s, 'pullAuth') !== 'None'
        const aci = str(s, 'runtime').includes('Instances')
        const stages = chain(containerStages, [
          [true, str(s, 'build')],
          [nameOk && skuOk, !nameOk ? 'Registry names are 5–50 alphanumeric characters (no hyphens), globally unique: <name>.azurecr.io.' : !skuOk ? 'Geo-replication requires the Premium SKU.' : `${str(s, 'registryName')}.azurecr.io (${str(s, 'sku')}).`],
          [authOk, !authOk ? 'Private registry: pull fails (unauthorized) without credentials.' : str(s, 'pullAuth').startsWith('Admin') ? 'Works, but the admin user is a single shared account; prefer managed identities with AcrPull.' : 'Identity granted AcrPull on the registry.'],
          [true, aci ? `ACI container group with restart policy ${str(s, 'restart')}${str(s, 'restart') === 'Always' ? ' (default; restarts even after successful exit, so not ideal for batch jobs)' : ''}.` : 'Container App revision created in a Container Apps environment.'],
          [true, str(s, 'exposure').startsWith('Public') ? (aci ? 'FQDN <label>.<region>.azurecontainer.io on the public IP.' : 'External ingress: HTTPS endpoint on the environment domain.') : aci ? 'Deployed into a VNet subnet (delegated); no public IP.' : 'Internal ingress: reachable only inside the environment/VNet.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'CONTAINER RUNNING' : 'DEPLOYMENT FAILED', detail: ok ? stages[4]!.detail : stages.find((x) => x.ok === false)!.detail }, checks: ok ? ['acr-pushed', aci ? 'aci-running' : 'aca-running'] : ['container-failed'] }
      },
    },
    {
      id: 'revisions',
      title: 'Container Apps revisions',
      description: 'Deploy a new revision and split traffic.',
      stages: [{ id: 'mode', label: 'Revision mode', kind: 'service' }, { id: 'rev', label: 'New revision', kind: 'compute' }, { id: 'traffic', label: 'Traffic split', kind: 'network' }],
      controls: [
        { type: 'select', key: 'mode', label: 'Revision mode', options: opt('Single', 'Multiple') },
        { type: 'number', key: 'newPercent', label: 'Traffic to new revision (%)', min: 0, max: 100 },
        { type: 'checkbox', key: 'configChange', label: 'Change is to a revision-scope setting (image, scale rules)' },
      ],
      initial: { mode: 'Multiple', newPercent: 20, configChange: true },
      evaluate: (s) => {
        const single = str(s, 'mode') === 'Single'
        const newRev = bool(s, 'configChange')
        const pct = single ? 100 : num(s, 'newPercent')
        const stages = chain([{ id: 'mode', label: 'Revision mode', kind: 'service' }, { id: 'rev', label: 'New revision', kind: 'compute' }, { id: 'traffic', label: 'Traffic split', kind: 'network' }], [
          [true, single ? 'Single: the new revision replaces the old one automatically.' : 'Multiple: several active revisions can receive traffic.'],
          [true, newRev ? 'Revision-scope change creates a new immutable revision.' : 'Application-scope changes (secrets, ingress, revision mode) do not create a new revision.'],
          [true, newRev ? `${pct}% to the new revision, ${100 - pct}% to the previous one.` : 'No traffic change.'],
        ])
        return { stages, outcome: { ok: true, title: 'REVISION DEPLOYED', detail: stages[2]!.detail }, checks: !single && newRev && pct > 0 && pct < 100 ? ['aca-traffic-split'] : ['aca-revision'] }
      },
    },
  ],
}

// ------------------------------------------------------------------ App Service
export const APP_TIERS = {
  Free: { customDomain: false, tls: false, maxInstances: 1, autoscale: false, slots: 0, backup: 'none', vnetIntegration: false, privateEndpoint: false },
  Shared: { customDomain: true, tls: false, maxInstances: 1, autoscale: false, slots: 0, backup: 'none', vnetIntegration: false, privateEndpoint: false },
  Basic: { customDomain: true, tls: true, maxInstances: 3, autoscale: false, slots: 0, backup: 'automatic + custom', vnetIntegration: true, privateEndpoint: true },
  Standard: { customDomain: true, tls: true, maxInstances: 10, autoscale: true, slots: 5, backup: 'automatic + custom', vnetIntegration: true, privateEndpoint: true },
  PremiumV3: { customDomain: true, tls: true, maxInstances: 30, autoscale: true, slots: 20, backup: 'automatic + custom', vnetIntegration: true, privateEndpoint: true },
  IsolatedV2: { customDomain: true, tls: true, maxInstances: 100, autoscale: true, slots: 20, backup: 'automatic + custom', vnetIntegration: true, privateEndpoint: true },
} as const
export type AppTier = keyof typeof APP_TIERS

export function swapResult(settings: Array<{ name: string; sticky: boolean }>) {
  return settings.map((x) => ({ ...x, after: x.sticky ? 'stays with the slot' : 'moves with the app (swapped)' }))
}

const appTierOptions = Object.keys(APP_TIERS).map((t) => ({ value: t, label: t }))

const appGroup: ScenarioGroup = {
  id: 'appservice-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'Tier capabilities (instances, autoscale, slots, custom domains, TLS, backups, networking), domain verification records, managed certificate limits and slot-swap stickiness follow Microsoft documentation. Pricing is not modelled.',
  scenarios: [
    {
      id: 'plan',
      title: 'Plan and scale',
      description: 'Pick an App Service plan tier and scale it.',
      stages: [{ id: 'plan', label: 'App Service plan', kind: 'service' }, { id: 'up', label: 'Scale up (tier)', kind: 'compute' }, { id: 'out', label: 'Scale out (instances)', kind: 'compute' }, { id: 'app', label: 'Web apps on the plan', kind: 'globe' }],
      controls: [
        { type: 'select', key: 'tier', label: 'Pricing tier', options: appTierOptions },
        { type: 'select', key: 'os', label: 'OS', options: opt('Linux', 'Windows') },
        { type: 'number', key: 'instances', label: 'Instance count', min: 1, max: 100 },
        { type: 'checkbox', key: 'autoscale', label: 'Use rule-based autoscale' },
        { type: 'number', key: 'apps', label: 'Web apps in the plan', min: 1, max: 20 },
      ],
      initial: { tier: 'Basic', os: 'Linux', instances: 2, autoscale: true, apps: 3 },
      presets: [{ label: 'Free tier, 2 instances', values: { tier: 'Free', instances: 2, autoscale: false } }, { label: 'Standard with autoscale', values: { tier: 'Standard', instances: 4, autoscale: true } }],
      evaluate: (s) => {
        const t = APP_TIERS[str(s, 'tier') as AppTier]
        const instOk = num(s, 'instances') <= t.maxInstances
        const asOk = !bool(s, 'autoscale') || t.autoscale
        const stages = chain([{ id: 'plan', label: 'App Service plan', kind: 'service' }, { id: 'up', label: 'Scale up (tier)', kind: 'compute' }, { id: 'out', label: 'Scale out (instances)', kind: 'compute' }, { id: 'app', label: 'Web apps on the plan', kind: 'globe' }], [
          [true, `${str(s, 'os')} plan, region-bound. The plan defines the VMs; apps share them.`],
          [true, `${str(s, 'tier')}: up to ${t.maxInstances} instance(s), ${t.slots} deployment slots, autoscale ${t.autoscale ? 'yes' : 'no'}.`],
          [instOk && asOk, !instOk ? `${str(s, 'tier')} allows at most ${t.maxInstances} instance(s).` : !asOk ? 'Rule-based autoscale requires Standard or higher; Basic scales manually (up to 3).' : `${num(s, 'instances')} instance(s)${bool(s, 'autoscale') ? ' as the autoscale default' : ''}.`],
          [true, `All ${num(s, 'apps')} apps run on every instance of the plan: scaling the plan scales them all.`],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'PLAN CONFIGURED' : 'NOT SUPPORTED', detail: ok ? stages[2]!.detail : stages.find((x) => x.ok === false)!.detail }, checks: ok ? ['plan-configured', ...(bool(s, 'autoscale') ? ['plan-autoscale'] : [])] : ['plan-limit'] }
      },
    },
    {
      id: 'domain-tls',
      title: 'Custom domain + TLS',
      description: 'Map www.contoso.com or contoso.com to app-contoso.azurewebsites.net and secure it.',
      stages: [{ id: 'tier', label: 'Tier supports it', kind: 'service' }, { id: 'dns', label: 'DNS records', kind: 'network' }, { id: 'verify', label: 'Domain verification', kind: 'security' }, { id: 'cert', label: 'Certificate + binding', kind: 'security' }, { id: 'https', label: 'HTTPS', kind: 'globe' }],
      controls: [
        { type: 'select', key: 'tier', label: 'Tier', options: appTierOptions },
        { type: 'select', key: 'host', label: 'Hostname', options: opt('www.contoso.com (subdomain)', 'contoso.com (apex)', '*.contoso.com (wildcard)') },
        { type: 'select', key: 'record', label: 'Mapping record', options: opt('CNAME → app-contoso.azurewebsites.net', 'A → app inbound IP') },
        { type: 'checkbox', key: 'txt', label: 'TXT asuid.<host> = custom domain verification ID' },
        { type: 'select', key: 'cert', label: 'Certificate', options: opt('App Service managed certificate (free)', 'Import from Key Vault', 'Upload PFX (password, private key)') },
        { type: 'checkbox', key: 'httpsOnly', label: 'HTTPS Only + minimum TLS 1.2' },
      ],
      initial: { tier: 'Basic', host: 'www.contoso.com (subdomain)', record: 'CNAME → app-contoso.azurewebsites.net', txt: true, cert: 'App Service managed certificate (free)', httpsOnly: true },
      presets: [{ label: 'Apex with CNAME', values: { host: 'contoso.com (apex)', record: 'CNAME → app-contoso.azurewebsites.net' } }, { label: 'Wildcard with free certificate', values: { host: '*.contoso.com (wildcard)' } }, { label: 'Shared tier with TLS', values: { tier: 'Shared' } }],
      evaluate: (s) => {
        const t = APP_TIERS[str(s, 'tier') as AppTier]
        const apex = str(s, 'host').startsWith('contoso.com')
        const wildcard = str(s, 'host').startsWith('*')
        const recOk = apex ? str(s, 'record').startsWith('A') : str(s, 'record').startsWith('CNAME')
        const managed = str(s, 'cert').startsWith('App Service managed')
        const certOk = t.tls && !(managed && wildcard)
        const stages = chain([{ id: 'tier', label: 'Tier supports it', kind: 'service' }, { id: 'dns', label: 'DNS records', kind: 'network' }, { id: 'verify', label: 'Domain verification', kind: 'security' }, { id: 'cert', label: 'Certificate + binding', kind: 'security' }, { id: 'https', label: 'HTTPS', kind: 'globe' }], [
          [t.customDomain, t.customDomain ? `${str(s, 'tier')} supports custom domains.` : 'Free tier does not support custom domains; scale up.'],
          [recOk, recOk ? `${str(s, 'record').split(' ')[0]} record correct for ${apex ? 'the apex' : 'a subdomain'}.` : apex ? 'A CNAME cannot be created at the zone apex; use an A record (or an alias record in Azure DNS).' : 'Use a CNAME for subdomains, so the record follows the app if its IP changes.'],
          [bool(s, 'txt'), bool(s, 'txt') ? 'Ownership verified with the asuid TXT record.' : 'Add TXT asuid.<subdomain> with the app\'s custom domain verification ID.'],
          [certOk, !t.tls ? `${str(s, 'tier')} cannot bind TLS certificates to custom domains; use Basic or higher.` : managed && wildcard ? 'Free managed certificates do not support wildcard domains; use Key Vault, an uploaded PFX or an App Service certificate.' : `${str(s, 'cert')} bound with SNI SSL.${managed ? ' Auto-renews; cannot be exported.' : ''}`],
          [bool(s, 'httpsOnly'), bool(s, 'httpsOnly') ? 'HTTP redirected to HTTPS; TLS 1.0/1.1 refused.' : 'HTTP still accepted: enable HTTPS Only and minimum TLS 1.2.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'DOMAIN SECURED' : 'MAPPING INCOMPLETE', detail: ok ? `https://${str(s, 'host').split(' ')[0]!.replace('*', 'shop')} serves the app.` : stages.find((x) => x.ok === false)!.detail }, checks: ok ? ['domain-mapped', 'tls-bound'] : ['domain-failed'] }
      },
    },
    {
      id: 'slots',
      title: 'Deployment slots',
      description: 'Deploy to staging, warm it up and swap with production.',
      stages: [{ id: 'tier', label: 'Tier', kind: 'service' }, { id: 'deploy', label: 'Deploy to staging', kind: 'compute' }, { id: 'warm', label: 'Warm-up', kind: 'service' }, { id: 'swap', label: 'Swap', kind: 'network' }, { id: 'prod', label: 'Production', kind: 'globe' }],
      controls: [
        { type: 'select', key: 'tier', label: 'Tier', options: appTierOptions },
        { type: 'checkbox', key: 'dbSticky', label: 'ConnectionStrings:Db marked "Deployment slot setting"' },
        { type: 'checkbox', key: 'flagSticky', label: 'FEATURE_FLAG app setting marked as slot setting' },
        { type: 'checkbox', key: 'preview', label: 'Swap with preview (multi-phase)' },
        { type: 'number', key: 'routing', label: 'Route % of production traffic to staging first', min: 0, max: 100 },
      ],
      initial: { tier: 'Standard', dbSticky: true, flagSticky: false, preview: true, routing: 10 },
      presets: [{ label: 'Basic tier (no slots)', values: { tier: 'Basic' } }, { label: 'Staging DB string not sticky', values: { dbSticky: false } }],
      evaluate: (s) => {
        const t = APP_TIERS[str(s, 'tier') as AppTier]
        const sw = swapResult([{ name: 'ConnectionStrings:Db', sticky: bool(s, 'dbSticky') }, { name: 'FEATURE_FLAG', sticky: bool(s, 'flagSticky') }])
        const stages = chain([{ id: 'tier', label: 'Tier', kind: 'service' }, { id: 'deploy', label: 'Deploy to staging', kind: 'compute' }, { id: 'warm', label: 'Warm-up', kind: 'service' }, { id: 'swap', label: 'Swap', kind: 'network' }, { id: 'prod', label: 'Production', kind: 'globe' }], [
          [t.slots > 0, t.slots > 0 ? `${str(s, 'tier')}: up to ${t.slots} slots in addition to production.` : `${str(s, 'tier')} has no deployment slots; use Standard or higher.`],
          [true, `New build deployed to the staging slot.${num(s, 'routing') > 0 ? ` ${num(s, 'routing')}% of production traffic tests it (testing in production).` : ''}`],
          [true, bool(s, 'preview') ? 'Phase 1 applies production settings to staging and waits for you to validate before completing.' : 'Instances warmed up (applicationInitialization) before routing switches.'],
          [bool(s, 'dbSticky'), bool(s, 'dbSticky') ? 'Sticky settings stay with their slot.' : 'The staging database connection string swaps into production!'],
          [true, 'Swap completed with no downtime; the old version is now in staging for quick rollback (swap again).'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'SWAP SUCCEEDED' : 'SWAP RISK', detail: ok ? stages[4]!.detail : stages.find((x) => x.ok === false)!.detail }, checks: ok ? ['slot-swapped'] : ['slot-problem'], notes: [...sw.map((x) => `${x.name}: ${x.after}`), 'Never swapped: custom domains, TLS/SSL bindings, scale settings, IP restrictions, Always On, VNet integration, managed identities, WebJobs schedulers.'] }
      },
    },
    {
      id: 'backup-network',
      title: 'Backup and networking',
      description: 'Configure backups and control inbound and outbound network paths.',
      stages: [{ id: 'backup', label: 'Backup', kind: 'storage' }, { id: 'in', label: 'Inbound access', kind: 'security' }, { id: 'out', label: 'Outbound to VNet', kind: 'network' }, { id: 'db', label: 'Private database', kind: 'storage' }],
      controls: [
        { type: 'select', key: 'tier', label: 'Tier', options: appTierOptions },
        { type: 'select', key: 'backup', label: 'Backup type', options: opt('Automatic (platform-managed)', 'Custom (to my storage account, with linked database)') },
        { type: 'select', key: 'inbound', label: 'Inbound', options: opt('Public (default)', 'Access restrictions: allow office IP only', 'Private endpoint + public access disabled') },
        { type: 'checkbox', key: 'vnetIntegration', label: 'Regional VNet integration (outbound)' },
        { type: 'checkbox', key: 'routeAll', label: 'Route all outbound traffic through the VNet' },
      ],
      initial: { tier: 'Standard', backup: 'Custom (to my storage account, with linked database)', inbound: 'Private endpoint + public access disabled', vnetIntegration: true, routeAll: true },
      presets: [{ label: 'Free tier backup', values: { tier: 'Free' } }, { label: 'No VNet integration', values: { vnetIntegration: false } }],
      evaluate: (s) => {
        const t = APP_TIERS[str(s, 'tier') as AppTier]
        const custom = str(s, 'backup').startsWith('Custom')
        const backupOk = custom ? t.backup.includes('custom') : t.backup !== 'none'
        const peOk = !str(s, 'inbound').startsWith('Private') || t.privateEndpoint
        const outOk = bool(s, 'vnetIntegration') && t.vnetIntegration
        const stages = chain([{ id: 'backup', label: 'Backup', kind: 'storage' }, { id: 'in', label: 'Inbound access', kind: 'security' }, { id: 'out', label: 'Outbound to VNet', kind: 'network' }, { id: 'db', label: 'Private database', kind: 'storage' }], [
          [backupOk, backupOk ? (custom ? 'Custom backups to your storage account (including linked databases) on a schedule you set.' : 'Automatic backups every hour, retained 30 days, no storage account needed.') : t.backup === 'none' ? `${str(s, 'tier')} has no backup feature.` : 'Custom backups require Basic tier or higher.'],
          [peOk, !peOk ? 'Private endpoints require Basic tier or higher.' : str(s, 'inbound').startsWith('Private') ? 'Inbound only through the private endpoint IP in your VNet (private DNS privatelink.azurewebsites.net).' : str(s, 'inbound').startsWith('Access') ? 'Access restriction rules (priority-ordered allow/deny on IP, service tag or subnet).' : 'Reachable from the internet on *.azurewebsites.net.'],
          [outOk, outOk ? `Outbound calls leave from the integration subnet${bool(s, 'routeAll') ? ' (all traffic routed into the VNet, subject to NSGs/UDRs)' : ''}.` : 'Without VNet integration, outbound traffic uses public outbound IPs and cannot reach private endpoints.'],
          [outOk, 'SQL private endpoint reachable through VNet integration with private DNS.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'CONFIGURED' : 'NOT POSSIBLE', detail: ok ? 'Backups and private networking in place.' : stages.find((x) => x.ok === false)!.detail }, checks: [...(backupOk ? ['app-backup'] : []), ...(ok ? ['app-networking'] : [])] }
      },
    },
  ],
}

export const groups: ScenarioGroup[] = [armGroup, vmGroup, autoscaleGroup, containerGroup, appGroup]
