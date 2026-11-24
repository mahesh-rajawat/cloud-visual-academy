"""AZ-900 domain 1: Describe cloud concepts (25–30%). Six focused lessons."""
from _az900 import E, ML, TR, anim, cfg, chooser_checks, lab, qq
from builder import lesson

CC = TR + "describe-cloud-compute/"
BEN = TR + "describe-benefits-use-cloud-services/"
ST = TR + "describe-cloud-service-types/"
SR = ML + "azure/security/fundamentals/shared-responsibility"

anim("az900-cloud-basics-sim", "Cloud characteristics and shared responsibility", ["AZ900-1.1.1", "AZ900-1.1.2"],
     "Match situations to cloud characteristics, then decide who is responsible for each layer in on-premises, IaaS, PaaS and SaaS.", "accurate-model")
anim("az900-cloud-models-sim", "Public, private, hybrid and multicloud", ["AZ900-1.1.3", "AZ900-1.1.4"], "Choose a cloud model for each scenario, then pick the Azure option for hybrid needs.")
anim("az900-pricing-sim", "Consumption pricing, pricing models and serverless", ["AZ900-1.1.5", "AZ900-1.1.6", "AZ900-1.1.7"], "Compare fixed capacity with consumption billing over a year of variable demand, then pick a pricing option for each workload.")
anim("az900-benefits-sim", "High availability, scalability, reliability and predictability", ["AZ900-1.2.1", "AZ900-1.2.2"], "Calculate a composite SLA and see autoscaling, then match situations to cloud benefits.")
anim("az900-manage-sim", "Security, governance and manageability", ["AZ900-1.2.3", "AZ900-1.2.4"], "Match capabilities to security, governance or manageability, and find where to get compliance assurance.")
anim("az900-service-types-sim", "IaaS, PaaS and SaaS", ["AZ900-1.3.1", "AZ900-1.3.2", "AZ900-1.3.3", "AZ900-1.3.4"], "Pick a service type for each workload and classify Azure and Microsoft products.")

