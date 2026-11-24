"""AZ-900 domain 3: Describe Azure management and governance (30–35%). Seven focused lessons."""
from _az900 import E, ML, TR, anim, cfg, chooser_checks, lab, qq
from builder import lesson

COST = TR + "describe-cost-management-azure/"
GOV = TR + "describe-features-tools-azure-for-governance-compliance/"
TOOLS = TR + "describe-features-tools-manage-deploy-azure-resources/"
MON = TR + "describe-monitoring-tools-azure/"
CM = ML + "azure/cost-management-billing/costs/overview-cost-management"
TAGS = ML + "azure/azure-resource-manager/management/tag-resources"

anim("az900-cost-sim", "Cost factors and estimates", ["AZ900-3.1.1", "AZ900-3.1.2"], "Build an estimate from region, size, hours and egress, compare it to a budget, and match situations to cost factors.")
anim("az900-costmgmt-sim", "Cost Management and tags", ["AZ900-3.1.3", "AZ900-3.1.4"], "See whether costs land under the right department tag with and without tag inheritance, and pick Cost Management tools.", "accurate-model")
anim("az900-governance-sim", "Azure Policy, resource locks and Microsoft Purview", ["AZ900-3.2.1", "AZ900-3.2.2", "AZ900-3.2.3"], "Send requests through RBAC, Azure Policy and resource locks, and pick the governance tool for each need.", "accurate-model")
anim("az900-tools-sim", "Azure portal, Cloud Shell, CLI, PowerShell and Azure Arc", ["AZ900-3.3.1", "AZ900-3.3.2", "AZ900-3.3.3"], "Pick the management tool for each task and identify CLI and PowerShell commands.")
anim("az900-iac-sim", "Infrastructure as code and ARM templates", ["AZ900-3.3.4", "AZ900-3.3.5"], "Compare manual deployments with declarative templates, including idempotent re-runs and complete mode, and match ARM template benefits.", "accurate-model")
anim("az900-health-sim", "Azure Advisor and Azure Service Health", ["AZ900-3.4.1", "AZ900-3.4.2"], "Match recommendations to Advisor categories and choose between Azure status, Service Health and Resource Health.")
anim("az900-monitor-sim", "Azure Monitor, Log Analytics, alerts and Application Insights", ["AZ900-3.4.3"], "Collect data, choose the alert type and notify people; pick the monitoring service for each question.")

# ================================================================ 3.1.1–3.1.2
lesson(
    id="az900-cost-factors", exam=E, title="Factors that affect cost, and the pricing calculator",
    objectives=["AZ900-3.1.1", "AZ900-3.1.2"], minutes=30,
    objective="Describe the factors that affect Azure costs and use the pricing calculator to estimate a solution before deploying it.",
    prereqs=[("Consumption-based pricing", "AZ900-1.1.5", "az900-pricing-serverless")],
    foundation=[
        "Azure bills by consumption, so what you deploy and how long it runs decides the bill.",
        "Main cost factors: the resource type and size, how much you consume, leftover resources, the region, network traffic leaving Azure, your subscription type, and anything bought from the Azure Marketplace.",
        "The pricing calculator (azure.microsoft.com/pricing/calculator) lets you add services, pick options and see an estimated monthly cost before you build anything. It's free and you don't need to sign in.",
    ],
    engineer=[
        "Resource type and size: each service, tier and SKU has its own meters. A Premium SSD costs more than Standard HDD; a D-series VM more than a B-series. Storage cost depends on type, tier, redundancy and region.",
        "Consumption: pay-as-you-go by default; commit with reservations or savings plans for discounts. Maintenance: resources created with others (disks, NICs, public IPs, NSGs) remain after a VM is deleted unless cleaned up.",
        "Geography: prices differ between regions because of local power, labour and tax costs. Network traffic: inbound data transfer is generally free; outbound (egress) to the internet and traffic between regions or zones is billed, in tiers by zone and volume.",
        "Subscription type: free accounts include 12 months of popular services, credit for the first 30 days and always-free services. Azure Marketplace: third-party solutions bill their own software charges on your Azure invoice.",
        "Pricing calculator: choose products, configure options (region, tier, billing option, support), see a per-month estimate, export or share it. Estimates aren't quotes; actual cost depends on real usage.",
    ],
    anim=("az900-cost-sim", "Build an estimate and compare it to a budget, then match situations to cost factors."),
    diagram=([("type", "Resource type and size", 0, 0, "compute"), ("reg", "Region", 0, 100, "scope"), ("egress", "Outbound traffic", 0, 200, "network"), ("cons", "Consumption / commitments", 0, 300, "scope"), ("calc", "Pricing calculator estimate", 300, 150, "user"), ("bill", "Monthly bill", 560, 150, "storage")],
             [("type", "calc"), ("reg", "calc"), ("egress", "calc"), ("cons", "calc"), ("calc", "bill", "deploy")]),
    example=("Estimating a new web shop", ["The team prices 2 App Service instances, an Azure SQL Database and 500 GB of outbound traffic in the calculator for two regions. North Europe is cheaper than Switzerland North for the same SKUs.",
                                           "They export the estimate for the budget meeting and later notice that a forgotten test VM's disks keep costing money after the VM was deleted."]),
    config=cfg(["azure.microsoft.com/pricing/calculator: add products, set region and options, Export.", "Cost Management > Cost analysis: compare the estimate with actual cost after deploying."],
               "az consumption usage list --top 5 -o table\naz vm list-skus -l westeurope --size Standard_D -o table", "Get-AzConsumptionUsageDetail -Top 5", perms=("Cost Management Reader to view costs",)),
    lab=lab("Estimate costs and recognise cost factors.", ["Cost factors and estimates tab: change region, size, hours and egress; compare with the budget.", "What affects cost? tab: answer every situation."],
            ["Region and egress change the estimate", "Leftover resources still cost money"], [("cost-estimated", "Built an estimate"), ("cost-over", "Saw an estimate exceed the budget")] + chooser_checks("cost-factor", "cost factor"),
            ["Ignoring outbound data transfer", "Treating an estimate as a guaranteed price"]),
    troubleshooting=[("Bill is much higher than the estimate.", "Real usage (hours, egress, transactions) differs from estimate inputs.", "Compare Cost analysis by meter with the estimate and adjust."),
                     ("Charges continue for deleted resources.", "Associated disks or IPs remain.", "Delete orphaned resources.")],
    comparisons=[("Pricing calculator vs Cost Management", "The calculator estimates before deploying; Cost Management tracks actual spend after."), ("Ingress vs egress", "Inbound transfer is generally free; outbound is billed.")],
    misconceptions=[("Azure prices are the same in every region.", "They vary by region."), ("Deleting a VM deletes everything it used.", "Disks, NICs and IPs may remain."), ("The calculator needs an Azure subscription.", "It's free to use without signing in.")],
    decisions=["Estimate in several regions before choosing.", "Design to minimise cross-region and internet egress.", "Clean up associated resources."],
    docs=[("Describe cost management in Azure (Learn)", COST), ("Pricing calculator", "https://azure.microsoft.com/pricing/calculator/"), ("Bandwidth pricing", "https://azure.microsoft.com/pricing/details/bandwidth/"), ("Azure free account", "https://azure.microsoft.com/free/")],
)
qq("AZ900-3.1.1", 2, "scenario", "The same VM size is cheaper in one region than in another. Which cost factor explains this?", [("Geography", "Correct."), ("Subscription type", "No."), ("Maintenance", "No."), ("Tags", "No cost effect.")], "a", "Prices vary by region.", COST)
qq("AZ900-3.1.1", 2, "single", "Which data transfer is generally free in Azure?", [("Inbound data transfer into Azure", "Correct."), ("Outbound transfer to the internet", "Billed."), ("Transfer between regions", "Billed."), ("All transfer is free", "No.")], "a", "Ingress is free; egress is billed.", "https://azure.microsoft.com/pricing/details/bandwidth/")
qq("AZ900-3.1.1", 2, "multiple", "Which TWO actions reduce Azure costs?", [("Deleting unused disks and public IPs", "Correct."), ("Choosing a cheaper region where requirements allow", "Correct."), ("Adding more tags", "No cost effect."), ("Moving all data to the Hot tier", "More expensive storage.")], "ab", "Clean up and choose regions wisely.", COST)
qq("AZ900-3.1.2", 1, "single", "What is the Azure pricing calculator used for?", [("Estimating the cost of Azure services before deploying them", "Correct."), ("Viewing last month's invoice", "Cost Management / billing."), ("Setting budgets", "Cost Management."), ("Enforcing tags", "Azure Policy.")], "a", "Pre-deployment estimates.", "https://azure.microsoft.com/pricing/calculator/")
qq("AZ900-3.1.2", 2, "scenario", "A consultant without an Azure subscription must prepare a cost estimate for a client's design. What can they use?", [("The Azure pricing calculator", "Correct: no sign-in needed."), ("Cost analysis", "Needs a subscription with usage."), ("Azure Advisor", "Needs resources."), ("Budgets", "Needs a subscription.")], "a", "The calculator is public.", "https://azure.microsoft.com/pricing/calculator/")

