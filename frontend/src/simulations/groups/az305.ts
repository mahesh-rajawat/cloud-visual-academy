/**
 * AZ-305 design trainers. Each lesson gets a group of "which design fits?" choosers built from
 * realistic requirements, plus a composite SLA calculator for availability questions.
 * Guidance follows Microsoft Learn (Azure Architecture Center, Well-Architected Framework) as of November 2026.
 */
import { chooser } from '../chooser'
import { chain, num, str, type Scenario, type ScenarioGroup } from '../scenario'

const NOTE = 'Design trainer: each case is a requirement and the service Microsoft guidance recommends for it. Real designs weigh several requirements at once.'
const ch = (id: string, title: string, description: string, req: string, ans: string, answers: Record<string, string>, rows: Array<[string, string, string, string]>) =>
  chooser({ id, title, description, requirementLabel: req, answerLabel: ans, answers: Object.keys(answers), answerNotes: answers, cases: rows.map(([value, label, answer, why]) => ({ value, label, answer, why })) })
const g = (id: string, scenarios: Scenario[]): ScenarioGroup => ({ id, fidelity: 'simplified-illustration', fidelityNote: NOTE, scenarios })

// ------------------------------------------------------------------ composite SLA
/** Availability of services that must ALL work (in series): multiply. */
export function serialSla(slas: number[]): number {
  return slas.reduce((p, s) => p * (s / 100), 1) * 100
}
/** Availability of N independent copies where ANY one is enough (in parallel): 1 - product of failure chances. */
export function parallelSla(sla: number, copies: number): number {
  return (1 - Math.pow(1 - sla / 100, copies)) * 100
}
/** Minutes of allowed downtime in a 30-day month. */
export function downtimeMinutes(sla: number): number {
  return Math.round((1 - sla / 100) * 30 * 24 * 60 * 10) / 10
}

const slaCalc: Scenario = {
  id: 'composite-sla',
  title: 'Composite SLA calculator',
  description: 'A web app that needs its web tier AND its database AND its cache is only up when all three are up, so the SLAs multiply. Deploying the whole stack in two regions behind a global router means either region is enough.',
  stages: [
    { id: 'web', label: 'Web tier', kind: 'compute' },
    { id: 'db', label: 'Database', kind: 'storage' },
    { id: 'cache', label: 'Cache', kind: 'service' },
    { id: 'total', label: 'Composite', kind: 'globe' },
  ],
  controls: [
    { type: 'number', key: 'web', label: 'Web tier SLA %', min: 90, max: 99.999, step: 0.001 },
    { type: 'number', key: 'db', label: 'Database SLA %', min: 90, max: 99.999, step: 0.001 },
    { type: 'number', key: 'cache', label: 'Cache SLA % (100 = no cache)', min: 90, max: 100, step: 0.001 },
    { type: 'select', key: 'regions', label: 'Deployment', options: [{ value: '1', label: 'One region' }, { value: '2', label: 'Two regions, active-active' }] },
    { type: 'number', key: 'router', label: 'Global router SLA % (used with two regions)', min: 90, max: 100, step: 0.001 },
    { type: 'number', key: 'target', label: 'Business target %', min: 90, max: 99.999, step: 0.001 },
  ],
  initial: { web: 99.95, db: 99.99, cache: 99.9, regions: '1', router: 99.99, target: 99.95 },
  presets: [
    { label: 'One region without the cache (one dependency fewer)', values: { web: 99.95, db: 99.99, cache: 100, regions: '1', router: 99.99, target: 99.95 } },
    { label: 'Same stack in two regions', values: { web: 99.95, db: 99.99, cache: 99.9, regions: '2', router: 99.99, target: 99.95 } },
  ],
  evaluate: (s) => {
    const one = serialSla([num(s, 'web'), num(s, 'db'), num(s, 'cache')])
    const two = str(s, 'regions') === '2'
    const total = two ? serialSla([parallelSla(one, 2), num(s, 'router')]) : one
    const ok = total >= num(s, 'target')
    const stages = chain(slaCalc.stages, [
      [true, `${num(s, 'web')}%`], [true, `${num(s, 'db')}%`], [true, `${num(s, 'cache')}%`],
      [ok, two ? `One region: ${one.toFixed(3)}%. Two regions: 1 − (1 − ${(one / 100).toFixed(5)})² = ${parallelSla(one, 2).toFixed(4)}%, × router ${num(s, 'router')}% = ${total.toFixed(4)}%.`
        : `${num(s, 'web')}% × ${num(s, 'db')}% × ${num(s, 'cache')}% = ${total.toFixed(3)}%.`],
    ])
    return {
      stages,
      outcome: { ok, title: ok ? 'MEETS TARGET' : 'BELOW TARGET', detail: `Composite ${total.toFixed(3)}% ≈ ${downtimeMinutes(total)} min downtime per 30-day month (target ${num(s, 'target')}%).${ok ? '' : ' Add redundancy (zones or a second region) or remove a dependency.'}` },
      checks: [two ? 'sla-multi-region' : 'sla-single', ok ? 'sla-meets' : 'sla-below'],
      metrics: [{ label: 'Composite SLA', value: `${total.toFixed(3)}%` }, { label: 'Downtime / month', value: `${downtimeMinutes(total)} min` }],
    }
  },
}

