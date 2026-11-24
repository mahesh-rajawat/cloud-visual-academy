"""AZ-900 domain 2: Describe Azure architecture and services (35–40%). Twelve focused lessons."""
from _az900 import E, ML, TR, anim, cfg, chooser_checks, lab, qq
from builder import lesson

ARCH = TR + "describe-core-architectural-components-of-azure/"
CN = TR + "describe-azure-compute-networking-services/"
STO = TR + "describe-azure-storage-services/"
IDS = TR + "describe-azure-identity-access-security/"

anim("az900-regions-sim", "Regions, region pairs, zones and datacenters", ["AZ900-2.1.1", "AZ900-2.1.2", "AZ900-2.1.3"], "Inject failures at rack, datacenter and region scope against different deployments, and name each part of Azure's physical infrastructure.", "accurate-model")
anim("az900-hierarchy-sim", "Resources, resource groups, subscriptions and management groups", ["AZ900-2.1.4", "AZ900-2.1.5", "AZ900-2.1.6", "AZ900-2.1.7"], "Assign at a scope and see what inherits it; pick the right level of the hierarchy for each need.", "accurate-model")
anim("az900-compute-sim", "Compute types and virtual machine options", ["AZ900-2.2.1", "AZ900-2.2.2"], "Pick VMs, containers or functions for each requirement, and choose availability sets, zones, scale sets or Azure Virtual Desktop.")
anim("az900-vm-hosting-sim", "VM resources and application hosting", ["AZ900-2.2.3", "AZ900-2.2.4"], "Build a VM from its required resources (size, disk, VNet, NIC, IP, NSG), and choose where to host each application.")
anim("az900-vnet-sim", "Virtual networking", ["AZ900-2.2.5"], "Pick VNets, subnets, peering, Azure DNS, VPN Gateway or ExpressRoute for each connectivity need.")
anim("az900-endpoints-sim", "Public and private endpoints", ["AZ900-2.2.6"], "Reach a storage account from the internet, the VNet or on-premises with different public access and private endpoint settings.", "accurate-model")
anim("az900-storage-sim", "Storage services and account types", ["AZ900-2.3.1", "AZ900-2.3.4"], "Pick Blob, Files, Queue, Table or Disk storage, and the storage account type, for each requirement.")
anim("az900-redundancy-sim", "Storage redundancy and access tiers", ["AZ900-2.3.2", "AZ900-2.3.3"], "Inject datacenter and region failures against LRS, ZRS, GRS and GZRS (with and without read access), and choose access tiers.", "accurate-model")
anim("az900-migration-sim", "Moving files and migrating to Azure", ["AZ900-2.3.5", "AZ900-2.3.6"], "Estimate transfer time and choose AzCopy, Storage Explorer, File Sync, Azure Migrate or Data Box.")
anim("az900-entra-sim", "Directory services, authentication and external identities", ["AZ900-2.4.1", "AZ900-2.4.2", "AZ900-2.4.3"], "Pick Entra ID, Domain Services or External ID; match SSO, MFA and passwordless; sign in as an employee or guest.")
anim("az900-access-sim", "Conditional Access and Azure RBAC", ["AZ900-2.4.4", "AZ900-2.4.5"], "Sign in from different locations with different methods and roles, and pick the least-privileged built-in role.")
anim("az900-defense-sim", "Zero Trust, defense in depth and Defender for Cloud", ["AZ900-2.4.6", "AZ900-2.4.7", "AZ900-2.4.8"], "Close gaps layer by layer with Defender for Cloud guidance, and match practices to Zero Trust principles and defense layers.")

# ================================================================ 2.1.1–2.1.3
lesson(
    id="az900-regions-zones", exam=E, title="Regions, region pairs, sovereign regions, availability zones and datacenters",
    objectives=["AZ900-2.1.1", "AZ900-2.1.2", "AZ900-2.1.3"], minutes=35,
    objective="Describe Azure's physical infrastructure (datacenters, availability zones, regions, region pairs and sovereign regions) and what failure each protects against.",
    prereqs=[("High availability", "AZ900-1.2.1", "az900-availability-scalability")],
    foundation=[
        "Datacenter: a building full of servers with its own power, cooling and networking. You never pick a datacenter directly.",
        "Region: a geographic area (for example West Europe) with one or more datacenters linked by a fast, low-latency network. You choose a region when you create most resources.",
        "Availability zone: a physically separate location inside a region (one or more datacenters) with independent power, cooling and networking. Regions that support zones have at least three.",
        "Region pair: two regions in the same geography (for example UK South and UK West) that Microsoft treats as partners for updates and disaster recovery. Sovereign regions are separate instances of Azure for governments or specific countries.",
    ],
    engineer=[
        "Regions: more than 60 worldwide. Choose by latency to users, data residency, service availability and price. Some services are global (for example Microsoft Entra ID, Azure DNS, Front Door) and have no region.",
        "Availability zones: zonal services pin a resource to one zone (a VM in zone 1); zone-redundant services replicate across zones automatically (ZRS storage, zone-redundant SQL). Using zones protects against a datacenter failure and enables higher SLAs; there may be a small data transfer cost between zones.",
        "Region pairs: each pair is at least 300 miles apart where possible, platform updates are rolled out to one region of a pair at a time, and one region of each pair is prioritised for recovery in a broad outage. Some services (such as GRS storage) replicate to the paired region. Most pairs are bidirectional; some newer regions have no pair and rely on zones.",
        "Sovereign regions: Azure Government (US government agencies and partners, physically and logically isolated, screened personnel) and Azure operated by 21Vianet (China; Microsoft doesn't directly operate the datacenters).",
        "Failure scopes: rack/host → availability sets or zones; datacenter → availability zones; region → a second region (pair or another region) with replication and failover.",
    ],
    anim=("az900-regions-sim", "Inject failures at rack, datacenter and region scope, then name each part of the infrastructure."),
    diagram=([("geo", "Geography: Europe", 0, 80, "scope"), ("r1", "Region: West Europe", 220, 0, "scope"), ("r2", "Region: North Europe (pair)", 220, 170, "scope"), ("z1", "Zone 1", 460, -40, "compute"), ("z2", "Zone 2", 460, 40, "compute"), ("z3", "Zone 3", 460, 120, "compute")],
             [("geo", "r1"), ("geo", "r2"), ("r1", "r2", "pair"), ("r1", "z1"), ("r1", "z2"), ("r1", "z3")]),
    example=("A payment API", ["A payment provider runs its API on VMs in three availability zones in West Europe, so losing a datacenter doesn't stop payments.",
                                "Its storage uses GRS replicated to North Europe, the pair region, so it can recover from a regional disaster. A US agency customer runs a separate copy in Azure Government."]),
    config=cfg(["Create a resource > Region and Availability options (No redundancy / Availability zone / Availability set).", "Azure portal home > All services > 'Regions' map in the Azure global infrastructure site."],
               "az account list-locations --query \"[].{name:name, pair:metadata.pairedRegion[0].name}\" -o table\naz vm create -g <rg> -n vm1 --image Ubuntu2404 --zone 1 --generate-ssh-keys", "Get-AzLocation | Select-Object Location, DisplayName"),
    lab=lab("See which deployments survive which failures, and name infrastructure parts.", ["Regions, zones and pairs tab: try each deployment against each failure.", "Regions, zones and datacenters tab: answer every description."],
            ["Zones survive a datacenter failure but not a region outage", "Region pairs protect against regional disasters"],
            [("region-survived", "Deployment survived a failure"), ("region-outage", "Saw an outage")] + chooser_checks("geography", "infrastructure term"),
            ["Assuming zones protect against a whole-region outage", "Assuming every service exists in every region"]),
    troubleshooting=[("Zone option is greyed out when creating a VM.", "The region or VM size doesn't support availability zones.", "Pick a zone-enabled region or another size."),
                     ("A service isn't available in the chosen region.", "Service availability varies by region.", "Check 'Products available by region' and choose another region.")],
    comparisons=[("Availability set vs availability zone", "Sets spread VMs across racks in one datacenter; zones across datacenters."), ("Region vs geography", "A geography (for example Europe) contains several regions and defines data residency boundaries.")],
    misconceptions=[("Every region has availability zones.", "Many do, not all."), ("You can choose the datacenter.", "You choose region and zone; Azure abstracts datacenters."), ("Region pairs replicate everything automatically.", "Only services you configure for it (for example GRS) replicate.")],
    decisions=["Use zones for production workloads in zone-enabled regions.", "Plan a second region for disaster recovery of critical systems.", "Pick regions close to users and within required data boundaries."],
    docs=[("Describe the core architectural components of Azure (Learn)", ARCH), ("What are availability zones?", ML + "azure/reliability/availability-zones-overview"), ("Azure region pairs and nonpaired regions", ML + "azure/reliability/cross-region-replication-azure"), ("Azure Government", ML + "azure/azure-government/documentation-government-welcome")],
)
qq("AZ900-2.1.1", 2, "scenario", "A US federal agency needs Azure services in a physically isolated environment operated by screened US personnel. What should it use?", [("Azure Government", "Correct: a sovereign region."), ("Any US region", "Not isolated."), ("Availability zones", "Within a commercial region."), ("A region pair", "No.")], "a", "Sovereign regions isolate Azure for compliance.", ML + "azure/azure-government/documentation-government-welcome")
qq("AZ900-2.1.1", 2, "single", "Why are platform updates rolled out to only one region of a pair at a time?", [("To reduce the risk of both regions being affected by a faulty update", "Correct."), ("To save electricity", "No."), ("Because pairs share one datacenter", "They don't."), ("To meet SLA credits", "No.")], "a", "Sequential updates protect the pair.", ML + "azure/reliability/cross-region-replication-azure")
qq("AZ900-2.1.2", 1, "single", "What does an availability zone protect against?", [("Failure of a datacenter within a region", "Correct."), ("Failure of an entire region", "Use another region."), ("Accidental deletion", "Use locks or backups."), ("A misconfigured NSG", "No.")], "a", "Zones are physically separate within a region.", ML + "azure/reliability/availability-zones-overview")
qq("AZ900-2.1.2", 2, "single", "What is the minimum number of availability zones in a zone-enabled region?", [("Three", "Correct."), ("Two", "No."), ("One", "No."), ("Six", "No.")], "a", "Zone-enabled regions have at least three zones.", ML + "azure/reliability/availability-zones-overview")
qq("AZ900-2.1.3", 1, "single", "Which statement about Azure datacenters is true?", [("They are grouped into availability zones and regions; you don't choose one directly", "Correct."), ("You select a datacenter when creating a VM", "No."), ("Each region has exactly one datacenter", "Can have several."), ("They are only in the US", "Worldwide.")], "a", "Datacenters are abstracted.", ARCH)