# ================================================================ 3.1.3–3.1.4
lesson(
    id="az900-cost-management-tags", exam=E, title="Cost Management capabilities and tags",
    objectives=["AZ900-3.1.3", "AZ900-3.1.4"], minutes=30,
    objective="Describe Cost Management capabilities (cost analysis, budgets, alerts, recommendations) and use tags to organise and report resources.",
    prereqs=[("Cost factors", "AZ900-3.1.1", "az900-cost-factors"), ("Resource hierarchy", "AZ900-2.1.4", "az900-resource-hierarchy")],
    foundation=[
        "Microsoft Cost Management shows what you've spent, where and why, and helps you control it: cost analysis reports, budgets, alerts and savings recommendations.",
        "A budget is a spending limit you set (for example $2,000 a month for a subscription). Azure alerts you when spend or forecast reaches a threshold. Budgets don't stop resources by themselves, but they can trigger automation.",
        "Tags are name/value labels you add to resources, such as dept=finance or env=prod. They help you find, organise and report on resources, especially costs.",
    ],
    engineer=[
        "Cost analysis: explore actual and forecast costs by service, resource, resource group, location, meter or tag; save views; export data to storage on a schedule.",
        "Cost alerts: budget alerts (when spend or forecast reaches a threshold), credit alerts (Azure Prepayment consumption), department spending quota alerts (EA), and anomaly alerts. Budgets can trigger action groups (email, runbooks, Logic Apps) to scale down or stop resources.",
        "Recommendations: Azure Advisor cost recommendations appear in Cost Management (resize or shut down underused VMs, buy reservations).",
        "Tags: up to 50 name/value pairs per resource, resource group or subscription. Uses: resource management (find and act on resources by tag), cost management and optimisation (group costs), operations (criticality, SLA), security (data classification), governance and compliance, workload optimisation and automation (for example shut down VMs tagged schedule=office-hours).",
        "Tags aren't inherited by resources from their resource group or subscription by default. Use Azure Policy (for example 'Inherit a tag from the resource group if missing' or 'Require a tag') or Cost Management tag inheritance (for supported billing accounts) to apply them consistently. Not every resource type supports tags.",
    ],
    anim=("az900-costmgmt-sim", "See whether VM costs show under the department tag, then pick the right Cost Management tool."),
    diagram=([("rg", "Resource group: dept=finance", 0, 0, "storage"), ("vm", "VM: no tag", 0, 140, "compute"), ("pol", "Policy: inherit tag", 260, 70, "security"), ("ca", "Cost analysis grouped by tag", 520, 0, "user"), ("bud", "Budget + alert at 80%", 520, 140, "security")],
             [("rg", "pol"), ("pol", "vm", "adds tag"), ("vm", "ca"), ("ca", "bud")]),
    example=("Chargeback by department", ["Finance asks each department to pay for its own Azure usage. IT requires a dept tag on every resource group with Azure Policy, and adds 'Inherit a tag from the resource group' so new VMs get it automatically.",
                                          "Cost analysis grouped by dept now shows each department's spend; each department has a monthly budget with alerts at 80% and 100%."]),
    config=cfg(["Cost Management > Cost analysis: Group by Tag.", "Cost Management > Budgets > Add.", "Any resource > Tags.", "Policy > Definitions: 'Inherit a tag from the resource group if missing'."],
               "az tag update --resource-id <id> --operation Merge --tags dept=finance env=prod\naz consumption budget create --budget-name monthly --amount 2000 --time-grain Monthly --start-date 2026-12-01 --end-date 2027-12-01 --category Cost",
               "Update-AzTag -ResourceId <id> -Tag @{dept='finance'} -Operation Merge\nNew-AzConsumptionBudget -Name monthly -Amount 2000 -TimeGrain Monthly -StartDate 2026-12-01 -Category Cost",
               perms=("Cost Management Contributor for budgets; Tag Contributor or Contributor for tags",), limits=("Up to 50 tags per resource", "Some resource types don't support tags")),
    lab=lab("Attribute costs with tags and choose Cost Management tools.", ["Tags and cost reports tab: run the default, then each preset.", "Cost management tools tab: answer every task."],
            ["Tags aren't inherited by default", "Budgets alert; the calculator estimates"], [("tags-reported", "Costs appeared under the tag"), ("tags-missing", "Saw untagged costs")] + chooser_checks("cost-tools", "cost tool"),
            ["Expecting a resource group tag to tag its resources automatically", "Expecting a budget to stop spending by itself"]),
    troubleshooting=[("Department report shows large 'untagged' costs.", "Resources lack the tag; resource group tags aren't inherited.", "Use Azure Policy to require or inherit tags."),
                     ("Budget alert received after spend already exceeded the budget.", "Alert threshold too high.", "Add forecast-based alerts at lower thresholds.")],
    comparisons=[("Tags vs resource groups", "A resource is in one group, but it can have many tags; tags cut across groups and subscriptions."), ("Budgets vs Azure Policy", "Budgets alert on spend; Policy controls what can be deployed.")],
    misconceptions=[("Budgets stop resources when exceeded.", "They alert; automation must be added to act."), ("Tags affect pricing.", "They only label resources."), ("Child resources inherit tags automatically.", "Not by default.")],
    decisions=["Define a tagging standard (dept, env, owner) and enforce it with Policy.", "Set budgets per subscription and department.", "Review cost analysis monthly."],
    docs=[("Describe cost management in Azure (Learn)", COST), ("Cost Management overview", CM), ("Create and manage budgets", ML + "azure/cost-management-billing/costs/tutorial-acm-create-budgets"), ("Use tags to organize resources", TAGS), ("Tag inheritance in Cost Management", ML + "azure/cost-management-billing/costs/enable-tag-inheritance")],
)
qq("AZ900-3.1.3", 2, "scenario", "Finance must be emailed when a subscription's spend reaches 80% of $5,000 per month. What should you create?", [("A budget with an alert threshold", "Correct."), ("A resource lock", "No."), ("A tag", "No."), ("A pricing calculator estimate", "Before deployment.")], "a", "Budgets notify on thresholds.", ML + "azure/cost-management-billing/costs/tutorial-acm-create-budgets")
qq("AZ900-3.1.3", 2, "single", "What happens by default when a Cost Management budget is exceeded?", [("Alerts are sent; resources keep running", "Correct."), ("All resources are deleted", "No."), ("The subscription is disabled", "Not for pay-as-you-go budgets."), ("Deployments are blocked", "No.")], "a", "Budgets alert; automation can act.", CM)
qq("AZ900-3.1.4", 2, "scenario", "A resource group has the tag dept=finance. A VM inside it has no tags. What does cost analysis show when grouped by dept?", [("The VM's cost as untagged", "Correct: tags aren't inherited by default."), ("The VM under finance", "Needs inheritance."), ("An error", "No."), ("Nothing; VMs can't be tagged", "They can.")], "a", "Use Policy or tag inheritance.", TAGS)
qq("AZ900-3.1.4", 1, "multiple", "Which TWO are common uses of tags?", [("Grouping costs by department or project", "Correct."), ("Automating actions such as shutting down VMs by schedule", "Correct."), ("Encrypting data", "No."), ("Granting RBAC permissions", "Tags don't grant access.")], "ab", "Organisation, cost and automation.", TAGS)