# ================================================================ 1.1.1–1.1.2
lesson(
    id="az900-cloud-basics", exam=E, title="What cloud computing is, and who secures what",
    objectives=["AZ900-1.1.1", "AZ900-1.1.2"], minutes=35,
    objective="Define cloud computing by its characteristics and explain the shared responsibility model for on-premises, IaaS, PaaS and SaaS.",
    prereqs=["Basic IT ideas: a server, a disk, a network"],
    foundation=[
        "Cloud computing is the delivery of computing services (servers, storage, databases, networking, software, analytics) over the internet. Instead of buying and running hardware, you rent what you need and pay for what you use.",
        "Think of electricity: you don't build a power station, you plug in and pay for the kilowatt-hours you consume. The cloud does the same for computing.",
        "Shared responsibility: moving to the cloud doesn't hand all security to the provider. Microsoft always secures the physical datacenters. You always own your data, your devices, and your accounts and identities. The layers in between move from you to Microsoft as you go from IaaS to PaaS to SaaS.",
        "If someone steals a user's password, that is the customer's problem in every model, even in SaaS.",
    ],
    engineer=[
        "Five characteristics (the NIST definition Microsoft Learn uses): on-demand self-service (provision without asking a person), broad network access (any device, over the network), resource pooling (shared, multi-tenant hardware, isolated per customer), rapid elasticity (scale out and in quickly) and measured service (usage is metered and billed).",
        "What you get: compute (VMs, containers, functions), storage (blobs, files, disks), networking (virtual networks, load balancers, gateways), and managed services (databases, AI, analytics) running in Microsoft's global datacenters.",
        "Shared responsibility, layer by layer. Always customer: information and data; devices (mobile and PCs); accounts and identities. Always Microsoft: physical hosts, physical network, physical datacenter.",
        "Varies by model. Identity and directory infrastructure: customer in IaaS, shared in PaaS and SaaS. Applications: customer in IaaS, shared in PaaS, Microsoft in SaaS. Network controls: customer in IaaS, shared in PaaS, Microsoft in SaaS. Operating system: customer in IaaS, Microsoft in PaaS and SaaS.",
        "On-premises: the customer is responsible for every layer, including the building, power and hardware.",
        "Practical effect: in IaaS you patch the guest OS and configure NSGs; in PaaS you secure your code and access configuration while Microsoft patches the OS; in SaaS you configure users, MFA and data sharing.",
    ],
    anim=("az900-cloud-basics-sim", "Match cloud characteristics, then assign each layer to the customer, Microsoft or both."),
    diagram=([("cust", "Always customer: data, devices, accounts", 0, 0, "user"), ("shift", "Shifts with the model: OS, network controls, apps, identity infrastructure", 260, 0, "scope"),
              ("ms", "Always Microsoft: physical hosts, network, datacenter", 560, 0, "security"), ("iaas", "IaaS: you manage OS and up", 140, 140, "compute"), ("paas", "PaaS: you manage apps and data", 340, 140, "compute"), ("saas", "SaaS: you manage data and access", 540, 140, "compute")],
             [("shift", "iaas", "mostly customer"), ("shift", "paas", "shared"), ("shift", "saas", "mostly Microsoft")]),
    example=("A clinic moves to the cloud", [
        "A clinic moves its booking app to Azure App Service (PaaS) and email to Microsoft 365 (SaaS). Microsoft now patches the web server OS and runs the email servers.",
        "The clinic still owns patient data, staff laptops and user accounts. When a receptionist's password leaked, the clinic, not Microsoft, had to reset it and turn on MFA.",
    ]),
    config=cfg(["Sign in at portal.azure.com and open 'All services' to see the catalogue of rentable services.", "Open a resource > Overview: note the location (a Microsoft datacenter region) and pricing tier.", "Microsoft Defender for Cloud > Recommendations shows the customer-side security tasks for your resources."],
               "az account show -o table\naz account list-locations -o table", "Get-AzContext\nGet-AzLocation | Select-Object DisplayName, Location"),
    lab=lab("Recognise cloud characteristics and assign responsibilities correctly.",
            ["Cloud characteristics tab: match all five situations.", "Shared responsibility tab: test SaaS + Information and data, IaaS + Operating system, PaaS + Applications.", "Try On-premises + Physical datacenter to see the contrast."],
            ["Data, devices, accounts and identities are always the customer's", "The OS moves to Microsoft in PaaS"],
            chooser_checks("cloud-traits", "cloud characteristic") + [("responsibility-correct", "Assigned a responsibility correctly"), ("responsibility-wrong", "Corrected a wrong assignment")],
            ["Assuming a SaaS provider is responsible for your users' passwords", "Assuming IaaS VMs are patched by Microsoft"]),
    troubleshooting=[("A breach happened through a SaaS user account with a weak password.", "Accounts and identities are always the customer's responsibility.", "Enforce MFA and Conditional Access; train users."),
                     ("A VM in Azure was compromised through an unpatched OS.", "In IaaS the customer patches the guest OS.", "Use Azure Update Manager and Defender for Cloud recommendations.")],
    comparisons=[("Traditional hosting", "Fixed servers on a contract; no self-service elasticity or per-second metering."), ("AWS shared responsibility", "Same idea: the provider secures 'of the cloud', the customer secures 'in the cloud'.")],
    misconceptions=[("In the cloud, the provider is responsible for security.", "Security is shared. Data, devices, accounts and identities are always yours."),
                    ("Cloud means everything is public on the internet.", "Cloud resources can be private, reachable only from your networks."),
                    ("Resource pooling means other customers can see your data.", "Pooling shares hardware; tenants are logically isolated.")],
    decisions=["Choose the model (IaaS/PaaS/SaaS) partly by how much responsibility you want to keep.", "Whatever the model, invest in identity protection: it is always yours."],
    docs=[("Describe cloud computing (Microsoft Learn module)", CC), ("Shared responsibility in the cloud", SR), ("What is cloud computing?", "https://azure.microsoft.com/resources/cloud-computing-dictionary/what-is-cloud-computing")],
)
qq("AZ900-1.1.1", 1, "single", "Which characteristic of cloud computing lets you pay only for the storage and compute you actually use?", [("Measured service", "Correct: usage is metered."), ("Broad network access", "Access from many devices."), ("Resource pooling", "Shared hardware."), ("High availability", "A benefit, not a characteristic.")], "a", "Metering enables consumption billing.", CC)
qq("AZ900-1.1.1", 2, "scenario", "An online retailer's capacity automatically doubles during a sale and shrinks afterwards. Which cloud characteristic is this?", [("Rapid elasticity", "Correct."), ("On-demand self-service", "Provisioning without a person."), ("Resource pooling", "Shared hardware."), ("Broad network access", "Device access.")], "a", "Elasticity adds and removes resources with demand.", CC)
qq("AZ900-1.1.1", 1, "multiple", "Which TWO statements describe cloud computing?", [("Services are delivered over a network and can be provisioned on demand", "Correct."), ("You typically pay for what you use", "Correct."), ("You must buy hardware before using it", "That is on-premises."), ("Resources can only be reached from inside the provider's buildings", "Broad network access.")], "ab", "On-demand services, paid by use.", CC)
qq("AZ900-1.1.2", 2, "scenario", "Your company uses Azure SQL Database (PaaS). Who is responsible for patching the database server's operating system?", [("Microsoft", "Correct: the OS is Microsoft's in PaaS."), ("Your company", "That is IaaS."), ("Shared equally", "No."), ("The internet service provider", "No.")], "a", "In PaaS, the provider manages the OS.", SR)
qq("AZ900-1.1.2", 2, "scenario", "You run SQL Server on an Azure virtual machine. Which task is your responsibility?", [("Installing operating system security updates", "Correct: IaaS guest OS."), ("Replacing failed disks in the host", "Physical: Microsoft."), ("Physical access control to the datacenter", "Microsoft."), ("Cooling the server racks", "Microsoft.")], "a", "In IaaS, the guest OS is yours.", SR)
qq("AZ900-1.1.2", 1, "multiple", "Which TWO responsibilities stay with the customer for every cloud service type?", [("Accounts and identities", "Correct."), ("Information and data", "Correct."), ("Physical network", "Always Microsoft."), ("Operating system", "Varies by model.")], "ab", "Data, devices, accounts and identities stay with you.", SR)