// ------------------------------------------------------------------ domain 1
const logRoute = ch('log-route', 'Where should the logs go?', 'Diagnostic settings can send platform logs and metrics to several destinations at once.', 'Requirement', 'Destination', {
  'Log Analytics workspace': 'Query with KQL, alerts, workbooks, Sentinel.',
  'Storage account': 'Cheapest long-term archive; no querying in place.',
  'Event Hubs': 'Stream to third-party SIEM or custom consumers.',
  'Azure Monitor partner integration': 'Send to partner tools such as Datadog or Elastic through native integrations.',
}, [
  ['kql', 'Correlate sign-in logs and firewall logs with queries and alerts', 'Log Analytics workspace', 'Log Analytics is where Azure Monitor runs KQL queries and log alerts.'],
  ['archive', 'Keep audit logs 7 years as cheaply as possible, rarely read', 'Storage account', 'A storage account (cool/archive tiers, immutability) is the low-cost archive destination.'],
  ['siem', 'Feed an existing third-party SIEM in real time', 'Event Hubs', 'Event Hubs streams logs to external tools that consume from it.'],
  ['datadog', 'The operations team already uses Datadog and wants Azure logs there with minimal plumbing', 'Azure Monitor partner integration', 'Native partner integrations route logs to supported partner solutions.'],
])
const monitorTool = ch('monitor-tool', 'Which monitoring solution?', 'Azure Monitor has a feature for each layer.', 'Requirement', 'Solution', {
  'Application Insights': 'Application performance monitoring: requests, dependencies, failures, distributed tracing.',
  'VM insights': 'Guest performance and dependency map for VMs and scale sets.',
  'Container insights': 'AKS and container workload monitoring.',
  'Microsoft Sentinel': 'Cloud SIEM and SOAR on top of Log Analytics.',
  'Network Watcher': 'Network diagnostics: connection monitor, flow logs, next hop.',
}, [
  ['apm', 'Find which downstream dependency makes a web API slow', 'Application Insights', 'Application Insights traces requests and dependency calls end to end.'],
  ['siem', 'Detect and investigate security incidents across Azure and on-premises', 'Microsoft Sentinel', 'Sentinel is the SIEM/SOAR built on Log Analytics.'],
  ['aks', 'Monitor node and pod health of AKS clusters', 'Container insights', 'Container insights collects AKS performance and inventory.'],
  ['vm', 'See which processes on a VM talk to which servers', 'VM insights', 'VM insights includes the dependency map.'],
  ['net', 'Continuously check latency between Azure and an on-premises server', 'Network Watcher', 'Connection monitor in Network Watcher tests reachability and latency over time.'],
])
const workspace = ch('workspace-design', 'How many Log Analytics workspaces?', 'Start with as few workspaces as possible and add one only for a real reason.', 'Requirement', 'Design', {
  'One central workspace': 'Simplest: one place to query, resource-context RBAC limits what each team sees.',
  'One workspace per data-residency region': 'Keeps data in the geography regulation requires.',
  'Separate workspace for a different tenant or billing owner': 'Data belongs to another organisation or must be billed separately.',
}, [
  ['teams', 'Each app team must see only logs from its own resources', 'One central workspace', 'Resource-context access (and table-level RBAC) lets teams see only their resources in a shared workspace.'],
  ['eu', 'EU customer data must stay in the EU; US data in the US', 'One workspace per data-residency region', 'Workspaces store data in their region, so residency needs a workspace per geography.'],
  ['msp', 'A managed service provider monitors two customers who must not share data', 'Separate workspace for a different tenant or billing owner', 'Different owners need separate workspaces (Azure Lighthouse can query across them).'],
])