# ================================================================ 3.2.1–3.2.3
lesson(
    id="az900-governance-compliance", exam=E, title="Microsoft Purview, Azure Policy and resource locks",
    objectives=["AZ900-3.2.1", "AZ900-3.2.2", "AZ900-3.2.3"], minutes=40,
    objective="Describe the purpose of Microsoft Purview, Azure Policy and resource locks, and how they work together with RBAC.",
    prereqs=[("RBAC", "AZ900-2.4.5", "az900-conditional-access-rbac"), ("Resource hierarchy", "AZ900-2.1.7", "az900-resource-hierarchy")],
    foundation=[
        "Microsoft Purview is a family of data governance, risk and compliance tools: it helps you find, classify and protect your data wherever it is (Azure, on-premises, Microsoft 365, other clouds).",
        "Azure Policy enforces rules on your Azure resources, such as 'only these regions' or 'storage must use HTTPS'. It can block non-compliant deployments, flag them, or fix them.",
        "Resource locks stop accidental deletion or change. CanNotDelete (shown as Delete) allows changes but not deletion; ReadOnly allows neither. Locks apply to everyone, even Owners.",
    ],
    engineer=[
        "Microsoft Purview: two main areas: risk and compliance (Microsoft 365 data: protect sensitive data in Teams, OneDrive, Exchange; manage data lifecycle; insider risk; compliance requirements) and unified data governance (data map that discovers and classifies data across sources such as Azure SQL, Azure Data Lake, on-premises SQL Server, Amazon S3, Power BI; data catalog; data lineage).",
        "Azure Policy: definitions (rules in JSON), initiatives (groups of policies, for example a regulatory standard), and assignments at a scope (management group, subscription, resource group, resource), inherited downward. Effects include Deny, Audit, Append, Modify, DeployIfNotExists and AuditIfNotExists.",
        "Policy evaluates resources when they're created or updated and periodically; the Compliance view lists non-compliant resources. Remediation tasks fix existing resources for Modify/DeployIfNotExists policies. Hundreds of built-in definitions exist; Defender for Cloud and regulatory compliance build on Policy.",
        "Resource locks: applied at subscription, resource group or resource; inherited by child resources. Order of checks: a request passes RBAC (are you allowed?), then Azure Policy (is it compliant?), then locks (is it locked?). To delete a locked resource, an Owner or User Access Administrator must remove the lock first.",
        "ReadOnly can have side effects: for example on a storage account it blocks listing keys, and on a VM it blocks start/restart because those are POST operations.",
    ],
    anim=("az900-governance-sim", "Send requests through RBAC, Azure Policy and locks, then pick the right governance tool."),
    diagram=([("req", "Request (create / change / delete)", 0, 80, "user"), ("rbac", "1. RBAC: allowed?", 230, 80, "identity"), ("pol", "2. Azure Policy: compliant?", 460, 80, "security"), ("lock", "3. Lock: CanNotDelete / ReadOnly", 690, 80, "security"), ("res", "Resource", 920, 80, "compute"), ("pv", "Microsoft Purview: data map and classification", 460, 230, "storage")],
             [("req", "rbac"), ("rbac", "pol"), ("pol", "lock"), ("lock", "res"), ("pv", "res", "scans data")]),
    example=("Keeping production safe", ["A retailer assigns 'Allowed locations' (Deny) and 'Require a tag' at its production management group. Developers who try to create resources in another region are blocked even with Contributor.",
                                         "The production database has a CanNotDelete lock, so even an Owner must remove it before deleting. Microsoft Purview scans the database and labels columns containing card numbers as sensitive."]),
    config=cfg(["Policy > Assignments > Assign policy; Policy > Compliance.", "Resource / resource group > Settings > Locks > Add.", "Microsoft Purview portal (purview.microsoft.com): Data Map, sources, scans."],
               "az policy assignment create --name allowed-locations --policy e56962a6-4747-49cd-b67b-bf8b01975c4c --params \"{\\\"listOfAllowedLocations\\\":{\\\"value\\\":[\\\"westeurope\\\",\\\"northeurope\\\"]}}\" --scope /subscriptions/<sub>\naz lock create --name keep --lock-type CanNotDelete -g rg-prod",
               "New-AzResourceLock -LockName keep -LockLevel CanNotDelete -ResourceGroupName rg-prod", perms=("Resource Policy Contributor to assign policies; Owner or User Access Administrator to create or delete locks",)),
    lab=lab("See RBAC, Policy and locks act on requests, and choose governance tools.", ["RBAC, Policy and locks together tab: run the default, then each preset.", "Governance tools tab: answer every need."],
            ["Locks block even Owners", "Policy denies regardless of role"], [("gov-allowed", "Saw an allowed request"), ("gov-policy-denied", "Policy denied a request"), ("gov-lock-blocked", "A lock blocked a request")] + chooser_checks("governance", "governance tool"),
            ["Using RBAC to restrict regions", "Expecting Owner to bypass a lock"]),
    troubleshooting=[("Deployment fails with 'RequestDisallowedByPolicy'.", "A Deny policy blocks the configuration.", "Change the deployment to comply, or request an exemption."),
                     ("Can't restart a VM in a resource group.", "A ReadOnly lock blocks POST operations.", "Use CanNotDelete instead, or remove the lock temporarily.")],
    comparisons=[("Azure Policy vs RBAC", "RBAC controls what users can do; Policy controls what resources can look like, for everyone."), ("CanNotDelete vs ReadOnly", "CanNotDelete allows changes; ReadOnly blocks changes too.")],
    misconceptions=[("Owners can delete locked resources.", "The lock must be removed first."), ("Azure Policy only reports.", "Deny blocks, Modify and DeployIfNotExists change resources."), ("Purview is only for Azure data.", "It covers on-premises, Microsoft 365 and other clouds.")],
    decisions=["Assign policies at management groups.", "Lock critical production resources with CanNotDelete.", "Use Purview to discover and classify sensitive data."],
    docs=[("Describe features and tools in Azure for governance and compliance (Learn)", GOV), ("What is Azure Policy?", ML + "azure/governance/policy/overview"), ("Lock your resources", ML + "azure/azure-resource-manager/management/lock-resources"), ("Learn about Microsoft Purview", ML + "purview/purview")],
)
qq("AZ900-3.2.1", 2, "scenario", "A company must discover and classify sensitive data across Azure SQL, on-premises SQL Server and Amazon S3. Which service?", [("Microsoft Purview", "Correct."), ("Azure Policy", "Resource rules."), ("Resource locks", "Deletion protection."), ("Azure Advisor", "Recommendations.")], "a", "Unified data governance.", ML + "purview/purview")
qq("AZ900-3.2.1", 1, "single", "What is Microsoft Purview?", [("A family of data governance, risk and compliance solutions", "Correct."), ("A VM backup service", "No."), ("A networking service", "No."), ("A cost tool", "No.")], "a", "Data governance and compliance.", GOV)
qq("AZ900-3.2.2", 2, "scenario", "Contributors must be prevented from creating resources outside West Europe and North Europe. What should you use?", [("Azure Policy with the Allowed locations definition (Deny)", "Correct."), ("A ReadOnly lock", "Blocks all changes."), ("Remove the Contributor role", "Too broad."), ("Tags", "Labels only.")], "a", "Policy restricts resource properties.", ML + "azure/governance/policy/overview")
qq("AZ900-3.2.2", 2, "single", "What is an Azure Policy initiative?", [("A group of policy definitions assigned together", "Correct."), ("A lock", "No."), ("An RBAC role", "No."), ("A budget", "No.")], "a", "Initiatives group related policies.", ML + "azure/governance/policy/overview")
qq("AZ900-3.2.3", 2, "scenario", "Admins must still be able to change a production database's settings, but nobody should delete it by accident. Which lock?", [("CanNotDelete", "Correct."), ("ReadOnly", "Blocks changes too."), ("No lock; use RBAC Reader", "Blocks changes."), ("A tag", "No protection.")], "a", "CanNotDelete allows updates.", ML + "azure/azure-resource-manager/management/lock-resources")
qq("AZ900-3.2.3", 2, "scenario", "An Owner tries to delete a resource group that has a CanNotDelete lock. What happens?", [("The deletion fails until the lock is removed", "Correct."), ("It succeeds because Owners bypass locks", "Locks apply to everyone."), ("Only empty resources are deleted", "No."), ("The lock is removed automatically", "No.")], "a", "Locks apply to all users.", ML + "azure/azure-resource-manager/management/lock-resources")