# ================================================================ 2.1.4–2.1.7
lesson(
    id="az900-resource-hierarchy", exam=E, title="Resources, resource groups, subscriptions and management groups",
    objectives=["AZ900-2.1.4", "AZ900-2.1.5", "AZ900-2.1.6", "AZ900-2.1.7"], minutes=40,
    objective="Describe resources, resource groups, subscriptions and management groups, and how settings flow down the hierarchy.",
    prereqs=[("Regions", "AZ900-2.1.1", "az900-regions-zones")],
    foundation=[
        "Resource: anything you create in Azure: a VM, a storage account, a database, a virtual network.",
        "Resource group: a folder for resources that share a lifecycle (for example everything for one app). Every resource is in exactly one group; groups can't be nested. Delete the group and you delete everything in it.",
        "Subscription: a billing and access boundary. All resource groups live in a subscription, and you get one bill per subscription.",
        "Management group: a container for subscriptions, so you can apply policies and access to many subscriptions at once. Hierarchy from the top: management groups → subscriptions → resource groups → resources.",
    ],
    engineer=[
        "Resource groups: can contain resources from different regions; the group's own location only stores its metadata. You can move most resources between groups. Apply RBAC, policies, locks and tags at the group level to cover all its resources.",
        "Subscriptions: two boundary types: billing (separate invoices, for example per department) and access control (different RBAC and policies). Organisations create separate subscriptions for environments (dev/test/prod), departments or compliance needs. Subscriptions trust one Microsoft Entra tenant.",
        "Management groups: up to 10,000 in a tenant, up to six levels of depth (not counting the root and subscription level), each management group and subscription has one parent. All sit under the tenant root group.",
        "Inheritance: RBAC role assignments and Azure Policy assignments made at a higher scope are inherited by everything below. Tags are NOT inherited by default.",
        "Typical structure: Root → Platform / Landing zones / Sandbox management groups → Prod and Dev subscriptions → resource groups per application.",
    ],
    anim=("az900-hierarchy-sim", "Assign at a scope and see what inherits it; pick the right hierarchy level for each need."),
    diagram=([("root", "Tenant root management group", 260, -60, "security"), ("mg", "Management group: Production", 260, 40, "security"), ("s1", "Subscription: Sales", 120, 140, "scope"), ("s2", "Subscription: HR", 400, 140, "scope"), ("rg", "Resource group: rg-web", 120, 240, "storage"), ("vm", "Resource: VM", 120, 340, "compute")],
             [("root", "mg"), ("mg", "s1"), ("mg", "s2"), ("s1", "rg"), ("rg", "vm")]),
    example=("A growing company", ["Contoso puts each app in its own resource group so it can be deployed and deleted as a unit. Sales and HR each get a subscription so their costs appear on separate invoices.",
                                   "A 'Production' management group holds both subscriptions; an allowed-regions policy assigned there applies to every resource in them."]),
    config=cfg(["Management groups: create the hierarchy and move subscriptions into it.", "Subscriptions > Access control (IAM) / Policies.", "Resource groups > Create; Resource group > Delete resource group."],
               "az account management-group create --name mg-prod\naz account management-group subscription add --name mg-prod --subscription <sub-id>\naz group create -n rg-web -l westeurope",
               "New-AzManagementGroup -GroupName mg-prod\nNew-AzResourceGroup -Name rg-web -Location westeurope"),
    lab=lab("Understand scope and inheritance.", ["Resource hierarchy tab: assign at each scope and test each target; try nesting resource groups.", "Which level of the hierarchy? tab: answer every need."],
            ["Assignments flow down, never up", "Resource groups can't be nested"], [("hierarchy-applies", "Saw an assignment inherited"), ("hierarchy-blocked", "Saw why something doesn't apply")] + chooser_checks("scope-level", "hierarchy level"),
            ["Expecting a resource-group assignment to affect the subscription"]),
    troubleshooting=[("Deleting a resource group removed a database someone still needed.", "Deleting a group deletes all its resources.", "Group by lifecycle and use CanNotDelete locks."),
                     ("A policy doesn't apply to a new subscription.", "The subscription isn't under the management group where the policy is assigned.", "Move the subscription into that management group.")],
    comparisons=[("Resource group vs subscription", "Groups organise resources by lifecycle; subscriptions are billing and access boundaries."), ("Management group vs tag", "Management groups structure subscriptions for policy and access; tags are metadata for reporting.")],
    misconceptions=[("A resource can be in two resource groups.", "Exactly one."), ("Resources must be in the same region as their resource group.", "They can be in any region."), ("Tags are inherited like policies.", "Not by default.")],
    decisions=["Group resources by lifecycle.", "Use subscriptions for billing and isolation boundaries.", "Assign governance at management groups."],
    docs=[("Describe the core architectural components of Azure (Learn)", ARCH), ("Management groups overview", ML + "azure/governance/management-groups/overview"), ("Resource Manager overview: resource groups", ML + "azure/azure-resource-manager/management/overview"), ("Organize subscriptions (Cloud Adoption Framework)", ML + "azure/cloud-adoption-framework/ready/azure-best-practices/organize-subscriptions")],
)
qq("AZ900-2.1.4", 2, "single", "What happens when you delete a resource group?", [("All resources in it are deleted", "Correct."), ("Resources move to the default group", "No."), ("Only empty groups can be deleted", "No."), ("Resources keep running without a group", "No.")], "a", "The group's lifecycle includes its resources.", ARCH)
qq("AZ900-2.1.4", 2, "single", "A resource group is in West Europe. Where can its resources be?", [("In any region", "Correct."), ("Only West Europe", "No."), ("Only Europe", "No."), ("Only the paired region", "No.")], "a", "The group location stores metadata only.", ML + "azure/azure-resource-manager/management/overview")
qq("AZ900-2.1.5", 2, "scenario", "Finance wants separate invoices for the Marketing and Engineering departments. What should you create?", [("A subscription per department", "Correct: billing boundary."), ("A resource group per department", "Same invoice."), ("A management group per department", "Not a billing boundary."), ("A tag per department only", "Same invoice.")], "a", "Subscriptions are billing boundaries.", ARCH)
qq("AZ900-2.1.6", 2, "scenario", "You must apply the same policy to 30 subscriptions with one assignment. What should you use?", [("A management group", "Correct."), ("A resource group", "Within one subscription."), ("A tag", "Metadata."), ("A region pair", "Infrastructure.")], "a", "Assign once at the management group.", ML + "azure/governance/management-groups/overview")
qq("AZ900-2.1.7", 2, "ordering", "Order the Azure hierarchy from broadest to narrowest.", [("Management group", "Step 1."), ("Subscription", "Step 2."), ("Resource group", "Step 3."), ("Resource", "Step 4.")], "abcd", "Management groups contain subscriptions, which contain resource groups, which contain resources.", ARCH)
qq("AZ900-2.1.7", 2, "scenario", "Reader is assigned to a user at the subscription. What can the user do in a resource group in that subscription?", [("View its resources", "Correct: inherited."), ("Nothing", "Inheritance applies."), ("Delete resources", "Reader can't."), ("Assign roles", "Reader can't.")], "a", "Assignments flow down.", ARCH)

# ================================================================ 2.2.1–2.2.2
lesson(
    id="az900-compute-types", exam=E, title="Compute types and virtual machine options",
    objectives=["AZ900-2.2.1", "AZ900-2.2.2"], minutes=40,
    objective="Compare VMs, containers and functions, and describe Azure Virtual Machines, Virtual Machine Scale Sets, availability sets and Azure Virtual Desktop.",
    prereqs=[("IaaS and PaaS", "AZ900-1.3.1", "az900-iaas-paas-saas")],
    foundation=[
        "Virtual machines: a whole computer in the cloud with its own OS. Most control, you manage the OS.",
        "Containers: a lightweight package of an app and its dependencies that shares the host's OS kernel. Start in seconds, run the same everywhere.",
        "Functions: small pieces of code that run in response to an event (serverless). No servers to think about; billed per execution.",
        "VM options: one VM; an availability set (VMs spread across racks); a Virtual Machine Scale Set (identical VMs that scale automatically); Azure Virtual Desktop (cloud-hosted Windows desktops for users).",
    ],
    engineer=[
        "Compare: VMs virtualise hardware (full OS each, minutes to start, total control). Containers virtualise the OS (share kernel, seconds to start, portable). Functions abstract everything but your code (event-driven, scale to zero on consumption plans).",
        "Azure container options: Azure Container Instances (single containers, fastest start), Azure Container Apps (serverless microservices), Azure Kubernetes Service (orchestration at scale). Docker is the common container format.",
        "Azure Virtual Machines: choose image, size, disks and networking. Use cases: test and development, running applications in the cloud, extending your datacenter, disaster recovery, lift-and-shift migration.",
        "Availability sets: group VMs across fault domains (separate power/network racks, up to 3) and update domains (rebooted at different times during planned maintenance, up to 20). No extra cost; you pay for the VMs. Protects within one datacenter.",
        "Virtual Machine Scale Sets: create and manage a group of identical, load-balanced VMs; scale automatically on demand or schedule; can span availability zones. Ideal for compute, big-data and container workloads.",
        "Azure Virtual Desktop: desktop and app virtualisation in Azure; centralised security with Microsoft Entra ID and MFA; data stays off user devices; multi-session Windows 10/11 Enterprise lets many users share one VM.",
    ],
    anim=("az900-compute-sim", "Pick compute types for each requirement, then the right VM availability or scale option."),
    diagram=([("vm", "Virtual machine: full OS", 0, 60, "compute"), ("ctr", "Container: app + dependencies", 230, 60, "compute"), ("fn", "Function: code on events", 460, 60, "compute"), ("vmss", "Scale set: identical VMs + autoscale", 0, 190, "compute"), ("aset", "Availability set: fault & update domains", 230, 190, "security"), ("avd", "Azure Virtual Desktop", 460, 190, "user")],
             [("vm", "vmss"), ("vm", "aset"), ("vm", "avd")]),
    example=("An e-commerce platform", ["The legacy ERP runs on two VMs in an availability set. The shop front end runs on a scale set across zones that grows from 4 to 20 VMs on Black Friday.",
                                        "Order emails are sent by an Azure Function, the recommendation service runs in containers on Container Apps, and call-centre staff use Azure Virtual Desktop."]),
    config=cfg(["Create a resource > Virtual machine: Availability options.", "Create a resource > Virtual machine scale set: scaling and orchestration.", "Azure Virtual Desktop > Host pools."],
               "az vm availability-set create -g <rg> -n avset1 --platform-fault-domain-count 2 --platform-update-domain-count 5\naz vmss create -g <rg> -n vmss1 --image Ubuntu2404 --instance-count 2 --zones 1 2 3 --generate-ssh-keys",
               "New-AzAvailabilitySet -ResourceGroupName <rg> -Name avset1 -Location westeurope -Sku Aligned -PlatformFaultDomainCount 2 -PlatformUpdateDomainCount 5"),
    lab=lab("Choose compute types and VM options.", ["Compute choice tab: answer every requirement.", "VM availability and scale options tab: answer every requirement."],
            ["Functions for event-driven code", "Scale sets for identical, autoscaling VMs"], chooser_checks("compute", "compute option") + chooser_checks("vm-options", "VM option"),
            ["Using an availability set to survive a datacenter failure", "Running one VM per user instead of multi-session AVD"]),
    troubleshooting=[("Both VMs rebooted at the same time during maintenance.", "They aren't in an availability set or zones.", "Use an availability set (update domains) or zones."),
                     ("Scale set doesn't add VMs under load.", "No autoscale rule, or maximum reached.", "Configure autoscale rules and limits.")],
    comparisons=[("Containers vs VMs", "Containers are lighter and faster but share the host kernel; VMs isolate a full OS."), ("Scale set vs availability set", "Scale sets manage identical VMs and autoscale; availability sets only spread VMs across racks.")],
    misconceptions=[("Containers include a full operating system.", "They share the host kernel."), ("Availability sets protect against datacenter failure.", "Use availability zones for that."), ("Azure Virtual Desktop needs one VM per user.", "Multi-session lets users share VMs.")],
    decisions=["Use functions for short, event-driven work.", "Use containers for portable microservices.", "Use scale sets across zones for scalable, resilient VM workloads."],
    docs=[("Describe Azure compute and networking services (Learn)", CN), ("Virtual Machine Scale Sets", ML + "azure/virtual-machine-scale-sets/overview"), ("Availability sets overview", ML + "azure/virtual-machines/availability-set-overview"), ("Azure Virtual Desktop", ML + "azure/virtual-desktop/overview"), ("Containers on Azure", "https://azure.microsoft.com/products/category/containers")],
)
qq("AZ900-2.2.1", 2, "single", "Which statement compares containers and VMs correctly?", [("Containers share the host OS kernel; VMs each run a full OS", "Correct."), ("Containers each run a full OS", "No."), ("VMs start faster than containers", "Usually the reverse."), ("Containers can't run on Azure", "They can.")], "a", "Containers virtualise the OS.", CN)
qq("AZ900-2.2.1", 2, "scenario", "A short piece of code must run every time a message arrives in a queue, with no infrastructure to manage. Which compute type?", [("Azure Functions", "Correct."), ("Virtual machines", "Infrastructure to manage."), ("Azure Virtual Desktop", "Desktops."), ("Availability set", "VM grouping.")], "a", "Event-driven serverless.", CN)
qq("AZ900-2.2.2", 2, "scenario", "You need VMs that are spread across separate power and network racks and are not rebooted together during maintenance. What should you use?", [("An availability set", "Correct: fault and update domains."), ("Azure Virtual Desktop", "Desktops."), ("A resource lock", "Prevents changes."), ("A single larger VM", "No redundancy.")], "a", "Availability sets use fault and update domains.", ML + "azure/virtual-machines/availability-set-overview")
qq("AZ900-2.2.2", 2, "scenario", "Call-centre staff need a secure Windows desktop from personal devices, with data not stored on the devices. What should you use?", [("Azure Virtual Desktop", "Correct."), ("Virtual Machine Scale Sets", "Server workloads."), ("Azure Functions", "Code."), ("Azure Container Instances", "Containers.")], "a", "Desktop virtualisation.", ML + "azure/virtual-desktop/overview")
qq("AZ900-2.2.2", 1, "single", "What do Virtual Machine Scale Sets provide?", [("A group of identical, load-balanced VMs that can scale automatically", "Correct."), ("Cloud-hosted desktops", "AVD."), ("A billing boundary", "Subscription."), ("Physical isolation in a sovereign region", "No.")], "a", "Scale sets manage identical VMs.", ML + "azure/virtual-machine-scale-sets/overview")

