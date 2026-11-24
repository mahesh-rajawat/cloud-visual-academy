import { Badge } from '../animations/primitives'

type Level = 'close' | 'partial' | 'different-model'

const ROWS: Array<{ azure: string; aws: string; level: Level; notes: string; docs: [string, string] }> = [
  { azure: 'Azure Virtual Machines', aws: 'Amazon EC2', level: 'close', notes: 'Both are IaaS VMs. Azure uses availability sets and zones; EC2 uses placement groups and AZ placement. Sizing families and naming differ.', docs: ['https://learn.microsoft.com/azure/virtual-machines/overview', 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html'] },
  { azure: 'Azure Blob Storage', aws: 'Amazon S3', level: 'close', notes: 'Object storage in both. Azure redundancy is chosen per storage account (LRS…RA-GZRS); S3 durability is built into storage classes and cross-Region copies need replication rules. Access tiers and storage classes map only loosely.', docs: ['https://learn.microsoft.com/azure/storage/blobs/storage-blobs-overview', 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html'] },
  { azure: 'Azure Virtual Network', aws: 'Amazon VPC', level: 'partial', notes: 'Azure subnets span all zones of a region; AWS subnets live in exactly one AZ. Azure routes to the internet without an internet-gateway object; a public AWS subnet needs a route to an internet gateway.', docs: ['https://learn.microsoft.com/azure/virtual-network/virtual-networks-overview', 'https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html'] },
  { azure: 'Network security groups', aws: 'Security groups + network ACLs', level: 'different-model', notes: 'NSGs are stateful with allow and deny rules and priorities, attachable to subnets or NICs. AWS security groups are stateful, allow-only and attach to ENIs; network ACLs are stateless, subnet-level, numbered allow/deny rules.', docs: ['https://learn.microsoft.com/azure/virtual-network/network-security-groups-overview', 'https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html'] },
  { azure: 'Azure Functions', aws: 'AWS Lambda', level: 'close', notes: 'Event-driven serverless functions. Hosting plans (Consumption, Flex Consumption, Premium, Dedicated) have no exact Lambda counterpart; triggers and bindings differ from Lambda event sources.', docs: ['https://learn.microsoft.com/azure/azure-functions/functions-overview', 'https://docs.aws.amazon.com/lambda/latest/dg/welcome.html'] },
  { azure: 'Azure Monitor', aws: 'Amazon CloudWatch (+ CloudTrail for API audit)', level: 'partial', notes: 'Azure Monitor covers metrics, logs (Log Analytics/KQL) and alerts; the Azure activity log records control-plane operations. On AWS, CloudWatch handles metrics/logs/alarms and CloudTrail records API activity.', docs: ['https://learn.microsoft.com/azure/azure-monitor/overview', 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html'] },
  { azure: 'Azure RBAC', aws: 'AWS IAM policies and roles', level: 'different-model', notes: 'Azure RBAC assigns role definitions to principals at hierarchical scopes, with no explicit deny in roles. AWS IAM evaluates identity and resource policies with explicit Deny overriding Allow; roles are assumed identities with temporary credentials.', docs: ['https://learn.microsoft.com/azure/role-based-access-control/overview', 'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html'] },
  { azure: 'Azure App Service', aws: 'AWS Elastic Beanstalk / AWS App Runner / AWS Amplify Hosting', level: 'partial', notes: 'App Service is a managed web-app PaaS with plans, slots and built-in scaling. No single AWS service matches it: Elastic Beanstalk orchestrates EC2-based environments, App Runner runs containers or source, and Amplify Hosting targets frontend/full-stack web apps.', docs: ['https://learn.microsoft.com/azure/app-service/overview', 'https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/Welcome.html'] },
  { azure: 'Management groups / subscriptions', aws: 'AWS Organizations (OUs / accounts)', level: 'partial', notes: 'Both build a hierarchy for policy and billing. Azure resource groups have no direct AWS equivalent; AWS accounts are a stronger isolation boundary than Azure resource groups.', docs: ['https://learn.microsoft.com/azure/governance/management-groups/overview', 'https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html'] },
]

const TONE: Record<Level, 'allow' | 'warn' | 'deny'> = { close: 'allow', partial: 'warn', 'different-model': 'deny' }

export default function Compare() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Azure ↔ AWS comparison</h1>
      <p className="text-sm text-slate-500">"Close" means similar purpose and model, not identical behaviour. Always check limits and semantics in each provider's documentation. Side-by-side animations for these pairs are not built yet.</p>
      <div className="overflow-x-auto">
        <table className="card w-full text-sm">
          <thead><tr className="text-left"><th className="p-2">Azure</th><th className="p-2">AWS</th><th className="p-2">Comparability</th><th className="p-2">Key differences</th><th className="p-2">Docs</th></tr></thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.azure} className="border-t border-slate-200 align-top dark:border-slate-800">
                <td className="p-2 font-medium">{r.azure}</td><td className="p-2 font-medium">{r.aws}</td>
                <td className="p-2"><Badge tone={TONE[r.level]}>{r.level}</Badge></td>
                <td className="p-2">{r.notes}</td>
                <td className="p-2 text-xs"><a className="underline" href={r.docs[0]} target="_blank" rel="noreferrer">Azure</a> · <a className="underline" href={r.docs[1]} target="_blank" rel="noreferrer">AWS</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