# ================================================================ 3.3.1–3.3.3
lesson(
    id="az900-management-tools", exam=E, title="Azure portal, Cloud Shell, Azure CLI, Azure PowerShell and Azure Arc",
    objectives=["AZ900-3.3.1", "AZ900-3.3.2", "AZ900-3.3.3"], minutes=35,
    objective="Describe the Azure portal, Azure Cloud Shell, Azure CLI and Azure PowerShell, and the purpose of Azure Arc.",
    prereqs=[("Management in the cloud", "AZ900-1.2.4", "az900-security-manageability")],
    foundation=[
        "Azure portal: a website (portal.azure.com) to create, manage and monitor everything in Azure with clicks, plus customisable dashboards.",
        "Azure CLI and Azure PowerShell: command-line tools to do the same things with commands, which you can save as scripts and repeat. CLI commands start with az; PowerShell uses cmdlets like Get-AzVM.",
        "Azure Cloud Shell: a command line in your browser, already signed in, with both tools installed. Nothing to install on your PC.",
        "Azure Arc: brings servers, Kubernetes clusters and databases running outside Azure (on-premises, other clouds) into Azure, so you manage them with the same tools.",
    ],
    engineer=[
        "Portal: build, manage and monitor from simple web apps to complex deployments; create custom dashboards; set accessibility options; designed for resiliency and continuous availability, present in every Azure datacenter, updated continuously with no downtime.",
        "Cloud Shell: choose Bash or PowerShell; authenticated with your Azure credentials; includes Azure CLI, Azure PowerShell and common tools (git, kubectl, terraform, editors); optional file share for persistent $HOME storage. Open from the portal toolbar or shell.azure.com.",
        "Azure CLI: cross-platform (Windows, macOS, Linux); syntax az <group> <command> --params, for example az vm create. Azure PowerShell: the Az module of cmdlets (Verb-Noun), for example New-AzVM; runs on Windows, macOS and Linux with PowerShell 7. Both are functionally equivalent for most tasks; pick the one your team knows. Both support interactive use and scripts.",
        "Azure Arc: manage servers (Windows/Linux), Kubernetes clusters, Azure data services (SQL Managed Instance, PostgreSQL) and SQL Server outside Azure. Once connected they appear as Azure resources (projected into Azure Resource Manager): apply Azure Policy, RBAC, tags, monitoring (Azure Monitor), security (Defender for Cloud) and updates consistently.",
        "Use Arc when: you have a hybrid or multicloud estate, need one governance model across environments, or want Azure services to run where your data lives.",
    ],
    anim=("az900-tools-sim", "Pick the management tool for each task and identify CLI and PowerShell commands."),
    diagram=([("portal", "Azure portal (GUI)", 0, 0, "user"), ("shell", "Cloud Shell (browser: Bash / PowerShell)", 0, 110, "user"), ("cli", "Azure CLI / PowerShell (local scripts)", 0, 220, "user"), ("arm", "Azure Resource Manager", 300, 110, "security"), ("az", "Azure resources", 580, 40, "compute"), ("arc", "Arc-enabled servers & Kubernetes (on-premises, AWS)", 580, 190, "compute")],
             [("portal", "arm"), ("shell", "arm"), ("cli", "arm"), ("arm", "az"), ("arm", "arc", "Azure Arc")]),
    example=("A hybrid operations team", ["Operators use the portal dashboards to watch production, run quick fixes from Cloud Shell on locked-down laptops, and schedule nightly Azure CLI scripts in a pipeline.",
                                          "120 on-premises Linux servers and an AWS Kubernetes cluster are connected with Azure Arc, so the same tagging policy and Defender for Cloud plans apply everywhere."]),
    config=cfg(["portal.azure.com: Dashboard > New dashboard.", "Portal toolbar > Cloud Shell icon (Bash or PowerShell).", "Azure Arc > Machines > Add/Create > Add a single server (generates an onboarding script)."],
               "az login\naz group list -o table\naz connectedmachine list -o table", "Connect-AzAccount\nGet-AzResourceGroup | Format-Table ResourceGroupName, Location\nGet-AzConnectedMachine"),
    lab=lab("Choose management tools.", ["Management tools tab: answer every task.", "Azure CLI, PowerShell, Cloud Shell tab: identify every command."],
            ["az = CLI; Verb-AzNoun = PowerShell", "Arc manages resources outside Azure"], chooser_checks("tools", "management tool") + chooser_checks("cli-or-ps", "tool"),
            ["Installing tools on a locked-down PC instead of using Cloud Shell"]),
    troubleshooting=[("'az' isn't recognised on a workstation.", "Azure CLI isn't installed.", "Install it or use Cloud Shell."),
                     ("On-premises servers don't appear in Azure Policy compliance.", "They aren't Arc-enabled.", "Onboard them with the Arc Connected Machine agent.")],
    comparisons=[("Azure CLI vs Azure PowerShell", "Same capabilities, different syntax: Bash-style commands vs PowerShell cmdlets and objects."), ("Azure Arc vs VPN", "Arc projects resources into Azure management; VPN only connects networks.")],
    misconceptions=[("Cloud Shell runs on your computer.", "It runs in Azure, in a container, accessed through the browser."), ("Azure PowerShell only runs on Windows.", "PowerShell 7 is cross-platform."), ("Arc migrates servers to Azure.", "They stay where they are; Arc manages them.")],
    decisions=["Use the portal to explore, scripts to repeat.", "Standardise on CLI or PowerShell per team.", "Use Arc for consistent hybrid governance."],
    docs=[("Describe features and tools for managing and deploying Azure resources (Learn)", TOOLS), ("Azure Cloud Shell", ML + "azure/cloud-shell/overview"), ("Azure CLI", ML + "cli/azure/what-is-azure-cli"), ("Azure PowerShell", ML + "powershell/azure/what-is-azure-powershell"), ("Azure Arc overview", ML + "azure/azure-arc/overview")],
)
qq("AZ900-3.3.1", 1, "single", "What can you do with Azure portal dashboards?", [("Create customised views of the resources and metrics you care about", "Correct."), ("Run nightly scripts", "Use CLI/PowerShell."), ("Enforce policies", "Azure Policy."), ("Connect on-premises servers", "Azure Arc.")], "a", "Custom dashboards.", TOOLS)
qq("AZ900-3.3.2", 2, "scenario", "An engineer must run Azure CLI commands from a shared PC where installing software is forbidden. What should they use?", [("Azure Cloud Shell", "Correct."), ("Install Azure CLI", "Not allowed."), ("Azure Arc", "Hybrid management."), ("ARM templates", "IaC files, still need a tool.")], "a", "Cloud Shell runs in the browser.", ML + "azure/cloud-shell/overview")
qq("AZ900-3.3.2", 2, "single", "Which command is Azure PowerShell?", [("Get-AzResourceGroup", "Correct."), ("az group list", "Azure CLI."), ("kubectl get pods", "Kubernetes."), ("azcopy list", "AzCopy.")], "a", "Verb-AzNoun cmdlets.", ML + "powershell/azure/what-is-azure-powershell")
qq("AZ900-3.3.3", 2, "scenario", "A company wants to apply Azure Policy and Defender for Cloud to servers in its own datacenter and in AWS without migrating them. What should it use?", [("Azure Arc", "Correct."), ("Azure Migrate", "Moves servers."), ("Azure Virtual Desktop", "Desktops."), ("ExpressRoute", "Network connectivity.")], "a", "Arc extends Azure management.", ML + "azure/azure-arc/overview")
qq("AZ900-3.3.3", 1, "multiple", "Which TWO can Azure Arc manage?", [("Windows and Linux servers outside Azure", "Correct."), ("Kubernetes clusters running in other clouds", "Correct."), ("Microsoft 365 mailboxes", "No."), ("Physical datacenter cooling", "No.")], "ab", "Servers, Kubernetes, data services.", ML + "azure/azure-arc/overview")