# ================================================================ 2.2.3–2.2.4
lesson(
    id="az900-vm-resources-hosting", exam=E, title="Resources a VM needs, and application hosting options",
    objectives=["AZ900-2.2.3", "AZ900-2.2.4"], minutes=30,
    objective="Describe the resources required to run a VM, and choose between web apps, containers and VMs to host an application.",
    prereqs=[("Compute types", "AZ900-2.2.1", "az900-compute-types")],
    foundation=[
        "A VM isn't one resource. It needs a size (CPU and memory), an image and OS disk, and networking: a virtual network with a subnet and a network interface (NIC).",
        "Optional extras: a public IP address (to reach it from the internet), a network security group (firewall rules), data disks, and extensions.",
        "To host an application you can use a web app (App Service), containers, or VMs. The more control you need, the more you manage.",
    ],
    engineer=[
        "Required: size (vCPUs, memory, temporary storage; changeable later), image (Marketplace or custom), OS disk (managed disk: Standard HDD, Standard SSD, Premium SSD, Ultra), virtual network and subnet, network interface.",
        "Optional: public IP (Standard SKU is secure by default and needs an NSG rule to allow traffic), network security group, data disks, availability options, boot diagnostics storage, extensions (monitoring agents, scripts).",
        "Each is a separate resource and some outlive the VM: deleting a VM doesn't delete its disks, NIC or public IP unless you chose 'delete with VM'. Leftover disks and IPs keep costing money.",
        "Billing: compute is billed per second while running; a stopped (deallocated) VM stops compute charges but disks still cost.",
        "Hosting options: Azure App Service (PaaS for web apps, REST APIs, background jobs; Windows or Linux; .NET, Java, Node.js, Python, PHP; deployment slots, autoscale, built-in authentication), containers (ACI, Container Apps, AKS), and VMs (full control, most management).",
        "Choose App Service for standard web apps; containers for portable or microservice apps; VMs when you need OS access, custom software or legacy dependencies.",
    ],
    anim=("az900-vm-hosting-sim", "Build a VM from its required resources, then choose where to host each application."),
    diagram=([("vm", "Virtual machine (size)", 260, 60, "compute"), ("disk", "Managed OS disk (image)", 0, 0, "storage"), ("nic", "NIC", 0, 130, "network"), ("vnet", "VNet / subnet", 0, 240, "network"), ("pip", "Public IP (optional)", 520, 0, "network"), ("nsg", "NSG (optional)", 520, 130, "security")],
             [("disk", "vm"), ("nic", "vm"), ("vnet", "nic"), ("pip", "nic"), ("nsg", "nic")]),
    example=("Two apps, two choices", ["A marketing site built with Node.js goes on App Service: no VM to manage, staging slot for testing, autoscale.",
                                       "A licensing server that needs a hardware dongle emulator and registry tweaks goes on a VM with a NIC, managed disk and an NSG allowing RDP from the office IP only."]),
    config=cfg(["Create a VM: Basics (image, size), Disks (OS disk type), Networking (VNet, subnet, public IP, NSG), Management, Monitoring.", "VM > Overview: see the linked disk, NIC and IP resources.", "Create a resource > Web App: runtime stack and plan."],
               "az vm create -g <rg> -n vm1 --image Ubuntu2404 --size Standard_B2s --vnet-name vnet1 --subnet default --public-ip-address \"\" --nsg-rule NONE --generate-ssh-keys\naz webapp up -n <app> --runtime \"PYTHON:3.12\"",
               "New-AzVM -ResourceGroupName <rg> -Name vm1 -Image Ubuntu2404 -Size Standard_B2s"),
    lab=lab("Build a working VM and choose hosting options.", ["Resources a VM needs tab: start from the default (missing NIC), then apply each preset.", "Application hosting tab: answer every app."],
            ["NIC, VNet/subnet, disk and size are required", "Internet access needs a public IP and an NSG rule"], [("vm-deployed", "Deployed a complete VM"), ("vm-blocked", "Found a missing resource")] + chooser_checks("hosting", "hosting option"),
            ["Opening RDP to the whole internet", "Forgetting leftover disks after deleting a VM"]),
    troubleshooting=[("Can't RDP to a new VM.", "No public IP, or no NSG rule allowing 3389.", "Use Bastion, or add a public IP and a rule limited to your IP."),
                     ("Costs continue after a VM was deleted.", "Disks and public IPs were left behind.", "Delete orphaned disks and IPs.")],
    comparisons=[("App Service vs VM", "App Service manages the OS and runtime; a VM gives full control and full responsibility."), ("Container Apps vs AKS", "Container Apps hides Kubernetes; AKS exposes it for full control.")],
    misconceptions=[("Stopping a VM in the OS stops billing.", "Only deallocating stops compute charges."), ("A VM always needs a public IP.", "Private access via VPN or Bastion is safer.")],
    decisions=["Default to App Service for web apps.", "Use VMs only when OS control is needed.", "Avoid public IPs on VMs; use Bastion."],
    docs=[("Describe Azure compute and networking services (Learn)", CN), ("Virtual machines in Azure", ML + "azure/virtual-machines/overview"), ("App Service overview", ML + "azure/app-service/overview"), ("Azure Container Apps overview", ML + "azure/container-apps/overview")],
)
qq("AZ900-2.2.3", 2, "multiple", "Which TWO resources are required to create an Azure VM?", [("A network interface in a virtual network subnet", "Correct."), ("An OS disk created from an image", "Correct."), ("A public IP address", "Optional."), ("A load balancer", "Optional.")], "ab", "Size, disk and networking are required.", ML + "azure/virtual-machines/overview")
qq("AZ900-2.2.3", 2, "scenario", "After deleting a VM, the bill still shows storage and IP charges. Why?", [("The VM's disks and public IP are separate resources that weren't deleted", "Correct."), ("The VM is still running", "It's deleted."), ("Azure charges a deletion fee", "No."), ("The region pair still runs the VM", "No.")], "a", "Clean up associated resources.", ML + "azure/virtual-machines/overview")
qq("AZ900-2.2.4", 2, "scenario", "A team wants to host a Python web app with deployment slots and autoscale, without managing an OS. What should they use?", [("Azure App Service", "Correct."), ("Azure Virtual Machines", "Manage the OS."), ("Azure Virtual Desktop", "Desktops."), ("Azure Files", "Storage.")], "a", "App Service is PaaS web hosting.", ML + "azure/app-service/overview")
qq("AZ900-2.2.4", 2, "single", "Which hosting option gives the most control over the environment?", [("Virtual machines", "Correct."), ("App Service", "Managed platform."), ("Container Apps", "Managed."), ("Azure Functions", "Least control.")], "a", "VMs give full OS control.", CN)

