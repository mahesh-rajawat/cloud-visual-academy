/**
 * AWS Certified Cloud Practitioner (CLF-C02) scenarios.
 * Accurate models: VPC reachability (IGW, route table, public IP, stateless NACL, stateful security group),
 * IAM policy evaluation (SCP boundary, explicit deny, explicit allow, implicit deny), shared responsibility by
 * service, and data-transfer charging rules. Prices are illustrative units, not AWS prices.
 */
import { chooser } from '../chooser'
import { allOk, bool, chain, num, opt, str, type ScenarioGroup, type Stage } from '../scenario'

// ------------------------------------------------------------------ VPC reachability
export interface VpcInput {
  igwAttached: boolean
  routeToIgw: boolean
  publicIp: boolean
  naclInboundAllowsPort: boolean
  naclOutboundAllowsEphemeral: boolean
  sgInboundAllowsPort: boolean
}

export function vpcReachable(v: VpcInput) {
  const steps: Array<[boolean, string]> = [
    [v.igwAttached, v.igwAttached ? 'An internet gateway is attached to the VPC.' : 'No internet gateway: the VPC has no path to the internet.'],
    [v.routeToIgw, v.routeToIgw ? 'Subnet route table has 0.0.0.0/0 → igw-…, so it is a public subnet.' : 'The subnet\'s route table has no 0.0.0.0/0 route to the IGW (private subnet).'],
    [v.publicIp, v.publicIp ? 'The instance has a public IPv4 or Elastic IP address.' : 'The instance has only a private IP; the internet cannot address it.'],
    [v.naclInboundAllowsPort && v.naclOutboundAllowsEphemeral, !v.naclInboundAllowsPort ? 'Network ACL inbound rules deny the port (NACLs are stateless, evaluated in rule-number order).' : !v.naclOutboundAllowsEphemeral ? 'Network ACL outbound rules block ephemeral ports 1024–65535, so responses are dropped (NACLs are stateless).' : 'Network ACL allows the request in and the response out.'],
    [v.sgInboundAllowsPort, v.sgInboundAllowsPort ? 'Security group allows the port; responses are allowed automatically (stateful).' : 'Security group has no inbound allow rule for the port (security groups have allow rules only; everything else is denied).'],
  ]
  return steps
}

// ------------------------------------------------------------------ IAM evaluation
export function iamDecision(p: { scpAllows: boolean; explicitDeny: boolean; identityAllow: boolean; resourceAllow: boolean; isRoot: boolean; inOrgMember: boolean }) {
  if (p.isRoot && !p.inOrgMember) return { allowed: true, reason: 'The root user of a standalone account has full access; protect it with MFA and do not use it for daily tasks.' }
  if (p.inOrgMember && !p.scpAllows) return { allowed: false, reason: 'A service control policy (SCP) does not allow the action: SCPs set the maximum permissions for member accounts (including their root user).' }
  if (p.explicitDeny) return { allowed: false, reason: 'An explicit Deny in an applicable policy always wins.' }
  if (p.identityAllow || p.resourceAllow) return { allowed: true, reason: `Allowed by ${p.identityAllow ? 'an identity-based policy' : 'a resource-based policy'}.` }
  return { allowed: false, reason: 'No policy allows the action: implicit deny (the default).' }
}

// ------------------------------------------------------------------ shared responsibility by service
export type AwsService = 'Amazon EC2' | 'Amazon RDS' | 'AWS Lambda' | 'Amazon S3'
export type AwsTask = 'Physical security of data centers' | 'Patching the guest operating system' | 'Patching the database engine' | 'Configuring security groups / network access' | 'Encrypting and classifying customer data' | 'Managing IAM users and permissions' | 'Securing the hypervisor and host infrastructure' | 'Application code security'

export function awsOwner(service: AwsService, task: AwsTask): 'AWS' | 'Customer' {
  if (task === 'Physical security of data centers' || task === 'Securing the hypervisor and host infrastructure') return 'AWS'
  if (task === 'Encrypting and classifying customer data' || task === 'Managing IAM users and permissions' || task === 'Application code security') return 'Customer'
  if (task === 'Patching the guest operating system') return service === 'Amazon EC2' ? 'Customer' : 'AWS'
  if (task === 'Patching the database engine') return service === 'Amazon RDS' ? 'AWS' : service === 'Amazon EC2' ? 'Customer' : 'AWS'
  // Network access configuration (security groups, VPC settings, function URLs) is the customer's.
  return 'Customer'
}

// ------------------------------------------------------------------ data transfer
export type TransferPath = 'Internet → AWS (inbound)' | 'AWS → Internet (outbound)' | 'Between Regions' | 'Between AZs in the same Region' | 'Same AZ using private IPs'
export function transferCharged(p: TransferPath): { charged: boolean; note: string } {
  switch (p) {
    case 'Internet → AWS (inbound)': return { charged: false, note: 'Data transfer in from the internet is generally free.' }
    case 'AWS → Internet (outbound)': return { charged: true, note: 'Data transfer out to the internet is charged per GB (with a monthly free allowance).' }
    case 'Between Regions': return { charged: true, note: 'Inter-Region transfer is charged.' }
    case 'Between AZs in the same Region': return { charged: true, note: 'Cross-AZ transfer within a Region is charged (in each direction).' }
    default: return { charged: false, note: 'Traffic within the same AZ over private IPs is free.' }
  }
}

// ------------------------------------------------------------------ purchasing options (illustrative)
export function purchaseCost(option: 'On-Demand' | 'Savings Plan / Reserved (1 yr)' | 'Spot', hours: number, interruptible: boolean) {
  const rate = option === 'On-Demand' ? 1 : option === 'Spot' ? 0.3 : 0.6
  const committed = option.startsWith('Savings') ? 730 : hours // commitments are paid whether used or not
  return { cost: Math.round(committed * rate), risk: option === 'Spot' && !interruptible ? 'Spot instances can be interrupted with a 2-minute warning.' : '' }
}