# ================================================================ 1.1.3–1.1.4
lesson(
    id="az900-cloud-models", exam=E, title="Public, private, hybrid and multicloud",
    objectives=["AZ900-1.1.3", "AZ900-1.1.4"], minutes=30,
    objective="Define public, private and hybrid cloud (and multicloud), and choose the right model for a scenario.",
    prereqs=[("Cloud computing basics", "AZ900-1.1.1", "az900-cloud-basics")],
    foundation=[
        "Public cloud: a provider (such as Microsoft) owns and runs the infrastructure and sells services to anyone over the internet. No hardware to buy; you can start in minutes.",
        "Private cloud: cloud capabilities (self-service, automation) used by one organisation only, usually in its own datacenter. Full control, but you buy and run everything.",
        "Hybrid cloud: public and private cloud connected so they work together. Keep some systems on-premises and use the public cloud for the rest or for extra capacity.",
        "Multicloud: using more than one public cloud provider (for example Azure and AWS) at the same time.",
    ],
    engineer=[
        "Public cloud strengths: no capital expense, fast provisioning, global reach, pay per use, elastic scale. Trade-off: less control over hardware and exact location within a region.",
        "Private cloud strengths: complete control of hardware, security and location; can meet strict rules. Trade-offs: up-front hardware cost (CapEx), you staff and maintain it, and capacity is limited to what you bought.",
        "Hybrid cloud strengths: flexibility. Keep regulated data or legacy apps on-premises, burst to the cloud at peak, or migrate step by step. The organisation decides where each workload runs.",
        "Azure tools for hybrid and multicloud: Azure Arc (manage servers, Kubernetes and data services anywhere through Azure), Azure VMware Solution (run VMware workloads in Azure), Azure Local (Azure-managed infrastructure in your datacenter, formerly Azure Stack HCI), and VPN Gateway or ExpressRoute to connect networks.",
        "Use-case signals: 'no hardware, start today, variable demand' → public. 'Must own and operate the hardware' → private. 'Keep X on-premises but use the cloud for Y' → hybrid. 'Use services from two providers' → multicloud.",
    ],
    anim=("az900-cloud-models-sim", "Choose a cloud model for each scenario, then the Azure option that supports hybrid needs."),
    diagram=([("onp", "On-premises / private cloud", 0, 60, "compute"), ("vpn", "VPN Gateway or ExpressRoute", 230, 60, "network"), ("az", "Azure (public cloud)", 460, 60, "compute"), ("aws", "Another public cloud", 460, 180, "compute"), ("arc", "Azure Arc: one management plane", 230, 180, "security")],
             [("onp", "vpn"), ("vpn", "az"), ("arc", "onp", "manages"), ("arc", "aws", "manages"), ("arc", "az")]),
    example=("A bank's mixed estate", ["A bank's core ledger must stay in its own datacenter (private cloud). Its mobile app back end runs in Azure and scales on payday (public cloud). An ExpressRoute circuit links the two: a hybrid cloud.",
                                         "After acquiring a company that runs on AWS, the bank uses Azure Arc to apply the same policies to both: multicloud management."]),
    config=cfg(["Azure Arc > Machines > Add/Create: onboard an on-premises server (generates a script).", "Virtual network gateways and ExpressRoute circuits: connect on-premises networks.", "Azure VMware Solution: private clouds created in Azure."],
               "az connectedmachine list -o table\naz network vnet-gateway list -g <rg> -o table", "Get-AzConnectedMachine\nGet-AzVirtualNetworkGateway -ResourceGroupName <rg>"),
    lab=lab("Choose cloud models and hybrid tools.", ["Cloud models tab: answer every scenario.", "Hybrid and multicloud tools tab: match each need to an Azure option."],
            ["Hybrid = on-premises + public cloud working together", "Arc manages resources outside Azure"],
            chooser_checks("cloud-model", "cloud model") + chooser_checks("hybrid-tools", "hybrid tool"), ["Calling two public clouds 'hybrid'", "Assuming private cloud has no up-front cost"]),
    troubleshooting=[("Policies are applied in Azure but not on on-premises servers.", "On-premises servers aren't connected to Azure Resource Manager.", "Onboard them with Azure Arc."),
                     ("A burst-to-cloud design fails at peak.", "Network link between on-premises and Azure is too small or missing.", "Size the VPN/ExpressRoute connection and test failover.")],
    comparisons=[("Hybrid vs multicloud", "Hybrid mixes on-premises/private with public; multicloud uses several public providers. An organisation can be both."), ("Private cloud vs on-premises", "Private cloud adds cloud features (self-service, automation) to dedicated infrastructure.")],
    misconceptions=[("Hybrid cloud means two public clouds.", "That is multicloud."), ("Public cloud is always less secure than private cloud.", "Security depends on configuration; public providers invest heavily in security."),
                    ("Private cloud removes all capital expense.", "You still buy and maintain the hardware.")],
    decisions=["Default to public cloud for new, variable workloads.", "Use hybrid when regulation, latency or legacy dependencies keep systems on-premises.", "Use Azure Arc to manage hybrid and multicloud estates consistently."],
    docs=[("Describe cloud computing (Learn: cloud models)", CC), ("Azure Arc overview", ML + "azure/azure-arc/overview"), ("What is hybrid cloud?", "https://azure.microsoft.com/resources/cloud-computing-dictionary/what-is-hybrid-cloud-computing"), ("Azure VMware Solution", ML + "azure/azure-vmware/introduction")],
)
qq("AZ900-1.1.3", 1, "single", "Which cloud model uses infrastructure owned by a provider and shared by many customers?", [("Public cloud", "Correct."), ("Private cloud", "Single organisation."), ("Hybrid cloud", "Combines models."), ("On-premises", "Not cloud.")], "a", "Public cloud is multi-tenant provider infrastructure.", CC)
qq("AZ900-1.1.3", 2, "single", "What is the main difference between hybrid cloud and multicloud?", [("Hybrid combines private/on-premises with public cloud; multicloud uses multiple public providers", "Correct."), ("They are the same", "No."), ("Multicloud always includes on-premises", "Not necessarily."), ("Hybrid uses only one datacenter", "No.")], "a", "Different combinations.", CC)
qq("AZ900-1.1.4", 2, "scenario", "A government agency must physically own and operate all hardware but wants self-service provisioning for its teams. Which model fits?", [("Private cloud", "Correct."), ("Public cloud", "Provider-owned."), ("Multicloud", "Multiple public providers."), ("SaaS", "A service type, not a model.")], "a", "Private cloud gives control plus cloud features.", CC)
qq("AZ900-1.1.4", 2, "scenario", "A manufacturer keeps factory-floor systems on-premises for latency but wants to analyse their data in Azure. Which model?", [("Hybrid cloud", "Correct."), ("Public cloud only", "The factory systems stay on-premises."), ("Private cloud only", "Analysis is in Azure."), ("Multicloud", "Only one public provider.")], "a", "On-premises plus public cloud is hybrid.", CC)