# ================================================================ 2.2.5
lesson(
    id="az900-virtual-networking", exam=E, title="Virtual networks, subnets, peering, DNS, VPN Gateway and ExpressRoute",
    objectives=["AZ900-2.2.5"], minutes=40,
    objective="Describe the purpose of Azure virtual networks and subnets, and how peering, Azure DNS, VPN Gateway and ExpressRoute connect things.",
    prereqs=[("VM resources", "AZ900-2.2.3", "az900-vm-resources-hosting")],
    foundation=[
        "A virtual network (VNet) is your private network in Azure. Resources in it get private IP addresses and can talk to each other securely.",
        "Subnets split a VNet's address range into smaller pieces, for example one for web servers and one for databases, so you can apply different rules.",
        "Peering joins two VNets so they act like one network. VPN Gateway connects your office or laptop to Azure through an encrypted tunnel over the internet. ExpressRoute is a private connection that doesn't use the internet at all.",
        "Azure DNS hosts your domain names (like contoso.com) on Microsoft's global name servers.",
    ],
    engineer=[
        "VNet capabilities: isolation and segmentation; internet communication (outbound by default, inbound with a public IP or load balancer); communication between Azure resources (VNets and service endpoints); communication with on-premises (point-to-site VPN, site-to-site VPN, ExpressRoute); routing (route tables, BGP); filtering (network security groups, network virtual appliances such as firewalls).",
        "Address space: you choose private ranges (for example 10.0.0.0/16) and subnets inside them (10.0.1.0/24). Azure reserves 5 addresses per subnet.",
        "Peering: connects VNets in the same region or across regions (global peering) over the Microsoft backbone, privately, with low latency. Not transitive by default.",
        "VPN Gateway: a type of virtual network gateway. Site-to-site (on-premises network to Azure), point-to-site (single device to Azure), VNet-to-VNet. Uses IPsec/IKE encryption over the public internet. Policy-based or route-based; active/standby or active/active for availability.",
        "ExpressRoute: private connection through a connectivity provider. Doesn't traverse the public internet, offers more reliability, higher speeds, consistent latency. Connectivity models: CloudExchange colocation, point-to-point Ethernet, any-to-any (IPVPN), ExpressRoute Direct. Also reaches Microsoft 365 services. Global Reach links on-premises sites through Microsoft's network.",
        "Azure DNS: hosts DNS zones with Azure's reliability and performance (anycast name servers), managed with Azure credentials, RBAC, activity logs and locks. Supports private DNS zones for names inside VNets and alias records. You can't buy domain names through Azure DNS.",
    ],
    anim=("az900-vnet-sim", "Pick the networking concept or service for each connectivity need."),
    diagram=([("onp", "On-premises network", 0, 80, "compute"), ("vpn", "VPN Gateway (internet, encrypted)", 230, 0, "network"), ("er", "ExpressRoute (private)", 230, 160, "network"), ("v1", "VNet A: web + db subnets", 470, 80, "network"), ("v2", "VNet B (peered)", 700, 80, "network"), ("dns", "Azure DNS: contoso.com", 470, 230, "scope")],
             [("onp", "vpn"), ("onp", "er"), ("vpn", "v1"), ("er", "v1"), ("v1", "v2", "peering"), ("dns", "v1", "names")]),
    example=("A hub for an insurance firm", ["The firm's VNet has subnets for web, app and data tiers, each with NSGs. A second VNet for analytics is peered to it.",
                                             "Head office uses ExpressRoute for predictable claims-processing traffic; 40 branch offices use site-to-site VPN; staff laptops use point-to-site VPN. contoso.com is hosted in Azure DNS."]),
    config=cfg(["Virtual networks > Create: address space and subnets.", "Virtual network > Peerings > Add.", "Virtual network gateways > Create (VPN); ExpressRoute circuits > Create.", "DNS zones > Create: record sets."],
               "az network vnet create -g <rg> -n vnet-a --address-prefixes 10.0.0.0/16 --subnet-name web --subnet-prefixes 10.0.1.0/24\naz network vnet peering create -g <rg> -n a-to-b --vnet-name vnet-a --remote-vnet vnet-b --allow-vnet-access\naz network dns zone create -g <rg> -n contoso.com",
               "New-AzVirtualNetwork -ResourceGroupName <rg> -Name vnet-a -Location westeurope -AddressPrefix 10.0.0.0/16", limits=("VPN gateways take 30+ minutes to create and are billed hourly", "ExpressRoute requires a connectivity provider and a circuit")),
    lab=lab("Choose networking concepts and services.", ["Virtual networking concepts tab: answer every need.", "Networking choice tab: answer every requirement."],
            ["Subnets segment a VNet", "ExpressRoute doesn't use the public internet; VPN does (encrypted)"], chooser_checks("vnet-concepts", "networking concept") + chooser_checks("networking", "networking service"),
            ["Choosing VPN when the requirement says 'not over the internet'", "Expecting peering to be transitive"]),
    troubleshooting=[("Peered VNets can't communicate.", "Overlapping address spaces, or the peering is only created on one side.", "Use non-overlapping ranges; create both peering links."),
                     ("Site-to-site VPN performance varies.", "Traffic crosses the public internet.", "Use ExpressRoute for consistent latency.")],
    comparisons=[("VPN Gateway vs ExpressRoute", "VPN: encrypted over the internet, cheaper, quick to set up. ExpressRoute: private, faster, more consistent, needs a provider."), ("Azure DNS vs domain registrar", "Azure DNS hosts zones; you buy the domain from a registrar.")],
    misconceptions=[("ExpressRoute traffic goes over the internet.", "It uses a private connection."), ("VNets are reachable from the internet by default.", "Inbound traffic needs a public IP or load balancer and allowed rules."), ("You can buy domains in Azure DNS.", "Azure DNS hosts zones only.")],
    decisions=["Plan non-overlapping address spaces up front.", "Use VPN for branches and remote users; ExpressRoute for critical, high-volume links.", "Segment tiers into subnets with NSGs."],
    docs=[("Describe Azure compute and networking services (Learn)", CN), ("What is Azure Virtual Network?", ML + "azure/virtual-network/virtual-networks-overview"), ("Virtual network peering", ML + "azure/virtual-network/virtual-network-peering-overview"),
          ("VPN Gateway", ML + "azure/vpn-gateway/vpn-gateway-about-vpngateways"), ("ExpressRoute", ML + "azure/expressroute/expressroute-introduction"), ("Azure DNS", ML + "azure/dns/dns-overview")],
)
qq("AZ900-2.2.5", 2, "scenario", "A company needs a connection between its datacenter and Azure that does not travel over the public internet. What should it use?", [("ExpressRoute", "Correct."), ("Site-to-site VPN", "Uses the internet (encrypted)."), ("Point-to-site VPN", "Single device over the internet."), ("Azure DNS", "Name resolution.")], "a", "ExpressRoute is private connectivity.", ML + "azure/expressroute/expressroute-introduction")
qq("AZ900-2.2.5", 2, "scenario", "Remote employees must connect individual laptops securely to an Azure VNet. What should you configure?", [("Point-to-site VPN on a VPN gateway", "Correct."), ("Site-to-site VPN", "Network to network."), ("VNet peering", "VNet to VNet."), ("ExpressRoute", "Provider circuit for sites.")], "a", "Point-to-site connects single devices.", ML + "azure/vpn-gateway/vpn-gateway-about-vpngateways")
qq("AZ900-2.2.5", 1, "single", "What is the purpose of subnets?", [("Segment a VNet's address space to organise and secure resources", "Correct."), ("Connect two VNets", "Peering."), ("Host DNS zones", "Azure DNS."), ("Encrypt internet traffic", "VPN.")], "a", "Subnets divide a VNet.", ML + "azure/virtual-network/virtual-networks-overview")
qq("AZ900-2.2.5", 2, "single", "Which statement about Azure DNS is true?", [("It hosts DNS zones; domains are bought from a registrar", "Correct."), ("It sells domain names", "No."), ("It's a VPN service", "No."), ("It only works inside VNets", "Public zones are internet-facing.")], "a", "Azure DNS is hosting only.", ML + "azure/dns/dns-overview")

# ================================================================ 2.2.6
lesson(
    id="az900-endpoints", exam=E, title="Public and private endpoints",
    objectives=["AZ900-2.2.6"], minutes=25,
    objective="Define public and private endpoints and decide when a PaaS service should be reached privately.",
    prereqs=[("Virtual networks", "AZ900-2.2.5", "az900-virtual-networking")],
    foundation=[
        "An endpoint is the address a client connects to. A public endpoint is reachable from the internet, for example mystorage.blob.core.windows.net.",
        "A private endpoint puts a network interface with a private IP address from your VNet in front of a service (such as a storage account or SQL database). Traffic stays on the Microsoft network.",
        "With a private endpoint you can turn off public access completely, so the service can't be reached from the internet at all.",
    ],
    engineer=[
        "Public endpoints: most PaaS services have one by default. You can restrict them with firewall rules (allowed IP ranges, selected VNets) or disable public network access.",
        "Private endpoints use Azure Private Link: a NIC with a private IP in your subnet maps to a specific resource (for example one storage account), not the whole service. Reachable from the VNet, peered VNets and on-premises over VPN/ExpressRoute.",
        "DNS: clients must resolve the service name to the private IP. Private DNS zones (privatelink.blob.core.windows.net) are created and linked to make this work; otherwise clients still resolve the public address.",
        "Security benefits: no exposure to the internet, protection against data exfiltration (connects to one specific resource), works with NSGs and on-premises connectivity.",
        "Service endpoints (a related AZ-104 topic) keep traffic on the backbone but the service keeps its public IP; private endpoints give it a private IP.",
    ],
    anim=("az900-endpoints-sim", "Connect from the internet, the VNet or on-premises with different public-access and private endpoint settings."),
    diagram=([("inet", "Internet client", 0, 0, "user"), ("pub", "Public endpoint (disabled)", 240, 0, "security"), ("vm", "VM in VNet", 0, 160, "compute"), ("pe", "Private endpoint 10.0.2.5", 240, 160, "network"), ("st", "Storage account", 480, 80, "storage")],
             [("inet", "pub", "blocked"), ("pub", "st"), ("vm", "pe", "private IP"), ("pe", "st", "Private Link")]),
    example=("Patient records", ["A hospital stores scans in a storage account. It adds a private endpoint in its app subnet and disables public network access.",
                                 "The web app in the VNet and clinicians on-premises (over ExpressRoute) reach the account at 10.0.2.5; requests from the internet fail even with a valid key."]),
    config=cfg(["Storage account > Networking > Public network access: Disabled / Enabled from selected networks.", "Storage account > Networking > Private endpoint connections > + Private endpoint.", "Private DNS zones: privatelink.blob.core.windows.net linked to the VNet."],
               "az network private-endpoint create -g <rg> -n pe-st --vnet-name vnet-a --subnet data --private-connection-resource-id <storage-id> --group-id blob --connection-name st-conn\naz storage account update -g <rg> -n <account> --public-network-access Disabled",
               "Set-AzStorageAccount -ResourceGroupName <rg> -Name <account> -PublicNetworkAccess Disabled"),
    lab=lab("See which clients reach a storage account through which endpoint.", ["Public vs private endpoint tab: run the default, then each preset.", "Public or private endpoint? tab: answer every requirement."],
            ["Private endpoint works from the VNet even with public access disabled", "The internet can't use a private endpoint"],
            [("endpoint-private", "Connected through a private endpoint"), ("endpoint-public", "Connected through the public endpoint"), ("endpoint-blocked", "Saw a blocked connection")] + chooser_checks("endpoints", "endpoint type"),
            ["Disabling public access before the private endpoint and DNS are ready"]),
    troubleshooting=[("VMs still go to the public IP after adding a private endpoint.", "DNS resolves the public address.", "Link the privatelink private DNS zone to the VNet."),
                     ("Internet clients can't reach the account any more.", "Public network access was disabled.", "Enable selected networks, or use the private path.")],
    comparisons=[("Private endpoint vs service endpoint", "Private endpoint: private IP for one resource. Service endpoint: optimised route to the public endpoint from a subnet."), ("Private endpoint vs VPN", "VPN connects networks; a private endpoint gives a service an address inside the network.")],
    misconceptions=[("A private endpoint makes the service private automatically.", "Public access stays on until you disable it."), ("Private endpoints connect to the whole service (all storage accounts).", "They map to one resource.")],
    decisions=["Use private endpoints for data services holding sensitive data.", "Disable public network access when all clients are private.", "Plan private DNS with the endpoint."],
    docs=[("Describe Azure compute and networking services (Learn)", CN), ("What is a private endpoint?", ML + "azure/private-link/private-endpoint-overview"), ("Azure Private Link", ML + "azure/private-link/private-link-overview"), ("Storage network security", ML + "azure/storage/common/storage-network-security")],
)
qq("AZ900-2.2.6", 1, "single", "What does a private endpoint provide?", [("A private IP address from your VNet for an Azure service", "Correct."), ("A public IP for a VM", "No."), ("Encryption for internet traffic", "VPN."), ("A DNS zone", "No.")], "a", "Private Link brings the service into your VNet.", ML + "azure/private-link/private-endpoint-overview")
qq("AZ900-2.2.6", 2, "scenario", "A storage account has a private endpoint and public network access disabled. Which client can connect?", [("A VM in the VNet with the private endpoint", "Correct."), ("A laptop on home Wi-Fi without VPN", "Internet: blocked."), ("Any internet client with the account key", "Network blocked first."), ("None", "The VNet client can.")], "a", "Only private paths work.", ML + "azure/storage/common/storage-network-security")
qq("AZ900-2.2.6", 2, "single", "Which is an example of a public endpoint?", [("https://contoso.blob.core.windows.net reachable from the internet", "Correct."), ("10.0.2.5 inside a VNet", "Private."), ("A subnet", "No."), ("An NSG", "No.")], "a", "Public endpoints are internet-reachable.", CN)

