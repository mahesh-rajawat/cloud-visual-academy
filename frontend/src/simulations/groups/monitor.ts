/**
 * AZ-104 Domain 5: Azure Monitor (metrics, diagnostic settings, KQL, alerts, Insights, Network Watcher /
 * Connection Monitor) and Azure Backup / Site Recovery (vaults, policies, restore, failover, reports).
 * The KQL evaluator supports a small, real subset (where / summarize avg|max|count by / bin / order / take)
 * over a sample Perf table, so results are computed, not canned.
 */
import { chooser } from '../chooser'
import { allOk, bool, chain, num, opt, str, type ScenarioGroup, type Stage } from '../scenario'

// ------------------------------------------------------------------ metrics
/** CPU % per minute for one hour: steady ~30% with a 4-minute spike to 97% at minute 40. */
export const CPU_SERIES: number[] = Array.from({ length: 60 }, (_, i) => (i >= 40 && i < 44 ? 97 : 28 + ((i * 7) % 9)))

export function aggregate(series: number[], grainMin: number, agg: 'Average' | 'Maximum' | 'Minimum'): number[] {
  const out: number[] = []
  for (let i = 0; i < series.length; i += grainMin) {
    const w = series.slice(i, i + grainMin)
    out.push(agg === 'Average' ? Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10 : agg === 'Maximum' ? Math.max(...w) : Math.min(...w))
  }
  return out
}

// ------------------------------------------------------------------ KQL
export interface PerfRow { TimeGenerated: number; Computer: string; CounterName: string; CounterValue: number }
export const PERF: PerfRow[] = ['vm-web1', 'vm-web2', 'vm-db1'].flatMap((c, ci) =>
  Array.from({ length: 6 }, (_, h) => [
    { TimeGenerated: h, Computer: c, CounterName: '% Processor Time', CounterValue: c === 'vm-db1' ? 70 + h * 4 : 20 + ci * 5 + h },
    { TimeGenerated: h, Computer: c, CounterName: 'Available MBytes', CounterValue: 4000 - ci * 900 - h * 100 },
  ]).flat(),
)

export interface KqlQuery { table: 'Perf' | 'Heartbeat'; counter: string; computer: string; summarize: 'none' | 'avg by Computer' | 'max by Computer' | 'count by Computer' | 'avg by bin(1h)'; minValue: number; orderDesc: boolean; take: number }

export function kqlText(q: KqlQuery): string {
  const lines: string[] = [q.table]
  lines.push(`| where CounterName == "${q.counter}"`)
  if (q.computer !== 'all') lines.push(`| where Computer == "${q.computer}"`)
  if (q.summarize === 'none') {
    if (q.minValue > 0) lines.push(`| where CounterValue > ${q.minValue}`)
  } else {
    const [fn, , by] = q.summarize.split(' ')
    const byExpr = by === 'bin(1h)' ? 'bin(TimeGenerated, 1h)' : 'Computer'
    lines.push(`| summarize ${fn === 'count' ? 'Samples = count()' : `${fn === 'avg' ? 'AvgValue' : 'MaxValue'} = ${fn}(CounterValue)`} by ${byExpr}`)
  }
  if (q.orderDesc) lines.push(`| order by ${q.summarize === 'none' ? 'CounterValue' : q.summarize.startsWith('count') ? 'Samples' : q.summarize.startsWith('avg') ? 'AvgValue' : 'MaxValue'} desc`)
  lines.push(`| take ${q.take}`)
  return lines.join('\n')
}

export function runKql(q: KqlQuery): { error?: string; columns: string[]; rows: Array<Array<string | number>> } {
  if (q.table === 'Heartbeat') return { error: "Failed to resolve column 'CounterName': the Heartbeat table has no performance counters (use Perf or InsightsMetrics).", columns: [], rows: [] }
  let rows = PERF.filter((r) => r.CounterName === q.counter && (q.computer === 'all' || r.Computer === q.computer))
  let columns: string[]
  let out: Array<Array<string | number>>
  if (q.summarize === 'none') {
    if (q.minValue > 0) rows = rows.filter((r) => r.CounterValue > q.minValue)
    columns = ['TimeGenerated', 'Computer', 'CounterValue']
    out = rows.map((r) => [`${r.TimeGenerated}:00`, r.Computer, r.CounterValue])
  } else {
    const byBin = q.summarize.endsWith('bin(1h)')
    const key = (r: PerfRow) => (byBin ? `${r.TimeGenerated}:00` : r.Computer)
    const groups = new Map<string, number[]>()
    rows.forEach((r) => groups.set(key(r), [...(groups.get(key(r)) ?? []), r.CounterValue]))
    const fn = q.summarize.split(' ')[0]
    columns = [byBin ? 'TimeGenerated' : 'Computer', fn === 'count' ? 'Samples' : fn === 'avg' ? 'AvgValue' : 'MaxValue']
    out = [...groups].map(([k, v]) => [k, fn === 'count' ? v.length : fn === 'avg' ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : Math.max(...v)])
  }
  if (q.orderDesc) out.sort((a, b) => Number(b[b.length - 1]) - Number(a[a.length - 1]))
  return { columns, rows: out.slice(0, q.take) }
}