# ================================================================ 3.3.4–3.3.5
lesson(
    id="az900-iac-arm", exam=E, title="Infrastructure as code, Azure Resource Manager and ARM templates",
    objectives=["AZ900-3.3.4", "AZ900-3.3.5"], minutes=35,
    objective="Describe infrastructure as code, Azure Resource Manager, and the benefits of ARM templates and Bicep.",
    prereqs=[("Management tools", "AZ900-3.3.2", "az900-management-tools")],
    foundation=[
        "Infrastructure as code (IaC): describe your infrastructure in files (code) instead of clicking through the portal. Deploy the same file again and you get the same environment every time.",
        "Azure Resource Manager (ARM) is the deployment and management service for Azure. Every request (from the portal, CLI, PowerShell, SDKs or templates) goes through it, which applies authentication, RBAC, Policy and locks.",
        "ARM templates are JSON files that describe the resources you want. Bicep is a simpler language that compiles to ARM templates. Both are declarative: you say what you want, not how to build it.",
    ],
    engineer=[
        "Resource Manager benefits: manage infrastructure through declarative templates; deploy, manage and monitor resources as a group; redeploy consistently; define dependencies so resources deploy in the right order; apply access control (RBAC) and tags; see costs grouped by tag.",
        "ARM template benefits: declarative syntax; repeatable results (idempotent: deploy many times, same result); orchestration (Resource Manager orders dependent resources and deploys in parallel when possible); modular files (linked and nested templates); extensibility (deployment scripts); built-in validation before deployment; tracked deployments (history in the portal); what-if previews; export templates from existing resources.",
        "Deployment modes: Incremental (default: add or update resources in the template, leave others alone) and Complete (also delete resources in the resource group that aren't in the template).",
        "Bicep: concise syntax, type safety and modules; same capabilities as JSON ARM templates; deployed with the same commands (az deployment group create). Other IaC tools such as Terraform also work with Azure through Resource Manager.",
        "IaC practice: store templates in source control, review changes in pull requests, deploy with pipelines (GitHub Actions, Azure Pipelines), and parameterise per environment (dev, test, prod).",
    ],
    anim=("az900-iac-sim", "Compare manual steps with declarative templates, including re-runs and complete mode, and match ARM template benefits."),
    diagram=([("file", "main.bicep / ARM template (source control)", 0, 80, "user"), ("tools", "Portal, CLI, PowerShell, pipelines", 0, 220, "user"), ("arm", "Azure Resource Manager: auth, RBAC, Policy, validation", 300, 150, "security"), ("vnet", "VNet", 600, 60, "network"), ("vm", "VM (depends on VNet)", 600, 160, "compute"), ("st", "Storage", 600, 260, "storage")],
             [("file", "arm", "deploy"), ("tools", "arm"), ("arm", "vnet"), ("arm", "vm"), ("arm", "st"), ("vnet", "vm", "dependency")]),
    example=("Three identical environments", ["A team defines its app's VNet, App Service and SQL database in one Bicep file with parameters for size and name. A pipeline deploys it to dev, test and prod.",
                                              "When a setting changes, they edit the file and redeploy: only the difference is applied. A what-if run before production shows exactly what will change."]),
    config=cfg(["Resource group > Deployments: history and templates.", "Any resource group > Export template.", "Create a resource > Template deployment (deploy using custom templates)."],
               "az deployment group what-if -g rg-app --template-file main.bicep --parameters env=test\naz deployment group create -g rg-app --template-file main.bicep --parameters env=test",
               "New-AzResourceGroupDeployment -ResourceGroupName rg-app -TemplateFile main.bicep -env test -WhatIf",
               bicep="param env string\nparam location string = resourceGroup().location\n\nresource st 'Microsoft.Storage/storageAccounts@2023-05-01' = {\n  name: 'st${env}${uniqueString(resourceGroup().id)}'\n  location: location\n  sku: { name: 'Standard_LRS' }\n  kind: 'StorageV2'\n  tags: { env: env }\n}"),
    lab=lab("See why declarative templates are repeatable.", ["Manual steps vs ARM templates tab: run the default, then each preset.", "Benefits of ARM templates tab: answer every statement."],
            ["Templates give the same result every time", "Complete mode deletes resources not in the template"],
            [("iac-repeatable", "Deployed consistently"), ("iac-drift", "Saw manual drift"), ("iac-complete-delete", "Saw complete mode delete a resource")] + chooser_checks("iac-benefit", "template benefit"),
            ["Using complete mode on a shared resource group", "Rebuilding environments by hand"]),
    troubleshooting=[("A resource disappeared after a template deployment.", "Complete mode removed resources not in the template.", "Use incremental mode, or add the resource to the template; run what-if first."),
                     ("Deployment fails because the VM is created before its NIC.", "Missing dependency.", "Reference the NIC (Bicep infers dependencies) or add dependsOn.")],
    comparisons=[("Declarative vs imperative", "Templates describe the end state; scripts list commands to run in order."), ("ARM JSON vs Bicep", "Same engine; Bicep is shorter and easier to read and compiles to JSON.")],
    misconceptions=[("Templates are only for creating resources once.", "Redeploying updates resources to match the file."), ("ARM is only used by templates.", "Every Azure management request goes through Resource Manager."), ("Bicep needs a separate deployment service.", "It deploys through Resource Manager.")],
    decisions=["Keep infrastructure in source control as Bicep.", "Use incremental mode and what-if by default.", "Deploy with pipelines, not by hand."],
    docs=[("Describe features and tools for managing and deploying Azure resources (Learn)", TOOLS), ("Azure Resource Manager overview", ML + "azure/azure-resource-manager/management/overview"), ("ARM templates overview", ML + "azure/azure-resource-manager/templates/overview"), ("What is Bicep?", ML + "azure/azure-resource-manager/bicep/overview"), ("Deployment modes", ML + "azure/azure-resource-manager/templates/deployment-modes")],
)
qq("AZ900-3.3.4", 2, "single", "What is infrastructure as code?", [("Managing and provisioning infrastructure through definition files rather than manual steps", "Correct."), ("Writing application code on VMs", "No."), ("A type of serverless function", "No."), ("Encrypting infrastructure", "No.")], "a", "Infrastructure defined in files.", TOOLS)
qq("AZ900-3.3.4", 2, "scenario", "A team must create identical dev, test and production environments and track changes in source control. What should they use?", [("Bicep or ARM templates", "Correct."), ("Manual portal steps", "Not repeatable."), ("Azure Advisor", "Recommendations."), ("Resource locks", "Protection.")], "a", "Declarative IaC.", ML + "azure/azure-resource-manager/bicep/overview")
qq("AZ900-3.3.5", 2, "single", "Which service handles every Azure management request from the portal, CLI, PowerShell and templates?", [("Azure Resource Manager", "Correct."), ("Azure Arc", "Extends ARM to external resources."), ("Azure Monitor", "Monitoring."), ("Microsoft Entra ID", "Identity; ARM uses it to authenticate.")], "a", "ARM is the management layer.", ML + "azure/azure-resource-manager/management/overview")
qq("AZ900-3.3.5", 2, "scenario", "You deploy an ARM template in Complete mode to a resource group that contains a storage account not defined in the template. What happens to it?", [("It is deleted", "Correct."), ("It's left unchanged", "That's incremental mode."), ("Deployment fails", "No."), ("It's moved to another group", "No.")], "a", "Complete mode removes undefined resources.", ML + "azure/azure-resource-manager/templates/deployment-modes")
qq("AZ900-3.3.5", 1, "single", "What does it mean that ARM templates are declarative?", [("You define what resources you want, not the steps to create them", "Correct."), ("They run commands in order", "Imperative."), ("They only declare costs", "No."), ("They can't be reused", "They're repeatable.")], "a", "Desired state.", ML + "azure/azure-resource-manager/templates/overview")