# ================================================================ 2.3.1 + 2.3.4
lesson(
    id="az900-storage-services", exam=E, title="Azure Storage services and storage account types",
    objectives=["AZ900-2.3.1", "AZ900-2.3.4"], minutes=35,
    objective="Compare Blob, Files, Queue, Table and Disk storage, and describe storage account types and their options.",
    prereqs=[("Resource groups", "AZ900-2.1.4", "az900-resource-hierarchy")],
    foundation=[
        "A storage account is a container for your Azure Storage data with a globally unique name (it becomes part of the URL).",
        "Blob Storage: huge amounts of unstructured data (images, video, backups, logs). Azure Files: file shares you can mount over SMB or NFS. Queue Storage: messages between parts of an app. Table Storage: simple NoSQL key/attribute data. Disk Storage: block disks attached to VMs.",
        "Different account types trade cost for performance: Standard (HDD-backed, most uses) or Premium (SSD-backed, low latency).",
    ],
    engineer=[
        "Blob: block blobs (text and binary, up to about 190 TiB), append blobs (logs), page blobs (random access, VHDs). Access over HTTP/HTTPS, REST, SDKs, AzCopy. Uses: serving images or documents to browsers, streaming video, backup and archive, data for analysis.",
        "Azure Files: fully managed SMB and NFS shares; mount concurrently from cloud or on-premises; replace or supplement file servers; cache on Windows Server with Azure File Sync.",
        "Queue Storage: millions of messages, each up to 64 KB, accessed over HTTP/HTTPS; used to create a backlog of work processed asynchronously.",
        "Table Storage: NoSQL structured data with a schemaless design (Azure Cosmos DB for Table is the premium option). Disk Storage: managed disks (Standard HDD, Standard SSD, Premium SSD, Premium SSD v2, Ultra Disk).",
        "Account types: Standard general-purpose v2 (blobs including Data Lake Storage, queues, tables, files; LRS, GRS, RA-GRS, ZRS, GZRS, RA-GZRS); Premium block blobs (LRS, ZRS); Premium file shares (LRS, ZRS); Premium page blobs (LRS, ZRS).",
        "Endpoints: https://<account>.blob.core.windows.net, .file., .queue., .table., .dfs. (Data Lake). Names: 3–24 lowercase letters and numbers, unique across Azure.",
    ],
    anim=("az900-storage-sim", "Pick the storage service, tier or redundancy, then the right account type."),
    diagram=([("acct", "Storage account (unique name)", 260, 0, "storage"), ("blob", "Blob", 0, 140, "storage"), ("files", "Files (SMB/NFS)", 170, 140, "storage"), ("queue", "Queue", 340, 140, "storage"), ("table", "Table", 510, 140, "storage"), ("disk", "Managed disks (separate)", 260, 260, "storage")],
             [("acct", "blob"), ("acct", "files"), ("acct", "queue"), ("acct", "table")]),
    example=("A photo-sharing app", ["Uploaded photos go to Blob Storage; an upload message goes to Queue Storage; a worker reads the queue to create thumbnails.",
                                     "Photo metadata is stored in Table Storage, the worker VM's OS runs on a Premium SSD managed disk, and the design team shares assets on Azure Files."]),
    config=cfg(["Create a resource > Storage account: performance (Standard/Premium), account kind, redundancy.", "Storage account > Containers / File shares / Queues / Tables."],
               "az storage account create -g <rg> -n st$RANDOM -l westeurope --sku Standard_LRS --kind StorageV2\naz storage container create --account-name <account> -n photos --auth-mode login",
               "New-AzStorageAccount -ResourceGroupName <rg> -Name <account> -Location westeurope -SkuName Standard_LRS -Kind StorageV2"),
    lab=lab("Choose storage services and account types.", ["Storage choice tab: answer every requirement.", "Storage account types tab: answer every requirement."],
            ["Blob for objects, Files for shares, Queue for messages", "Premium accounts support only LRS or ZRS"], chooser_checks("storage", "storage option") + chooser_checks("account-type", "account type"),
            ["Choosing Queue Storage for files", "Expecting geo-redundancy on a premium account"]),
    troubleshooting=[("Storage account name rejected.", "Names must be 3–24 lowercase letters and numbers and globally unique.", "Choose another name."),
                     ("Can't select GRS on a premium account.", "Premium accounts support LRS and ZRS only.", "Use Standard general-purpose v2 for geo-redundancy.")],
    comparisons=[("Blob vs Files", "Blob is object storage over HTTP; Files is a mountable file share over SMB/NFS."), ("Queue Storage vs Service Bus", "Queue Storage is simple and cheap; Service Bus adds ordering, topics and transactions.")],
    misconceptions=[("Managed disks are stored in your storage account.", "Managed disks are separate resources managed by Azure."), ("Each storage service needs its own account.", "A general-purpose v2 account holds all four.")],
    decisions=["Use Standard GPv2 unless you need premium performance.", "Use Blob for anything served over HTTP.", "Use Azure Files to lift-and-shift file shares."],
    docs=[("Describe Azure storage services (Learn)", STO), ("Introduction to Azure Storage", ML + "azure/storage/common/storage-introduction"), ("Storage account overview", ML + "azure/storage/common/storage-account-overview")],
)
qq("AZ900-2.3.1", 2, "scenario", "A web front end must hand work to a background process asynchronously. Which storage service fits?", [("Queue Storage", "Correct."), ("Table Storage", "NoSQL data."), ("Azure Files", "File shares."), ("Disk Storage", "VM disks.")], "a", "Queues decouple components.", STO)
qq("AZ900-2.3.1", 2, "scenario", "You need to replace an on-premises SMB file share that many servers mount at once. Which service?", [("Azure Files", "Correct."), ("Blob Storage", "Object storage."), ("Queue Storage", "Messages."), ("Table Storage", "NoSQL.")], "a", "Azure Files offers SMB shares.", STO)
qq("AZ900-2.3.4", 2, "single", "Which storage account type supports geo-redundant storage (GRS)?", [("Standard general-purpose v2", "Correct."), ("Premium block blobs", "LRS/ZRS only."), ("Premium file shares", "LRS/ZRS only."), ("Premium page blobs", "LRS/ZRS only.")], "a", "Only Standard GPv2 supports all redundancy options.", ML + "azure/storage/common/storage-account-overview")
qq("AZ900-2.3.4", 1, "single", "Which is true of storage account names?", [("They must be globally unique", "Correct."), ("They can contain uppercase letters", "Lowercase only."), ("They can be 100 characters long", "3–24."), ("They must match the resource group name", "No.")], "a", "The name forms a public DNS name.", ML + "azure/storage/common/storage-account-overview")

# ================================================================ 2.3.2–2.3.3
lesson(
    id="az900-storage-tiers-redundancy", exam=E, title="Storage access tiers and redundancy options",
    objectives=["AZ900-2.3.2", "AZ900-2.3.3"], minutes=35,
    objective="Describe the Hot, Cool, Cold and Archive tiers, and choose between LRS, ZRS, GRS, GZRS and their read-access variants.",
    prereqs=[("Storage services", "AZ900-2.3.1", "az900-storage-services"), ("Regions and zones", "AZ900-2.1.2", "az900-regions-zones")],
    foundation=[
        "Access tiers set the price of blob data by how often you read it. Hot: read often, highest storage price, cheapest to read. Cool and Cold: read rarely, cheaper to store, more to read. Archive: offline and cheapest, but it takes hours to get data back.",
        "Redundancy decides how many copies Azure keeps and where. Every option keeps at least three copies.",
        "LRS: three copies in one datacenter. ZRS: three copies in three zones. GRS: LRS plus three more copies in another region. GZRS: ZRS plus three copies in another region. 'RA-' versions let you read from the second region at any time.",
    ],
    engineer=[
        "Tiers: Hot (frequently accessed), Cool (infrequently accessed, stored at least 30 days), Cold (rarely accessed, stored at least 90 days), Archive (stored at least 180 days, offline). Deleting or moving data early incurs an early-deletion charge.",
        "Hot, Cool and Cold can be set as the account default and per blob; Archive is set only per blob. Archived blobs must be rehydrated (copied or re-tiered to an online tier), which can take up to 15 hours (high priority can be faster). Lifecycle management policies move blobs between tiers automatically.",
        "Durability: LRS at least 11 nines per year; ZRS at least 12 nines; GRS/GZRS at least 16 nines. LRS protects against drive and rack failure but not a datacenter disaster. ZRS survives a zone outage with continued reads and writes.",
        "Geo-redundancy copies asynchronously to the paired (secondary) region, where data is stored with LRS. Without RA-, the secondary isn't readable until failover. Customer-managed failover makes the secondary the new primary; some recent writes may be lost (RPO typically under 15 minutes, not guaranteed by SLA).",
        "Pick by requirement: lowest cost/non-critical → LRS; survive datacenter loss, data residency within region → ZRS; survive region loss → GRS/GZRS; read during a regional outage → RA-GRS/RA-GZRS.",
    ],
    anim=("az900-redundancy-sim", "Inject datacenter and region failures against each redundancy option, then choose access tiers."),
    diagram=([("p", "Primary region", 0, 60, "scope"), ("lrs", "LRS: 3 copies, 1 datacenter", 0, 180, "storage"), ("zrs", "ZRS: 3 copies, 3 zones", 230, 180, "storage"), ("s", "Secondary (paired) region: LRS", 460, 60, "scope"), ("geo", "GRS / GZRS: async copy", 460, 180, "storage")],
             [("p", "lrs"), ("p", "zrs"), ("p", "s", "async replication"), ("s", "geo")]),
    example=("A legal firm's documents", ["Active case files are in the Hot tier on RA-GZRS: they survive a zone outage, are copied to the paired region, and lawyers can still read them if the primary region is down.",
                                          "Closed cases move to Cool after 30 days and Archive after a year by a lifecycle policy, cutting storage cost by most of the bill."]),
    config=cfg(["Storage account > Data management > Redundancy: change replication; Prepare for failover.", "Blob > Change tier; Storage account > Lifecycle management > Add rule."],
               "az storage account update -g <rg> -n <account> --sku Standard_RAGZRS\naz storage blob set-tier --account-name <account> -c docs -n case.pdf --tier Archive --auth-mode login",
               "Set-AzStorageAccount -ResourceGroupName <rg> -Name <account> -SkuName Standard_RAGZRS"),
    lab=lab("See what each redundancy option survives, and choose access tiers.", ["Storage redundancy tab: try each option against each failure; try failover.", "Access tiers tab: answer every data type."],
            ["LRS doesn't survive a datacenter loss", "Geo-redundancy needs RA- or failover to read during a regional outage"],
            [("redundancy-survived", "Data stayed available"), ("redundancy-lost", "Found a redundancy gap")] + chooser_checks("tier", "access tier"),
            ["Expecting Archive data to be readable immediately", "Expecting GRS to be readable without failover"]),
    troubleshooting=[("Reading an archived blob fails.", "Archive is offline.", "Rehydrate to Hot or Cool first (can take hours)."),
                     ("Unexpected charges after moving blobs out of Cool.", "Early-deletion charge for less than 30 days.", "Plan tier moves around minimum retention.")],
    comparisons=[("GRS vs GZRS", "Both copy to a secondary region; GZRS also spreads the primary copies across zones."), ("Cold vs Archive", "Cold is online and immediately readable; Archive is offline and needs rehydration.")],
    misconceptions=[("Archive can be the account default tier.", "Archive is set per blob."), ("GRS lets you read from the secondary by default.", "Only RA-GRS/RA-GZRS."), ("ZRS copies data to another region.", "Within one region across zones.")],
    decisions=["Use ZRS or GZRS for production data in zone-enabled regions.", "Use lifecycle rules to move ageing data to cooler tiers.", "Use RA- variants when reads must continue during a regional outage."],
    docs=[("Describe Azure storage services (Learn)", STO), ("Azure Storage redundancy", ML + "azure/storage/common/storage-redundancy"), ("Access tiers for blob data", ML + "azure/storage/blobs/access-tiers-overview"), ("Blob rehydration from Archive", ML + "azure/storage/blobs/archive-rehydrate-overview")],
)
qq("AZ900-2.3.2", 2, "scenario", "Data must be kept for 7 years at the lowest storage cost and is almost never read; a delay of hours to read is acceptable. Which tier?", [("Archive", "Correct."), ("Hot", "Most expensive storage."), ("Cool", "Online, costs more."), ("Premium", "Performance tier.")], "a", "Archive is cheapest, offline.", ML + "azure/storage/blobs/access-tiers-overview")
qq("AZ900-2.3.2", 2, "single", "Which access tier can't be set as a storage account's default?", [("Archive", "Correct: per-blob only."), ("Hot", "Can be default."), ("Cool", "Can be default."), ("Cold", "Can be default.")], "a", "Archive is set only at blob level.", ML + "azure/storage/blobs/access-tiers-overview")
qq("AZ900-2.3.3", 2, "scenario", "Data must remain readable and writable if one datacenter in the region fails, and must stay in that region. Which redundancy?", [("ZRS", "Correct."), ("LRS", "One datacenter."), ("GRS", "Copies to another region."), ("RA-GRS", "Copies to another region.")], "a", "ZRS spans zones within a region.", ML + "azure/storage/common/storage-redundancy")
qq("AZ900-2.3.3", 3, "scenario", "Apps must be able to read data immediately during an outage of the entire primary region, without waiting for failover. Which options meet this?", [("RA-GRS or RA-GZRS", "Correct."), ("GRS", "Needs failover."), ("ZRS", "Single region."), ("LRS", "Single datacenter.")], "a", "Read-access geo-redundancy.", ML + "azure/storage/common/storage-redundancy")