# ================================================================ 1.1.5–1.1.7
lesson(
    id="az900-pricing-serverless", exam=E, title="Consumption-based pricing, pricing models and serverless",
    objectives=["AZ900-1.1.5", "AZ900-1.1.6", "AZ900-1.1.7"], minutes=40,
    objective="Explain the consumption-based model (CapEx vs OpEx), compare Azure pricing models, and describe serverless computing.",
    prereqs=[("Cloud computing basics", "AZ900-1.1.1", "az900-cloud-basics")],
    foundation=[
        "Capital expenditure (CapEx): a large, up-front purchase of something you own, such as servers, paid once and depreciated over years.",
        "Operational expenditure (OpEx): spending on services as you use them, billed regularly. Cloud computing is OpEx.",
        "Consumption-based model: no up-front cost, pay only for what you use, stop paying when you stop using it. You don't buy capacity for the busiest day of the year and leave it idle the rest of the time.",
        "Serverless: you don't manage servers at all. You give Azure your code or workflow, it runs when triggered, scales automatically, and you pay only while it runs.",
    ],
    engineer=[
        "Consumption model benefits: no up-front infrastructure cost; no need to buy and manage infrastructure you might not use; pay for additional resources when needed; stop paying when you no longer need them.",
        "Pricing models compared: pay-as-you-go (per second/hour, no commitment); Azure Reservations (commit to specific resources for 1 or 3 years for a discount); Azure savings plan for compute (commit to an hourly compute spend for 1 or 3 years, flexible across sizes and regions); Spot VMs (discounted spare capacity that can be evicted); Azure Hybrid Benefit (reuse eligible Windows Server and SQL Server licences).",
        "Choosing: unknown or short-lived usage → pay-as-you-go. Steady, predictable usage of one resource → reservation. Steady spend but changing resources → savings plan. Interruptible batch → spot. Existing licences → Hybrid Benefit. They can be combined.",
        "Serverless on Azure: Azure Functions (event-driven code: an HTTP request, a queue message, a timer, a new blob), Azure Logic Apps (low-code workflows with connectors), and serverless containers in Azure Container Apps. On consumption plans, billing is per execution and resources consumed, and they can scale to zero.",
        "Serverless still has servers: the provider manages them, their patching and scaling. You focus on code and business logic.",
        "Cost visibility: the pricing calculator estimates before you deploy; Cost Management shows actual spend afterwards.",
    ],
    anim=("az900-pricing-sim", "Compare fixed capacity with consumption billing, then pick the pricing option for each workload."),
    diagram=([("capex", "CapEx: buy servers up front", 0, 0, "compute"), ("opex", "OpEx: pay for use monthly", 260, 0, "compute"), ("paygo", "Pay-as-you-go", 120, 140, "scope"), ("res", "Reservations / savings plan", 330, 140, "scope"), ("spot", "Spot", 540, 140, "scope"), ("sls", "Serverless: pay per execution", 540, 0, "compute")],
             [("opex", "paygo"), ("opex", "res"), ("opex", "spot"), ("opex", "sls")]),
    example=("Ticket sales spikes", ["A concert promoter sells tickets for a few hours when shows are announced. Owning servers for that peak (CapEx) would leave them idle for weeks.",
                                     "In Azure, the web tier autoscales on pay-as-you-go, the steady database uses a 3-year reservation, and confirmation emails are sent by an Azure Function billed per execution."]),
    config=cfg(["Pricing calculator: add a VM and compare pay-as-you-go with 1-year and 3-year reserved prices.", "Reservations > Add: purchase options (scope, term, billing frequency).", "Function App > Create > Hosting: choose a consumption-based plan."],
               "az functionapp create -g <rg> -n <app> --storage-account <st> --consumption-plan-location westeurope --runtime python --functions-version 4\naz reservations reservation-order list -o table",
               "Get-AzReservationOrder", limits=("Reservations and savings plans are commitments: refunds and exchanges have limits", "Spot VMs can be evicted with 30 seconds' notice")),
    lab=lab("Compare spending models and choose pricing options.", ["CapEx vs consumption tab: run the default, then apply each preset.", "Pricing models tab: answer every workload."],
            ["Variable demand favours consumption", "Commitments suit steady workloads"],
            [("pricing-compared", "Compared fixed and consumption costs")] + chooser_checks("pricing-model", "pricing option"),
            ["Buying reservations for a short experiment", "Running production on Spot VMs that cannot tolerate eviction"]),
    troubleshooting=[("A reservation shows low utilisation.", "The reserved VM size or region no longer matches what runs.", "Exchange the reservation or use a savings plan for flexibility."),
                     ("A Spot VM disappeared during a job.", "Azure evicted it to reclaim capacity.", "Use spot only for interruptible work, with checkpoints.")],
    comparisons=[("Reservations vs savings plan", "Reservations target specific resources; savings plans commit to an hourly spend across eligible compute."), ("Serverless vs PaaS web app", "A web app on a dedicated plan is billed while the plan exists; consumption serverless is billed per execution.")],
    misconceptions=[("Serverless means there are no servers.", "Servers exist; Microsoft manages them."), ("Cloud is always cheaper.", "Steady workloads may need reservations to be cost-effective; unused resources still cost money."),
                    ("Consumption-based means unpredictable bills.", "Budgets, alerts and forecasts make spend predictable.")],
    decisions=["Start on pay-as-you-go, then commit once usage is stable.", "Use serverless for event-driven, spiky workloads.", "Apply Hybrid Benefit wherever you own eligible licences."],
    docs=[("Describe cloud computing (Learn: consumption model)", CC), ("Azure Functions overview", ML + "azure/azure-functions/functions-overview"), ("What are Azure Reservations?", ML + "azure/cost-management-billing/reservations/save-compute-costs-reservations"),
          ("Azure savings plan for compute", ML + "azure/cost-management-billing/savings-plan/savings-plan-compute-overview"), ("Azure Spot Virtual Machines", ML + "azure/virtual-machines/spot-vms")],
)
qq("AZ900-1.1.5", 1, "single", "Which statement describes the consumption-based model?", [("You pay only for resources you use and stop paying when you stop using them", "Correct."), ("You pay up front for three years of hardware", "CapEx."), ("You pay a fixed monthly amount regardless of usage", "No."), ("Resources are free until a limit", "No.")], "a", "Pay for what you use.", CC)
qq("AZ900-1.1.5", 2, "single", "Moving from buying servers to renting cloud resources shifts spending from:", [("CapEx to OpEx", "Correct."), ("OpEx to CapEx", "Reversed."), ("OpEx to free", "No."), ("Licensing to hardware", "No.")], "a", "Cloud is operational expenditure.", CC)
qq("AZ900-1.1.6", 2, "scenario", "A web server VM will run 24/7 at the same size in the same region for three years. How can you lower its cost the most?", [("Buy a 3-year Azure Reservation", "Correct."), ("Use pay-as-you-go", "No discount."), ("Use a Spot VM", "Can be evicted."), ("Use the pricing calculator", "Estimates only.")], "a", "Steady use of a specific resource suits a reservation.", ML + "azure/cost-management-billing/reservations/save-compute-costs-reservations")
qq("AZ900-1.1.6", 2, "scenario", "You own Windows Server licences with Software Assurance and want to run them on Azure VMs. Which offer reduces cost?", [("Azure Hybrid Benefit", "Correct."), ("Spot VMs", "No."), ("Azure Arc", "Management, not pricing."), ("Pay-as-you-go", "No discount.")], "a", "Hybrid Benefit reuses eligible licences.", ML + "azure/virtual-machines/windows/hybrid-use-benefit-licensing")
qq("AZ900-1.1.7", 1, "single", "Which statement about serverless computing is correct?", [("The provider manages servers and scaling; you supply code and pay per execution", "Correct."), ("There are no servers involved", "There are; they are managed for you."), ("You must patch the operating system", "No."), ("It is billed per VM hour", "No.")], "a", "Serverless abstracts servers away.", ML + "azure/azure-functions/functions-overview")
qq("AZ900-1.1.7", 2, "scenario", "Code must run whenever a file is uploaded to Blob Storage, a few times a day, and cost nothing when idle. What should you use?", [("Azure Functions on a consumption plan", "Correct."), ("A VM running 24/7", "Pays while idle."), ("Azure Virtual Desktop", "Desktops."), ("A reservation", "Commitment, not event-driven.")], "a", "Event-driven serverless.", ML + "azure/azure-functions/functions-overview")