const hybridAuth = ch('hybrid-auth', 'Which hybrid sign-in method?', 'Users sync from on-premises AD to Microsoft Entra ID with Entra Connect Sync or Cloud Sync.', 'Requirement', 'Method', {
  'Password hash sync': 'Entra ID checks a hash of the password hash. Recommended default; works if on-premises is down; enables leaked-credential detection.',
  'Pass-through authentication': 'Agents on-premises validate passwords against AD in real time.',
  'Federation (AD FS)': 'On-premises federation servers authenticate users; most complex.',
}, [
  ['simple', 'Simplest method that keeps working if the datacenter goes offline', 'Password hash sync', 'PHS needs no on-premises components at sign-in time.'],
  ['policy', 'Passwords must never leave on-premises, and AD account lockout and logon hours must apply at sign-in', 'Pass-through authentication', 'PTA validates against on-premises AD in real time without storing hashes in the cloud.'],
  ['smartcard', 'Sign-in must use an existing third-party smart-card solution that only integrates with AD FS', 'Federation (AD FS)', 'Federation is needed only for requirements Entra ID cannot meet natively.'],
])
const idType = ch('identity-type', 'Which identity solution?', 'Pick the identity feature that fits who (or what) is signing in.', 'Requirement', 'Solution', {
  'Managed identity': 'An identity Azure manages for an Azure resource; no secrets.',
  'Microsoft Entra B2B collaboration': 'Partners sign in with their own work accounts as guests.',
  'Microsoft Entra External ID (customers)': 'Customer sign-up and sign-in for your apps (successor to Azure AD B2C).',
  'Workload identity federation': 'External workloads (GitHub Actions, Kubernetes) get tokens without stored secrets.',
  'Conditional Access': 'Policies that require MFA, compliant devices or block risky sign-ins.',
}, [
  ['func', 'An Azure Function must read Key Vault secrets without storing credentials', 'Managed identity', 'Managed identities remove secrets from code entirely.'],
  ['partner', 'Staff at a partner company need access to a SharePoint site and one Azure app', 'Microsoft Entra B2B collaboration', 'B2B invites partners as guests who use their own credentials.'],
  ['shop', 'Millions of consumers must sign up to an online shop with email or social accounts', 'Microsoft Entra External ID (customers)', 'External ID in an external tenant is built for customer identity.'],
  ['gha', 'A GitHub Actions workflow must deploy to Azure without a client secret', 'Workload identity federation', 'Federated credentials trust GitHub\'s OIDC tokens.'],
  ['mfa', 'Require MFA when admins sign in from outside the corporate network', 'Conditional Access', 'Conditional Access (Entra ID P1) evaluates location, device and risk.'],
])
const azAuthz = ch('authz-azure', 'Authorize access to Azure resources', 'Least privilege first: the smallest role at the smallest scope, only when needed.', 'Requirement', 'Solution', {
  'Built-in RBAC role at the right scope': 'Use an existing role assigned to a group at the narrowest scope.',
  'Custom RBAC role': 'A role with exactly the actions needed when no built-in role fits.',
  'Privileged Identity Management (PIM)': 'Just-in-time, time-limited, approved activation of privileged roles.',
  'RBAC with ABAC condition': 'Role assignment that also checks attributes, such as blob index tags.',
  'Azure Policy': 'Rules about resource configuration, not about people.',
}, [
  ['jit', 'Admins should hold Owner only for a few hours when needed, with approval', 'Privileged Identity Management (PIM)', 'PIM (Entra ID P2 / ID Governance) makes roles eligible instead of permanent.'],
  ['restart', 'Operators may only start and restart VMs, nothing else', 'Custom RBAC role', 'No built-in role is that narrow; create a custom role with those actions.'],
  ['tags', 'Users may read only blobs tagged Project=Alpha in a shared container', 'RBAC with ABAC condition', 'Attribute-based conditions on Storage Blob Data roles filter by blob index tags.'],
  ['team', 'A team manages everything in its own resource group', 'Built-in RBAC role at the right scope', 'Contributor (or a narrower built-in role) on that resource group, assigned to the team\'s group.'],
])
const onpremAuthz = ch('authz-onprem', 'Authorize access to on-premises resources', 'Use Microsoft Entra ID as the front door for on-premises apps.', 'Requirement', 'Solution', {
  'Microsoft Entra application proxy': 'Publishes on-premises web apps with Entra pre-authentication; no inbound firewall ports.',
  'Microsoft Entra Private Access': 'Zero Trust network access to private apps and ports, replacing a traditional VPN (Global Secure Access).',
  'Microsoft Entra Domain Services': 'Managed domain in Azure for legacy apps that need LDAP, Kerberos or NTLM.',
  'Site-to-site VPN': 'Network-level connection between locations.',
}, [
  ['web', 'Remote staff need an on-premises intranet web app with MFA, without opening inbound ports', 'Microsoft Entra application proxy', 'Application proxy uses an outbound connector and Conditional Access.'],
  ['ztna', 'Replace the legacy VPN so remote users reach private apps on any port with Conditional Access per app', 'Microsoft Entra Private Access', 'Private Access gives per-app Zero Trust network access.'],
  ['ldap', 'A lift-and-shift app in Azure needs LDAP and Kerberos, but there must be no domain controllers to manage', 'Microsoft Entra Domain Services', 'Domain Services provides a managed domain without running DCs.'],
])
const secrets = ch('secrets', 'Where do secrets, keys and certificates live?', 'Key Vault for most needs; stronger isolation costs more.', 'Requirement', 'Service', {
  'Key Vault Standard': 'Secrets, certificates and software-protected keys.',
  'Key Vault Premium': 'Adds HSM-protected keys in a multi-tenant HSM.',
  'Managed HSM': 'Single-tenant, FIPS 140-3 Level 3 validated HSM pool you control.',
  'App Configuration': 'Non-secret settings and feature flags (can reference Key Vault).',
}, [
  ['conn', 'Store database connection strings and TLS certificates with auto-renewal', 'Key Vault Standard', 'Standard covers secrets and certificate management.'],
  ['hsm', 'Customer-managed keys must be HSM-protected, at the lowest cost', 'Key Vault Premium', 'Premium offers HSM-backed keys without a dedicated HSM.'],
  ['single', 'Regulation requires single-tenant HSMs with full control of the security domain', 'Managed HSM', 'Managed HSM is a dedicated, single-tenant HSM pool.'],
  ['flags', 'Turn a feature on for 10% of users without redeploying', 'App Configuration', 'Feature flags belong in App Configuration; secrets stay in Key Vault.'],
])
const hierarchy = ch('hierarchy', 'Management groups, subscriptions, resource groups or tags?', 'Each level has a job: policy and access inheritance, billing and scale boundaries, lifecycle, metadata.', 'Requirement', 'Level', {
  'Management group': 'Apply policy and RBAC to many subscriptions at once (up to six levels below the root).',
  'Subscription': 'Billing, quota and isolation boundary.',
  'Resource group': 'Resources that share a lifecycle and are deployed and deleted together.',
  'Tag': 'Metadata such as cost center or environment for reporting.',
}, [
  ['policy', 'Every production subscription must allow only EU regions', 'Management group', 'Assign the policy at a management group containing the production subscriptions.'],
  ['bill', 'A business unit needs its own invoice and its own quota limits', 'Subscription', 'Subscriptions are the billing and quota boundary.'],
  ['life', 'An app\'s web app, database and storage are created and deleted together', 'Resource group', 'Group resources that share a lifecycle.'],
  ['cost', 'Finance needs costs split by cost center across many subscriptions', 'Tag', 'A CostCenter tag (enforced with Azure Policy) enables cost reports by tag.'],
])
const compliance = ch('compliance', 'Manage compliance', 'Prevent, detect and report.', 'Requirement', 'Solution', {
  'Azure Policy initiative': 'Group policies (for example a regulatory set) and enforce or audit them.',
  'Defender for Cloud regulatory compliance': 'Dashboard of controls for standards such as ISO 27001 or PCI DSS.',
  'Microsoft Purview Compliance Manager': 'Compliance across Microsoft 365 and other services, with improvement actions.',
  'Resource lock': 'Stops deletion or change of critical resources.',
}, [
  ['enforce', 'Block public IPs and require encryption across 40 subscriptions', 'Azure Policy initiative', 'An initiative with Deny effects, assigned at a management group.'],
  ['report', 'Show auditors how Azure resources map to PCI DSS controls', 'Defender for Cloud regulatory compliance', 'Defender for Cloud maps assessments to standards.'],
  ['m365', 'Track compliance posture for Microsoft 365 data handling', 'Microsoft Purview Compliance Manager', 'Compliance Manager covers Microsoft 365 and data-centric controls.'],
])
const idGov = ch('id-governance', 'Identity governance', 'Right people, right access, for the right time, reviewed regularly.', 'Requirement', 'Feature', {
  'Access reviews': 'Owners or users confirm periodically that access is still needed.',
  'Entitlement management (access packages)': 'Bundle groups, apps and sites; users request; access expires.',
  'Privileged Identity Management': 'Just-in-time activation of admin roles.',
  'Lifecycle workflows': 'Automate joiner, mover and leaver tasks.',
}, [
  ['guests', 'Every quarter, confirm that guest users still need access to a team', 'Access reviews', 'Access reviews can target guests and remove denied access automatically.'],
  ['onboard', 'New contractors request one bundle of apps and groups that expires after 6 months', 'Entitlement management (access packages)', 'Access packages bundle resources with approval and expiry.'],
  ['leaver', 'Disable accounts and remove group memberships automatically on an employee\'s last day', 'Lifecycle workflows', 'Lifecycle workflows run tasks based on HR attributes such as leave date.'],
  ['admin', 'Global Administrator should be activated only with approval and a reason', 'Privileged Identity Management', 'PIM makes the role eligible with approval and justification.'],
])