# ================================================================ 2.3.5–2.3.6
lesson(
    id="az900-moving-data", exam=E, title="Moving files and migrating to Azure",
    objectives=["AZ900-2.3.5", "AZ900-2.3.6"], minutes=30,
    objective="Identify AzCopy, Azure Storage Explorer and Azure File Sync for moving files, and Azure Migrate and Azure Data Box for migration.",
    prereqs=[("Storage services", "AZ900-2.3.1", "az900-storage-services")],
    foundation=[
        "AzCopy: a command-line tool to copy files to, from and between storage accounts. Good for scripts.",
        "Azure Storage Explorer: a free desktop app (Windows, macOS, Linux) to browse and move files with a graphical interface.",
        "Azure File Sync: keeps a Windows file server and an Azure file share in sync, so the server becomes a fast local cache.",
        "Azure Migrate: one hub to discover, assess and move servers, databases, apps and data to Azure. Azure Data Box: a physical, rugged device Microsoft ships to you to move lots of data offline.",
    ],
    engineer=[
        "AzCopy: upload, download, copy between accounts, and sync (one-direction) blobs and files; authenticates with Microsoft Entra ID or SAS tokens; resumable; works across clouds (for example from Amazon S3).",
        "Storage Explorer: uses AzCopy underneath; manage blobs, files, queues, tables, Data Lake Storage and managed disks; connect by Entra ID, keys or SAS.",
        "Azure File Sync: centralise shares in Azure Files; keep the flexibility and performance of on-premises Windows Server; any protocol on the server (SMB, NFS, FTPS); as many caches as needed worldwide; cloud tiering keeps hot files local and tiers cold files to Azure; replace a failed server quickly.",
        "Azure Migrate: integrated tools (Discovery and assessment, Server migration, Data Migration Assistant, Azure Database Migration Service, web app migration assistant, Azure Data Box) plus third-party ISV tools, with a central dashboard tracking progress.",
        "Azure Data Box: about 80 TB usable per standard device; for one-time bulk migration, initial seeding before online sync, periodic uploads, or exporting data out of Azure (for disaster recovery or moving off). Data is encrypted (AES 256-bit) and wiped after upload following NIST 800-88.",
        "Rule of thumb: transfer time = data size ÷ bandwidth. 80 TB over 100 Mbps takes about 74 days; ship a Data Box instead.",
    ],
    anim=("az900-migration-sim", "Estimate transfer times, then pick the right tool for each move."),
    diagram=([("onp", "On-premises servers and files", 0, 80, "compute"), ("mig", "Azure Migrate: discover, assess, migrate", 260, 0, "scope"), ("db", "Data Box: ship disks", 260, 100, "storage"), ("az", "AzCopy / Storage Explorer", 260, 200, "user"), ("fs", "Azure File Sync", 260, 300, "network"), ("azure", "Azure", 520, 150, "compute")],
             [("onp", "mig"), ("onp", "db"), ("onp", "az"), ("onp", "fs"), ("mig", "azure"), ("db", "azure"), ("az", "azure"), ("fs", "azure")]),
    example=("A media company moves to Azure", ["It assesses 300 servers with Azure Migrate (sizing and cost), ships 400 TB of video archive on Data Box devices, and uses AzCopy nightly for new footage.",
                                                 "Regional offices keep a Windows file server each, synchronised by Azure File Sync with cloud tiering so only recent projects use local disk."]),
    config=cfg(["Azure Migrate > Servers, databases and web apps: discover and assess.", "Data Box > Order.", "Storage Sync Services > Create; register servers; create sync groups."],
               "azcopy login\nazcopy copy ./footage \"https://<account>.blob.core.windows.net/raw\" --recursive\nazcopy sync ./footage \"https://<account>.blob.core.windows.net/raw\"",
               "New-AzStorageSyncService -ResourceGroupName <rg> -Name sync1 -Location westeurope"),
    lab=lab("Estimate transfers and choose migration tools.", ["Moving data and migrating tab: try different sizes and link speeds.", "Moving files and migrating tab: answer every task."],
            ["Large data on slow links → Data Box", "File Sync keeps a local cache"], [("migration-correct", "Chose the right transfer tool"), ("migration-wrong", "Saw a slower option")] + chooser_checks("move-tools", "tool"),
            ["Sending hundreds of TB over a slow internet link"]),
    troubleshooting=[("Copy job fails after a network interruption.", "Long transfers are interrupted.", "AzCopy jobs can resume: azcopy jobs resume <id>."),
                     ("Local file server disk fills up.", "Cloud tiering isn't enabled.", "Enable cloud tiering with a free-space policy.")],
    comparisons=[("AzCopy vs Storage Explorer", "AzCopy is scriptable command line; Storage Explorer is a GUI built on AzCopy."), ("Azure Migrate vs Data Box", "Migrate is the assessment and migration hub; Data Box is one offline transfer option it includes.")],
    misconceptions=[("Azure File Sync replaces your file server entirely.", "It keeps the server as a cache synced with Azure Files."), ("Data Box only imports data.", "It can export data from Azure too.")],
    decisions=["Assess before migrating with Azure Migrate.", "Use Data Box when online transfer would take too long.", "Script recurring copies with AzCopy."],
    docs=[("Describe Azure storage services (Learn)", STO), ("Get started with AzCopy", ML + "azure/storage/common/storage-use-azcopy-v10"), ("Azure File Sync introduction", ML + "azure/storage/file-sync/file-sync-introduction"),
          ("Azure Migrate overview", ML + "azure/migrate/migrate-services-overview"), ("Azure Data Box", ML + "azure/databox/data-box-overview"), ("Azure Storage Explorer", "https://azure.microsoft.com/products/storage/storage-explorer/")],
)
qq("AZ900-2.3.5", 2, "scenario", "An admin wants a graphical desktop tool to browse containers and upload files on macOS. What should they use?", [("Azure Storage Explorer", "Correct."), ("AzCopy", "Command line."), ("Azure File Sync", "Server sync."), ("Azure Migrate", "Migration hub.")], "a", "Storage Explorer is the GUI.", STO)
qq("AZ900-2.3.5", 2, "scenario", "Branch offices must keep fast local access to shared files while the master copy lives in Azure. What should you use?", [("Azure File Sync", "Correct."), ("AzCopy", "Copies, doesn't cache."), ("Data Box", "Offline transfer."), ("Archive tier", "No.")], "a", "File Sync caches Azure Files on Windows Server.", ML + "azure/storage/file-sync/file-sync-introduction")
qq("AZ900-2.3.6", 2, "scenario", "Before migrating, you must discover on-premises servers and estimate their Azure size and cost. Which service?", [("Azure Migrate", "Correct."), ("Azure Data Box", "Transfer device."), ("AzCopy", "File copy."), ("Azure Advisor", "Recommendations for existing Azure resources.")], "a", "Discovery and assessment.", ML + "azure/migrate/migrate-services-overview")
qq("AZ900-2.3.6", 2, "scenario", "You must move 300 TB to Azure but have only a 50 Mbps internet link. What should you use?", [("Azure Data Box", "Correct."), ("AzCopy over the internet", "Would take over a year."), ("Azure Storage Explorer", "Same link."), ("ExpressRoute ordered today", "Slow to provision.")], "a", "Ship the data offline.", ML + "azure/databox/data-box-overview")