# ================================================================ 1.2.1–1.2.2
lesson(
    id="az900-availability-scalability", exam=E, title="High availability, scalability, reliability and predictability",
    objectives=["AZ900-1.2.1", "AZ900-1.2.2"], minutes=35,
    objective="Describe high availability, scalability (vertical and horizontal) and elasticity, and explain how the cloud improves reliability and predictability.",
    prereqs=[("Cloud computing basics", "AZ900-1.1.1", "az900-cloud-basics")],
    foundation=[
        "High availability: your service keeps running even when something fails. Azure backs services with SLAs (service level agreements) such as 99.9% or 99.99% uptime.",
        "Scalability: adding resources to handle more load. Scale up (vertical) = a bigger machine. Scale out (horizontal) = more machines. Elasticity is scaling automatically as demand changes, and scaling back down.",
        "Reliability: the ability to recover from failures and keep working. Azure's global regions let you run in more than one place, so one disaster doesn't stop you.",
        "Predictability: you can predict both performance (autoscaling and load balancing keep it steady) and cost (tools forecast and track spending).",
    ],
    engineer=[
        "SLA maths: 99.9% allows about 43.8 minutes of downtime a month; 99.99% about 4.4 minutes. When an app depends on several services, the composite SLA is the product: 99.95% × 99.99% ≈ 99.94%, lower than either.",
        "High availability techniques: redundancy (several instances), availability zones (separate datacenters in a region), load balancing, health probes, and automatic failover.",
        "Scale up/down: change VM size or service tier (often a brief restart). Scale out/in: add or remove instances (Virtual Machine Scale Sets, App Service instances); usually no downtime.",
        "Elasticity is driven by autoscale rules (for example 'add an instance when average CPU > 70% for 10 minutes', 'remove when < 30%') or schedules.",
        "Reliability: decentralised design across zones and regions, backups, geo-replication, and disaster recovery (Azure Site Recovery). The Well-Architected Framework reliability pillar gives design guidance.",
        "Performance predictability: autoscale, load balancing and high availability. Cost predictability: pricing calculator, Cost Management forecasts, budgets and analytics.",
    ],
    anim=("az900-benefits-sim", "Calculate a composite SLA and autoscale, then match situations to cloud benefits."),
    diagram=([("lb", "Load balancer", 0, 60, "network"), ("z1", "Zone 1: VM", 230, 0, "compute"), ("z2", "Zone 2: VM", 230, 120, "compute"), ("as", "Autoscale: add/remove VMs", 460, 60, "scope"), ("dr", "Paired region: DR copy", 460, 180, "storage")],
             [("lb", "z1"), ("lb", "z2"), ("as", "z1"), ("as", "z2"), ("z2", "dr", "replicate")]),
    example=("A news site on election night", ["Traffic jumps 20× for one night. Autoscale adds web instances as CPU rises (elasticity) and removes them after midnight. Instances span three availability zones behind a load balancer (high availability).",
                                              "The database is geo-replicated to another region (reliability), and finance set a budget alert with a forecast (predictability)."]),
    config=cfg(["VM scale set or App Service plan > Scaling: add autoscale rules and instance limits.", "VM > Size: scale up or down.", "Service level agreements are published per service on the Microsoft licensing site."],
               "az monitor autoscale create -g <rg> --resource <vmss-id> --min-count 2 --max-count 10 --count 2\naz monitor autoscale rule create -g <rg> --autoscale-name <name> --condition \"Percentage CPU > 70 avg 10m\" --scale out 1",
               "Get-AzAutoscaleSetting -ResourceGroupName <rg>"),
    lab=lab("Calculate composite SLAs and match cloud benefits.", ["Availability, scalability, elasticity tab: run the default and each preset.", "Which benefit? tab: answer every situation."],
            ["Composite SLA is lower than each part", "Elasticity scales automatically both ways"],
            [("sla-met", "Met an availability requirement"), ("sla-missed", "Saw a design miss its SLA")] + chooser_checks("benefit", "cloud benefit"),
            ["Assuming two 99.9% services give 99.9% together", "Scaling up when you need more instances"]),
    troubleshooting=[("App is slow at peak even with autoscale.", "Maximum instance count reached, or scale rule threshold too high.", "Raise the maximum and lower the threshold; check for a bottleneck in the database."),
                     ("Brief outage when scaling.", "Scaling up (resizing) restarts the VM.", "Scale out with multiple instances instead.")],
    comparisons=[("Scalability vs elasticity", "Scalability is the ability to grow; elasticity is growing and shrinking automatically."), ("High availability vs disaster recovery", "HA keeps a service up through component failures; DR restores service after a major event such as a region outage.")],
    misconceptions=[("An SLA guarantees no downtime.", "It defines an uptime commitment and service credits if it's missed."), ("Scaling up and scaling out are the same.", "Up = bigger; out = more."),
                    ("The cloud is automatically highly available.", "You must design for it, for example with zones and multiple instances.")],
    decisions=["Prefer scale-out with autoscale for web tiers.", "Deploy across availability zones for higher SLAs.", "Calculate the composite SLA of all dependencies."],
    docs=[("Describe the benefits of using cloud services (Learn)", BEN), ("Service Level Agreements", "https://www.microsoft.com/licensing/docs/view/Service-Level-Agreements-SLA-for-Online-Services"),
          ("Autoscale overview", ML + "azure/azure-monitor/autoscale/autoscale-overview"), ("Well-Architected reliability pillar", ML + "azure/well-architected/reliability/")],
)
qq("AZ900-1.2.1", 2, "scenario", "An app depends on a web tier with a 99.95% SLA and a database with a 99.99% SLA. What is the approximate composite SLA?", [("99.94%", "Correct: 0.9995 × 0.9999."), ("99.99%", "Higher than one part."), ("99.95%", "Ignores the database."), ("199.94%", "No.")], "a", "Multiply the SLAs of dependencies.", BEN)
qq("AZ900-1.2.1", 1, "single", "Adding more VM instances to handle extra load is called:", [("Scaling out (horizontal scaling)", "Correct."), ("Scaling up", "A bigger VM."), ("High availability", "Uptime."), ("Governance", "No.")], "a", "More instances = scale out.", BEN)
qq("AZ900-1.2.1", 2, "single", "Which feature lets resources grow and shrink automatically with demand?", [("Autoscale (elasticity)", "Correct."), ("A reservation", "Pricing."), ("A resource lock", "Prevents changes."), ("A management group", "Organisation.")], "a", "Autoscale delivers elasticity.", ML + "azure/azure-monitor/autoscale/autoscale-overview")
qq("AZ900-1.2.2", 2, "scenario", "A company replicates its data to a second Azure region so it can continue after a regional disaster. Which cloud benefit is this?", [("Reliability", "Correct."), ("Predictability", "Forecasting."), ("Manageability", "Management."), ("Governance", "Compliance.")], "a", "Recovering from failure is reliability.", BEN)
qq("AZ900-1.2.2", 2, "multiple", "Which TWO help make cloud costs predictable?", [("Cost Management forecasts and budgets", "Correct."), ("The pricing calculator before deployment", "Correct."), ("Resource pooling", "A characteristic."), ("Availability zones", "Availability.")], "ab", "Cost predictability tools.", BEN)