// ------------------------------------------------------------------ domain 2
const sqlStore = ch('sql-store', 'Which relational service?', 'From most managed to most control: SQL Database, SQL Managed Instance, SQL Server on a VM.', 'Requirement', 'Service', {
  'Azure SQL Database': 'Fully managed single databases or elastic pools.',
  'Azure SQL Managed Instance': 'Near-100% SQL Server compatibility (SQL Agent, cross-database queries, CLR) as PaaS in your VNet.',
  'SQL Server on Azure VMs': 'Full control of OS and SQL Server, including features PaaS does not support.',
  'Azure Database for PostgreSQL flexible server': 'Managed open-source PostgreSQL.',
}, [
  ['new', 'A new cloud app needs one relational database with minimal administration', 'Azure SQL Database', 'SQL Database is the most managed option for new apps.'],
  ['agent', 'Migrate 30 databases that use SQL Agent jobs and cross-database queries with few changes', 'Azure SQL Managed Instance', 'Managed Instance supports instance-level features such as SQL Agent and cross-database queries.'],
  ['ssrs', 'The app needs SQL Server Reporting Services on the same server and OS-level access', 'SQL Server on Azure VMs', 'Only a VM gives OS access and the full SQL Server feature set.'],
  ['pg', 'A team\'s app is built on PostgreSQL extensions', 'Azure Database for PostgreSQL flexible server', 'Use the managed PostgreSQL service.'],
])
const sqlTier = ch('sql-tier', 'Which service tier and compute?', 'vCore tiers: General Purpose, Business Critical, Hyperscale. Compute: provisioned or serverless. Many databases: elastic pool.', 'Requirement', 'Choice', {
  'General Purpose': 'Balanced, budget-friendly; remote storage.',
  'Business Critical': 'Lowest latency on local SSD, a built-in readable replica, In-Memory OLTP.',
  'Hyperscale': 'Very large databases (up to 128 TB), fast scaling and named replicas.',
  'Serverless compute': 'Auto-scales vCores and can auto-pause when idle; billed per second of use.',
  'Elastic pool': 'Many databases share a pool of resources.',
}, [
  ['big', 'A 40 TB database that keeps growing', 'Hyperscale', 'Hyperscale is built for very large databases.'],
  ['oltp', 'Heavy OLTP with the lowest I/O latency and a free read-only replica for reports', 'Business Critical', 'Business Critical uses local SSD and includes a readable secondary.'],
  ['dev', 'A dev database used a few hours a day, idle at night', 'Serverless compute', 'Serverless auto-pauses when idle, so you pay only for use.'],
  ['saas', '200 small tenant databases with unpredictable, non-overlapping peaks', 'Elastic pool', 'An elastic pool shares resources across databases with different peak times.'],
  ['std', 'A typical business app with moderate performance needs and a tight budget', 'General Purpose', 'General Purpose is the default balanced tier.'],
])
const sqlScale = ch('sql-scale', 'Scale a relational database', 'Scale up, scale out reads, pool, or shard.', 'Requirement', 'Technique', {
  'Scale up (more vCores)': 'Change the compute size; quick but has an upper limit.',
  'Read scale-out': 'Send read-only workloads to a replica (Business Critical, Hyperscale).',
  'Elastic pool': 'Share resources across many databases.',
  'Sharding': 'Split data across many databases by a key (elastic database tools).',
}, [
  ['reports', 'Reports slow down the OLTP workload on a Business Critical database', 'Read scale-out', 'Use ApplicationIntent=ReadOnly to route reports to the readable replica.'],
  ['cpu', 'Month-end processing needs double the CPU for two days', 'Scale up (more vCores)', 'Scale up for the peak, then scale down.'],
  ['tenants', 'A multi-tenant app must grow beyond what one database can hold, with each tenant\'s data kept together', 'Sharding', 'Shard by tenant ID across databases.'],
])
const sqlProtect = ch('sql-protect', 'Protect relational data', 'Encryption at rest, in use, masking, row filtering, auditing.', 'Requirement', 'Feature', {
  'Transparent data encryption (TDE)': 'Encrypts database files at rest; on by default.',
  'Always Encrypted': 'Encrypts columns in the client; the database engine and DBAs never see plaintext.',
  'Dynamic data masking': 'Hides part of a value in query results for non-privileged users.',
  'Row-level security': 'Filters which rows a user can see.',
  'Auditing': 'Records database events to storage, Log Analytics or Event Hubs.',
}, [
  ['dba', 'DBAs must not be able to read credit card numbers', 'Always Encrypted', 'Only clients holding the column key can decrypt.'],
  ['mask', 'Support staff should see only the last 4 digits of phone numbers', 'Dynamic data masking', 'Masking changes what non-privileged users see in results.'],
  ['tenant', 'Each sales rep should see only their own customers\' rows', 'Row-level security', 'Security predicates filter rows per user.'],
  ['who', 'Record who ran which queries for compliance', 'Auditing', 'Auditing logs database events to a chosen destination.'],
])
const semi = ch('semi-structured', 'Store semi-structured data', 'JSON and key-value data: pick the Cosmos DB API by app need, or Table storage for simple, cheap key-value.', 'Requirement', 'Service', {
  'Azure Cosmos DB for NoSQL': 'Native JSON document API, global distribution, low latency.',
  'Azure Cosmos DB for MongoDB': 'Use existing MongoDB drivers and tools.',
  'Azure Cosmos DB for Apache Cassandra': 'Wide-column, CQL-compatible.',
  'Azure Cosmos DB for Apache Gremlin': 'Graph data and traversals.',
  'Azure Table Storage': 'Simple, low-cost key-value storage in a storage account.',
}, [
  ['global', 'A new app needs single-digit-millisecond JSON reads and writes in three regions', 'Azure Cosmos DB for NoSQL', 'The NoSQL API is the native, fully featured option.'],
  ['mongo', 'Move an existing MongoDB app with no code changes', 'Azure Cosmos DB for MongoDB', 'The MongoDB API keeps drivers and tools working.'],
  ['graph', 'Model and query social-network relationships', 'Azure Cosmos DB for Apache Gremlin', 'Gremlin is the graph API.'],
  ['cheap', 'Store device settings as key-value pairs as cheaply as possible, with no global distribution', 'Azure Table Storage', 'Table Storage is the low-cost key-value option.'],
])
const unstruct = ch('unstructured', 'Store unstructured data', 'Files and objects.', 'Requirement', 'Service', {
  'Azure Blob Storage': 'Object storage for any amount of files, images, backups.',
  'Azure Data Lake Storage': 'Blob storage with a hierarchical namespace for big-data analytics.',
  'Azure Files': 'Managed SMB and NFS file shares.',
  'Azure NetApp Files': 'Enterprise, high-performance NFS/SMB volumes (SAP, HPC, databases).',
}, [
  ['media', 'Store millions of images served to a website', 'Azure Blob Storage', 'Blob Storage is object storage at massive scale.'],
  ['lake', 'An analytics platform needs folders, POSIX-like ACLs and Spark access', 'Azure Data Lake Storage', 'The hierarchical namespace provides directories and ACLs for analytics.'],
  ['share', 'Replace an on-premises Windows file server share', 'Azure Files', 'Azure Files provides SMB shares (with AD-based permissions).'],
  ['sap', 'SAP HANA needs sub-millisecond-latency shared NFS volumes', 'Azure NetApp Files', 'NetApp Files is designed for demanding enterprise file workloads.'],
])
const balance = ch('storage-balance', 'Balance features, performance and cost', 'Pick the account type, tier and redundancy that fit, not the most expensive.', 'Requirement', 'Choice', {
  'Premium block blob account': 'SSD-backed, low latency, high transaction rates.',
  'Standard GPv2 with Hot tier': 'Frequently accessed data.',
  'Cool or Cold tier': 'Infrequently accessed data kept 30+ / 90+ days.',
  'Archive tier': 'Offline, cheapest storage; hours to rehydrate.',
  'Lifecycle management policy': 'Moves or deletes data automatically by age or last access.',
}, [
  ['iot', 'IoT telemetry needs many small writes with consistently low latency', 'Premium block blob account', 'Premium block blob is built for high transaction rates.'],
  ['backup', 'Backups kept 7 years, restored perhaps once, with 15 hours\' notice', 'Archive tier', 'Archive is cheapest when hours of rehydration are acceptable.'],
  ['auto', 'Logs are read for a week, then rarely, and deleted after a year, without manual work', 'Lifecycle management policy', 'A lifecycle rule tiers and deletes automatically.'],
  ['monthly', 'Reports are read once or twice a month but must open instantly', 'Cool or Cold tier', 'Online cooler tiers cost less to store and are read instantly.'],
])
const durable = ch('storage-durability', 'Protection and durability for unstructured data', 'Durability (redundancy) and protection (from mistakes and attacks) are different things.', 'Requirement', 'Feature', {
  'GZRS / RA-GZRS': 'Zone-redundant in the primary region plus copies in the secondary region.',
  'Immutable storage (WORM)': 'Time-based retention or legal hold: nobody can change or delete.',
  'Soft delete and versioning': 'Recover deleted or overwritten blobs.',
  'Azure Backup for blobs (vaulted)': 'Backups in a separate vault, protected from account-level deletion.',
}, [
  ['zone+region', 'Survive both a datacenter failure and a regional disaster', 'GZRS / RA-GZRS', 'GZRS combines zone redundancy with geo-replication.'],
  ['worm', 'Financial records must be undeletable for 7 years (SEC 17a-4)', 'Immutable storage (WORM)', 'Time-based retention policies make data WORM.'],
  ['oops', 'Users accidentally overwrite and delete files', 'Soft delete and versioning', 'Versioning recovers overwrites; soft delete recovers deletions.'],
  ['ransom', 'Keep an isolated copy even if the storage account itself is deleted by an attacker', 'Azure Backup for blobs (vaulted)', 'Vaulted backups live outside the source account.'],
])
const integrate = ch('data-integration', 'Data integration and analysis', 'Move and transform, then analyse.', 'Requirement', 'Service', {
  'Azure Data Factory': 'Orchestrate ETL/ELT pipelines with 90+ connectors; self-hosted runtime for on-premises.',
  'Azure Databricks': 'Apache Spark for data engineering, data science and ML.',
  'Azure Synapse Analytics': 'Data warehouse (dedicated SQL pools) plus serverless SQL and Spark.',
  'Azure Stream Analytics': 'SQL-like queries over real-time streams.',
  'Microsoft Fabric': 'SaaS analytics platform with OneLake, warehousing, data engineering and Power BI.',
  'Azure Data Explorer': 'Fast KQL analytics over large volumes of logs and telemetry.',
}, [
  ['copy', 'Copy data nightly from on-premises SQL Server and SAP into a data lake', 'Azure Data Factory', 'Data Factory pipelines with a self-hosted integration runtime.'],
  ['spark', 'Data scientists build ML features from huge datasets with notebooks and Spark', 'Azure Databricks', 'Databricks is the Spark-based platform for engineering and ML.'],
  ['stream', 'Raise an alert within seconds when a machine\'s temperature average exceeds a limit', 'Azure Stream Analytics', 'Stream Analytics runs windowed queries on live streams.'],
  ['saas', 'One managed platform for lakehouse, warehouse and Power BI with minimal infrastructure', 'Microsoft Fabric', 'Fabric unifies analytics as a SaaS service on OneLake.'],
  ['telemetry', 'Interactive queries over billions of telemetry records with KQL', 'Azure Data Explorer', 'Data Explorer is optimised for log and time-series analytics.'],
])