# ================================================================ 2.4.1–2.4.3
lesson(
    id="az900-entra-authentication", exam=E, title="Microsoft Entra ID, authentication methods and external identities",
    objectives=["AZ900-2.4.1", "AZ900-2.4.2", "AZ900-2.4.3"], minutes=40,
    objective="Describe Microsoft Entra ID and Microsoft Entra Domain Services, SSO, MFA and passwordless authentication, and external identities.",
    prereqs=[("Shared responsibility: accounts and identities", "AZ900-1.1.2", "az900-cloud-basics")],
    foundation=[
        "Microsoft Entra ID is Microsoft's cloud identity service. It signs users in to Azure, Microsoft 365 and thousands of other apps, and protects those sign-ins.",
        "Microsoft Entra Domain Services gives you an old-style Windows domain (domain join, Group Policy, LDAP, Kerberos) as a managed service, for legacy apps, without running domain controllers yourself.",
        "Authentication proves who you are. SSO: sign in once, use many apps. MFA: a password plus something you have (phone) or are (fingerprint). Passwordless: no password at all.",
        "External identities let people outside your organisation (partners, customers) sign in to your apps with their own accounts.",
    ],
    engineer=[
        "Entra ID capabilities: authentication (verify identity, self-service password reset, MFA, banned password lists, smart lockout), single sign-on, application management, device management (register devices, Intune policies). Hybrid: Microsoft Entra Connect synchronises on-premises AD identities to Entra ID.",
        "Entra Domain Services: managed domain with two domain controllers deployed and maintained by Microsoft; one-way sync from Entra ID; supports legacy protocols (Kerberos, NTLM, LDAP) and Group Policy for lift-and-shift apps. It's not a replacement for on-premises AD and doesn't sync back.",
        "MFA factors: something you know (password), something you have (phone, hardware key), something you are (fingerprint, face). Microsoft Entra multifactor authentication supports Authenticator app notifications, codes, SMS and voice.",
        "Passwordless options: Windows Hello for Business (biometric/PIN tied to a device), Microsoft Authenticator app, FIDO2 security keys, and passkeys. Phishing-resistant and convenient.",
        "External identities (Microsoft Entra External ID): B2B collaboration (invite partners as guest users who use their own identity), B2B direct connect (mutual trust, for Teams shared channels), and External ID for customers (sign-up/sign-in for consumer and business customer apps, including social providers). Microsoft Entra ID P1/P2 add Conditional Access and identity protection for guests too.",
    ],
    anim=("az900-entra-sim", "Pick the identity service, match authentication methods, and sign in as an employee or a guest."),
    diagram=([("ad", "On-premises AD", 0, 0, "identity"), ("connect", "Entra Connect sync", 0, 140, "network"), ("entra", "Microsoft Entra ID", 260, 70, "identity"), ("ds", "Entra Domain Services (managed domain)", 520, 0, "identity"), ("apps", "SaaS + Azure apps (SSO)", 520, 140, "compute"), ("guest", "Partners and customers (External ID)", 260, 230, "user")],
             [("ad", "connect"), ("connect", "entra"), ("entra", "ds", "one-way sync"), ("entra", "apps", "SSO"), ("guest", "entra")]),
    example=("A consultancy", ["Staff sign in once to Microsoft 365, the Azure portal and Salesforce (SSO) using Windows Hello (passwordless). Contractors must approve an Authenticator notification (MFA).",
                               "Client employees are invited as B2B guests to a project site using their own company accounts, and an old timesheet app moved to Azure joins a Microsoft Entra Domain Services managed domain."]),
    config=cfg(["Microsoft Entra admin center > Users / Groups / External Identities.", "Protection > Authentication methods: enable passkeys, Authenticator, FIDO2.", "Microsoft Entra Domain Services > Create."],
               "az ad user list --query \"[].userPrincipalName\" -o tsv\naz ad user create --display-name \"Ana\" --user-principal-name ana@contoso.onmicrosoft.com --password <temp>",
               "Connect-MgGraph -Scopes User.Read.All\nGet-MgUser -Top 5", perms=("User Administrator or Global Administrator for identity settings",)),
    lab=lab("Choose identity services and authentication methods.", ["Directory and external identities tab: answer every need.", "Authentication methods tab: answer every description.", "Sign-in and access tab: sign in as a B2B guest and as an employee."],
            ["Domain Services is for legacy protocols", "Passwordless removes the password"], chooser_checks("directory", "identity service") + chooser_checks("auth-methods", "authentication method") + [("signin-ok", "Completed a sign-in")],
            ["Using Domain Services instead of Entra ID for modern apps", "Calling SMS-only sign-in 'passwordless MFA'"]),
    troubleshooting=[("A legacy app requires LDAP binds in Azure.", "Entra ID doesn't speak LDAP.", "Use Microsoft Entra Domain Services."),
                     ("Partners need accounts in your tenant and forget passwords.", "Local accounts were created for them.", "Use B2B collaboration so they use their own identity.")],
    comparisons=[("Entra ID vs Active Directory Domain Services", "Entra ID is cloud identity using modern protocols (OAuth, SAML, OpenID Connect); AD DS is on-premises using Kerberos/LDAP."), ("B2B vs External ID for customers", "B2B is for partners collaborating in your workforce tenant; customer identity is for consumer-facing apps.")],
    misconceptions=[("Entra ID is just Active Directory in the cloud.", "It's a different service with modern protocols."), ("SSO means less security.", "With MFA and Conditional Access, SSO reduces password reuse."), ("Guests need accounts created for them.", "They sign in with their own identity.")],
    decisions=["Turn on MFA for everyone; move to passwordless where possible.", "Use B2B for partner access instead of local accounts.", "Use Domain Services only for legacy needs."],
    docs=[("Describe Azure identity, access, and security (Learn)", IDS), ("What is Microsoft Entra ID?", ML + "entra/fundamentals/whatis"), ("Microsoft Entra Domain Services", ML + "entra/identity/domain-services/overview"),
          ("Passwordless authentication options", ML + "entra/identity/authentication/concept-authentication-passwordless"), ("External ID overview", ML + "entra/external-id/external-identities-overview")],
)
qq("AZ900-2.4.1", 2, "scenario", "A lift-and-shifted app needs Kerberos authentication and domain join in Azure, but the company doesn't want to manage domain controllers. What should it use?", [("Microsoft Entra Domain Services", "Correct."), ("Microsoft Entra ID only", "No Kerberos/LDAP."), ("Azure Policy", "Governance."), ("Azure DNS", "Names only.")], "a", "Managed domain services.", ML + "entra/identity/domain-services/overview")
qq("AZ900-2.4.1", 1, "single", "What is Microsoft Entra ID?", [("Microsoft's cloud-based identity and access management service", "Correct."), ("A VM-based domain controller", "No."), ("A firewall", "No."), ("A billing service", "No.")], "a", "Cloud identity.", ML + "entra/fundamentals/whatis")
qq("AZ900-2.4.2", 2, "multiple", "Which TWO are passwordless authentication methods?", [("Windows Hello for Business", "Correct."), ("FIDO2 security keys", "Correct."), ("Password plus SMS code", "MFA with a password."), ("Security questions", "Knowledge-based.")], "ab", "Passwordless removes the password.", ML + "entra/identity/authentication/concept-authentication-passwordless")
qq("AZ900-2.4.2", 1, "single", "What does single sign-on allow?", [("Signing in once to access multiple applications", "Correct."), ("Using two factors", "MFA."), ("Signing in without a device", "No."), ("Sharing one account among users", "No.")], "a", "One sign-in, many apps.", IDS)
qq("AZ900-2.4.3", 2, "scenario", "A supplier's employees must access your SharePoint site with their own corporate credentials. What should you use?", [("Microsoft Entra B2B collaboration", "Correct."), ("Create accounts for them in your tenant", "Extra credentials to manage."), ("Microsoft Entra Domain Services", "Legacy domain."), ("A VPN", "Network, not identity.")], "a", "B2B guests use their own identity.", ML + "entra/external-id/external-identities-overview")

# ================================================================ 2.4.4–2.4.5
lesson(
    id="az900-conditional-access-rbac", exam=E, title="Conditional Access and Azure role-based access control",
    objectives=["AZ900-2.4.4", "AZ900-2.4.5"], minutes=35,
    objective="Describe how Microsoft Entra Conditional Access uses signals to make access decisions, and how Azure RBAC grants permissions at a scope.",
    prereqs=[("Authentication methods", "AZ900-2.4.2", "az900-entra-authentication"), ("Resource hierarchy", "AZ900-2.1.7", "az900-resource-hierarchy")],
    foundation=[
        "Conditional Access is an if-then engine for sign-ins: IF a user signs in from an unknown country, THEN require MFA (or block). It looks at who, where, what device and which app.",
        "Azure role-based access control (RBAC) decides what a signed-in person can do with Azure resources. You assign a role (for example Reader) to a person or group at a scope (for example a resource group).",
        "Authentication is 'who are you?' (Entra ID, MFA, Conditional Access). Authorization is 'what may you do?' (RBAC).",
    ],
    engineer=[
        "Conditional Access signals: user or group membership, location (IP ranges, countries), device (platform, compliant or hybrid-joined), application, sign-in and user risk (with Microsoft Entra ID P2). Decisions: block access; grant access; grant with requirements (MFA, compliant device, approved app, password change, terms of use). Requires Microsoft Entra ID P1.",
        "Common policies: require MFA for administrators; require MFA from outside trusted locations; block legacy authentication; require compliant devices for sensitive apps; block sign-ins from certain countries.",
        "RBAC elements: security principal (user, group, service principal, managed identity) + role definition (set of permissions) + scope (management group, subscription, resource group, resource) = role assignment.",
        "Built-in roles: Owner (full access including access management), Contributor (full resource management, no access management), Reader (view only), User Access Administrator (manage access only), plus 100s of service-specific roles (for example Virtual Machine Contributor). You can create custom roles.",
        "RBAC is additive and inherited down the hierarchy; it's enforced on any action through Azure Resource Manager (portal, CLI, PowerShell, templates). Follow least privilege: smallest role, narrowest scope, groups instead of individuals.",
    ],
    anim=("az900-access-sim", "Sign in with different methods, locations and roles; pick the least-privileged built-in role."),
    diagram=([("u", "User signs in", 0, 60, "user"), ("signals", "Signals: user, location, device, app, risk", 220, 0, "scope"), ("ca", "Conditional Access: block / MFA / allow", 440, 60, "security"), ("rbac", "RBAC: role + scope", 660, 60, "identity"), ("res", "Azure resource", 880, 60, "compute")],
             [("u", "ca"), ("signals", "ca"), ("ca", "rbac", "authenticated"), ("rbac", "res", "authorized")]),
    example=("A finance team", ["Policy: IF a finance app is opened from outside the office, THEN require MFA and a compliant device. Sign-ins from countries where the company doesn't operate are blocked.",
                                "In Azure, the finance-ops group has Contributor on rg-finance only; auditors have Reader on the subscription; nobody gets Owner except two admins."]),
    config=cfg(["Microsoft Entra admin center > Protection > Conditional Access > New policy (users, target resources, conditions, grant).", "Resource / resource group / subscription > Access control (IAM) > Add role assignment."],
               "az role assignment create --assignee <user-or-group-id> --role Reader --scope /subscriptions/<sub>/resourceGroups/rg-finance\naz role definition list --query \"[?roleType=='BuiltInRole'].roleName\" -o tsv | head",
               "New-AzRoleAssignment -ObjectId <id> -RoleDefinitionName Reader -ResourceGroupName rg-finance", perms=("Owner or User Access Administrator to assign Azure roles; Conditional Access Administrator for policies",),
               limits=("Conditional Access requires Microsoft Entra ID P1 or higher",)),
    lab=lab("See authentication, Conditional Access and RBAC decisions.", ["Sign-in and access tab: run the default, then each preset; change role and action.", "Built-in Azure roles tab: answer every requirement."],
            ["MFA satisfies the Conditional Access policy", "RBAC decides the action after sign-in"], [("signin-ok", "Completed a sign-in with access"), ("signin-blocked", "Saw access blocked")] + chooser_checks("rbac-role", "role"),
            ["Giving Owner when Contributor is enough", "Confusing Conditional Access (authentication) with RBAC (authorization)"]),
    troubleshooting=[("User signed in but gets 'authorization failed'.", "No role assignment at that scope.", "Assign the needed role at the right scope."),
                     ("Users outside the office can't sign in at all.", "A policy blocks instead of requiring MFA.", "Change the grant control to 'Require MFA'.")],
    comparisons=[("Conditional Access vs RBAC", "Conditional Access controls sign-in conditions; RBAC controls actions on Azure resources."), ("Azure RBAC vs Entra roles", "Azure roles manage Azure resources; Microsoft Entra roles (such as User Administrator) manage the directory.")],
    misconceptions=[("Contributor can grant access to others.", "Only Owner or User Access Administrator."), ("Conditional Access is included in every Entra ID edition.", "It requires P1."), ("Deny is the default role effect.", "RBAC is additive; no assignment means no access.")],
    decisions=["Assign roles to groups at the narrowest scope.", "Require MFA for all admins with Conditional Access.", "Review role assignments regularly."],
    docs=[("Describe Azure identity, access, and security (Learn)", IDS), ("What is Conditional Access?", ML + "entra/identity/conditional-access/overview"), ("What is Azure RBAC?", ML + "azure/role-based-access-control/overview"), ("Azure built-in roles", ML + "azure/role-based-access-control/built-in-roles")],
)
qq("AZ900-2.4.4", 2, "scenario", "Users must complete MFA only when signing in from outside the corporate network. What should you configure?", [("A Conditional Access policy", "Correct."), ("An Azure Policy", "Resource rules."), ("A resource lock", "No."), ("An RBAC role", "Authorization.")], "a", "Conditional Access uses location signals.", ML + "entra/identity/conditional-access/overview")
qq("AZ900-2.4.4", 2, "multiple", "Which TWO are signals Conditional Access can evaluate?", [("The user's location (IP address)", "Correct."), ("The device's compliance state", "Correct."), ("The VM size", "No."), ("The storage account's redundancy", "No.")], "ab", "User, location, device, app, risk.", ML + "entra/identity/conditional-access/overview")
qq("AZ900-2.4.5", 2, "scenario", "A developer must create and manage resources in one resource group but must not grant access to others. Which role and scope?", [("Contributor on that resource group", "Correct."), ("Owner on the subscription", "Too broad."), ("Reader on the resource group", "Can't manage."), ("User Access Administrator", "Access only.")], "a", "Least privilege at the narrowest scope.", ML + "azure/role-based-access-control/built-in-roles")
qq("AZ900-2.4.5", 1, "single", "In Azure RBAC, a role assignment consists of:", [("A security principal, a role definition and a scope", "Correct."), ("A policy, an effect and a lock", "Azure Policy terms."), ("A user, a password and a device", "No."), ("A region, a zone and a datacenter", "No.")], "a", "Who, what, where.", ML + "azure/role-based-access-control/overview")