# ================================================================ 1.2.3–1.2.4
lesson(
    id="az900-security-manageability", exam=E, title="Security, governance and manageability benefits",
    objectives=["AZ900-1.2.3", "AZ900-1.2.4"], minutes=30,
    objective="Describe how the cloud helps with security and governance, and the two sides of manageability: management of the cloud and management in the cloud.",
    prereqs=[("Shared responsibility", "AZ900-1.1.2", "az900-cloud-basics")],
    foundation=[
        "Security benefit: you get protection you'd struggle to build alone, such as physical datacenter security, DDoS protection built into the network, and, with PaaS and SaaS, automatic OS patching.",
        "Governance benefit: templates and policies keep deployments compliant with company standards and regulations, and auditing shows what doesn't comply.",
        "Management of the cloud: managing your resources: deploy from templates, autoscale, monitor health, replace failing resources automatically, get alerts.",
        "Management in the cloud: how you manage: through the web portal, a command-line interface, APIs or PowerShell.",
    ],
    engineer=[
        "Choose the model for the security control you want: IaaS gives maximum control (you patch and secure the OS); PaaS and SaaS shift patching and maintenance to Microsoft.",
        "Built-in protections: physical security of datacenters, DDoS infrastructure protection, encryption at rest by default for Azure Storage, Microsoft Defender for Cloud recommendations.",
        "Governance tools: Azure Policy (enforce and audit rules), resource locks, tags, management groups, blueprints-style templates via ARM/Bicep, and Microsoft Purview for data governance and compliance.",
        "Compliance assurance: Microsoft publishes audit reports (ISO 27001, SOC, PCI DSS and others) in the Service Trust Portal; the Microsoft Purview compliance portal tracks your own compliance.",
        "Management of the cloud examples: autoscale based on need, deploy from preconfigured templates, monitor health and replace failing resources automatically, receive real-time alerts.",
        "Management in the cloud examples: Azure portal, Azure CLI, Azure PowerShell, REST APIs, Cloud Shell, SDKs.",
    ],
    anim=("az900-manage-sim", "Match capabilities to security, governance or manageability, and find where to get assurance."),
    diagram=([("sec", "Security: platform protections", 0, 0, "security"), ("gov", "Governance: Policy, templates, audit", 240, 0, "security"), ("mof", "Management of the cloud: autoscale, alerts", 0, 140, "compute"), ("min", "Management in the cloud: portal, CLI, API", 240, 140, "user"), ("res", "Your Azure resources", 480, 70, "compute")],
             [("sec", "res"), ("gov", "res"), ("mof", "res"), ("min", "res")]),
    example=("A school district", ["A district has no security team big enough to patch dozens of servers. Moving the learning app to PaaS shifts OS patching to Microsoft (security).",
                                   "IT assigns Azure Policy to allow only approved regions and require tags (governance), sets autoscale for exam weeks (management of the cloud), and manages it all from the portal and scripts (management in the cloud)."]),
    config=cfg(["Microsoft Defender for Cloud > Overview: secure score.", "Policy > Compliance: compliance state of assignments.", "servicetrust.microsoft.com: Microsoft audit reports."],
               "az policy state summarize -o table\naz security secure-scores list -o table", "Get-AzPolicyStateSummary"),
    lab=lab("Match capabilities to cloud benefits.", ["Security, governance, manageability tab: answer every capability.", "Where to get assurance tab: answer every question."],
            ["Management of vs in the cloud are different", "Policy enforces governance"], chooser_checks("manageability", "benefit") + chooser_checks("compliance", "assurance resource"),
            ["Mixing up 'management of' and 'management in' the cloud"]),
    troubleshooting=[("Auditors ask for Microsoft's SOC report.", "It isn't in the Azure portal.", "Download it from the Service Trust Portal."),
                     ("Non-compliant resources keep appearing.", "Policies only audit, or aren't assigned at the right scope.", "Use a Deny effect and assign at the management group or subscription.")],
    comparisons=[("Governance vs security", "Governance keeps resources aligned with rules; security protects them from threats. Policy can enforce security settings, so they overlap."), ("Portal vs CLI", "Both are 'management in the cloud'; the CLI is scriptable.")],
    misconceptions=[("Moving to the cloud makes you compliant automatically.", "Microsoft's certifications cover its platform; you must configure your workloads compliantly."), ("Manageability only means the portal.", "It includes automation, templates, alerts and APIs.")],
    decisions=["Use PaaS where possible to reduce patching burden.", "Assign governance policies early, at high scopes.", "Automate management with templates and alerts."],
    docs=[("Describe the benefits of using cloud services (Learn)", BEN), ("Get started with the Service Trust Portal", ML + "purview/get-started-with-service-trust-portal"), ("Azure Policy overview", ML + "azure/governance/policy/overview"), ("Azure compliance documentation", ML + "azure/compliance/")],
)
qq("AZ900-1.2.3", 2, "scenario", "Which cloud benefit lets a company ensure all deployed resources meet corporate standards using templates and policies?", [("Governance", "Correct."), ("Elasticity", "Scaling."), ("Predictability", "Forecasting."), ("High availability", "Uptime.")], "a", "Governance keeps deployments compliant.", BEN)
qq("AZ900-1.2.3", 2, "single", "With PaaS, which security task does Microsoft take on that you would handle yourself with IaaS?", [("Patching the operating system", "Correct."), ("Managing user accounts", "Always yours."), ("Classifying your data", "Always yours."), ("Securing employee laptops", "Always yours.")], "a", "OS maintenance moves to the provider.", SR)
qq("AZ900-1.2.4", 2, "single", "Managing Azure resources through the portal, CLI and APIs is an example of:", [("Management in the cloud", "Correct."), ("Management of the cloud", "That's autoscale, templates, alerts."), ("Governance", "No."), ("Elasticity", "No.")], "a", "The tools you use = management in the cloud.", BEN)
qq("AZ900-1.2.4", 2, "single", "Automatically replacing a failing resource and sending an alert is an example of:", [("Management of the cloud", "Correct."), ("Management in the cloud", "That's the tools."), ("Resource pooling", "No."), ("CapEx", "No.")], "a", "Managing the resources themselves.", BEN)