// ================================================================== groups
const conceptsGroup: ScenarioGroup = {
  id: 'aws-concepts-sim',
  fidelity: 'simplified-illustration',
  fidelityNote: 'Well-Architected pillars, CAF perspectives and migration strategies follow AWS documentation. Cost figures are illustrative units.',
  scenarios: [
    chooser({
      id: 'aws-pillar', title: 'Well-Architected pillars', description: 'Match each design concern to a Well-Architected pillar.', requirementLabel: 'Concern', answerLabel: 'Pillar',
      answers: ['Operational excellence', 'Security', 'Reliability', 'Performance efficiency', 'Cost optimization', 'Sustainability'],
      answerNotes: { 'Operational excellence': 'Run and monitor systems, improve processes (IaC, small reversible changes).', Security: 'Protect data, systems and assets (identity, traceability, encryption).', Reliability: 'Recover from failure and meet demand (multi-AZ, automatic recovery).', 'Performance efficiency': 'Use resources efficiently as demand and technology change.', 'Cost optimization': 'Avoid unnecessary cost (right-size, pay for what you use).', Sustainability: 'Minimise environmental impact (maximise utilisation, managed services).' },
      cases: [
        { value: 'multiaz', label: 'Automatically recover from an AZ failure', answer: 'Reliability', why: 'Reliability covers failure recovery and availability.' },
        { value: 'iac', label: 'Make small, reversible changes with infrastructure as code', answer: 'Operational excellence', why: 'Operations as code and frequent small changes.' },
        { value: 'rightsize', label: 'Right-size instances and stop idle resources', answer: 'Cost optimization', why: 'Pay only for what you need.' },
        { value: 'serverless', label: 'Pick serverless or the latest instance generation to meet demand efficiently', answer: 'Performance efficiency', why: 'Choosing the right resource types and sizes.' },
        { value: 'least', label: 'Grant least privilege and enable traceability', answer: 'Security', why: 'Identity foundation and traceability.' },
        { value: 'util', label: 'Maximise utilisation to reduce energy use', answer: 'Sustainability', why: 'Reduce the environmental footprint.' },
      ],
    }),
    chooser({
      id: 'aws-migration', title: 'Migration strategies', description: 'Pick a migration strategy (the 7 Rs) for each application.', requirementLabel: 'Application', answerLabel: 'Strategy',
      answers: ['Rehost (lift and shift)', 'Replatform (lift, tinker and shift)', 'Refactor / re-architect', 'Repurchase (move to SaaS)', 'Retire', 'Retain', 'Relocate'],
      answerNotes: { 'Rehost (lift and shift)': 'Move as-is to EC2 (for example with AWS Application Migration Service).', 'Replatform (lift, tinker and shift)': 'Small optimisations, such as moving a database to Amazon RDS.', 'Refactor / re-architect': 'Re-design for cloud-native features (serverless, microservices).', 'Repurchase (move to SaaS)': 'Replace with a SaaS product.', Retire: 'Switch off apps no longer needed.', Retain: 'Keep on-premises for now.', Relocate: 'Move infrastructure without changes, for example VMware Cloud on AWS.' },
      cases: [
        { value: 'quick', label: 'Move 200 VMs quickly before a datacenter lease ends', answer: 'Rehost (lift and shift)', why: 'Fastest path with minimal changes.' },
        { value: 'rds', label: 'Keep the app, but move its self-managed database to Amazon RDS', answer: 'Replatform (lift, tinker and shift)', why: 'A targeted optimisation without re-architecting.' },
        { value: 'crm', label: 'Replace an in-house CRM with a SaaS CRM', answer: 'Repurchase (move to SaaS)', why: 'Buy rather than migrate.' },
        { value: 'unused', label: 'An app nobody has used for a year', answer: 'Retire', why: 'Do not migrate what you do not need.' },
        { value: 'scale', label: 'Rebuild a monolith as event-driven serverless services to scale', answer: 'Refactor / re-architect', why: 'Cloud-native redesign.' },
        { value: 'compliance', label: 'A system that must stay on-premises for two more years', answer: 'Retain', why: 'Revisit later.' },
      ],
    }),
    chooser({
      id: 'aws-caf', title: 'Cloud Adoption Framework', description: 'Match each activity to an AWS CAF perspective.', requirementLabel: 'Activity', answerLabel: 'Perspective',
      answers: ['Business', 'People', 'Governance', 'Platform', 'Security', 'Operations'],
      answerNotes: { Business: 'Cloud investments accelerate business outcomes.', People: 'Culture, skills, organisational change.', Governance: 'Benefits realisation, risk, financial management (FinOps).', Platform: 'Enterprise-grade, scalable cloud platform and architecture.', Security: 'Confidentiality, integrity and availability of data and workloads.', Operations: 'Cloud services delivered at agreed service levels.' },
      cases: [
        { value: 'train', label: 'Run training to upskill staff for cloud roles', answer: 'People', why: 'Workforce transformation.' },
        { value: 'finops', label: 'Track cloud spend and manage portfolio risk', answer: 'Governance', why: 'Financial and risk management.' },
        { value: 'arch', label: 'Design the landing zone and CI/CD for workloads', answer: 'Platform', why: 'Platform engineering and architecture.' },
        { value: 'ops', label: 'Define incident management and observability', answer: 'Operations', why: 'Operating services reliably.' },
        { value: 'iam', label: 'Establish identity, detection and data protection controls', answer: 'Security', why: 'Security capabilities.' },
        { value: 'strategy', label: 'Align cloud investment with revenue growth goals', answer: 'Business', why: 'Business outcomes.' },
      ],
    }),
    {
      id: 'aws-economics',
      title: 'Cloud economics',
      description: 'Compare an on-premises estate (fixed costs) with AWS (variable costs), including rightsizing and licensing (illustrative units).',
      stages: [{ id: 'onprem', label: 'On-premises TCO', kind: 'compute' }, { id: 'aws', label: 'AWS variable cost', kind: 'globe' }, { id: 'right', label: 'Rightsizing', kind: 'service' }, { id: 'lic', label: 'Licensing', kind: 'security' }],
      controls: [
        { type: 'number', key: 'servers', label: 'Servers needed at peak', min: 1, max: 500 },
        { type: 'number', key: 'avgUtil', label: 'Average utilisation (%)', min: 1, max: 100 },
        { type: 'checkbox', key: 'rightsize', label: 'Rightsize instances to measured utilisation' },
        { type: 'checkbox', key: 'automate', label: 'Automate start/stop of non-production' },
        { type: 'select', key: 'license', label: 'Licensing', options: opt('License included', 'Bring your own license (BYOL)') },
      ],
      initial: { servers: 100, avgUtil: 25, rightsize: false, automate: false, license: 'License included' },
      presets: [{ label: 'Rightsize and automate', values: { rightsize: true, automate: true } }],
      evaluate: (s) => {
        const servers = num(s, 'servers')
        const onprem = servers * 12 * 1.6 // hardware + power + space + staff, per server per month
        let awsCost = servers * 12 * 1.0
        if (bool(s, 'rightsize')) awsCost *= Math.max(0.3, num(s, 'avgUtil') / 70)
        if (bool(s, 'automate')) awsCost *= 0.8
        if (str(s, 'license').startsWith('Bring')) awsCost *= 0.85
        const stages = chain([{ id: 'onprem', label: 'On-premises TCO', kind: 'compute' }, { id: 'aws', label: 'AWS variable cost', kind: 'globe' }, { id: 'right', label: 'Rightsizing', kind: 'service' }, { id: 'lic', label: 'Licensing', kind: 'security' }], [
          [true, `Fixed costs: hardware bought for peak, data center space, power and cooling, staff. ≈ ${Math.round(onprem)} units/year regardless of use.`],
          [true, 'Variable costs: pay per use; AWS economies of scale lower unit prices; no upfront investment.'],
          [true, bool(s, 'rightsize') ? `Rightsized to match ${num(s, 'avgUtil')}% average utilisation.` : 'Not rightsized: paying for capacity that sits idle.'],
          [true, str(s, 'license').startsWith('Bring') ? 'BYOL: reuse existing licences (may need Dedicated Hosts for some licence terms).' : 'License-included: licence cost is in the hourly price.'],
        ])
        return { stages, outcome: { ok: true, title: `AWS ≈ ${Math.round(awsCost)} vs on-premises ≈ ${Math.round(onprem)} units/year`, detail: 'Variable cost plus rightsizing and automation turns idle fixed capacity into savings.' }, checks: ['aws-economics', ...(bool(s, 'rightsize') ? ['aws-rightsized'] : [])], metrics: [{ label: 'Savings', value: `${Math.round((1 - awsCost / onprem) * 100)}%` }] }
      },
    },
  ],
}

const iamStages: Stage[] = [
  { id: 'principal', label: 'Principal', kind: 'identity' },
  { id: 'scp', label: 'Organizations SCP', kind: 'security' },
  { id: 'deny', label: 'Explicit deny?', kind: 'security' },
  { id: 'allow', label: 'Explicit allow?', kind: 'security' },
  { id: 'res', label: 'AWS resource', kind: 'storage' },
]