// ------------------------------------------------------------------ domain 3
const recovery = ch('recovery', 'Backup and disaster recovery', 'Backup protects data (go back in time). Disaster recovery keeps the service running elsewhere (fail over).', 'Requirement', 'Solution', {
  'Azure Backup': 'Point-in-time backups of VMs, SQL in VM, files, blobs and disks in a vault.',
  'Azure Site Recovery': 'Continuous replication of VMs to another region with orchestrated failover.',
  'Auto-failover group (SQL)': 'Geo-replicated databases with a listener that fails over together.',
  'Point-in-time restore (SQL)': 'Restore a database to any point within its retention (1–35 days).',
  'Long-term retention (SQL)': 'Keep weekly, monthly or yearly SQL backups for up to 10 years.',
}, [
  ['vmregion', 'VMs must run in another region within 2 hours of a regional outage, losing at most minutes of data', 'Azure Site Recovery', 'Site Recovery replicates continuously and orchestrates failover.'],
  ['ransomware', 'Recover a VM to how it was three days ago after ransomware', 'Azure Backup', 'Backups give point-in-time recovery; replication would copy the encryption too.'],
  ['sqlregion', 'A SQL database and its app must fail over to another region with no connection-string change', 'Auto-failover group (SQL)', 'Failover groups provide listener endpoints that follow the primary.'],
  ['dropped', 'Someone deleted rows from a table 20 minutes ago', 'Point-in-time restore (SQL)', 'Restore to a point before the mistake as a new database.'],
  ['audit', 'Keep a yearly SQL backup for 7 years for auditors', 'Long-term retention (SQL)', 'LTR keeps backups up to 10 years.'],
])
const ha = ch('high-availability', 'High availability', 'Zones protect against a datacenter failure; regions against a regional one.', 'Requirement', 'Design', {
  'Availability zones (zone-redundant)': 'Spread across datacenters in one region.',
  'Availability set': 'Spread across racks in one datacenter.',
  'Multi-region active-passive': 'Second region on standby, failed over when needed.',
  'Multi-region active-active': 'Both regions serve traffic behind a global router.',
  'Cosmos DB multi-region writes': 'Every region accepts writes.',
}, [
  ['dc', 'A VM-based app must survive a whole datacenter failure in its region', 'Availability zones (zone-redundant)', 'Zones are separate datacenters with independent power and network.'],
  ['legacy', 'A legacy app runs in a region without availability zones and needs protection from rack failures', 'Availability set', 'Availability sets spread VMs across fault and update domains.'],
  ['global', 'Users on three continents need low latency, and the app must keep running if a region fails', 'Multi-region active-active', 'Active-active behind Front Door serves users from the nearest healthy region.'],
  ['writes', 'A global app must accept writes in every region with 99.999% availability', 'Cosmos DB multi-region writes', 'Multi-region writes let each region accept writes.'],
  ['budget', 'The app must recover from a regional outage, but a second fully running region is too expensive', 'Multi-region active-passive', 'A standby (or pilot-light) region costs less; failover takes longer.'],
])
const dataHa = ch('data-ha', 'High availability for data', 'Pick by data type.', 'Requirement', 'Design', {
  'Zone-redundant SQL Database': 'Replicas spread across zones in one region.',
  'Active geo-replication / failover group': 'Readable secondary databases in other regions.',
  'ZRS storage': 'Three copies across zones in one region.',
  'RA-GZRS storage': 'Zones in the primary plus a readable secondary region.',
}, [
  ['sqlzone', 'A SQL database must survive a zone outage with no data loss and no region change', 'Zone-redundant SQL Database', 'Zone redundancy keeps synchronous replicas in other zones.'],
  ['sqlread', 'A SQL database needs a readable copy in another region for reports and DR', 'Active geo-replication / failover group', 'Geo-secondaries are readable and can become primary.'],
  ['blobread', 'Blobs must be readable from another region even before any failover', 'RA-GZRS storage', 'RA- gives read access to the secondary region.'],
  ['blobzone', 'Blobs must survive a zone failure; data must stay in one region', 'ZRS storage', 'ZRS keeps three synchronous copies across zones in one region.'],
])