# ================================================================ 3.4.1–3.4.2
lesson(
    id="az900-advisor-service-health", exam=E, title="Azure Advisor and Azure Service Health",
    objectives=["AZ900-3.4.1", "AZ900-3.4.2"], minutes=25,
    objective="Describe Azure Advisor recommendations and how Azure Service Health (Azure status, Service Health, Resource Health) keeps you informed.",
    prereqs=[("Defender for Cloud", "AZ900-2.4.8", "az900-zero-trust-defender")],
    foundation=[
        "Azure Advisor looks at how your resources are configured and used, and gives personalised recommendations to make them more reliable, secure, fast and cheap.",
        "Azure Service Health tells you about problems in Azure itself. It has three views: Azure status (public, worldwide), Service Health (only what affects your services and regions) and Resource Health (your individual resources).",
    ],
    engineer=[
        "Advisor categories: Reliability (formerly High Availability: continuity of business-critical apps), Security (threats and vulnerabilities, from Defender for Cloud), Performance (speed), Cost (reduce spend), Operational excellence (process and workflow efficiency, manageability, deployment best practices). Each recommendation has an impact level and suggested actions, often one-click.",
        "Advisor features: Advisor score, recommendations dashboard, filter by subscription/resource group, alerts when new recommendations appear, export to PDF/CSV, postpone or dismiss recommendations.",
        "Azure status: a global public page of Azure service health across all regions; useful for wide outages; no sign-in needed.",
        "Service Health: personalised view in the portal of four event types: service issues (problems affecting you now), planned maintenance, health advisories (changes needing action, such as feature retirements) and security advisories. Set up Service Health alerts with action groups to notify teams.",
        "Resource Health: current and past health of each of your resources (available, unavailable, degraded, unknown) and whether a platform issue caused downtime; useful for support cases and SLA claims.",
    ],
    anim=("az900-health-sim", "Match recommendations to Advisor categories, then choose Azure status, Service Health or Resource Health."),
    diagram=([("adv", "Azure Advisor: 5 categories of recommendations", 0, 0, "scope"), ("status", "Azure status: global, public", 300, -40, "globe"), ("sh", "Service Health: your services and regions", 300, 70, "security"), ("rh", "Resource Health: each resource", 300, 180, "compute"), ("alert", "Service Health alert → action group", 600, 70, "user")],
             [("status", "sh", "narrows to you"), ("sh", "rh", "narrows to a resource"), ("sh", "alert")]),
    example=("Monday morning ops review", ["Advisor shows 12 recommendations: resize 4 idle VMs (Cost), add zones to the order database (Reliability), enable MFA for 3 admins (Security).",
                                            "Service Health shows planned maintenance in West Europe next week and a health advisory about a retiring VM series. A Service Health alert already emailed the on-call channel. Resource Health confirms last night's VM outage was a platform issue."]),
    config=cfg(["Advisor > Recommendations; Advisor > Alerts.", "Service Health > Service issues / Planned maintenance / Health advisories > Create service health alert.", "Any resource > Help > Resource health."],
               "az advisor recommendation list --category Cost -o table\naz monitor activity-log list --offset 7d --query \"[?category.value=='ServiceHealth']\" -o table",
               "Get-AzAdvisorRecommendation -Category Cost"),
    lab=lab("Match Advisor categories and pick the right health view.", ["Azure Advisor categories tab: answer every recommendation.", "Azure status, Service Health, Resource Health tab: answer every question."],
            ["Advisor has five categories", "Service Health is personalised; Azure status is global"], chooser_checks("advisor-category", "Advisor category") + chooser_checks("health-scope", "health view"),
            ["Checking Azure status for an issue only affecting your region", "Ignoring health advisories about retirements"]),
    troubleshooting=[("Team wasn't told about planned maintenance.", "No Service Health alert configured.", "Create a Service Health alert with an action group."),
                     ("Advisor shows no recommendations for a new subscription.", "Advisor needs time and resources to analyse.", "Check again later; refresh recommendations.")],
    comparisons=[("Advisor vs Defender for Cloud", "Advisor covers five categories; its security recommendations come from Defender for Cloud."), ("Service Health vs Azure Monitor", "Service Health reports Azure platform health; Azure Monitor reports your resources' own telemetry.")],
    misconceptions=[("Azure status shows everything affecting you.", "It shows widespread issues; Service Health is personalised."), ("Advisor changes resources automatically.", "It recommends; you act (some quick fixes are one click).")],
    decisions=["Review Advisor weekly; track Advisor score.", "Create Service Health alerts for all production subscriptions.", "Use Resource Health when investigating downtime."],
    docs=[("Describe monitoring tools in Azure (Learn)", MON), ("Azure Advisor overview", ML + "azure/advisor/advisor-overview"), ("Azure Service Health overview", ML + "azure/service-health/overview"), ("Resource Health overview", ML + "azure/service-health/resource-health-overview"), ("Azure status overview", ML + "azure/service-health/azure-status-overview")],
)
qq("AZ900-3.4.1", 2, "single", "Which is NOT an Azure Advisor recommendation category?", [("Compliance", "Correct: not an Advisor category."), ("Reliability", "Category."), ("Cost", "Category."), ("Operational excellence", "Category.")], "a", "Reliability, Security, Performance, Cost, Operational excellence.", ML + "azure/advisor/advisor-overview")
qq("AZ900-3.4.1", 2, "scenario", "You want recommendations to resize underused VMs and buy reservations. Where do you look?", [("Azure Advisor (Cost)", "Correct."), ("Azure Service Health", "Platform health."), ("Azure Policy", "Rules."), ("Microsoft Purview", "Data governance.")], "a", "Advisor cost recommendations.", ML + "azure/advisor/advisor-overview")
qq("AZ900-3.4.2", 2, "scenario", "You want to be notified of planned maintenance that affects only the regions and services you use. What should you configure?", [("A Service Health alert", "Correct."), ("Azure status page bookmark", "Global, not personalised."), ("An Advisor alert", "Recommendations."), ("A budget", "Cost.")], "a", "Personalised platform notifications.", ML + "azure/service-health/overview")
qq("AZ900-3.4.2", 2, "scenario", "A VM was unavailable last night. How can you check whether an Azure platform issue caused it?", [("Resource Health for that VM", "Correct."), ("Azure Advisor", "Recommendations."), ("Cost analysis", "Spend."), ("The pricing calculator", "Estimates.")], "a", "Resource Health shows per-resource history.", ML + "azure/service-health/resource-health-overview")