# ================================================================ 1.3.1–1.3.4
lesson(
    id="az900-iaas-paas-saas", exam=E, title="IaaS, PaaS and SaaS",
    objectives=["AZ900-1.3.1", "AZ900-1.3.2", "AZ900-1.3.3", "AZ900-1.3.4"], minutes=40,
    objective="Describe infrastructure, platform and software as a service, what you manage in each, and choose the right one for a use case.",
    prereqs=[("Shared responsibility", "AZ900-1.1.2", "az900-cloud-basics")],
    foundation=[
        "IaaS (infrastructure as a service): you rent the raw building blocks (virtual machines, storage, networks) and manage the operating system and everything on it. Most control, most work.",
        "PaaS (platform as a service): you bring your application and data; Azure runs the platform (OS, runtime, patching, scaling). Less control, much less maintenance.",
        "SaaS (software as a service): you use a finished application over the internet (email, CRM). You manage your data, users and settings only.",
        "Pizza analogy: IaaS is buying ingredients and cooking in a rented kitchen, PaaS is take-and-bake, SaaS is eating at the restaurant.",
    ],
    engineer=[
        "IaaS: Azure Virtual Machines, Virtual Network, managed disks. You handle OS updates, middleware, runtime, security configuration and backups. Use cases: lift-and-shift migration, test and development, custom software needing OS access, storage and backup infrastructure.",
        "PaaS: Azure App Service, Azure SQL Database, Azure Functions, Azure Kubernetes Service (managed control plane), Azure Cosmos DB. Microsoft handles OS, patching, runtime and often high availability. Use cases: development frameworks (build apps without managing infrastructure), analytics and business intelligence, APIs.",
        "SaaS: Microsoft 365, Dynamics 365, Microsoft Teams. The provider manages the application. Use cases: email and messaging, business productivity, finance and expense tracking.",
        "Shared responsibility by type: IaaS customer manages OS, network controls, applications, identity infrastructure, data; PaaS shares applications, network controls and identity infrastructure; SaaS customer keeps data, devices, accounts, identities.",
        "Trade-offs: IaaS offers maximum flexibility and control but requires the most management. PaaS speeds development but limits OS-level customisation. SaaS has the least effort but the least customisation.",
        "Choosing: needs OS control or installed agents → IaaS. Want to deploy code without servers → PaaS. Need a ready-made business application → SaaS.",
    ],
    anim=("az900-service-types-sim", "Pick a service type for each workload, then classify Azure and Microsoft products."),
    diagram=([("iaas", "IaaS: VMs, networks, disks", 0, 60, "compute"), ("paas", "PaaS: App Service, Azure SQL, Functions", 260, 60, "compute"), ("saas", "SaaS: Microsoft 365, Dynamics 365", 520, 60, "user"),
              ("you1", "You: OS, runtime, apps, data", 0, 190, "user"), ("you2", "You: apps and data", 260, 190, "user"), ("you3", "You: data, users, settings", 520, 190, "user")],
             [("iaas", "you1"), ("paas", "you2"), ("saas", "you3")]),
    example=("One company, three service types", ["Contoso migrates a legacy inventory app that needs a specific Windows agent to Azure VMs (IaaS).",
                                                  "Its new customer portal runs on App Service with Azure SQL Database (PaaS), and staff use Microsoft 365 for email and Teams (SaaS)."]),
    config=cfg(["Create a resource > Virtual machine (IaaS).", "Create a resource > Web App (PaaS).", "admin.microsoft.com: Microsoft 365 admin center (SaaS settings)."],
               "az vm image list -o table\naz webapp list-runtimes -o table", "Get-AzVMImageOffer -Location westeurope -PublisherName MicrosoftWindowsServer"),
    lab=lab("Choose service types and classify products.", ["IaaS, PaaS, SaaS tab: answer every workload.", "Azure services by type tab: classify every product."],
            ["OS control means IaaS", "Deploying only code means PaaS"], chooser_checks("service-type", "service type") + chooser_checks("service-examples", "classification"),
            ["Calling Azure SQL Database IaaS", "Choosing IaaS when no OS control is needed"]),
    troubleshooting=[("A PaaS app needs a custom OS driver.", "PaaS doesn't allow OS-level changes.", "Use containers or IaaS VMs."),
                     ("Too much time spent patching VMs that host a simple website.", "IaaS chosen where PaaS fits.", "Move the site to App Service.")],
    comparisons=[("Containers", "Often treated as a middle ground: package the app with dependencies; run on PaaS services such as Container Apps or AKS."), ("Serverless vs PaaS", "Serverless is commonly grouped with PaaS; it adds per-execution billing and scale to zero.")],
    misconceptions=[("SaaS means the provider owns your data.", "You always own and are responsible for your data."), ("PaaS gives no control at all.", "You control the application, its settings and scaling."), ("IaaS is always cheapest.", "Management effort is a cost too.")],
    decisions=["Prefer SaaS, then PaaS, then IaaS, unless requirements need more control.", "Use IaaS for lift-and-shift, then modernise to PaaS."],
    docs=[("Describe cloud service types (Learn)", ST), ("What is IaaS?", "https://azure.microsoft.com/resources/cloud-computing-dictionary/what-is-iaas"), ("What is PaaS?", "https://azure.microsoft.com/resources/cloud-computing-dictionary/what-is-paas"), ("What is SaaS?", "https://azure.microsoft.com/resources/cloud-computing-dictionary/what-is-saas")],
)
qq("AZ900-1.3.1", 2, "scenario", "Which is a typical IaaS use case?", [("Lift-and-shift migration of on-premises servers", "Correct."), ("Using Microsoft 365 email", "SaaS."), ("Deploying a web app without managing servers", "PaaS."), ("Using Dynamics 365", "SaaS.")], "a", "IaaS suits lift-and-shift.", ST)
qq("AZ900-1.3.1", 1, "single", "In IaaS, who manages the operating system?", [("The customer", "Correct."), ("Microsoft", "PaaS and SaaS."), ("Nobody", "No."), ("The ISP", "No.")], "a", "IaaS = you manage the OS.", ST)
qq("AZ900-1.3.2", 2, "scenario", "Developers want to deploy a web API and have Azure handle OS patching and scaling. Which service type?", [("PaaS", "Correct."), ("IaaS", "You'd patch the OS."), ("SaaS", "A finished application."), ("On-premises", "No.")], "a", "PaaS manages the platform.", ST)
qq("AZ900-1.3.2", 1, "single", "Which Azure service is PaaS?", [("Azure App Service", "Correct."), ("Azure Virtual Machines", "IaaS."), ("Microsoft 365", "SaaS."), ("Azure Virtual Network", "IaaS networking.")], "a", "App Service is PaaS.", ST)
qq("AZ900-1.3.3", 1, "single", "Which is an example of SaaS?", [("Microsoft 365", "Correct."), ("Azure Virtual Machines", "IaaS."), ("Azure SQL Database", "PaaS."), ("Azure Functions", "Serverless / PaaS.")], "a", "Finished applications are SaaS.", ST)
qq("AZ900-1.3.3", 2, "single", "In SaaS, which is still the customer's responsibility?", [("Users, their access and the data they store", "Correct."), ("Application code", "Provider."), ("Operating system", "Provider."), ("Physical servers", "Provider.")], "a", "Data and access stay with you.", SR)
qq("AZ900-1.3.4", 3, "scenario", "A company needs (1) email, (2) a custom web app without server management, and (3) a VM with a custom security agent. Match the service types in order.", [("SaaS, PaaS, IaaS", "Correct."), ("PaaS, SaaS, IaaS", "No."), ("IaaS, PaaS, SaaS", "No."), ("SaaS, IaaS, PaaS", "No.")], "a", "Email = SaaS; app without servers = PaaS; custom agent = IaaS.", ST)