// ------------------------------------------------------------------ domain 4
const compute = ch('compute', 'Which compute?', 'Most managed first: serverless → PaaS → containers → VMs.', 'Requirement', 'Service', {
  'Azure App Service': 'Managed web apps and APIs (code or container).',
  'Azure Container Apps': 'Serverless containers and microservices with scale to zero.',
  'Azure Kubernetes Service': 'Full Kubernetes control for complex container platforms.',
  'Azure Virtual Machines': 'Full OS control, any software, lift-and-shift.',
  'Azure Container Instances': 'Single containers on demand, no orchestration.',
  'Azure Virtual Desktop': 'Virtual Windows desktops and apps for users.',
}, [
  ['web', 'A .NET web app with deployment slots and custom domains, minimal operations', 'Azure App Service', 'App Service is the managed web hosting platform.'],
  ['micro', 'Ten microservices that scale on HTTP traffic and queue length, no cluster to manage', 'Azure Container Apps', 'Container Apps runs microservices serverlessly with KEDA scaling.'],
  ['k8s', 'The platform team needs custom Kubernetes operators, service mesh and node control', 'Azure Kubernetes Service', 'AKS gives the full Kubernetes API.'],
  ['lift', 'A third-party app needs a specific Windows Server version and registry settings', 'Azure Virtual Machines', 'Only VMs give full OS control.'],
  ['vdi', 'Contractors need a managed Windows desktop with company apps from any device', 'Azure Virtual Desktop', 'Azure Virtual Desktop delivers desktops and apps.'],
])
const vmChoice = ch('vm-choice', 'Design a VM-based solution', 'Size, pricing and placement.', 'Requirement', 'Choice', {
  'Azure Spot VMs': 'Deep discount on spare capacity; can be evicted.',
  'Reserved instances or savings plan': 'Discount for committing to 1 or 3 years of steady use.',
  'Azure Dedicated Host': 'Physical servers dedicated to your organisation.',
  'Virtual Machine Scale Sets': 'Many VMs that autoscale.',
}, [
  ['batch', 'Interruptible rendering jobs at the lowest price', 'Azure Spot VMs', 'Spot VMs suit work that tolerates eviction.'],
  ['steady', 'A database VM runs 24/7 for the next three years', 'Reserved instances or savings plan', 'Committed use gives large discounts for steady workloads.'],
  ['licence', 'Compliance requires no other customer\'s VMs on the same physical server', 'Azure Dedicated Host', 'Dedicated Host provides single-tenant physical servers.'],
  ['web', 'A stateless web tier must grow from 2 to 20 VMs with load', 'Virtual Machine Scale Sets', 'Scale sets autoscale identical VMs.'],
])
const serverless = ch('serverless', 'Serverless and batch', 'Code, workflows or big parallel jobs?', 'Requirement', 'Service', {
  'Azure Functions': 'Event-driven code; Flex Consumption scales fast and can scale to zero.',
  'Durable Functions': 'Stateful orchestrations of functions (chaining, fan-out/fan-in, human approval).',
  'Azure Logic Apps': 'Low-code workflows with hundreds of connectors.',
  'Azure Batch': 'Large-scale parallel and HPC jobs on pools of VMs.',
  'Container Apps jobs': 'Containerised tasks that run on demand, on a schedule or on events.',
}, [
  ['resize', 'Resize every image uploaded to a container', 'Azure Functions', 'A blob- or Event Grid-triggered function is the simplest fit.'],
  ['approval', 'An order process waits up to 3 days for a manager\'s approval before continuing', 'Durable Functions', 'Durable orchestrations keep state while waiting.'],
  ['connect', 'When an email with an invoice arrives, save it to SharePoint and post to Teams, built by business analysts', 'Azure Logic Apps', 'Logic Apps connectors make integration low-code.'],
  ['hpc', 'Run 10,000 independent simulation tasks on hundreds of cores overnight', 'Azure Batch', 'Batch schedules large parallel workloads on VM pools.'],
])
const messaging = ch('messaging', 'Messaging and events', 'Commands you must process (messages) vs facts that something happened (events).', 'Requirement', 'Service', {
  'Azure Queue Storage': 'Simple, very large queues in a storage account.',
  'Azure Service Bus': 'Enterprise messaging: FIFO sessions, transactions, dead-lettering, topics.',
  'Azure Event Grid': 'Push discrete events to subscribers (reactive, pub/sub).',
  'Azure Event Hubs': 'Ingest millions of events per second as a stream; Kafka endpoint.',
}, [
  ['order', 'Orders must be processed exactly in sequence per customer, with duplicate detection', 'Azure Service Bus', 'Service Bus sessions give FIFO and it supports duplicate detection.'],
  ['react', 'Start a function whenever a blob is created in any storage account', 'Azure Event Grid', 'Event Grid delivers resource events to handlers.'],
  ['telemetry', 'Ingest telemetry from 500,000 devices for real-time analytics', 'Azure Event Hubs', 'Event Hubs is the high-throughput streaming platform.'],
  ['simple', 'A background worker needs a simple, cheap queue that may hold over 80 GB of messages', 'Azure Queue Storage', 'Queue Storage is simple and scales to the storage account limit.'],
  ['fanout', 'One message must go to billing, shipping and email services, each filtering what it needs', 'Azure Service Bus', 'Service Bus topics with subscriptions and filters.'],
])
const apiCache = ch('api-cache', 'APIs, caching and configuration', 'Front your APIs, cache hot data, centralise settings.', 'Requirement', 'Service', {
  'Azure API Management': 'API gateway: policies, rate limits, versions, developer portal.',
  'Azure Managed Redis': 'In-memory cache (successor to Azure Cache for Redis).',
  'Azure Front Door caching': 'Cache static content at the global edge.',
  'Azure App Configuration': 'Central settings and feature flags.',
  'Key Vault references': 'Apps read secrets from Key Vault without storing them.',
}, [
  ['partners', 'Publish internal APIs to partners with API keys, quotas and a developer portal', 'Azure API Management', 'API Management is the API gateway and portal.'],
  ['session', 'Cache product catalogue lookups and session state with sub-millisecond reads', 'Azure Managed Redis', 'An in-memory Redis cache serves hot data fast.'],
  ['static', 'Serve images and scripts quickly to users worldwide', 'Azure Front Door caching', 'Edge caching brings static content close to users.'],
  ['settings', '20 microservices share settings that change without redeployment', 'Azure App Configuration', 'App Configuration centralises settings and supports dynamic refresh.'],
])
const deploy = ch('deployment', 'Automated deployment', 'Repeatable infrastructure and safe releases.', 'Requirement', 'Choice', {
  'Infrastructure as code (Bicep or Terraform)': 'Environments defined in files and deployed by pipelines.',
  'GitHub Actions or Azure Pipelines': 'CI/CD workflows that build, test and deploy.',
  'Deployment slots': 'Deploy to staging, warm up, then swap with no downtime.',
  'Azure Deployment Environments': 'Developers self-serve approved environments from templates.',
}, [
  ['repeat', 'Dev, test and production must be identical and recreated on demand', 'Infrastructure as code (Bicep or Terraform)', 'IaC makes environments repeatable.'],
  ['ci', 'Every merge to main should build, test and deploy automatically', 'GitHub Actions or Azure Pipelines', 'A CI/CD pipeline automates the release.'],
  ['swap', 'Release a web app with zero downtime and instant rollback', 'Deployment slots', 'Swap staging and production; swap back to roll back.'],
  ['self', 'Developers need sandbox environments that follow company templates, without tickets', 'Azure Deployment Environments', 'Deployment Environments provides governed self-service.'],
])
const migratePlan = ch('migrate-plan', 'Plan a migration with the Cloud Adoption Framework', 'Strategy → Plan → Ready → Adopt, with Govern, Secure and Manage throughout.', 'Requirement', 'CAF phase or tool', {
  'Strategy': 'Define motivations and business outcomes.',
  'Plan': 'Inventory the estate, decide the approach per workload, build skills.',
  'Ready': 'Prepare the landing zone (identity, network, governance).',
  'Adopt (migrate)': 'Move and modernise workloads.',
  'Azure Migrate': 'Discover, assess and migrate servers, databases and web apps.',
}, [
  ['why', 'Leaders agree why to move: exit a datacenter lease and cut costs', 'Strategy', 'Strategy captures motivations and outcomes.'],
  ['lz', 'Build the hub network, management groups and policies before moving any workload', 'Ready', 'Ready prepares Azure landing zones.'],
  ['discover', 'Find all 400 servers, their performance and dependencies, and estimate Azure cost', 'Azure Migrate', 'Azure Migrate discovery and assessment (with dependency analysis and business case).'],
  ['rationalize', 'Decide for each app whether to rehost, refactor, replace or retire', 'Plan', 'Digital estate rationalisation is part of Plan.'],
])
const migrateHow = ch('migrate-how', 'Migrate workloads, databases and files', 'Pick the strategy and the tool.', 'Requirement', 'Choice', {
  'Rehost (lift and shift) to VMs': 'Move as-is with Azure Migrate; fastest.',
  'Replatform to PaaS': 'Small changes to use managed services (App Service, SQL MI).',
  'Azure Database Migration Service (online)': 'Migrate databases with minimal downtime by syncing until cutover.',
  'Azure Data Box': 'Ship physical devices for offline transfer of large data.',
  'Azure Storage Mover / AzCopy': 'Copy files over the network to Azure Files or Blob.',
  'Azure File Sync': 'Keep a file server on-premises as a cache of Azure Files.',
}, [
  ['fast', 'Exit the datacenter in 3 months with no code changes', 'Rehost (lift and shift) to VMs', 'Rehosting is the fastest path.'],
  ['web', 'Move ASP.NET web apps to a managed platform with minimal code change', 'Replatform to PaaS', 'Replatforming to App Service reduces operations.'],
  ['db', 'Move a 2 TB production SQL Server with less than 15 minutes of downtime', 'Azure Database Migration Service (online)', 'Online migration keeps syncing until cutover.'],
  ['pb', 'Move 500 TB over a slow WAN link', 'Azure Data Box', 'Offline transfer avoids weeks of network copy.'],
  ['branch', 'Branch offices keep fast local file access while data lives in Azure', 'Azure File Sync', 'File Sync caches Azure file shares on local servers.'],
  ['nas', 'Copy 20 TB of file shares to Azure Files over a good network link, managed centrally', 'Azure Storage Mover / AzCopy', 'Storage Mover (or AzCopy) copies files online.'],
])
const netConnect = ch('net-connect', 'Connect to the internet and on-premises', 'Inbound, outbound and hybrid.', 'Requirement', 'Service', {
  'NAT gateway': 'Scalable outbound internet with static public IPs for a subnet.',
  'Azure Front Door': 'Global HTTP(S) entry with WAF and caching.',
  'Site-to-site VPN': 'Encrypted tunnel over the internet.',
  'ExpressRoute': 'Private connection through a provider.',
  'Azure Virtual WAN': 'Managed hub-and-spoke for many branches, VNets and users.',
  'ExpressRoute with VPN failover': 'Private primary path with an internet VPN backup.',
}, [
  ['snat', 'VMs without public IPs need outbound internet from fixed IPs that partners can allow-list', 'NAT gateway', 'NAT gateway gives predictable outbound IPs.'],
  ['private', 'Steady 5 Gbps to on-premises, predictable latency, not over the internet', 'ExpressRoute', 'ExpressRoute is a private, high-bandwidth link.'],
  ['backup', 'The private link must have a cheaper backup path if it fails', 'ExpressRoute with VPN failover', 'A site-to-site VPN can be the failover path for ExpressRoute.'],
  ['branches', 'Connect 60 branch offices and 30 VNets with automated any-to-any routing', 'Azure Virtual WAN', 'Virtual WAN manages hubs, branch VPNs and routing at scale.'],
  ['small', 'A small office needs secure connectivity to Azure quickly and cheaply', 'Site-to-site VPN', 'VPN uses the existing internet link.'],
])
const netDesign = ch('net-design', 'Optimise network performance and security', 'Faster paths and layered protection.', 'Requirement', 'Feature', {
  'Accelerated networking': 'SR-IOV bypasses the host for lower latency and jitter.',
  'Proximity placement group': 'Keeps VMs physically close for lowest latency between them.',
  'Azure Firewall Premium': 'Central firewall with TLS inspection and IDPS.',
  'Web Application Firewall': 'Protects web apps from OWASP attacks (on Front Door or Application Gateway).',
  'Azure DDoS Protection': 'Adaptive mitigation of volumetric attacks on public IPs.',
  'Private Link': 'Reach PaaS services over private IPs.',
}, [
  ['latency', 'Tightly coupled HPC VMs need the lowest possible latency between each other', 'Proximity placement group', 'PPGs place VMs in the same datacenter close together.'],
  ['jitter', 'Reduce CPU overhead and network jitter on VMs with heavy network traffic', 'Accelerated networking', 'Accelerated networking offloads packet processing to hardware.'],
  ['tls', 'Inspect encrypted outbound traffic for threats', 'Azure Firewall Premium', 'Premium adds TLS inspection and IDPS.'],
  ['sqli', 'Block SQL injection and cross-site scripting against a public website', 'Web Application Firewall', 'WAF managed rules cover OWASP threats.'],
  ['flood', 'Protect public endpoints from volumetric floods, with cost protection', 'Azure DDoS Protection', 'DDoS Network Protection mitigates attacks and includes cost protection.'],
])
const lbRoute = ch('lb-route', 'Load balancing and routing', 'Global or regional? HTTP(S) or any protocol?', 'Requirement', 'Service', {
  'Azure Load Balancer': 'Regional layer 4.',
  'Application Gateway': 'Regional layer 7 with WAF and path routing.',
  'Azure Front Door': 'Global layer 7 with WAF and caching.',
  'Traffic Manager': 'Global DNS-based routing for any protocol.',
}, [
  ['tcp', 'Balance a TCP game server across VMs in one region', 'Azure Load Balancer', 'Regional, non-HTTP: Load Balancer.'],
  ['path', 'Route /api and /images to different backends in one region with WAF', 'Application Gateway', 'Regional, HTTP with path routing: Application Gateway.'],
  ['global', 'Accelerate a global website with WAF, caching and instant failover between regions', 'Azure Front Door', 'Global HTTP(S): Front Door.'],
  ['dns', 'Fail over a non-HTTP service between two regions by DNS', 'Traffic Manager', 'Global, any protocol: Traffic Manager.'],
])