const securityGroup: ScenarioGroup = {
  id: 'aws-security-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'IAM evaluation order (SCP boundary, explicit deny, allow, implicit deny) and shared responsibility by service follow AWS documentation. Permissions boundaries, session policies and conditions are not modelled.',
  scenarios: [
    {
      id: 'aws-shared',
      title: 'Shared responsibility by service',
      description: 'Choose a service and a task, then decide who is responsible.',
      stages: [{ id: 'svc', label: 'Service', kind: 'service' }, { id: 'task', label: 'Task', kind: 'storage' }, { id: 'who', label: 'Responsible party', kind: 'user' }],
      controls: [
        { type: 'select', key: 'service', label: 'Service', options: opt('Amazon EC2', 'Amazon RDS', 'AWS Lambda', 'Amazon S3') },
        { type: 'select', key: 'task', label: 'Task', options: opt('Physical security of data centers', 'Patching the guest operating system', 'Patching the database engine', 'Configuring security groups / network access', 'Encrypting and classifying customer data', 'Managing IAM users and permissions', 'Securing the hypervisor and host infrastructure', 'Application code security') },
        { type: 'select', key: 'answer', label: 'Your answer', options: opt('AWS', 'Customer') },
      ],
      initial: { service: 'Amazon RDS', task: 'Patching the database engine', answer: 'Customer' },
      presets: [{ label: 'EC2 guest OS patching', values: { service: 'Amazon EC2', task: 'Patching the guest operating system', answer: 'AWS' } }],
      evaluate: (s) => {
        const owner = awsOwner(str(s, 'service') as AwsService, str(s, 'task') as AwsTask)
        const ok = owner === str(s, 'answer')
        const stages = chain([{ id: 'svc', label: 'Service', kind: 'service' }, { id: 'task', label: 'Task', kind: 'storage' }, { id: 'who', label: 'Responsible party', kind: 'user' }], [
          [true, str(s, 'service')], [true, str(s, 'task')],
          [ok, `${owner} is responsible. AWS: security OF the cloud; customer: security IN the cloud. ${str(s, 'service') === 'Amazon EC2' ? 'EC2 is IaaS: the customer manages the guest OS and above.' : str(s, 'service') === 'Amazon RDS' ? 'RDS is managed: AWS patches the OS and DB engine; the customer manages data, users and access.' : str(s, 'service') === 'AWS Lambda' ? 'Lambda: AWS manages the runtime and OS; the customer owns code, permissions and data.' : 'S3: AWS runs the service; the customer controls bucket policies, encryption choices and data.'}`],
        ])
        return { stages, outcome: { ok, title: ok ? 'CORRECT' : 'NOT QUITE', detail: stages[2]!.detail }, checks: [ok ? 'aws-shared-correct' : 'aws-shared-wrong'] }
      },
    },
    {
      id: 'aws-iam',
      title: 'IAM policy evaluation',
      description: 'Follow how AWS decides whether a request is allowed.',
      stages: iamStages,
      controls: [
        { type: 'select', key: 'principal', label: 'Principal', options: opt('IAM user in a group', 'IAM role (assumed)', 'Root user') },
        { type: 'checkbox', key: 'member', label: 'Account is a member of AWS Organizations' },
        { type: 'checkbox', key: 'scpAllows', label: 'SCP allows the action' },
        { type: 'checkbox', key: 'explicitDeny', label: 'Some policy explicitly denies the action' },
        { type: 'checkbox', key: 'identityAllow', label: 'Identity-based policy allows it (for example a managed policy on the group)' },
        { type: 'checkbox', key: 'resourceAllow', label: 'Resource-based policy allows it (for example an S3 bucket policy)' },
        { type: 'checkbox', key: 'mfa', label: 'MFA enabled on the principal' },
      ],
      initial: { principal: 'IAM user in a group', member: true, scpAllows: true, explicitDeny: false, identityAllow: false, resourceAllow: false, mfa: true },
      presets: [{ label: 'Allowed by group policy', values: { identityAllow: true } }, { label: 'Explicit deny overrides allow', values: { identityAllow: true, explicitDeny: true } }, { label: 'SCP blocks even root', values: { principal: 'Root user', scpAllows: false, identityAllow: true } }],
      evaluate: (s) => {
        const root = str(s, 'principal') === 'Root user'
        const d = iamDecision({ scpAllows: bool(s, 'scpAllows'), explicitDeny: bool(s, 'explicitDeny'), identityAllow: bool(s, 'identityAllow'), resourceAllow: bool(s, 'resourceAllow'), isRoot: root, inOrgMember: bool(s, 'member') })
        const scpOk = !bool(s, 'member') || bool(s, 'scpAllows')
        const rootStandalone = root && !bool(s, 'member')
        const stages = chain(iamStages, [
          [true, `${str(s, 'principal')}${bool(s, 'mfa') ? ' with MFA' : ' without MFA (enable MFA, especially for root)'}.`],
          [scpOk, !bool(s, 'member') ? 'Standalone account: no SCPs.' : scpOk ? 'SCP permits the action (SCPs only limit; they never grant).' : 'SCP does not permit it: denied for everyone in the account, including root.'],
          [rootStandalone || !bool(s, 'explicitDeny'), bool(s, 'explicitDeny') && !rootStandalone ? 'Explicit Deny found: denied.' : 'No explicit deny.'],
          [rootStandalone || bool(s, 'identityAllow') || bool(s, 'resourceAllow'), rootStandalone ? 'Root has unrestricted access in a standalone account.' : bool(s, 'identityAllow') || bool(s, 'resourceAllow') ? d.reason : 'No allow: implicit deny.'],
          [true, 'Request authorised.'],
        ])
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'ALLOWED' : 'DENIED', detail: d.reason }, checks: [ok ? 'aws-iam-allowed' : 'aws-iam-denied'] }
      },
    },
    chooser({
      id: 'aws-sec-service', title: 'Security services', description: 'Pick the AWS security or compliance service for each need.', requirementLabel: 'Need', answerLabel: 'Service',
      answers: ['Amazon GuardDuty', 'Amazon Inspector', 'AWS Security Hub', 'AWS Shield', 'AWS WAF', 'AWS Firewall Manager', 'Amazon Macie', 'Amazon Detective', 'AWS Artifact', 'AWS CloudTrail', 'AWS Config', 'AWS KMS', 'AWS Secrets Manager'],
      answerNotes: { 'Amazon GuardDuty': 'Threat detection from logs (CloudTrail, VPC Flow Logs, DNS).', 'Amazon Inspector': 'Automated vulnerability scanning of EC2, container images and Lambda.', 'AWS Security Hub': 'Aggregates security findings and checks against standards.', 'AWS Shield': 'DDoS protection (Standard free, Advanced paid).', 'AWS WAF': 'Web application firewall for HTTP(S) rules (SQL injection, XSS).', 'AWS Firewall Manager': 'Central management of WAF, Shield Advanced, security groups and Network Firewall across accounts.', 'Amazon Macie': 'Discovers and protects sensitive data in S3.', 'Amazon Detective': 'Investigates root cause of security findings.', 'AWS Artifact': 'On-demand access to AWS compliance reports and agreements.', 'AWS CloudTrail': 'Records API calls (who did what, when).', 'AWS Config': 'Records resource configuration and evaluates compliance rules.', 'AWS KMS': 'Creates and manages encryption keys.', 'AWS Secrets Manager': 'Stores and rotates secrets such as database passwords.' },
      cases: [
        { value: 'threat', label: 'Detect crypto-mining activity and compromised credentials from logs', answer: 'Amazon GuardDuty', why: 'Intelligent threat detection.' },
        { value: 'vuln', label: 'Scan EC2 instances and container images for CVEs', answer: 'Amazon Inspector', why: 'Vulnerability management.' },
        { value: 'soc', label: 'Download a SOC 2 report for an auditor', answer: 'AWS Artifact', why: 'Compliance reports portal.' },
        { value: 'ddos', label: 'Protect against large DDoS attacks with a response team', answer: 'AWS Shield', why: 'Shield Advanced adds DDoS response support.' },
        { value: 'sqli', label: 'Block SQL injection requests to a web app', answer: 'AWS WAF', why: 'Layer 7 rules.' },
        { value: 'pii', label: 'Find credit card numbers stored in S3 buckets', answer: 'Amazon Macie', why: 'Sensitive data discovery in S3.' },
        { value: 'who', label: 'Find out who deleted an EC2 instance yesterday', answer: 'AWS CloudTrail', why: 'API activity history.' },
        { value: 'drift', label: 'Track configuration changes and flag non-compliant resources', answer: 'AWS Config', why: 'Configuration history and rules.' },
        { value: 'rotate', label: 'Rotate a database password automatically', answer: 'AWS Secrets Manager', why: 'Secret storage with rotation.' },
        { value: 'central', label: 'One dashboard of findings from GuardDuty, Inspector and Macie', answer: 'AWS Security Hub', why: 'Aggregated findings and posture checks.' },
      ],
    }),
    chooser({
      id: 'aws-root', title: 'Root user tasks', description: 'Decide whether a task requires the root user or can be done by an IAM identity.', requirementLabel: 'Task', answerLabel: 'Who', answers: ['Root user only', 'IAM user or role with permissions'],
      answerNotes: { 'Root user only': 'Sign in with the account email and password (protected by MFA).', 'IAM user or role with permissions': 'Delegate with least-privilege IAM policies.' },
      cases: [
        { value: 'close', label: 'Close the AWS account', answer: 'Root user only', why: 'Closing an account is a root-only task.' },
        { value: 'email', label: 'Change the account\'s root email address or account name', answer: 'Root user only', why: 'Account settings are root-only.' },
        { value: 'ec2', label: 'Launch EC2 instances', answer: 'IAM user or role with permissions', why: 'Day-to-day work should never use root.' },
        { value: 'mfadelete', label: 'Enable MFA delete on an S3 bucket', answer: 'Root user only', why: 'MFA delete is configured by the root user.' },
        { value: 'billing', label: 'View costs in Cost Explorer (after IAM access to billing is activated)', answer: 'IAM user or role with permissions', why: 'Billing access can be delegated.' },
        { value: 'restore', label: 'Restore permissions after the only IAM administrator locked themselves out', answer: 'Root user only', why: 'Root can restore IAM permissions.' },
      ],
    }),
  ],
}