# ================================================================ 3.4.3
lesson(
    id="az900-azure-monitor", exam=E, title="Azure Monitor, Log Analytics, alerts and Application Insights",
    objectives=["AZ900-3.4.3"], minutes=35,
    objective="Describe Azure Monitor, including Log Analytics, Azure Monitor alerts and Application Insights.",
    prereqs=[("Service Health", "AZ900-3.4.2", "az900-advisor-service-health")],
    foundation=[
        "Azure Monitor collects data about your resources and apps (in Azure, on-premises and other clouds), analyses it and helps you act on it.",
        "Two main data types: metrics (numbers over time, like CPU %) and logs (records of events, like errors or sign-ins).",
        "Log Analytics is where you query logs. Alerts tell you when something needs attention. Application Insights watches your web apps: requests, failures, response times.",
    ],
    engineer=[
        "Data sources: application, operating system (with the Azure Monitor Agent and data collection rules), Azure resources (platform metrics collected automatically; resource logs via diagnostic settings), subscription (Activity log: who did what, when) and tenant (Entra ID logs). Custom sources via APIs.",
        "Metrics: lightweight, near real-time, stored in a time-series database; view in Metrics explorer. Logs: stored in a Log Analytics workspace; query with Kusto Query Language (KQL) in Log Analytics; e.g. Heartbeat | summarize count() by Computer.",
        "Azure Monitor alerts: alert rules evaluate metrics (metric alerts), log queries (log search alerts) or the Activity log (activity log alerts, including Service Health); when triggered they call action groups (email, SMS, push, voice, webhook, Logic App, Function, ITSM). Alert processing rules can suppress or route alerts.",
        "Application Insights: application performance monitoring (APM) for web apps on Azure, on-premises or other clouds. Enable with auto-instrumentation or an SDK (OpenTelemetry). Tracks request rates, response times, failure rates, dependency calls, exceptions, page views, user and session counts, and performance counters; availability tests ping your endpoints. Workspace-based, stored in Log Analytics.",
        "Visualise and act: dashboards, workbooks, Power BI, Grafana; autoscale and automated responses from alerts.",
    ],
    anim=("az900-monitor-sim", "Collect the right data, choose the alert type and notify people; pick the monitoring service for each question."),
    diagram=([("src", "Sources: apps, OS, resources, Activity log", 0, 100, "compute"), ("met", "Metrics", 280, 30, "storage"), ("logs", "Logs: Log Analytics workspace (KQL)", 280, 170, "storage"), ("ai", "Application Insights", 0, 250, "compute"), ("alert", "Alert rule", 560, 100, "security"), ("ag", "Action group: email, SMS, webhook", 800, 100, "user")],
             [("src", "met"), ("src", "logs"), ("ai", "logs"), ("met", "alert"), ("logs", "alert"), ("alert", "ag")]),
    example=("An online bank's monitoring", ["Platform metrics show database DTU; a metric alert emails DBAs when it stays above 90%. The Azure Monitor Agent sends VM security event logs to a Log Analytics workspace, where a log search alert flags repeated failed sign-ins.",
                                             "Application Insights shows that the payment page's response time doubled after a release and pinpoints a slow dependency call."]),
    config=cfg(["Monitor > Metrics; Monitor > Logs (KQL); Monitor > Alerts > Create alert rule; Monitor > Action groups.", "Resource > Diagnostic settings: send resource logs to a workspace.", "Create a resource > Application Insights; or App Service > Application Insights > Turn on."],
               "az monitor metrics list --resource <vm-id> --metric \"Percentage CPU\" --interval PT5M\naz monitor log-analytics query -w <workspace-guid> --analytics-query \"Heartbeat | summarize count() by Computer\"\naz monitor action-group create -g <rg> -n oncall --short-name oncall --action email ops ops@contoso.com",
               "Get-AzMetric -ResourceId <vm-id> -MetricName 'Percentage CPU'\nInvoke-AzOperationalInsightsQuery -WorkspaceId <guid> -Query 'Heartbeat | take 10'",
               limits=("Log ingestion and retention beyond included amounts are billed", "Platform metrics are kept 93 days")),
    lab=lab("Build a working alert and choose monitoring services.", ["From data to alert tab: run the default, then each preset.", "Monitoring tools tab: answer every question."],
            ["Guest OS logs need the agent and a data collection rule", "Alerts need an action group to notify"],
            [("monitor-alert-ok", "Built a working alert"), ("monitor-alert-broken", "Found a gap in the alert chain")] + chooser_checks("monitoring", "monitoring service"),
            ["Expecting guest OS logs without an agent", "Creating alerts without an action group"]),
    troubleshooting=[("Log query returns no data from a VM.", "No Azure Monitor Agent or data collection rule.", "Install the agent and associate a DCR with the VM."),
                     ("Alert fires but nobody is told.", "No action group on the rule.", "Attach an action group.")],
    comparisons=[("Metrics vs logs", "Metrics: numeric, fast, near real-time. Logs: rich records, queried with KQL."), ("Application Insights vs Log Analytics", "App Insights collects app telemetry; Log Analytics is the query tool and workspace store."), ("Azure Monitor vs Service Health", "Monitor: your resources; Service Health: the Azure platform.")],
    misconceptions=[("Azure Monitor only works for Azure resources.", "It also monitors on-premises and other clouds."), ("Application Insights is only for .NET.", "It supports many languages via OpenTelemetry."), ("All logs are collected automatically.", "Resource logs need diagnostic settings; OS logs need the agent.")],
    decisions=["Send resource logs to a central workspace.", "Use metric alerts for fast numeric signals; log alerts for patterns.", "Enable Application Insights for every web app."],
    docs=[("Describe monitoring tools in Azure (Learn)", MON), ("Azure Monitor overview", ML + "azure/azure-monitor/overview"), ("Log Analytics overview", ML + "azure/azure-monitor/logs/log-analytics-overview"), ("Azure Monitor alerts", ML + "azure/azure-monitor/alerts/alerts-overview"), ("Application Insights", ML + "azure/azure-monitor/app/app-insights-overview")],
)
qq("AZ900-3.4.3", 2, "scenario", "You must query a week of security events from many VMs using KQL. Which Azure Monitor feature?", [("Log Analytics", "Correct."), ("Metrics explorer", "Numbers, not events."), ("Azure Advisor", "Recommendations."), ("Service Health", "Platform health.")], "a", "KQL over logs in a workspace.", ML + "azure/azure-monitor/logs/log-analytics-overview")
qq("AZ900-3.4.3", 2, "scenario", "Developers want to see failed requests, slow dependencies and exceptions in their web app. What should they enable?", [("Application Insights", "Correct."), ("Azure Service Health", "Platform."), ("Resource locks", "No."), ("Azure Arc", "Hybrid management.")], "a", "APM for apps.", ML + "azure/azure-monitor/app/app-insights-overview")
qq("AZ900-3.4.3", 2, "single", "What does an action group do in Azure Monitor alerts?", [("Defines who is notified and what automated actions run when an alert fires", "Correct."), ("Groups VMs for scaling", "Scale sets."), ("Collects logs", "Agents and diagnostic settings."), ("Sets budgets", "Cost Management.")], "a", "Notifications and actions.", ML + "azure/azure-monitor/alerts/alerts-overview")
qq("AZ900-3.4.3", 3, "troubleshooting", "A log search alert on Windows event logs never fires, though errors occur. The VM has no extensions installed. What is the most likely cause?", [("The Azure Monitor Agent and a data collection rule aren't sending the logs to the workspace", "Correct."), ("Metric alerts can't be used for VMs", "Not related."), ("The VM is in the Hot tier", "No such thing."), ("Application Insights is disabled", "Not for OS logs.")], "a", "Guest OS logs need the agent.", ML + "azure/azure-monitor/overview")

# ---------------------------------------------------------------- extra practice
qq("AZ900-3.3.1", 2, "scenario", "A manager wants one screen showing the health and cost tiles of the team's key resources. What should you create in the Azure portal?", [("A custom dashboard", "Correct."), ("A resource lock", "No."), ("An ARM template", "Deployment."), ("A management group", "Organisation.")], "a", "Dashboards combine tiles.", TOOLS)