// ------------------------------------------------------------------ alerts
/** Returns the minute at which a metric alert first fires (window-aggregated value crosses the threshold), or -1. */
export function alertFiresAt(series: number[], threshold: number, windowMin: number, agg: 'Average' | 'Maximum', frequencyMin: number): number {
  for (let t = windowMin; t <= series.length; t += frequencyMin) {
    const w = series.slice(t - windowMin, t)
    const v = agg === 'Average' ? w.reduce((a, b) => a + b, 0) / w.length : Math.max(...w)
    if (v > threshold) return t
  }
  return -1
}

// ------------------------------------------------------------------ backup
export type Datasource = 'Azure VM' | 'SQL Server in Azure VM' | 'Azure Files' | 'On-premises files (MARS agent)' | 'Azure Blobs' | 'Azure Managed Disks' | 'Azure Database for PostgreSQL flexible server' | 'AKS'
export const VAULT_FOR: Record<Datasource, 'Recovery Services vault' | 'Backup vault'> = {
  'Azure VM': 'Recovery Services vault', 'SQL Server in Azure VM': 'Recovery Services vault', 'Azure Files': 'Recovery Services vault', 'On-premises files (MARS agent)': 'Recovery Services vault',
  'Azure Blobs': 'Backup vault', 'Azure Managed Disks': 'Backup vault', 'Azure Database for PostgreSQL flexible server': 'Backup vault', AKS: 'Backup vault',
}

export interface VmPolicy { type: 'Standard' | 'Enhanced'; frequency: 'Daily' | 'Hourly'; dailyDays: number; weeklyWeeks: number; monthlyMonths: number; yearlyYears: number; instantRestoreDays: number }
export function policyIssues(p: VmPolicy, trustedLaunch: boolean): string[] {
  const i: string[] = []
  if (p.frequency === 'Hourly' && p.type !== 'Enhanced') i.push('Multiple backups per day (hourly) need the Enhanced policy.')
  if (trustedLaunch && p.type !== 'Enhanced') i.push('Trusted Launch VMs require the Enhanced policy.')
  const maxIr = p.type === 'Enhanced' ? 30 : 5
  if (p.instantRestoreDays < 1 || p.instantRestoreDays > maxIr) i.push(`Instant restore snapshot retention must be 1–${maxIr} days for the ${p.type} policy.`)
  if (p.dailyDays < 7 || p.dailyDays > 9999) i.push('Daily retention must be 7–9999 days.')
  return i
}
export function restorePoints(p: VmPolicy): number {
  const perDay = p.frequency === 'Hourly' ? 6 : 1 // example: every 4 hours
  return p.dailyDays * perDay + p.weeklyWeeks + p.monthlyMonths + p.yearlyYears
}

// ================================================================== monitor group
const metricStages: Stage[] = [{ id: 'vm', label: 'vm-web1 platform metric', kind: 'compute' }, { id: 'agg', label: 'Aggregation + granularity', kind: 'service' }, { id: 'chart', label: 'Metrics explorer chart', kind: 'user' }]
const kqlStages: Stage[] = [{ id: 'ws', label: 'Log Analytics workspace', kind: 'storage' }, { id: 'parse', label: 'Parse query', kind: 'service' }, { id: 'run', label: 'Run', kind: 'compute' }, { id: 'res', label: 'Results', kind: 'user' }]
const alertStages: Stage[] = [{ id: 'sig', label: 'Signal: Percentage CPU', kind: 'compute' }, { id: 'rule', label: 'Alert rule', kind: 'security' }, { id: 'apr', label: 'Alert processing rule', kind: 'service' }, { id: 'ag', label: 'Action group', kind: 'user' }]
const cmStages: Stage[] = [{ id: 'src', label: 'Source VM + agent', kind: 'compute' }, { id: 'test', label: 'Test configuration', kind: 'service' }, { id: 'dst', label: 'Destination', kind: 'globe' }, { id: 'eval', label: 'Thresholds', kind: 'security' }]