export const groups: ScenarioGroup[] = [
  g('az305-monitor-sim', [logRoute, monitorTool, workspace]),
  g('az305-authn-sim', [hybridAuth, idType]),
  g('az305-authz-sim', [azAuthz, onpremAuthz]),
  g('az305-secrets-sim', [secrets]),
  g('az305-governance-sim', [hierarchy, compliance, idGov]),
  g('az305-sql-sim', [sqlStore, sqlTier]),
  g('az305-sql-scale-sim', [sqlScale, sqlProtect]),
  g('az305-nosql-sim', [semi, unstruct]),
  g('az305-storage-design-sim', [balance, durable]),
  g('az305-data-int-sim', [integrate]),
  g('az305-bcdr-sim', [recovery]),
  g('az305-ha-sim', [ha, dataHa, slaCalc]),
  g('az305-compute-sim', [compute, vmChoice]),
  g('az305-serverless-sim', [serverless]),
  g('az305-messaging-sim', [messaging]),
  g('az305-app-config-sim', [apiCache, deploy]),
  g('az305-migrate-plan-sim', [migratePlan]),
  g('az305-migrate-sim', [migrateHow]),
  g('az305-net-connect-sim', [netConnect]),
  g('az305-net-design-sim', [netDesign, lbRoute]),
]