# ================================================================ 2.4.6–2.4.8
lesson(
    id="az900-zero-trust-defender", exam=E, title="Zero Trust, defense in depth and Microsoft Defender for Cloud",
    objectives=["AZ900-2.4.6", "AZ900-2.4.7", "AZ900-2.4.8"], minutes=35,
    objective="Describe the Zero Trust model, the layers of defense in depth, and what Microsoft Defender for Cloud does.",
    prereqs=[("Conditional Access and RBAC", "AZ900-2.4.4", "az900-conditional-access-rbac")],
    foundation=[
        "Zero Trust: 'never trust, always verify'. Don't assume a request is safe because it comes from inside the corporate network; check every request as if it came from an open network.",
        "Defense in depth: protect data with several layers of security, like a castle with a moat, walls and guards. If one layer fails, the next one stops the attacker.",
        "Microsoft Defender for Cloud: a monitoring tool that checks your resources' security, gives you a secure score and recommendations, and alerts you to threats, in Azure, on-premises and other clouds.",
    ],
    engineer=[
        "Zero Trust principles: verify explicitly (authenticate and authorise on all available data points: identity, location, device health, service, data classification, anomalies); use least privilege access (just-in-time and just-enough access, risk-based adaptive policies); assume breach (minimise blast radius, segment access, verify end-to-end encryption, use analytics to detect threats).",
        "Defense-in-depth layers (outer to inner): physical security (datacenter buildings), identity and access (SSO, MFA, auditing), perimeter (DDoS protection, perimeter firewalls), network (segmentation, NSGs, deny by default), compute (patching, endpoint protection, closing ports), application (secure code, secrets in Key Vault), data (encryption, access control). The goal: protect information and prevent it from being stolen.",
        "Microsoft Defender for Cloud: cloud security posture management (CSPM: continuous assessment, secure score, recommendations against benchmarks such as the Microsoft cloud security benchmark) and cloud workload protection (Defender plans for servers, storage, SQL, containers, Key Vault and more: threat detection and alerts).",
        "Coverage: Azure-native resources automatically; on-premises and other clouds through Azure Arc and native connectors for AWS and GCP. Foundational CSPM is free; enhanced plans are paid.",
        "Assess, secure, defend: assess with continuous inventory and recommendations; secure by remediating (often with one-click fixes or Azure Policy); defend with alerts that include affected resources and remediation steps.",
    ],
    anim=("az900-defense-sim", "Close defense-in-depth gaps with Defender for Cloud guidance, and match practices to Zero Trust principles and layers."),
    diagram=([("phys", "Physical", 0, 0, "security"), ("id", "Identity & access", 120, 0, "identity"), ("per", "Perimeter", 240, 0, "security"), ("net", "Network", 360, 0, "network"), ("comp", "Compute", 480, 0, "compute"), ("app", "Application", 600, 0, "compute"), ("data", "Data", 720, 0, "storage"), ("def", "Defender for Cloud: secure score, alerts", 360, 150, "security")],
             [("phys", "id"), ("id", "per"), ("per", "net"), ("net", "comp"), ("comp", "app"), ("app", "data"), ("def", "net", "assess"), ("def", "comp", "protect")]),
    example=("A ransomware attempt", ["An attacker phishes a password. MFA stops the sign-in (identity layer). A second attempt through a VM with an open port is blocked by an NSG (network layer).",
                                      "Defender for Cloud had already raised 'Management ports should be closed' and a high-severity alert; the team followed its remediation steps. Assuming breach, data was encrypted and segmented anyway."]),
    config=cfg(["Microsoft Defender for Cloud > Overview: secure score; Recommendations; Security alerts.", "Environment settings: enable Defender plans; add AWS/GCP connectors."],
               "az security secure-scores list -o table\naz security assessment list --query \"[?status.code=='Unhealthy'].displayName\" -o tsv | head\naz security pricing list -o table",
               "Get-AzSecuritySecureScore\nGet-AzSecurityAlert", perms=("Security Reader to view; Security Admin to change settings",), limits=("Foundational CSPM is free; Defender plans are billed per resource",)),
    lab=lab("Build layered defenses and apply Zero Trust.", ["Defense in depth tab: enable layers until no gaps remain.", "Zero Trust principles tab: answer every practice.", "Defense-in-depth layers tab: answer every control."],
            ["One gap shouldn't expose data", "Zero Trust verifies every request"], [("defense-complete", "Protected every layer"), ("defense-gaps", "Found a gap")] + chooser_checks("zero-trust", "Zero Trust principle") + chooser_checks("defense-layer", "layer"),
            ["Trusting traffic because it's inside the network", "Relying on one layer only"]),
    troubleshooting=[("Secure score is low.", "Many unhealthy recommendations.", "Fix the highest-impact recommendations first (score increase shown)."),
                     ("No alerts for on-premises servers.", "They aren't connected.", "Onboard with Azure Arc and enable Defender for Servers.")],
    comparisons=[("Zero Trust vs perimeter security", "Perimeter security trusts everything inside the network; Zero Trust verifies every request."), ("Defender for Cloud vs Azure Advisor", "Both give recommendations; Defender focuses on security and threat protection. Advisor's security recommendations come from Defender.")],
    misconceptions=[("Zero Trust means trusting nobody, so blocking everything.", "It means verifying explicitly before granting least-privilege access."), ("Defender for Cloud only covers Azure.", "It covers hybrid and multicloud too."), ("A firewall is enough.", "Defense in depth needs several layers.")],
    decisions=["Adopt Zero Trust: MFA, least privilege, segmentation.", "Track and improve secure score.", "Enable Defender plans for critical workloads."],
    docs=[("Describe Azure identity, access, and security (Learn)", IDS), ("Zero Trust overview", ML + "security/zero-trust/zero-trust-overview"), ("Microsoft Defender for Cloud", ML + "azure/defender-for-cloud/defender-for-cloud-introduction"), ("Secure score", ML + "azure/defender-for-cloud/secure-score-security-controls")],
)
qq("AZ900-2.4.6", 2, "single", "Which is a Zero Trust principle?", [("Assume breach", "Correct."), ("Trust the internal network", "Opposite of Zero Trust."), ("Grant broad access to reduce friction", "Least privilege instead."), ("Verify only at the perimeter", "Verify explicitly every time.")], "a", "Verify explicitly, least privilege, assume breach.", ML + "security/zero-trust/zero-trust-overview")
qq("AZ900-2.4.6", 2, "scenario", "Admins get elevated rights only for the time needed to complete a task. Which Zero Trust principle is this?", [("Use least privilege access", "Correct: just-in-time."), ("Verify explicitly", "Authentication signals."), ("Assume breach", "Blast radius."), ("Defense in depth", "Layering model.")], "a", "Just-in-time, just-enough access.", ML + "security/zero-trust/zero-trust-overview")
qq("AZ900-2.4.7", 2, "scenario", "Network security groups that limit traffic between subnets protect which defense-in-depth layer?", [("Network", "Correct."), ("Perimeter", "Edge: DDoS, firewalls."), ("Physical security", "Buildings."), ("Data", "Encryption and access.")], "a", "Segmentation is the network layer.", IDS)
qq("AZ900-2.4.7", 1, "single", "What is the main goal of defense in depth?", [("Slow and stop attacks with multiple layers so one failure doesn't expose data", "Correct."), ("Use one very strong firewall", "Single layer."), ("Encrypt only backups", "One control."), ("Speed up networks", "No.")], "a", "Layered protection.", IDS)
qq("AZ900-2.4.8", 2, "single", "What does Microsoft Defender for Cloud provide?", [("Security posture assessment (secure score, recommendations) and threat protection", "Correct."), ("Cost forecasts", "Cost Management."), ("DNS hosting", "Azure DNS."), ("Backup of VMs", "Azure Backup.")], "a", "CSPM and workload protection.", ML + "azure/defender-for-cloud/defender-for-cloud-introduction")
qq("AZ900-2.4.8", 2, "scenario", "You want Defender for Cloud to assess servers in your own datacenter and in AWS. What enables this?", [("Azure Arc and the AWS connector", "Correct."), ("Nothing: it can't", "It can."), ("A VPN gateway only", "Network, not onboarding."), ("Azure DNS", "No.")], "a", "Defender for Cloud is multicloud and hybrid.", ML + "azure/defender-for-cloud/defender-for-cloud-introduction")

# ---------------------------------------------------------------- extra practice
qq("AZ900-2.1.3", 2, "scenario", "A company asks to deploy its VMs into a specific Azure datacenter building. What should you tell them?", [("You choose a region (and optionally a zone); Azure places resources in datacenters", "Correct."), ("Select the datacenter in the VM's Networking tab", "No such option."), ("Use a region pair", "Pairs are regions."), ("Use a management group", "Organisation, not location.")], "a", "Datacenters are abstracted behind regions and zones.", ARCH)
qq("AZ900-2.1.5", 2, "scenario", "Developers must be isolated from production with separate access control and spending. What is the simplest boundary?", [("Separate subscriptions for development and production", "Correct."), ("Separate resource groups in one subscription", "Same billing boundary."), ("Tags env=dev and env=prod", "Labels only."), ("Separate regions", "Not an access boundary.")], "a", "Subscriptions are access and billing boundaries.", ARCH)
qq("AZ900-2.1.6", 2, "single", "How many levels deep can a management group hierarchy go (excluding the root and subscriptions)?", [("Six", "Correct."), ("Two", "No."), ("Unlimited", "No."), ("Ten", "No.")], "a", "Up to six levels.", ML + "azure/governance/management-groups/overview")
qq("AZ900-2.4.3", 2, "scenario", "A consumer shopping app needs customers to sign up with their email or a social account. What should you use?", [("Microsoft Entra External ID for customers", "Correct."), ("B2B collaboration", "Partners in your workforce tenant."), ("Microsoft Entra Domain Services", "Legacy domain."), ("Azure RBAC", "Authorisation.")], "a", "Customer identity in an external tenant.", ML + "entra/external-id/external-identities-overview")