const monitorGroup: ScenarioGroup = {
  id: 'monitor-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'Aggregation, KQL results and alert timing are computed from sample data. Collection rules (platform metrics automatic, resource logs need diagnostic settings, guest data needs Azure Monitor Agent + DCR), alert processing and Connection Monitor behaviour follow Microsoft Learn.',
  scenarios: [
    {
      id: 'metrics',
      title: 'Interpret metrics',
      description: 'A VM had a 4-minute CPU spike to 97% at minute 40. See how aggregation and time grain change what the chart shows.',
      stages: metricStages,
      controls: [
        { type: 'select', key: 'agg', label: 'Aggregation', options: opt('Average', 'Maximum', 'Minimum') },
        { type: 'select', key: 'grain', label: 'Time granularity', options: [{ value: '1', label: '1 minute' }, { value: '15', label: '15 minutes' }, { value: '60', label: '1 hour' }] },
      ],
      initial: { agg: 'Average', grain: '60' },
      presets: [{ label: 'Maximum at 1 minute', values: { agg: 'Maximum', grain: '1' } }, { label: 'Average at 15 minutes', values: { grain: '15' } }],
      evaluate: (s) => {
        const grain = Number(str(s, 'grain'))
        const pts = aggregate(CPU_SERIES, grain, str(s, 'agg') as 'Average')
        const peak = Math.max(...pts)
        const visible = peak >= 90
        const stages = chain(metricStages, [
          [true, 'Platform metric collected every minute automatically; retained 93 days.'],
          [true, `${str(s, 'agg')} per ${grain} min → ${pts.length} point(s). Peak shown: ${peak}%.`],
          [visible, visible ? 'Spike visible on the chart.' : 'The spike is hidden: averaging over a long time grain smooths it out. Use Maximum or a smaller grain.'],
        ])
        return {
          stages, outcome: { ok: visible, title: visible ? 'SPIKE DETECTED' : 'SPIKE HIDDEN BY AGGREGATION', detail: stages[2]!.detail }, checks: [visible ? 'metrics-spike-found' : 'metrics-spike-hidden'],
          series: { xLabel: 'Time bucket', yLabel: 'CPU %', lines: [{ label: `${str(s, 'agg')} CPU`, points: pts }] },
          metrics: [{ label: 'Points', value: String(pts.length) }, { label: 'Peak', value: `${peak}%` }],
        }
      },
    },
    chooser({
      id: 'mon-data', title: 'Log settings and data sources', description: 'Pick how each kind of monitoring data is collected and where it goes.', requirementLabel: 'Requirement', answerLabel: 'Configuration',
      answers: ['Nothing: platform metrics are automatic', 'Activity log (subscription-level, kept 90 days)', 'Diagnostic setting → Log Analytics workspace', 'Diagnostic setting → Storage account', 'Diagnostic setting → Event Hubs', 'Azure Monitor Agent + data collection rule'],
      answerNotes: { 'Nothing: platform metrics are automatic': 'Platform metrics are collected without configuration.', 'Activity log (subscription-level, kept 90 days)': 'Control-plane events (who did what) are recorded automatically; export with a diagnostic setting to keep longer.', 'Diagnostic setting → Log Analytics workspace': 'Resource logs into tables you can query with KQL and alert on.', 'Diagnostic setting → Storage account': 'Cheap long-term archive.', 'Diagnostic setting → Event Hubs': 'Stream to a SIEM or third-party tool.', 'Azure Monitor Agent + data collection rule': 'Guest OS data: performance counters, Windows events, Syslog, text logs.' },
      cases: [
        { value: 'cpu', label: 'Chart a VM\'s host CPU for the last week', answer: 'Nothing: platform metrics are automatic', why: 'Percentage CPU is a platform metric.' },
        { value: 'who', label: 'Find who deleted a resource group yesterday', answer: 'Activity log (subscription-level, kept 90 days)', why: 'Control-plane operations.' },
        { value: 'kql', label: 'Query Key Vault access logs with KQL', answer: 'Diagnostic setting → Log Analytics workspace', why: 'Resource logs need a diagnostic setting.' },
        { value: 'archive', label: 'Keep storage account logs for 7 years at low cost', answer: 'Diagnostic setting → Storage account', why: 'Archive destination.' },
        { value: 'siem', label: 'Stream NSG and firewall logs to a third-party SIEM', answer: 'Diagnostic setting → Event Hubs', why: 'Event Hubs streaming.' },
        { value: 'guest', label: 'Collect Windows event logs and memory counters from VMs', answer: 'Azure Monitor Agent + data collection rule', why: 'Guest OS data needs the agent.' },
      ],
    }),
    {
      id: 'kql',
      title: 'Query logs with KQL',
      description: 'Build a Kusto query against a sample Perf table (3 VMs × 6 hours) and run it. Results are computed.',
      stages: kqlStages,
      controls: [
        { type: 'select', key: 'table', label: 'Table', options: opt('Perf', 'Heartbeat') },
        { type: 'select', key: 'counter', label: 'where CounterName ==', options: opt('% Processor Time', 'Available MBytes') },
        { type: 'select', key: 'computer', label: 'where Computer ==', options: opt('all', 'vm-web1', 'vm-web2', 'vm-db1') },
        { type: 'select', key: 'summarize', label: 'summarize', options: opt('none', 'avg by Computer', 'max by Computer', 'count by Computer', 'avg by bin(1h)') },
        { type: 'number', key: 'minValue', label: 'where CounterValue > (no summarize)', min: 0, max: 5000 },
        { type: 'checkbox', key: 'orderDesc', label: 'order by value desc' },
        { type: 'number', key: 'take', label: 'take', min: 1, max: 50 },
      ],
      initial: { table: 'Heartbeat', counter: '% Processor Time', computer: 'all', summarize: 'none', minValue: 0, orderDesc: false, take: 10 },
      presets: [{ label: 'Busiest VMs (avg CPU)', values: { table: 'Perf', summarize: 'avg by Computer', orderDesc: true } }, { label: 'CPU samples above 80%', values: { table: 'Perf', minValue: 80 } }, { label: 'Hourly trend for vm-db1', values: { table: 'Perf', computer: 'vm-db1', summarize: 'avg by bin(1h)' } }],
      evaluate: (s) => {
        const q: KqlQuery = { table: str(s, 'table') as 'Perf', counter: str(s, 'counter'), computer: str(s, 'computer'), summarize: str(s, 'summarize') as 'none', minValue: num(s, 'minValue'), orderDesc: bool(s, 'orderDesc'), take: num(s, 'take') }
        const r = runKql(q)
        const stages = chain(kqlStages, [
          [true, 'law-ops (Perf populated by Azure Monitor Agent via a DCR).'],
          [!r.error, r.error ?? 'Query parsed.'],
          [true, 'Executed over the selected time range.'],
          [r.rows.length > 0, r.rows.length ? `${r.rows.length} row(s): ${r.columns.join(' | ')}` : 'No rows matched. Relax a filter.'],
        ])
        const ok = allOk(stages)
        return {
          stages, outcome: { ok, title: ok ? 'RESULTS' : r.error ? 'SEMANTIC ERROR' : 'NO RESULTS', detail: ok ? r.rows.slice(0, 5).map((row) => row.join(' · ')).join('\n') : stages.find((x) => x.ok === false)!.detail },
          checks: [ok ? (q.summarize === 'none' ? 'kql-filtered' : 'kql-summarized') : 'kql-error'],
          notes: [kqlText(q)],
        }
      },
    },
    {
      id: 'alerts',
      title: 'Alert rules, action groups and processing rules',
      description: 'Create a metric alert on the CPU series and route it to an action group. Add an alert processing rule for a maintenance window.',
      stages: alertStages,
      controls: [
        { type: 'number', key: 'threshold', label: 'Threshold: Percentage CPU >', min: 1, max: 100 },
        { type: 'select', key: 'agg', label: 'Aggregation', options: opt('Average', 'Maximum') },
        { type: 'select', key: 'window', label: 'Lookback window', options: [{ value: '5', label: '5 minutes' }, { value: '15', label: '15 minutes' }, { value: '60', label: '1 hour' }] },
        { type: 'checkbox', key: 'ag', label: 'Action group ag-ops (email + SMS + webhook) attached' },
        { type: 'checkbox', key: 'suppress', label: 'Alert processing rule: suppress notifications 00:30–00:50 (maintenance)' },
      ],
      initial: { threshold: 80, agg: 'Average', window: '60', ag: true, suppress: false },
      presets: [{ label: 'Average over 5 minutes', values: { window: '5' } }, { label: 'Maintenance window suppression', values: { window: '5', suppress: true } }, { label: 'No action group', values: { window: '5', ag: false } }],
      evaluate: (s) => {
        const w = Number(str(s, 'window'))
        const at = alertFiresAt(CPU_SERIES, num(s, 'threshold'), w, str(s, 'agg') as 'Average', 1)
        const fired = at >= 0
        const suppressed = fired && bool(s, 'suppress') && at >= 30 && at <= 50
        const stages = chain(alertStages, [
          [true, 'Percentage CPU evaluated every minute.'],
          [fired, fired ? `Fired at minute ${at}: ${str(s, 'agg')} over ${w} min > ${num(s, 'threshold')}%. Severity 2, state Fired.` : `Never fired: ${str(s, 'agg')} over ${w} min stays below ${num(s, 'threshold')}%.`],
          [!suppressed, suppressed ? 'Alert processing rule suppresses notifications during maintenance (the alert is still recorded).' : bool(s, 'suppress') ? 'Outside the suppression window.' : 'No processing rule applies.'],
          [bool(s, 'ag'), bool(s, 'ag') ? 'ag-ops notified: email, SMS, webhook.' : 'Alert fired but no action group: nobody is notified.'],
        ])
        const ok = allOk(stages)
        return {
          stages, outcome: { ok, title: ok ? 'TEAM NOTIFIED' : suppressed ? 'SUPPRESSED (BY DESIGN)' : fired ? 'FIRED, NOT ROUTED' : 'ALERT MISSED', detail: stages.find((x) => x.ok === false)?.detail ?? stages[3]!.detail },
          checks: [ok ? 'alert-notified' : suppressed ? 'alert-suppressed' : fired ? 'alert-no-action' : 'alert-missed'],
          series: { xLabel: 'Minute', yLabel: 'CPU %', lines: [{ label: 'CPU', points: CPU_SERIES }, { label: 'Threshold', points: CPU_SERIES.map(() => num(s, 'threshold')), dashed: true }], markers: fired ? [{ x: at - 1, label: 'fired' }] : [] },
        }
      },
    },
    chooser({
      id: 'insights', title: 'Insights and Network Watcher', description: 'Pick the monitoring feature for each requirement.', requirementLabel: 'Requirement', answerLabel: 'Feature',
      answers: ['VM insights', 'Storage insights', 'Network insights', 'Connection Monitor', 'IP flow verify', 'VNet flow logs', 'Packet capture'],
      answerNotes: { 'VM insights': 'Guest performance and optional dependency map; needs Azure Monitor Agent and a DCR.', 'Storage insights': 'Capacity, availability, latency and transactions for storage accounts from platform metrics; no setup.', 'Network insights': 'Topology and health of network resources across subscriptions.', 'Connection Monitor': 'Continuous reachability, latency and packet loss between endpoints.', 'IP flow verify': 'One-off NSG allow/deny check for a 5-tuple.', 'VNet flow logs': 'Record IP flows through a VNet for analysis (Traffic analytics).', 'Packet capture': 'Capture packets on a VM for deep inspection.' },
      cases: [
        { value: 'vmperf', label: 'Compare memory and disk use across 50 VMs and see which processes talk to each other', answer: 'VM insights', why: 'Guest performance and Map.' },
        { value: 'stlat', label: 'Find which storage account has rising latency and failed transactions', answer: 'Storage insights', why: 'Built from storage metrics.' },
        { value: 'loss', label: 'Get alerted when latency from vm-app to an on-premises server exceeds 100 ms', answer: 'Connection Monitor', why: 'Continuous monitoring with thresholds.' },
        { value: 'topo', label: 'See a topology map and health of gateways, load balancers and VNets', answer: 'Network insights', why: 'Network health and topology.' },
        { value: 'flows', label: 'Analyse which IPs talked to a subnet over the last week', answer: 'VNet flow logs', why: 'Flow records + Traffic analytics.' },
        { value: 'pcap', label: 'Inspect TLS handshake packets from one VM', answer: 'Packet capture', why: 'Packet-level data.' },
      ],
    }),
    {
      id: 'conn-monitor',
      title: 'Connection Monitor',
      description: 'Continuously test from a VM to an endpoint and alert on failures or latency.',
      stages: cmStages,
      controls: [
        { type: 'checkbox', key: 'agent', label: 'Source VM has the Network Watcher agent extension (or Azure Monitor Agent for Arc/on-premises)' },
        { type: 'select', key: 'proto', label: 'Protocol', options: opt('TCP 443', 'HTTP GET /', 'ICMP') },
        { type: 'number', key: 'rtt', label: 'Destination round-trip time (ms)', min: 1, max: 500 },
        { type: 'number', key: 'loss', label: 'Checks failed (%)', min: 0, max: 100 },
        { type: 'number', key: 'rttThr', label: 'Threshold: round-trip time (ms)', min: 1, max: 500 },
        { type: 'number', key: 'lossThr', label: 'Threshold: checks failed (%)', min: 0, max: 100 },
      ],
      initial: { agent: false, proto: 'TCP 443', rtt: 40, loss: 0, rttThr: 100, lossThr: 5 },
      presets: [{ label: 'Install the agent', values: { agent: true } }, { label: 'Latency degradation', values: { agent: true, rtt: 180 } }, { label: 'Destination down', values: { agent: true, loss: 100 } }],
      evaluate: (s) => {
        const healthy = num(s, 'rtt') <= num(s, 'rttThr') && num(s, 'loss') <= num(s, 'lossThr')
        const stages = chain(cmStages, [
          [bool(s, 'agent'), bool(s, 'agent') ? 'Agent installed; Connection Monitor runs tests from this VM.' : 'Azure VMs need the Network Watcher agent extension to be a Connection Monitor source.'],
          [true, `Test group: ${str(s, 'proto')} every 30 s, results to Log Analytics.`],
          [num(s, 'loss') < 100, num(s, 'loss') >= 100 ? 'All checks failed: destination unreachable (use the topology view to see the failing hop).' : `RTT ${num(s, 'rtt')} ms, ${num(s, 'loss')}% failed.`],
          [healthy, healthy ? 'Within thresholds: Pass.' : 'Threshold breached: test state Fail → alert via Azure Monitor.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'PASS' : 'FAIL / ALERT', detail: stages.find((x) => x.ok === false)?.detail ?? stages[3]!.detail }, checks: [ok ? 'cm-pass' : bool(s, 'agent') ? 'cm-alert' : 'cm-no-agent'] }
      },
    },
  ],
}

// ================================================================== backup group
const policyStages: Stage[] = [{ id: 'vm', label: 'Azure VM', kind: 'compute' }, { id: 'pol', label: 'Backup policy', kind: 'security' }, { id: 'snap', label: 'Instant restore snapshots', kind: 'storage' }, { id: 'vault', label: 'Vault-tier recovery points', kind: 'storage' }, { id: 'req', label: 'Requirement', kind: 'user' }]
const restoreStages: Stage[] = [{ id: 'vault', label: 'Recovery Services vault', kind: 'storage' }, { id: 'rp', label: 'Recovery point', kind: 'service' }, { id: 'opt', label: 'Restore option', kind: 'compute' }, { id: 'done', label: 'Outcome', kind: 'user' }]
const asrStages: Stage[] = [{ id: 'vault', label: 'Vault in target region', kind: 'storage' }, { id: 'rep', label: 'Replication', kind: 'network' }, { id: 'test', label: 'Test failover', kind: 'service' }, { id: 'fo', label: 'Failover + commit', kind: 'compute' }, { id: 'rp', label: 'Re-protect / failback', kind: 'globe' }]
const repStages: Stage[] = [{ id: 'vault', label: 'Vaults', kind: 'storage' }, { id: 'diag', label: 'Diagnostic settings', kind: 'service' }, { id: 'law', label: 'Log Analytics', kind: 'storage' }, { id: 'out', label: 'Reports + alerts', kind: 'user' }]

const backupGroup: ScenarioGroup = {
  id: 'backup-dr-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'Vault/datasource support, policy limits (Standard vs Enhanced, instant restore ranges), restore options, Site Recovery workflow and backup reporting prerequisites follow Microsoft Learn. Recovery point counts are calculated from the policy.',
  scenarios: [
    chooser({
      id: 'vault', title: 'Recovery Services vault or Backup vault', description: 'Pick the vault type for each data source.', requirementLabel: 'Data source', answerLabel: 'Vault',
      answers: ['Recovery Services vault', 'Backup vault'],
      answerNotes: { 'Recovery Services vault': 'Azure VMs, SQL Server/SAP HANA in Azure VMs, Azure Files, MARS/MABS/DPM on-premises, and Azure Site Recovery.', 'Backup vault': 'Newer workloads: Azure Blobs, Azure Disks, Azure Database for PostgreSQL flexible server, AKS and others.' },
      cases: (Object.keys(VAULT_FOR) as Datasource[]).map((d) => ({ value: d, label: d, answer: VAULT_FOR[d], why: `${d} is protected by a ${VAULT_FOR[d]}.` })),
    }),
    {
      id: 'policy',
      title: 'Backup policy',
      description: 'Design a VM backup policy for: restore any day in the last 30 days, the last 12 month-ends, and run at least twice a day for a critical VM.',
      stages: policyStages,
      controls: [
        { type: 'select', key: 'type', label: 'Policy sub-type', options: opt('Standard', 'Enhanced') },
        { type: 'select', key: 'freq', label: 'Frequency', options: opt('Daily', 'Hourly') },
        { type: 'checkbox', key: 'tl', label: 'VM uses Trusted Launch' },
        { type: 'number', key: 'ir', label: 'Instant restore retention (days)', min: 0, max: 30 },
        { type: 'number', key: 'daily', label: 'Daily retention (days)', min: 1, max: 9999 },
        { type: 'number', key: 'weekly', label: 'Weekly retention (weeks)', min: 0, max: 5163 },
        { type: 'number', key: 'monthly', label: 'Monthly retention (months)', min: 0, max: 1188 },
        { type: 'number', key: 'yearly', label: 'Yearly retention (years)', min: 0, max: 99 },
      ],
      initial: { type: 'Standard', freq: 'Hourly', tl: true, ir: 2, daily: 30, weekly: 0, monthly: 0, yearly: 0 },
      presets: [{ label: 'Enhanced, every 4 hours, 12 months', values: { type: 'Enhanced', monthly: 12, ir: 7 } }, { label: 'Standard daily', values: { type: 'Standard', freq: 'Daily', tl: false, monthly: 12 } }],
      evaluate: (s) => {
        const p: VmPolicy = { type: str(s, 'type') as 'Standard', frequency: str(s, 'freq') as 'Daily', dailyDays: num(s, 'daily'), weeklyWeeks: num(s, 'weekly'), monthlyMonths: num(s, 'monthly'), yearlyYears: num(s, 'yearly'), instantRestoreDays: num(s, 'ir') }
        const issues = policyIssues(p, bool(s, 'tl'))
        const meets = p.dailyDays >= 30 && p.monthlyMonths >= 12 && p.frequency === 'Hourly'
        const stages = chain(policyStages, [
          [true, bool(s, 'tl') ? 'Trusted Launch VM.' : 'Standard security VM.'],
          [issues.length === 0, issues.length ? issues.join(' ') : `${p.type} policy, ${p.frequency === 'Hourly' ? 'every 4 hours' : 'once a day'}.`],
          [true, `Snapshots kept ${p.instantRestoreDays} day(s) for fast restores.`],
          [true, `≈ ${restorePoints(p)} recovery points retained in the vault.`],
          [meets, meets ? 'Meets: 30 days of dailies, 12 month-ends, multiple backups per day.' : 'Does not meet the requirement: need ≥30 days daily, ≥12 monthly and multiple backups per day (Enhanced, hourly).'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'POLICY MEETS REQUIREMENT' : 'POLICY INVALID OR INSUFFICIENT', detail: stages.find((x) => x.ok === false)?.detail ?? stages[4]!.detail }, checks: [ok ? 'policy-valid' : 'policy-invalid'], metrics: [{ label: 'Recovery points', value: String(restorePoints(p)) }] }
      },
    },
    {
      id: 'restore',
      title: 'Back up and restore',
      description: 'Pick the right restore for each incident.',
      stages: restoreStages,
      controls: [
        { type: 'select', key: 'incident', label: 'Incident', options: opt('A user deleted one file on the VM', 'The VM OS is corrupt; keep the same VM', 'Need a copy of the VM for testing', 'Primary region outage') },
        { type: 'select', key: 'option', label: 'Restore option', options: opt('File recovery', 'Replace existing', 'Create new VM', 'Restore disks', 'Cross Region Restore') },
        { type: 'select', key: 'redundancy', label: 'Vault storage redundancy', options: opt('GRS with Cross Region Restore enabled', 'GRS', 'LRS', 'ZRS') },
        { type: 'checkbox', key: 'onDemand', label: 'Take an on-demand backup first (Backup now)' },
      ],
      initial: { incident: 'A user deleted one file on the VM', option: 'Create new VM', redundancy: 'GRS', onDemand: false },
      presets: [{ label: 'File recovery', values: { option: 'File recovery' } }, { label: 'Replace corrupted OS', values: { incident: 'The VM OS is corrupt; keep the same VM', option: 'Replace existing' } }, { label: 'Region outage without CRR', values: { incident: 'Primary region outage', option: 'Cross Region Restore' } }, { label: 'Region outage with CRR', values: { incident: 'Primary region outage', option: 'Cross Region Restore', redundancy: 'GRS with Cross Region Restore enabled' } }],
      evaluate: (s) => {
        const best: Record<string, string> = { 'A user deleted one file on the VM': 'File recovery', 'The VM OS is corrupt; keep the same VM': 'Replace existing', 'Need a copy of the VM for testing': 'Create new VM', 'Primary region outage': 'Cross Region Restore' }
        const want = best[str(s, 'incident')]!
        const crrOk = str(s, 'option') !== 'Cross Region Restore' || str(s, 'redundancy').includes('Cross Region Restore')
        const fit = str(s, 'option') === want
        const stages = chain(restoreStages, [
          [true, `rsv-prod (${str(s, 'redundancy')}). ${bool(s, 'onDemand') ? 'On-demand backup taken.' : 'Using the scheduled backups.'}`],
          [true, 'Recovery point: latest application-consistent snapshot (instant restore tier).'],
          [crrOk, crrOk ? `${str(s, 'option')}: ${{ 'File recovery': 'mount the recovery point with a script and copy files back', 'Replace existing': 'replaces the VM disks in place (keeps name, NICs)', 'Create new VM': 'creates a VM from the recovery point', 'Restore disks': 'restores disks to a staging storage account/resource group; attach or deploy with the generated template', 'Cross Region Restore': 'restores in the paired region' }[str(s, 'option')]}.` : 'Cross Region Restore requires a GRS vault with CRR enabled (and it must be set up before the outage).'],
          [fit, fit ? 'Incident resolved with minimal impact.' : `Works, but ${want} fits this incident better.`],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'RESTORED' : 'WRONG OR UNAVAILABLE OPTION', detail: stages.find((x) => x.ok === false)?.detail ?? stages[2]!.detail }, checks: [ok ? (str(s, 'option') === 'File recovery' ? 'restore-file' : 'restore-vm') : 'restore-wrong'], notes: ['Vault storage redundancy can only be changed before the first item is protected. Soft delete keeps deleted backup data for 14 days by default.'] }
      },
    },
    {
      id: 'asr',
      title: 'Site Recovery: configure and fail over',
      description: 'Replicate an Azure VM from East US to West US, test failover and then fail over for real.',
      stages: asrStages,
      controls: [
        { type: 'select', key: 'vaultRegion', label: 'Recovery Services vault region', options: opt('West US (target)', 'East US (source)') },
        { type: 'checkbox', key: 'replicated', label: 'Replication enabled and initial replication complete (Protected)' },
        { type: 'checkbox', key: 'test', label: 'Test failover to an isolated VNet, then Cleanup test failover' },
        { type: 'select', key: 'point', label: 'Recovery point', options: opt('Latest (lowest RPO)', 'Latest processed (lowest RTO)', 'Latest app-consistent') },
        { type: 'checkbox', key: 'commit', label: 'Commit the failover' },
        { type: 'checkbox', key: 'reprotect', label: 'Re-protect (replicate West US → East US)' },
      ],
      initial: { vaultRegion: 'East US (source)', replicated: true, test: false, point: 'Latest processed (lowest RTO)', commit: false, reprotect: false },
      presets: [{ label: 'Vault in the target region', values: { vaultRegion: 'West US (target)' } }, { label: 'Full DR drill', values: { vaultRegion: 'West US (target)', test: true, commit: true, reprotect: true } }],
      evaluate: (s) => {
        const vOk = str(s, 'vaultRegion').startsWith('West')
        const stages = chain(asrStages, [
          [vOk, vOk ? 'Vault in the target region (West US), separate from the source.' : 'The vault for Azure-to-Azure replication must not be in the source region: create it in the target region.'],
          [bool(s, 'replicated'), bool(s, 'replicated') ? 'Mobility service extension installed; cache storage account in East US; replication policy keeps recovery points (up to 15 days) and app-consistent snapshots.' : 'Enable replication and wait for initial replication.'],
          [bool(s, 'test'), bool(s, 'test') ? 'Test failover succeeded in an isolated VNet without affecting production; cleaned up.' : 'Run a test failover first to validate the plan without impact.'],
          [bool(s, 'commit'), bool(s, 'commit') ? `Failed over using ${str(s, 'point')}; committed.` : 'Failover not committed: you can still change the recovery point, but re-protect is unavailable.'],
          [bool(s, 'reprotect'), bool(s, 'reprotect') ? 'Re-protected: replicating back to East US, ready for failback.' : 'Re-protect so you can fail back to the primary region later.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'DR DRILL COMPLETE' : 'DR NOT READY', detail: stages.find((x) => x.ok === false)?.detail ?? 'Workload running in West US and protected back to East US.' }, checks: [ok ? 'asr-failover' : bool(s, 'test') && vOk ? 'asr-test-failover' : 'asr-incomplete'] }
      },
    },
    {
      id: 'reports',
      title: 'Backup reports and alerts',
      description: 'Get a weekly backup success report and be paged when a backup job fails.',
      stages: repStages,
      controls: [
        { type: 'checkbox', key: 'diag', label: 'Vault diagnostic settings send backup data (resource-specific tables) to law-backup' },
        { type: 'checkbox', key: 'alerts', label: 'Azure Monitor built-in alerts for backup job failures enabled' },
        { type: 'checkbox', key: 'apr', label: 'Alert processing rule routes backup alerts to action group ag-backup' },
        { type: 'number', key: 'failed', label: 'Failed backup jobs this week', min: 0, max: 50 },
      ],
      initial: { diag: false, alerts: true, apr: false, failed: 2 },
      presets: [{ label: 'Enable diagnostics', values: { diag: true } }, { label: 'Route alerts', values: { diag: true, apr: true } }],
      evaluate: (s) => {
        const stages = chain(repStages, [
          [true, '3 Recovery Services vaults, 1 Backup vault.'],
          [bool(s, 'diag'), bool(s, 'diag') ? 'Diagnostic settings configured on every vault (use Azure Policy at scale).' : 'Backup reports need vault diagnostic settings sending data to a Log Analytics workspace.'],
          [true, 'Data arrives in AddonAzureBackupJobs and related tables (can take hours at first).'],
          [bool(s, 'alerts') && bool(s, 'apr'), !bool(s, 'alerts') ? 'Enable built-in Azure Monitor alerts for backup.' : !bool(s, 'apr') ? `${num(s, 'failed')} job failure alert(s) raised, but no alert processing rule/action group sends notifications.` : `Backup reports show success rate; ${num(s, 'failed')} failure(s) paged to ag-backup.`],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'REPORTING AND ALERTING' : 'GAP IN VISIBILITY', detail: stages.find((x) => x.ok === false)?.detail ?? stages[3]!.detail }, checks: [ok ? 'backup-reports' : 'backup-visibility-gap'] }
      },
    },
  ],
}

export const groups: ScenarioGroup[] = [monitorGroup, backupGroup]
