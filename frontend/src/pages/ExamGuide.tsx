import { Link } from 'react-router-dom'

const ML = 'https://learn.microsoft.com/en-us/credentials/'

/** Numbers and rules that AZ-104 questions test again and again. Each one is taught in the linked lesson. */
const CHEAT: Array<{ topic: string; lesson: string; facts: string[] }> = [
  { topic: 'Identity', lesson: 'az104-entra-users-groups', facts: ['Dynamic groups and self-service password reset (SSPR) for users need Microsoft Entra ID P1', 'Direct licence assignment needs a usage location; group-based licensing falls back to the tenant\'s country', 'Guests (B2B) sign in with their own account', 'SSPR scope: None, Selected (one group) or All'] },
  { topic: 'RBAC', lesson: 'az104-rbac', facts: ['Owner = all + grant access; Contributor = all except grant access; Reader = view', 'User Access Administrator = manage access only', 'Access inherits down: MG > subscription > RG > resource', 'Permissions add up across all assignments and groups'] },
  { topic: 'Governance', lesson: 'az104-policy-tags', facts: ['Policy = is the resource allowed? RBAC = may the person act?', 'Deny blocks new requests; existing resources need a remediation task (Modify/DINE)', 'Tags are not inherited from the resource group by default', 'CanNotDelete allows changes; ReadOnly blocks changes and even List Keys', 'Management groups: 6 levels below root', 'Moving a subscription to another tenant removes its role assignments', 'Budgets alert only; they never stop resources'] },
  { topic: 'Storage', lesson: 'az104-storage-redundancy', facts: ['LRS 3 copies / 1 datacenter; ZRS 3 zones; GRS/GZRS + paired region; RA- = readable -secondary', 'Hot / Cool 30 days / Cold 90 days / Archive 180 days (offline, rehydrate up to 15 h)', 'User delegation SAS = Entra credentials, blobs only, most secure', 'Max 5 stored access policies per container; delete the policy to revoke its SAS', 'Object replication needs versioning on both + change feed on source', 'NFS file shares need Premium (FileStorage); SMB uses port 445', 'Customer-managed keys need Key Vault soft delete + purge protection'] },
  { topic: 'Compute', lesson: 'az104-vm-create', facts: ['Availability set: 99.95%, up to 3 fault / 20 update domains, chosen at VM creation', 'Availability zones: 99.99% with 2+ VMs in 2+ zones', 'Resize may need deallocation; disks grow, never shrink', 'Temporary disk is lost on deallocation', 'Complete deployment mode deletes resources not in the template', 'ACR geo-replication and private link need Premium', 'Slots and autoscale start at Standard; custom domain + TLS at Basic', 'Sticky (slot) settings stay with the slot on swap'] },
  { topic: 'Networking', lesson: 'az104-vnet-subnets', facts: ['5 reserved IPs per subnet: /24 = 251, /27 = 27, /28 = 11, /29 = 3 usable', 'Peering is not transitive; address spaces must not overlap', 'Hub VPN for spokes: Allow gateway transit (hub) + Use remote gateways (spoke)', 'Standard public IPs are static and closed until an NSG allows traffic', 'NSG priority 100–4096, lowest first; inbound = subnet NSG then NIC NSG; both must allow', 'Longest prefix wins; then UDR > BGP > system route; next hop None drops', 'Bastion: AzureBastionSubnet /26 or larger; native client needs Standard+', 'Private endpoint not used? Check the privatelink.* private DNS zone link', 'Load balancer: frontend, backend pool, health probe, rule; probes must hit a listening port'] },
  { topic: 'Monitor and backup', lesson: 'az104-monitor-metrics-logs', facts: ['Platform metrics: automatic, 93 days. Activity log: 90 days', 'Resource logs need a diagnostic setting', 'Guest OS data: Azure Monitor Agent + data collection rule', 'KQL: Table | where | summarize count() by X | render timechart', 'Alert = scope + condition + action group; processing rules suppress or add actions', 'RSV: VMs, SQL/SAP HANA in VM, Azure Files, Site Recovery. Backup vault: disks, blobs, PostgreSQL, AKS', 'Vault in the same region as the VM; change redundancy before the first backup', 'Enhanced backup policy = several backups per day', 'ASR: test failover (isolated VNet) → failover → commit → re-protect → fail back'] },
]