const vpcStages: Stage[] = [
  { id: 'igw', label: 'Internet gateway', kind: 'globe' },
  { id: 'rt', label: 'Route table', kind: 'network' },
  { id: 'ip', label: 'Public IP', kind: 'network' },
  { id: 'nacl', label: 'Network ACL (stateless)', kind: 'security' },
  { id: 'sg', label: 'Security group (stateful)', kind: 'security' },
]

const techGroup: ScenarioGroup = {
  id: 'aws-tech-sim',
  fidelity: 'accurate-model',
  fidelityNote: 'VPC reachability logic, AZ/Region failure scopes and service use cases follow AWS documentation. Storage cost curves are illustrative.',
  scenarios: [
    {
      id: 'aws-vpc',
      title: 'VPC: reach a web server',
      description: 'A client on the internet requests HTTPS (443) from an EC2 instance. Configure the VPC so it works.',
      stages: vpcStages,
      controls: [
        { type: 'checkbox', key: 'igwAttached', label: 'Internet gateway attached to the VPC' },
        { type: 'checkbox', key: 'routeToIgw', label: 'Subnet route table: 0.0.0.0/0 → internet gateway' },
        { type: 'checkbox', key: 'publicIp', label: 'Instance has a public IP / Elastic IP' },
        { type: 'checkbox', key: 'naclIn', label: 'NACL inbound allows TCP 443' },
        { type: 'checkbox', key: 'naclOut', label: 'NACL outbound allows ephemeral ports 1024–65535' },
        { type: 'checkbox', key: 'sgIn', label: 'Security group inbound allows TCP 443 from 0.0.0.0/0' },
      ],
      initial: { igwAttached: true, routeToIgw: false, publicIp: true, naclIn: true, naclOut: true, sgIn: true },
      presets: [{ label: 'Custom NACL without ephemeral ports', values: { routeToIgw: true, naclOut: false } }, { label: 'Security group missing 443', values: { routeToIgw: true, sgIn: false } }],
      evaluate: (s) => {
        const steps = vpcReachable({ igwAttached: bool(s, 'igwAttached'), routeToIgw: bool(s, 'routeToIgw'), publicIp: bool(s, 'publicIp'), naclInboundAllowsPort: bool(s, 'naclIn'), naclOutboundAllowsEphemeral: bool(s, 'naclOut'), sgInboundAllowsPort: bool(s, 'sgIn') })
        const stages = chain(vpcStages, steps)
        const ok = allOk(stages)
        return { stages, outcome: { ok, title: ok ? 'REACHABLE' : 'NOT REACHABLE', detail: ok ? 'Request and response both pass.' : stages.find((x) => x.ok === false)!.detail }, checks: [ok ? 'aws-vpc-ok' : 'aws-vpc-blocked'] }
      },
    },
    {
      id: 'aws-ha',
      title: 'AZs, Regions and edge locations',
      description: 'Deploy an app and inject failures; add CloudFront edge locations for latency.',
      stages: [{ id: 'deploy', label: 'Deployment', kind: 'compute' }, { id: 'fail', label: 'Failure', kind: 'security' }, { id: 'up', label: 'Available?', kind: 'globe' }, { id: 'edge', label: 'Edge locations', kind: 'network' }],
      controls: [
        { type: 'select', key: 'deploy', label: 'Deployment', options: opt('One AZ', 'Multiple AZs behind a load balancer', 'Multiple Regions') },
        { type: 'select', key: 'fail', label: 'Failure', options: opt('Single instance', 'Entire Availability Zone', 'Entire Region') },
        { type: 'checkbox', key: 'cdn', label: 'Serve static content through Amazon CloudFront' },
      ],
      initial: { deploy: 'Multiple AZs behind a load balancer', fail: 'Entire Availability Zone', cdn: true },
      presets: [{ label: 'Region outage', values: { fail: 'Entire Region' } }, { label: 'Single AZ', values: { deploy: 'One AZ' } }],
      evaluate: (s) => {
        const d = str(s, 'deploy'); const f = str(s, 'fail')
        const up = f === 'Single instance' ? true : f === 'Entire Availability Zone' ? d !== 'One AZ' : d === 'Multiple Regions'
        const stages = chain([{ id: 'deploy', label: 'Deployment', kind: 'compute' }, { id: 'fail', label: 'Failure', kind: 'security' }, { id: 'up', label: 'Available?', kind: 'globe' }, { id: 'edge', label: 'Edge locations', kind: 'network' }], [
          [true, d], [true, f],
          [up, up ? (f === 'Entire Region' ? 'The other Region serves users (disaster recovery, business continuity).' : f === 'Entire Availability Zone' ? 'AZs are isolated (separate power, networking, connectivity); the load balancer and Auto Scaling use the remaining AZs.' : 'Auto Scaling replaces the failed instance.') : f === 'Entire Region' ? 'All AZs are in the failed Region.' : 'Everything was in one AZ: a single point of failure.'],
          [true, bool(s, 'cdn') ? 'CloudFront caches content at edge locations close to users (lower latency, offloads origin).' : 'No CDN: every user request goes to the Region.'],
        ])
        return { stages, outcome: { ok: allOk(stages), title: allOk(stages) ? 'AVAILABLE' : 'OUTAGE', detail: stages[2]!.detail }, checks: [allOk(stages) ? 'aws-ha-ok' : 'aws-ha-outage'] }
      },
    },
    chooser({
      id: 'aws-compute', title: 'Compute choice', description: 'Pick the compute service or instance type.', requirementLabel: 'Requirement', answerLabel: 'Choice',
      answers: ['EC2 compute optimized (C family)', 'EC2 memory optimized (R/X family)', 'EC2 storage optimized (I/D family)', 'EC2 general purpose (M/T family)', 'Amazon ECS', 'Amazon EKS', 'AWS Fargate', 'AWS Lambda', 'AWS Batch', 'Amazon Lightsail', 'AWS Elastic Beanstalk', 'AWS Outposts'],
      answerNotes: { 'EC2 compute optimized (C family)': 'High CPU: batch processing, gaming, HPC.', 'EC2 memory optimized (R/X family)': 'Large in-memory datasets.', 'EC2 storage optimized (I/D family)': 'High sequential I/O on local storage (data warehouses, NoSQL).', 'EC2 general purpose (M/T family)': 'Balanced web servers and code repositories.', 'Amazon ECS': 'AWS-native container orchestration.', 'Amazon EKS': 'Managed Kubernetes.', 'AWS Fargate': 'Serverless compute for ECS/EKS containers.', 'AWS Lambda': 'Run code on events, pay per request and duration.', 'AWS Batch': 'Managed batch job scheduling.', 'Amazon Lightsail': 'Simple VPS bundles with predictable pricing.', 'AWS Elastic Beanstalk': 'Deploy web apps; AWS provisions EC2, load balancing and scaling.', 'AWS Outposts': 'AWS infrastructure in your data center.' },
      cases: [
        { value: 'hpc', label: 'Scientific modelling that is CPU-bound', answer: 'EC2 compute optimized (C family)', why: 'High-performance processors.' },
        { value: 'k8s', label: 'Run existing Kubernetes manifests on AWS', answer: 'Amazon EKS', why: 'Managed Kubernetes control plane.' },
        { value: 'noservers', label: 'Run containers without managing EC2 instances', answer: 'AWS Fargate', why: 'Serverless containers.' },
        { value: 'event', label: 'Resize images when uploaded to S3', answer: 'AWS Lambda', why: 'Event-driven serverless.' },
        { value: 'memdb', label: 'In-memory database needing lots of RAM', answer: 'EC2 memory optimized (R/X family)', why: 'Memory-heavy workloads.' },
        { value: 'simple', label: 'A blogger wants a simple server with a fixed monthly price', answer: 'Amazon Lightsail', why: 'Bundled, predictable pricing.' },
        { value: 'local', label: 'Low-latency AWS services must run inside the company data center', answer: 'AWS Outposts', why: 'AWS infrastructure on premises.' },
      ],
    }),
    chooser({
      id: 'aws-db', title: 'Database choice', description: 'Pick a database or migration service.', requirementLabel: 'Requirement', answerLabel: 'Service',
      answers: ['Amazon RDS', 'Amazon Aurora', 'Amazon DynamoDB', 'Amazon ElastiCache', 'Amazon Neptune', 'Amazon DocumentDB', 'Database on EC2', 'AWS DMS', 'AWS SCT'],
      answerNotes: { 'Amazon RDS': 'Managed relational databases (MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, Db2).', 'Amazon Aurora': 'AWS-built MySQL/PostgreSQL-compatible relational database with high performance and availability.', 'Amazon DynamoDB': 'Serverless NoSQL key-value/document database, single-digit millisecond latency.', 'Amazon ElastiCache': 'In-memory caching (Redis OSS / Valkey / Memcached).', 'Amazon Neptune': 'Graph database.', 'Amazon DocumentDB': 'MongoDB-compatible document database.', 'Database on EC2': 'Full control of the OS and DB software (you manage everything).', 'AWS DMS': 'Migrate and replicate databases with minimal downtime.', 'AWS SCT': 'Convert schemas between database engines.' },
      cases: [
        { value: 'osaccess', label: 'Need OS-level access to install a custom database plugin', answer: 'Database on EC2', why: 'Managed databases do not give OS access.' },
        { value: 'managed', label: 'Managed PostgreSQL with automated backups and patching', answer: 'Amazon RDS', why: 'Managed relational database.' },
        { value: 'kv', label: 'Serverless key-value store for millions of requests per second', answer: 'Amazon DynamoDB', why: 'NoSQL with automatic scaling.' },
        { value: 'cache', label: 'Reduce database load by caching session data in memory', answer: 'Amazon ElastiCache', why: 'In-memory cache.' },
        { value: 'graph', label: 'Social network friend-of-friend queries', answer: 'Amazon Neptune', why: 'Graph database.' },
        { value: 'migrate', label: 'Migrate Oracle to Aurora PostgreSQL with minimal downtime', answer: 'AWS DMS', why: 'Ongoing replication during migration (SCT converts the schema).' },
        { value: 'schema', label: 'Convert an Oracle schema and stored procedures to PostgreSQL', answer: 'AWS SCT', why: 'Schema conversion.' },
      ],
    }),
    chooser({
      id: 'aws-net', title: 'Network service choice', description: 'Pick a network or connectivity service.', requirementLabel: 'Requirement', answerLabel: 'Service',
      answers: ['Amazon VPC', 'Amazon Route 53', 'Amazon CloudFront', 'AWS Direct Connect', 'AWS Site-to-Site VPN', 'AWS Client VPN', 'AWS Transit Gateway', 'AWS Global Accelerator', 'AWS PrivateLink', 'Amazon API Gateway'],
      answerNotes: { 'Amazon VPC': 'Isolated virtual network with subnets, route tables and gateways.', 'Amazon Route 53': 'DNS, domain registration, health checks and routing policies.', 'Amazon CloudFront': 'CDN using edge locations.', 'AWS Direct Connect': 'Dedicated private connection from on-premises.', 'AWS Site-to-Site VPN': 'Encrypted IPsec tunnels over the internet between a network and a VPC.', 'AWS Client VPN': 'Managed remote-access VPN for users.', 'AWS Transit Gateway': 'Hub connecting many VPCs and on-premises networks.', 'AWS Global Accelerator': 'Static anycast IPs routing over the AWS global network.', 'AWS PrivateLink': 'Private access to services without traversing the internet.', 'Amazon API Gateway': 'Create and manage APIs.' },
      cases: [
        { value: 'dns', label: 'Route users to the healthiest Region with DNS failover', answer: 'Amazon Route 53', why: 'Health checks and routing policies.' },
        { value: 'dedicated', label: 'Consistent, private, high-bandwidth link from a data center', answer: 'AWS Direct Connect', why: 'Does not use the public internet.' },
        { value: 'quickvpn', label: 'Connect a branch office to a VPC this week over the internet, encrypted', answer: 'AWS Site-to-Site VPN', why: 'Fast to set up.' },
        { value: 'hub', label: 'Connect 50 VPCs and on-premises through one hub', answer: 'AWS Transit Gateway', why: 'Hub-and-spoke routing.' },
        { value: 'cache', label: 'Deliver videos with low latency worldwide', answer: 'Amazon CloudFront', why: 'Edge caching.' },
        { value: 'remote', label: 'Employees connect from laptops at home', answer: 'AWS Client VPN', why: 'Remote access VPN.' },
      ],
    }),
    chooser({
      id: 'aws-storage', title: 'Storage choice', description: 'Pick a storage service, S3 storage class or feature.', requirementLabel: 'Requirement', answerLabel: 'Choice',
      answers: ['S3 Standard', 'S3 Intelligent-Tiering', 'S3 Standard-IA', 'S3 One Zone-IA', 'S3 Glacier Instant Retrieval', 'S3 Glacier Flexible Retrieval', 'S3 Glacier Deep Archive', 'Amazon EBS', 'Instance store', 'Amazon EFS', 'Amazon FSx', 'AWS Storage Gateway', 'AWS Backup', 'S3 Lifecycle policy'],
      answerNotes: { 'S3 Standard': 'Frequently accessed objects, multi-AZ.', 'S3 Intelligent-Tiering': 'Unknown or changing access patterns; moves objects automatically.', 'S3 Standard-IA': 'Infrequent access, millisecond retrieval, multi-AZ.', 'S3 One Zone-IA': 'Infrequent, re-creatable data in one AZ.', 'S3 Glacier Instant Retrieval': 'Archive with millisecond access (quarterly reads).', 'S3 Glacier Flexible Retrieval': 'Archive retrieved in minutes to hours.', 'S3 Glacier Deep Archive': 'Lowest cost, retrieval within hours (up to 12 h standard).', 'Amazon EBS': 'Persistent block storage for EC2 in one AZ.', 'Instance store': 'Temporary block storage physically attached to the host; lost on stop/terminate.', 'Amazon EFS': 'Managed elastic NFS file system for Linux, multi-AZ.', 'Amazon FSx': 'Managed file systems: Windows File Server, Lustre, NetApp ONTAP, OpenZFS.', 'AWS Storage Gateway': 'Hybrid storage with local caching of cloud data.', 'AWS Backup': 'Centralised, policy-based backups across AWS services.', 'S3 Lifecycle policy': 'Rules to transition or expire objects over time.' },
      cases: [
        { value: 'unknown', label: 'Data lake with unpredictable access patterns', answer: 'S3 Intelligent-Tiering', why: 'Automatic tiering without retrieval fees for frequent/infrequent tiers.' },
        { value: 'deep', label: 'Keep 10 years of compliance archives at the lowest cost', answer: 'S3 Glacier Deep Archive', why: 'Cheapest storage class.' },
        { value: 'scratch', label: 'Temporary scratch space for a cache on EC2', answer: 'Instance store', why: 'Ephemeral, high performance.' },
        { value: 'shared', label: 'Many Linux instances share one file system', answer: 'Amazon EFS', why: 'Elastic NFS.' },
        { value: 'smb', label: 'Windows file shares with Active Directory integration', answer: 'Amazon FSx', why: 'FSx for Windows File Server.' },
        { value: 'hybrid', label: 'On-premises apps use cloud storage with a local cache', answer: 'AWS Storage Gateway', why: 'Cached hybrid storage.' },
        { value: 'policy', label: 'Move logs to Glacier after 90 days and delete after 1 year', answer: 'S3 Lifecycle policy', why: 'Automated transitions and expiration.' },
        { value: 'central', label: 'One backup policy for EBS, RDS, DynamoDB and EFS', answer: 'AWS Backup', why: 'Central backup management.' },
        { value: 'boot', label: 'Persistent boot volume for an EC2 instance', answer: 'Amazon EBS', why: 'Durable block storage.' },
      ],
    }),
    chooser({
      id: 'aws-ai', title: 'AI/ML and analytics choice', description: 'Pick the AI/ML or analytics service.', requirementLabel: 'Task', answerLabel: 'Service',
      answers: ['Amazon SageMaker AI', 'Amazon Lex', 'Amazon Polly', 'Amazon Transcribe', 'Amazon Translate', 'Amazon Comprehend', 'Amazon Rekognition', 'Amazon Textract', 'Amazon Q', 'Amazon Athena', 'Amazon Kinesis', 'AWS Glue', 'Amazon Redshift', 'Amazon EMR', 'Amazon OpenSearch Service', 'Amazon Quick'],
      answerNotes: { 'Amazon SageMaker AI': 'Build, train and deploy ML models.', 'Amazon Lex': 'Conversational chatbots (voice and text).', 'Amazon Polly': 'Text to speech.', 'Amazon Transcribe': 'Speech to text.', 'Amazon Translate': 'Language translation.', 'Amazon Comprehend': 'Natural language processing: sentiment, entities, key phrases.', 'Amazon Rekognition': 'Image and video analysis.', 'Amazon Textract': 'Extract text, forms and tables from documents.', 'Amazon Q': 'Generative AI assistant for business and developers.', 'Amazon Athena': 'Query data in S3 with SQL, serverless.', 'Amazon Kinesis': 'Collect and process streaming data in real time.', 'AWS Glue': 'Serverless data integration (ETL) and Data Catalog.', 'Amazon Redshift': 'Data warehouse.', 'Amazon EMR': 'Managed big data frameworks (Spark, Hadoop).', 'Amazon OpenSearch Service': 'Search and log analytics.', 'Amazon Quick': 'AWS business intelligence and dashboards (including the capabilities previously known as Amazon QuickSight).' },
      cases: [
        { value: 'bot', label: 'Build a customer-service chatbot', answer: 'Amazon Lex', why: 'Conversational interfaces.' },
        { value: 'tts', label: 'Read articles aloud in natural voices', answer: 'Amazon Polly', why: 'Text to speech.' },
        { value: 'forms', label: 'Extract fields from scanned invoices', answer: 'Amazon Textract', why: 'Document extraction.' },
        { value: 'faces', label: 'Detect objects and faces in photos', answer: 'Amazon Rekognition', why: 'Computer vision.' },
        { value: 'sql', label: 'Run ad hoc SQL on CSV logs in S3 without servers', answer: 'Amazon Athena', why: 'Serverless query.' },
        { value: 'stream', label: 'Ingest clickstream events in real time', answer: 'Amazon Kinesis', why: 'Streaming data.' },
        { value: 'etl', label: 'Discover schemas and run ETL jobs', answer: 'AWS Glue', why: 'Data catalog and ETL.' },
        { value: 'custom', label: 'Train a custom fraud-detection model', answer: 'Amazon SageMaker AI', why: 'Full ML lifecycle.' },
        { value: 'sentiment', label: 'Analyse sentiment of product reviews', answer: 'Amazon Comprehend', why: 'NLP.' },
        { value: 'dash', label: 'Interactive BI dashboards for business users', answer: 'Amazon Quick', why: 'Business intelligence.' },
      ],
    }),
    chooser({
      id: 'aws-other', title: 'Other service categories', description: 'Integration, business apps, developer tools, end-user computing, web/mobile and IoT.', requirementLabel: 'Requirement', answerLabel: 'Service',
      answers: ['Amazon SNS', 'Amazon SQS', 'Amazon EventBridge', 'AWS Step Functions', 'Amazon Connect', 'Amazon SES', 'AWS CodeBuild', 'AWS CodePipeline', 'AWS X-Ray', 'Amazon WorkSpaces', 'Amazon AppStream 2.0', 'Amazon WorkSpaces Secure Browser', 'AWS Amplify', 'AWS IoT Core', 'AWS Support'],
      answerNotes: { 'Amazon SNS': 'Pub/sub notifications (push to email, SMS, endpoints, queues).', 'Amazon SQS': 'Message queues to decouple components.', 'Amazon EventBridge': 'Event bus routing events between services and SaaS apps.', 'AWS Step Functions': 'Orchestrate workflows of services.', 'Amazon Connect': 'Cloud contact center.', 'Amazon SES': 'Send and receive email at scale.', 'AWS CodeBuild': 'Managed build and test service.', 'AWS CodePipeline': 'Continuous delivery pipelines.', 'AWS X-Ray': 'Trace and debug distributed applications.', 'Amazon WorkSpaces': 'Persistent virtual desktops.', 'Amazon AppStream 2.0': 'Stream desktop applications to browsers.', 'Amazon WorkSpaces Secure Browser': 'Secure browser access to internal websites and SaaS.', 'AWS Amplify': 'Build and host full-stack web and mobile apps.', 'AWS IoT Core': 'Connect and manage IoT devices.', 'AWS Support': 'Technical support plans and services.' },
      cases: [
        { value: 'fanout', label: 'Send an alert to email and SMS subscribers when an order fails', answer: 'Amazon SNS', why: 'Push notifications to many subscribers.' },
        { value: 'buffer', label: 'Buffer orders so a slow worker can process them later', answer: 'Amazon SQS', why: 'Queue-based decoupling.' },
        { value: 'callcenter', label: 'Set up a cloud contact center', answer: 'Amazon Connect', why: 'Contact center as a service.' },
        { value: 'email', label: 'Send transactional emails from an app', answer: 'Amazon SES', why: 'Email sending service.' },
        { value: 'trace', label: 'Find which microservice causes slow requests', answer: 'AWS X-Ray', why: 'Distributed tracing.' },
        { value: 'ci', label: 'Automatically build, test and deploy on every commit', answer: 'AWS CodePipeline', why: 'CI/CD orchestration (CodeBuild runs the builds).' },
        { value: 'desktop', label: 'Persistent Windows desktops for remote staff', answer: 'Amazon WorkSpaces', why: 'Virtual desktops.' },
        { value: 'stream', label: 'Stream a CAD application to students\' browsers', answer: 'Amazon AppStream 2.0', why: 'Application streaming.' },
        { value: 'mobile', label: 'Front-end developers build and host a web app with auth quickly', answer: 'AWS Amplify', why: 'Full-stack web/mobile.' },
        { value: 'iot', label: 'Connect millions of sensors securely', answer: 'AWS IoT Core', why: 'IoT device connectivity.' },
        { value: 'schedule', label: 'Trigger a Lambda function on a schedule or SaaS event', answer: 'Amazon EventBridge', why: 'Event bus with schedules and rules.' },
      ],
    }),
    chooser({
      id: 'aws-access', title: 'Ways to access and deploy', description: 'Pick how to access AWS and whether to automate.', requirementLabel: 'Requirement', answerLabel: 'Method',
      answers: ['AWS Management Console', 'AWS CLI', 'AWS SDKs / APIs', 'AWS CloudFormation (IaC)'],
      answerNotes: { 'AWS Management Console': 'Web interface; good for one-time tasks and exploring.', 'AWS CLI': 'Command-line scripting.', 'AWS SDKs / APIs': 'Programmatic access from application code.', 'AWS CloudFormation (IaC)': 'Templates for repeatable, version-controlled provisioning.' },
      cases: [
        { value: 'once', label: 'Look at a bill once and change one setting', answer: 'AWS Management Console', why: 'One-time manual operations.' },
        { value: 'repeat', label: 'Create identical environments in five Regions repeatedly', answer: 'AWS CloudFormation (IaC)', why: 'Repeatable processes.' },
        { value: 'app', label: 'A Python app uploads files to S3', answer: 'AWS SDKs / APIs', why: 'Programmatic access from code.' },
        { value: 'script', label: 'A nightly shell script stops dev instances', answer: 'AWS CLI', why: 'Scripted automation.' },
      ],
    }),
  ],
}