export default function ExamGuide() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">AZ-104 exam-day guide</h1>
        <p className="text-sm text-slate-500">How the exam works, how to use your time, and the facts worth knowing by heart. Check the official exam page for the latest rules before you book.</p>
      </header>

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="text-base font-semibold">The exam in short</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>About 100 minutes of answering time, usually 40–60 questions. Passing score: 700 out of 1000 (this is a scaled score, not 70% of questions).</li>
          <li>Question styles: single and multiple choice, drag-and-drop or ordering, "hot area" (choose values in a picture or template), case studies (a long scenario with several questions), and yes/no series that you cannot go back to.</li>
          <li>Case studies are in their own section. Once you leave a section you cannot return to it.</li>
          <li>Microsoft currently lets you open Microsoft Learn during role-based exams like AZ-104. It does not add time, so use it only to check one fact, not to learn.</li>
          <li>The certificate is valid for one year; renewal is a free online assessment on Microsoft Learn.</li>
        </ul>
        <p className="flex flex-wrap gap-3">
          <a className="text-sky-700 underline dark:text-sky-400" href={`${ML}certifications/azure-administrator/`} target="_blank" rel="noreferrer">Official AZ-104 certification page (book, free practice assessment)</a>
          <a className="text-sky-700 underline dark:text-sky-400" href={`${ML}certifications/resources/study-guides/az-104`} target="_blank" rel="noreferrer">Official study guide</a>
          <a className="text-sky-700 underline dark:text-sky-400" href="https://aka.ms/examdemo" target="_blank" rel="noreferrer">Exam sandbox (try the question types)</a>
        </p>
      </section>

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="text-base font-semibold">Are you ready? Book when all of these are true</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>You finished every day of the <Link className="underline" to="/sprint">study plan</Link>, including the hands-on labs marked as real Azure.</li>
          <li>You score 80%+ on two <Link className="underline" to="/practice?exam=az-104&mode=mock">mock exams</Link> in a row, and you can explain why each wrong option is wrong.</li>
          <li>You score 80%+ on Microsoft's free official practice assessment (link above). It is the best independent check.</li>
          <li>No domain shows "weak" in <Link className="underline" to="/analytics">Analytics</Link>.</li>
        </ul>
      </section>

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="text-base font-semibold">Time strategy</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>Aim for about 1½ minutes per normal question. Keep 20–25 minutes for case studies.</li>
          <li>Read the last line of the question first: it tells you what is being asked (cheapest? least privilege? least effort?).</li>
          <li>Eliminate two wrong options, then choose. Do not leave anything blank; there is no penalty for guessing.</li>
          <li>Flag questions you are unsure of and come back if the section allows it.</li>
          <li>Watch for keywords: "minimise cost", "least administrative effort", "without downtime", "least privilege". They decide between two correct-looking answers.</li>
        </ul>
      </section>

      <section className="card space-y-2 p-4 text-sm">
        <h2 className="text-base font-semibold">On the day</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>Online exam: run the system test the day before, clear your desk, have your passport or Emirates ID ready, and use a wired connection if you can. Check in 30 minutes early.</li>
          <li>Test centre: arrive 15–30 minutes early with your ID.</li>
          <li>The night before: read this cheat sheet once, then stop. Sleep matters more than one more lab.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cheat sheet: facts the exam tests again and again</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {CHEAT.map((c) => (
            <div key={c.topic} className="card p-4 text-sm">
              <h3 className="font-semibold"><Link className="hover:underline" to={`/lesson/${c.lesson}`}>{c.topic}</Link></h3>
              <ul className="ml-5 mt-1 list-disc space-y-0.5">{c.facts.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