const billingGroup: ScenarioGroup = {
  id: 'aws-billing-sim',
  fidelity: 'simplified-illustration',
  fidelityNote: 'Purchasing option behaviour, data transfer charging rules, consolidated billing and support resources follow AWS documentation. Costs are illustrative units, not AWS prices.',
  scenarios: [
    {
      id: 'aws-purchase',
      title: 'Compute purchasing options',
      description: 'Choose a purchasing option for a workload and compare illustrative monthly cost.',
      stages: [{ id: 'work', label: 'Workload', kind: 'compute' }, { id: 'opt', label: 'Purchasing option', kind: 'service' }, { id: 'fit', label: 'Fit', kind: 'security' }],
      controls: [
        { type: 'number', key: 'hours', label: 'Hours used per month (max 730)', min: 0, max: 730 },
        { type: 'checkbox', key: 'interruptible', label: 'Workload tolerates interruption' },
        { type: 'checkbox', key: 'steady', label: 'Steady usage expected for 1–3 years' },
        { type: 'select', key: 'option', label: 'Option', options: opt('On-Demand', 'Savings Plan / Reserved (1 yr)', 'Spot') },
      ],
      initial: { hours: 730, interruptible: false, steady: true, option: 'On-Demand' },
      presets: [{ label: 'Spiky dev/test', values: { hours: 120, steady: false, option: 'Savings Plan / Reserved (1 yr)' } }, { label: 'Interruptible batch', values: { hours: 300, interruptible: true, steady: false, option: 'Spot' } }],
      evaluate: (s) => {
        const o = str(s, 'option') as 'On-Demand' | 'Savings Plan / Reserved (1 yr)' | 'Spot'
        const c = purchaseCost(o, num(s, 'hours'), bool(s, 'interruptible'))
        const best = bool(s, 'interruptible') ? 'Spot' : bool(s, 'steady') && num(s, 'hours') > 400 ? 'Savings Plan / Reserved (1 yr)' : 'On-Demand'
        const ok = o === best
        const all = (['On-Demand', 'Savings Plan / Reserved (1 yr)', 'Spot'] as const).map((x) => `${x}: ${purchaseCost(x, num(s, 'hours'), bool(s, 'interruptible')).cost}`)
        const stages = chain([{ id: 'work', label: 'Workload', kind: 'compute' }, { id: 'opt', label: 'Purchasing option', kind: 'service' }, { id: 'fit', label: 'Fit', kind: 'security' }], [
          [true, `${num(s, 'hours')} h/month, ${bool(s, 'steady') ? 'steady' : 'variable'}, ${bool(s, 'interruptible') ? 'interruptible' : 'must not be interrupted'}.`],
          [true, `${o}: ≈ ${c.cost} units. ${c.risk}`],
          [ok, ok ? 'Good fit.' : `${best} fits better: ${best === 'Spot' ? 'up to 90% off for interruptible workloads' : best === 'On-Demand' ? 'no commitment for short or unpredictable use' : 'commitment discount for steady use'}.`],
        ])
        return { stages, outcome: { ok, title: ok ? 'GOOD CHOICE' : 'BETTER OPTION EXISTS', detail: stages[2]!.detail }, checks: [ok ? 'aws-purchase-correct' : 'aws-purchase-wrong'], notes: [...all, 'Dedicated Hosts: physical server for licence/compliance needs. Dedicated Instances: hardware isolation. Capacity Reservations: guaranteed capacity in an AZ.'] }
      },
    },
    {
      id: 'aws-transfer',
      title: 'Data transfer charges',
      description: 'Pick a data path and see whether it is charged.',
      stages: [{ id: 'src', label: 'Source', kind: 'globe' }, { id: 'path', label: 'Path', kind: 'network' }, { id: 'bill', label: 'Charged?', kind: 'service' }],
      controls: [{ type: 'select', key: 'path', label: 'Path', options: opt('Internet → AWS (inbound)', 'AWS → Internet (outbound)', 'Between Regions', 'Between AZs in the same Region', 'Same AZ using private IPs') }, { type: 'select', key: 'guess', label: 'Your answer', options: opt('Charged', 'Free') }],
      initial: { path: 'Internet → AWS (inbound)', guess: 'Charged' },
      presets: [{ label: 'Outbound to internet', values: { path: 'AWS → Internet (outbound)', guess: 'Charged' } }],
      evaluate: (s) => {
        const t = transferCharged(str(s, 'path') as TransferPath)
        const ok = (str(s, 'guess') === 'Charged') === t.charged
        const stages = chain([{ id: 'src', label: 'Source', kind: 'globe' }, { id: 'path', label: 'Path', kind: 'network' }, { id: 'bill', label: 'Charged?', kind: 'service' }], [[true, str(s, 'path').split(' ')[0]!], [true, str(s, 'path')], [ok, t.note]])
        return { stages, outcome: { ok, title: ok ? 'CORRECT' : 'NOT QUITE', detail: t.note }, checks: [ok ? 'aws-transfer-correct' : 'aws-transfer-wrong'] }
      },
    },
    {
      id: 'aws-org',
      title: 'Consolidated billing and RIs',
      description: 'Three accounts in AWS Organizations: see consolidated billing and Reserved Instance sharing.',
      stages: [{ id: 'accts', label: 'Member accounts', kind: 'user' }, { id: 'payer', label: 'Management account', kind: 'service' }, { id: 'ri', label: 'RI / Savings Plan sharing', kind: 'security' }, { id: 'bill', label: 'One bill', kind: 'storage' }],
      controls: [
        { type: 'number', key: 'a', label: 'Account A instance-hours', min: 0, max: 2000 },
        { type: 'number', key: 'b', label: 'Account B instance-hours', min: 0, max: 2000 },
        { type: 'number', key: 'ri', label: 'Reserved instance-hours bought by Account A', min: 0, max: 2000 },
        { type: 'checkbox', key: 'sharing', label: 'RI/Savings Plan discount sharing enabled (default)' },
        { type: 'checkbox', key: 'tags', label: 'Activate cost allocation tags (project)' },
      ],
      initial: { a: 300, b: 700, ri: 730, sharing: true, tags: true },
      presets: [{ label: 'Turn off sharing', values: { sharing: false } }],
      evaluate: (s) => {
        const a = num(s, 'a'); const b = num(s, 'b'); const ri = num(s, 'ri')
        const coveredA = Math.min(a, ri)
        const coveredB = bool(s, 'sharing') ? Math.min(b, ri - coveredA) : 0
        const unused = ri - coveredA - coveredB
        const stages = chain([{ id: 'accts', label: 'Member accounts', kind: 'user' }, { id: 'payer', label: 'Management account', kind: 'service' }, { id: 'ri', label: 'RI / Savings Plan sharing', kind: 'security' }, { id: 'bill', label: 'One bill', kind: 'storage' }], [
          [true, `A uses ${a} h, B uses ${b} h.`],
          [true, 'Consolidated billing: one payment method; usage combined for volume pricing tiers; no extra charge.'],
          [true, `Account A's ${ri} reserved hours cover ${coveredA} h in A${bool(s, 'sharing') ? ` and ${coveredB} h in B` : ' only (sharing off)'}; ${unused} h unused.`],
          [true, bool(s, 'tags') ? 'Cost allocation tags appear in Cost Explorer and the Cost and Usage Report after activation.' : 'Without activated tags, costs are only by account/service.'],
        ])
        return { stages, outcome: { ok: true, title: `${unused} RESERVED HOURS WASTED`, detail: bool(s, 'sharing') ? 'Sharing lets other accounts use unused reservations.' : 'Turning sharing off keeps discounts in the purchasing account.' }, checks: ['aws-org-billing'] }
      },
    },
    chooser({
      id: 'aws-billing-tool', title: 'Billing and cost tools', description: 'Pick the billing or cost tool.', requirementLabel: 'Need', answerLabel: 'Tool',
      answers: ['AWS Budgets', 'AWS Cost Explorer', 'AWS Pricing Calculator', 'AWS Cost and Usage Report', 'Cost allocation tags', 'AWS Organizations (consolidated billing)'],
      answerNotes: { 'AWS Budgets': 'Set budgets and alerts on cost, usage, RI or Savings Plans coverage; can trigger actions.', 'AWS Cost Explorer': 'Visualise, analyse and forecast costs and usage.', 'AWS Pricing Calculator': 'Estimate costs before deploying.', 'AWS Cost and Usage Report': 'Most detailed billing data, delivered to S3.', 'Cost allocation tags': 'Tags activated for billing to categorise costs.', 'AWS Organizations (consolidated billing)': 'One bill for many accounts with combined volume pricing.' },
      cases: [
        { value: 'alert', label: 'Email me when forecasted spend exceeds 1,000 USD', answer: 'AWS Budgets', why: 'Budget alerts on actual or forecasted cost.' },
        { value: 'trend', label: 'See which services drove cost growth over 6 months', answer: 'AWS Cost Explorer', why: 'Cost analysis and forecasting.' },
        { value: 'estimate', label: 'Estimate the monthly cost of an architecture before building it', answer: 'AWS Pricing Calculator', why: 'Pre-deployment estimates.' },
        { value: 'lineitems', label: 'Load hourly line-item billing data into Athena', answer: 'AWS Cost and Usage Report', why: 'Detailed billing export.' },
        { value: 'project', label: 'Break costs down by project across accounts', answer: 'Cost allocation tags', why: 'Activate user-defined tags for billing.' },
        { value: 'onebill', label: 'Receive a single bill for 20 accounts', answer: 'AWS Organizations (consolidated billing)', why: 'Consolidated billing.' },
      ],
    }),
    chooser({
      id: 'aws-support', title: 'Support and resources', description: 'Pick the AWS support option or resource.', requirementLabel: 'Need', answerLabel: 'Resource',
      answers: ['AWS re:Post', 'AWS Knowledge Center', 'AWS Prescriptive Guidance', 'AWS Trusted Advisor', 'AWS Health Dashboard', 'AWS Trust & Safety team', 'AWS Professional Services', 'AWS Marketplace', 'AWS Partner Network (APN)', 'AWS Support plans', 'AWS Support Center'],
      answerNotes: { 'AWS re:Post': 'Community Q&A site.', 'AWS Knowledge Center': 'Answers to frequent customer questions.', 'AWS Prescriptive Guidance': 'Strategies, guides and patterns for migration and modernisation.', 'AWS Trusted Advisor': 'Checks for cost optimisation, security, fault tolerance, performance, service limits and operational excellence.', 'AWS Health Dashboard': 'Events affecting AWS services and your resources (also via the AWS Health API).', 'AWS Trust & Safety team': 'Report abuse of AWS resources (spam, attacks).', 'AWS Professional Services': 'AWS experts who help deliver outcomes.', 'AWS Marketplace': 'Catalog of third-party software, data and services.', 'AWS Partner Network (APN)': 'Consulting partners/system integrators and ISVs.', 'AWS Support plans': 'Levels of technical support (Basic and paid plans).', 'AWS Support Center': 'Open and manage support cases.' },
      cases: [
        { value: 'abuse', label: 'Report an AWS IP address sending spam to you', answer: 'AWS Trust & Safety team', why: 'Abuse reporting.' },
        { value: 'checks', label: 'Find idle load balancers and open security groups automatically', answer: 'AWS Trusted Advisor', why: 'Best-practice checks.' },
        { value: 'event', label: 'See whether an AWS outage affects my EC2 instances', answer: 'AWS Health Dashboard', why: 'Personalised service health.' },
        { value: 'patterns', label: 'Find vetted migration patterns and guides', answer: 'AWS Prescriptive Guidance', why: 'Prescriptive guides.' },
        { value: 'thirdparty', label: 'Buy a third-party firewall appliance billed through AWS', answer: 'AWS Marketplace', why: 'Third-party software marketplace.' },
        { value: 'integrator', label: 'Hire a partner company to run our migration', answer: 'AWS Partner Network (APN)', why: 'Consulting partners / system integrators.' },
        { value: 'case', label: 'Open a technical support case', answer: 'AWS Support Center', why: 'Case management.' },
        { value: 'community', label: 'Ask the community how others solved an error', answer: 'AWS re:Post', why: 'Community Q&A.' },
      ],
    }),
  ],
}

export const groups: ScenarioGroup[] = [conceptsGroup, securityGroup, techGroup, billingGroup]
