"""Replacements for extra AZ-104 questions that repeated an existing question (found in the 2026-11-23 review).

REPLACE maps the question number in az104_examq.py (az104-q-x-NNN) to a new question on a concept the bank did not cover yet.
Same tuple format as _az104_q12.py.
"""
D = "https://learn.microsoft.com/"
REPLACE: dict[int, tuple] = {}

# ---------------------------------------------------------------- domain 1
REPLACE[1] = ("AZ104-1.1.1", 2, "single", "A help-desk lead must create and manage users and groups but must not manage other directory settings. Which Microsoft Entra role is the least-privileged fit?",
              [("Global Administrator", "Far more privilege than needed."), ("Owner of the subscription", "An Azure role; it gives no directory permissions."),
               ("User Administrator", "Correct: creates and manages users and groups, and resets passwords for non-admins."), ("Reports Reader", "Read-only reports.")],
              "c", "Directory work needs Microsoft Entra roles. User Administrator covers users and groups without full tenant control.", D + "entra/identity/role-based-access-control/permissions-reference")
REPLACE[11] = ("AZ104-1.2.1", 3, "scenario", "Operators must be able to restart VMs, but not start, stop, resize or delete them. No built-in role matches. What should you do?",
               [("Assign Virtual Machine Contributor", "Allows far more than restart."), ("Create a custom role with Microsoft.Compute/virtualMachines/read and .../restart/action, and assign it", "Correct."),
                ("Assign Reader and add a NotActions entry", "You cannot add NotActions to a built-in role, and Reader has no restart action."), ("Use an Azure Policy Deny for stop and delete", "Policy does not grant the restart permission.")],
               "b", "When no built-in role fits, create a custom role with only the actions needed and set its assignable scopes.", D + "azure/role-based-access-control/custom-roles")
REPLACE[20] = ("AZ104-1.3.2", 2, "scenario", "Nobody must delete resources in any subscription under the MG-Prod management group. You try to add a lock on MG-Prod. What happens?",
               [("It works and applies to every subscription below", "Locks cannot be created on management groups."), ("Locks are not supported at management group scope; lock each subscription (or use an Azure Policy DenyAction)", "Correct."),
                ("It works only for resource groups created later", "No."), ("It locks the management group itself but not its subscriptions", "Management group locks do not exist.")],
               "b", "Locks apply to subscriptions, resource groups and resources. For a whole hierarchy, lock each subscription or use Policy with the DenyAction effect.", D + "azure/azure-resource-manager/management/lock-resources")
REPLACE[23] = ("AZ104-1.3.4", 1, "single", "You need to rename resource group rg-tst to rg-test. What do you do?",
               [("Open the resource group and edit its name", "Resource groups cannot be renamed."), ("Create rg-test, move the resources into it, then delete rg-tst", "Correct."),
                ("Run az group update --name rg-test", "There is no rename."), ("Change the resource group's tag 'name'", "A tag does not rename anything.")],
               "b", "Resource groups cannot be renamed; create a new one and move the resources.", D + "azure/azure-resource-manager/management/manage-resource-groups-portal")
REPLACE[25] = ("AZ104-1.3.5", 2, "scenario", "A subscription must be paid by a different billing account, and all existing role assignments must stay in place. What should you do?",
               [("Change the subscription's directory", "That deletes role assignments and is not about billing."), ("Transfer billing ownership of the subscription", "Correct: billing changes, the tenant and RBAC stay."),
                ("Move all resources to a new subscription", "Unnecessary effort."), ("Move the subscription to another management group", "Management groups do not change billing.")],
               "b", "Transferring billing ownership is separate from changing the directory, and keeps access unchanged.", D + "azure/cost-management-billing/manage/billing-subscription-transfer")
REPLACE[29] = ("AZ104-1.3.7", 2, "scenario", "New subscriptions must automatically land in the Sandbox management group so its policies apply from day one. What do you configure?",
               [("A policy on the root that moves subscriptions", "Policy cannot move subscriptions."), ("The default management group in the root's Hierarchy settings", "Correct."),
                ("A budget on Sandbox", "Budgets do not place subscriptions."), ("Nothing; new subscriptions always go to the group of their creator", "They go to the root unless a default is set.")],
               "b", "Hierarchy settings let you choose the default management group for new subscriptions.", D + "azure/governance/management-groups/how-to/protect-resource-hierarchy")

# ---------------------------------------------------------------- domain 2
REPLACE[35] = ("AZ104-2.1.3", 3, "troubleshooting", "A stored access policy sets an expiry of 31 December. You generate a service SAS that references the policy and also sets its own expiry (se). Requests with the SAS fail with 403. Why?",
               [("The expiry may be set in the policy or in the SAS, not in both", "Correct: duplicated fields make the SAS invalid."), ("Stored access policies only work with account SAS", "Only service SAS can use them."),
                ("The policy needs 30 seconds after every request", "Changes take up to 30 seconds, not each request."), ("Policies cannot set an expiry", "They can.")],
               "a", "When a SAS references a stored access policy, a field such as expiry or permissions must be defined in only one of the two.", D + "azure/storage/common/storage-stored-access-policy-define-dotnet")
REPLACE[36] = ("AZ104-2.1.3", 2, "single", "Which kind of SAS can reference a stored access policy?",
               [("Account SAS", "Cannot reference a stored access policy."), ("Service SAS", "Correct."), ("User delegation SAS", "Cannot reference a stored access policy."), ("All three", "Only the service SAS can.")],
               "b", "Stored access policies apply to service SAS on a container, share, queue or table.", D + "azure/storage/common/storage-sas-overview")
REPLACE[37] = ("AZ104-2.1.4", 2, "scenario", "An automation account must list and regenerate a storage account's keys, and nothing else. Which built-in role is the least-privileged fit?",
               [("Storage Account Contributor", "Can also change the account's settings."), ("Owner", "Far too broad."), ("Storage Account Key Operator Service Role", "Correct."), ("Storage Blob Data Owner", "A data role; it does not manage keys.")],
               "c", "Storage Account Key Operator Service Role allows listing and regenerating access keys only.", D + "azure/role-based-access-control/built-in-roles/storage")
REPLACE[38] = ("AZ104-2.1.4", 2, "scenario", "You must be warned when a storage account's access keys have not been rotated for 90 days. What do you configure?",
               [("A key expiration policy of 90 days on the account (and audit it with Azure Policy)", "Correct."), ("A lifecycle management rule", "That moves blobs, not keys."),
                ("A stored access policy", "That governs SAS, not keys."), ("Soft delete for blobs", "Unrelated.")],
               "a", "A key expiration policy sets a rotation reminder; Azure Policy can flag accounts whose keys are older than the policy allows.", D + "azure/storage/common/storage-account-keys-manage")
REPLACE[50] = ("AZ104-2.2.5", 2, "troubleshooting", "An AzCopy upload of 200,000 files stopped halfway because the network dropped. How do you finish without uploading everything again?",
               [("azcopy jobs resume <job-id> (with the same SAS if one was used)", "Correct."), ("Run azcopy copy again with --overwrite=true", "Re-uploads everything."),
                ("Delete the container and start over", "Unnecessary."), ("Switch to Storage Explorer", "It would also start a new transfer.")],
               "a", "AzCopy keeps job plan files, so a job can be resumed from where it stopped.", D + "azure/storage/common/storage-use-azcopy-configure")
REPLACE[54] = ("AZ104-2.3.2", 2, "single", "An app adds log lines to the end of the same blob all day. Which blob type fits best?",
               [("Block blob", "Good for most files, but not optimised for appends."), ("Append blob", "Correct: optimised for adding data to the end."),
                ("Page blob", "For random read/write such as VHDs."), ("Archive blob", "Archive is a tier, not a blob type.")],
               "b", "Append blobs are designed for logging-style workloads.", D + "rest/api/storageservices/understanding-block-blobs--append-blobs--and-page-blobs")
REPLACE[56] = ("AZ104-2.3.3", 2, "scenario", "Data is read about twice a year, must be available within seconds when needed, and must be stored as cheaply as possible. Which tier?",
               [("Hot", "Most expensive storage."), ("Cool", "Online, but not the cheapest online tier."), ("Cold", "Correct: the cheapest tier that stays online."), ("Archive", "Cheapest, but offline: reads need hours of rehydration.")],
               "c", "Cold is the lowest-cost online tier (90-day minimum); Archive is offline.", D + "azure/storage/blobs/access-tiers-overview")
REPLACE[60] = ("AZ104-2.3.5", 2, "configuration", "You want a lifecycle rule that moves blobs to Cool when nobody has read them for 60 days. What must you enable first?",
               [("Last access time tracking on the account", "Correct: needed for daysAfterLastAccessTimeGreaterThan."), ("Blob versioning", "Not required for this rule."),
                ("Change feed", "Not required for this rule."), ("Hierarchical namespace", "Not required.")],
               "a", "Rules based on last access need access time tracking enabled.", D + "azure/storage/blobs/lifecycle-management-policy-configure")

# ---------------------------------------------------------------- domain 3
REPLACE[69] = ("AZ104-3.1.4", 2, "scenario", "A Bicep file must create three resource groups in a subscription. Which command deploys it?",
               [("az deployment group create", "Resource group scope cannot create resource groups."), ("az deployment sub create (with targetScope = 'subscription' in the file)", "Correct."),
                ("az group create --template-file", "No such option."), ("az bicep build", "Only compiles the file.")],
               "b", "Resource groups are created by deployments at subscription scope.", D + "azure/azure-resource-manager/bicep/deploy-to-subscription")
REPLACE[71] = ("AZ104-3.1.5", 3, "scenario", "A template needs the VM admin password, but the parameter file is stored in Git. What should you do?",
               [("Put the password in the parameter file", "Secrets must not be stored in Git."), ("Mark the parameter @secure() and reference a Key Vault secret from the parameter file", "Correct."),
                ("Hard-code it in the template", "Worse: it ends up in source control and deployment history."), ("Use an output to return it", "Outputs are visible in deployment history.")],
               "b", "Secure parameters plus Key Vault references keep secrets out of files and logs.", D + "azure/azure-resource-manager/bicep/key-vault-parameter")
REPLACE[74] = ("AZ104-3.2.1", 2, "scenario", "Nightly batch jobs can be interrupted and restarted at any time. You want the lowest VM cost. What do you choose?",
               [("Reserved instances", "Cheaper for steady 24/7 use, not for interruptible jobs."), ("Pay-as-you-go D-series", "Full price."), ("Azure Spot VMs", "Correct: deep discounts, but Azure can evict them."), ("Dedicated hosts", "More expensive.")],
               "c", "Spot VMs use spare capacity at a large discount and can be evicted, which fits interruptible work.", D + "azure/virtual-machines/spot-vms")
REPLACE[76] = ("AZ104-3.2.2", 2, "scenario", "Compliance requires customer-managed keys for a VM's managed disks, without installing anything inside the VM. What do you configure?",
               [("Azure Disk Encryption with BitLocker", "Works inside the guest OS."), ("A disk encryption set pointing to a Key Vault key, assigned to the disks", "Correct."),
                ("Storage account encryption scopes", "For blobs, not managed disks."), ("TLS 1.2 on the VM", "In transit only.")],
               "b", "Server-side encryption with customer-managed keys uses a disk encryption set.", D + "azure/virtual-machines/disk-encryption")
REPLACE[77] = ("AZ104-3.2.3", 2, "troubleshooting", "Moving a VM to a subscription in another Microsoft Entra tenant fails. Moving it to a subscription in the same tenant works. Why?",
               [("Cross-subscription moves require both subscriptions to be in the same tenant", "Correct."), ("The VM must be stopped", "Not the cause."), ("The VM needs a public IP", "Unrelated."), ("Moves only work within a resource group", "They work across subscriptions too.")],
               "a", "Resource moves between subscriptions are supported only within the same tenant; across tenants, redeploy or change the subscription's directory.", D + "azure/azure-resource-manager/management/move-resource-group-and-subscription")
REPLACE[78] = ("AZ104-3.2.3", 3, "scenario", "An existing VM with no zone must run in availability zone 2. What do you do?",
               [("Edit the VM and choose zone 2", "The zone cannot simply be edited on a running VM."), ("Move the VM to another resource group", "Does not change zones."),
                ("Recreate the VM in zone 2 (for example from snapshots of its disks) or use the VM zone move capability", "Correct."), ("Resize the VM", "Size does not set the zone.")],
               "c", "Zones are fixed at deployment; moving into a zone means recreating the VM or using the zone move feature.", D + "azure/reliability/migrate-vm")
REPLACE[79] = ("AZ104-3.2.4", 2, "scenario", "A small web VM averages 5% CPU but has short bursts a few times a day. Which VM family is the most cost-effective?",
               [("B-series (burstable)", "Correct: builds up CPU credits while idle and spends them during bursts."), ("E-series", "Memory optimised, more expensive."), ("N-series", "GPU."), ("L-series", "Storage optimised.")],
               "a", "B-series VMs suit low average CPU with occasional peaks.", D + "azure/virtual-machines/sizes/general-purpose/b-family")
REPLACE[82] = ("AZ104-3.2.5", 2, "troubleshooting", "You cannot attach another data disk to a VM. All existing disks are working. What is the most likely cause, and fix?",
               [("The VM size's maximum number of data disks is reached; resize to a larger size", "Correct."), ("The disk is Premium; use Standard", "Type does not set the count limit."),
                ("Soft delete is on", "Unrelated."), ("The VM must be in an availability set", "Unrelated.")],
               "a", "Each VM size has a maximum number of data disks.", D + "azure/virtual-machines/sizes/overview")
REPLACE[83] = ("AZ104-3.2.6", 2, "single", "Can a VM be in an availability set and an availability zone at the same time?",
               [("Yes, for the best SLA", "Not supported."), ("No; choose one or the other", "Correct."), ("Yes, if both are in the same region", "Still not supported."), ("Only with Premium SSD disks", "Disk type does not change this.")],
               "b", "A VM is placed either in an availability set or in a zone.", D + "azure/virtual-machines/availability")
REPLACE[84] = ("AZ104-3.2.6", 2, "single", "What does an availability set's fault domain count represent?",
               [("Groups of VMs restarted together during planned maintenance", "That is an update domain."), ("Separate datacenters in a region", "That is an availability zone."),
                ("Groups of hardware that share power and network (racks)", "Correct."), ("The number of regions used", "No.")],
               "c", "Fault domains (up to 3) protect against rack-level failures; update domains (up to 20) against planned maintenance.", D + "azure/virtual-machines/availability-set-overview")
REPLACE[85] = ("AZ104-3.2.7", 2, "scenario", "One scale set instance is running a long job and must not be removed when the set scales in. What do you configure?",
               [("Instance protection from scale-in on that instance", "Correct."), ("Upgrade policy Manual", "Controls model updates, not scale-in."), ("A larger maximum count", "Does not protect an instance."), ("A resource lock on the scale set", "Would block scaling operations altogether.")],
               "a", "Instance protection can exclude specific instances from scale-in or from model updates.", D + "azure/virtual-machine-scale-sets/virtual-machine-scale-sets-instance-protection")
REPLACE[86] = ("AZ104-3.2.7", 2, "scenario", "A new scale set must mix VM sizes and let you manage instances with the normal VM APIs. Which orchestration mode?",
               [("Uniform", "Identical instances managed only through the scale set."), ("Flexible", "Correct."), ("Availability set mode", "Not a scale set mode."), ("Spot mode", "Spot is a pricing option.")],
               "b", "Flexible orchestration supports mixed sizes and standard VM APIs, and is recommended for new deployments.", D + "azure/virtual-machine-scale-sets/virtual-machine-scale-sets-orchestration-modes")
REPLACE[89] = ("AZ104-3.3.2", 2, "scenario", "An ACI container must be reachable only from VMs in VNet1, with no public IP. What do you do?",
               [("Deploy the container group into a subnet of VNet1", "Correct."), ("Give it a DNS name label", "That makes it public."), ("Use restart policy Never", "Unrelated."), ("Enable the ACR admin user", "Unrelated.")],
               "a", "Container groups can be deployed into a virtual network subnet with a private IP.", D + "azure/container-instances/container-instances-vnet")
REPLACE[94] = ("AZ104-3.3.4", 2, "troubleshooting", "On the Container Apps Consumption plan, setting 1 vCPU and 8 GiB of memory fails. Why?",
               [("Consumption allows fixed CPU/memory pairs (memory = 2 × vCPU, for example 1 vCPU / 2 GiB)", "Correct."), ("Container Apps has no memory setting", "It does."),
                ("Max replicas must be 1", "Unrelated."), ("The image is too large", "Unrelated.")],
               "a", "Use a valid pair, or a dedicated workload profile for larger sizes.", D + "azure/container-apps/containers")
REPLACE[95] = ("AZ104-3.4.1", 2, "scenario", "A web app must run on 5 instances. Autoscale and slots are not needed. Which is the lowest tier that allows this?",
               [("Basic", "Maximum 3 instances."), ("Free", "One shared instance."), ("Shared", "No scale out."), ("Standard", "Correct: up to 10 instances.")],
               "d", "Basic scales manually to 3 instances; Standard to 10.", D + "azure/app-service/overview-hosting-plans")
REPLACE[97] = ("AZ104-3.4.2", 2, "scenario", "An App Service plan needs 4 instances on weekdays 08:00–18:00 and 2 instances at other times. What do you configure?",
               [("Manual scale to 4", "Wastes money outside working hours."), ("Autoscale with a recurring schedule profile plus a default profile", "Correct."),
                ("Scale up to Premium v3", "Changes size, not schedule."), ("A deployment slot", "Unrelated.")],
               "b", "Autoscale supports schedule-based profiles for predictable patterns.", D + "azure/azure-monitor/autoscale/autoscale-get-started")
REPLACE[98] = ("AZ104-3.4.3", 3, "single", "You want to move a web app to an App Service plan in a different region. What is true?",
               [("Change the app's plan to the new plan", "Plans must be in the same region and resource group."), ("Move the app's resource group", "Does not change the region."),
                ("Create the app again in the target region (for example clone or redeploy) and switch traffic", "Correct."), ("Enable zone redundancy", "Unrelated.")],
               "c", "An app can only move between plans in the same resource group and region.", D + "azure/app-service/app-service-plan-manage")
REPLACE[107] = ("AZ104-3.4.7", 3, "scenario", "A web app uses VNet integration. Its calls to the internet must also go through the VNet's NAT gateway and NSG. What do you enable?",
                [("Access restrictions", "Inbound only."), ("Route all (vnetRouteAllEnabled) on the VNet integration", "Correct."), ("A private endpoint", "Inbound only."), ("HTTPS Only", "Unrelated.")],
                "b", "With route all enabled, all outbound traffic from the app goes through the integration subnet, so NSGs, UDRs and NAT gateway apply.", D + "azure/app-service/overview-vnet-integration")
REPLACE[109] = ("AZ104-3.4.8", 2, "scenario", "Before a swap completes, you want to check the staging slot running with production settings. What do you use?",
                [("Swap with preview (multi-phase swap)", "Correct."), ("Auto swap", "Swaps without a pause."), ("A new App Service plan", "Unrelated."), ("Restore from backup", "Unrelated.")],
                "a", "Swap with preview applies the target slot's settings to the source first and pauses so you can validate.", D + "azure/app-service/deploy-staging-slots")

# ---------------------------------------------------------------- domain 4
REPLACE[113] = ("AZ104-4.1.2", 3, "scenario", "Two peered VNets are running out of addresses. You add a new address range to one of them. What else must you do?",
                [("Delete and recreate the peering", "No longer needed."), ("Sync the peering so the other VNet learns the new range", "Correct."), ("Nothing; peering updates instantly", "A sync is required."), ("Restart all VMs", "Not needed.")],
                "b", "You can resize the address space of peered VNets; then sync the peering.", D + "azure/virtual-network/update-virtual-network-peering-address-space")
REPLACE[114] = ("AZ104-4.1.2", 3, "troubleshooting", "Spoke A and spoke B both peer with a hub that has a firewall VM. UDRs send spoke-to-spoke traffic to the firewall, but it is dropped when it enters spoke B. What is missing?",
                [("Allow forwarded traffic on the peering links", "Correct: the traffic did not originate in the hub."), ("Use remote gateways", "For VPN gateways."), ("A public IP on the firewall", "Not needed."), ("A NAT gateway", "Unrelated.")],
                "a", "Allow forwarded traffic accepts traffic forwarded by an NVA in the peered VNet.", D + "azure/virtual-network/virtual-network-peering-overview")
REPLACE[115] = ("AZ104-4.1.3", 2, "single", "Which public IP routing preference sends traffic over the ISP network to reduce data transfer cost?",
                [("Microsoft network", "The default: traffic stays on Microsoft's network as long as possible."), ("Internet", "Correct."), ("Global tier", "That is the tier, not routing."), ("Zone-redundant", "That is resiliency.")],
                "b", "Routing preference Internet uses transit ISP networks and is cheaper.", D + "azure/virtual-network/ip-services/routing-preference-overview")
REPLACE[116] = ("AZ104-4.1.3", 2, "troubleshooting", "A load balancer must survive a zone failure, but its existing public IP was created without zones. What do you do?",
                [("Edit the IP and switch it to zone-redundant", "The zone setting cannot be changed after creation."), ("Create a new zone-redundant Standard public IP and use it", "Correct."),
                 ("Add a second IP to the same NIC", "Does not change zone resilience."), ("Change the IP to Basic", "Retired.")],
                "b", "A public IP's zone configuration is fixed at creation.", D + "azure/virtual-network/ip-services/public-ip-addresses")
REPLACE[119] = ("AZ104-4.1.5", 2, "scenario", "You need to see the actual packets between a VM and a database for 10 minutes to diagnose a protocol issue. Which tool?",
                [("Packet capture", "Correct: records packets on the VM, with filters and a time limit."), ("VNet flow logs", "Record flows, not packet contents."), ("Next hop", "Routing only."), ("IP flow verify", "Rule check only.")],
                "a", "Packet capture uses the Network Watcher extension to capture traffic on a VM.", D + "azure/network-watcher/packet-capture-overview")
REPLACE[120] = ("AZ104-4.1.5", 2, "troubleshooting", "Effective security rules and effective routes are greyed out for a VM. Why?",
                [("The VM is stopped (deallocated)", "Correct: they need a running VM."), ("The NSG is on the subnet", "Still visible."), ("The VM has no public IP", "Not required."), ("Network Watcher is disabled", "Not the cause here.")],
                "a", "Start the VM, or use IP flow verify / NSG diagnostics instead.", D + "azure/virtual-network/diagnose-network-routing-problem")
REPLACE[122] = ("AZ104-4.2.1", 3, "single", "A VM has NSGs on both its NIC and its subnet. In which order is outbound traffic evaluated?",
                [("Subnet NSG first, then NIC NSG", "That is the inbound order."), ("NIC NSG first, then subnet NSG", "Correct."), ("Only the subnet NSG", "Both apply."), ("Whichever has the lower priority rule", "Order is fixed by direction.")],
                "b", "Inbound: subnet then NIC. Outbound: NIC then subnet. Both must allow.", D + "azure/virtual-network/network-security-group-how-it-works")
REPLACE[123] = ("AZ104-4.2.2", 3, "single", "The default rule AllowVnetInBound allows the VirtualNetwork service tag. Which sources does that include?",
                [("Only the VNet's own address space", "Wider than that."), ("The VNet, peered VNets and on-premises ranges connected through a gateway", "Correct."),
                 ("All of Azure", "No."), ("The internet", "No.")],
                "b", "VirtualNetwork covers the VNet, peered networks and connected on-premises ranges, so restrict east-west traffic with explicit rules.", D + "azure/virtual-network/service-tags-overview")
REPLACE[125] = ("AZ104-4.2.3", 2, "scenario", "Bastion is deployed in the hub VNet. Can admins use it to reach VMs in a peered spoke VNet?",
                [("Yes, Bastion can connect to VMs in peered VNets", "Correct (not on the Developer SKU)."), ("No, only VMs in the same VNet", "Peered VNets are supported."),
                 ("Only if the spoke VMs have public IPs", "Not needed."), ("Only with a VPN gateway", "Not needed.")],
                "a", "Deploy Bastion once in the hub and reach spokes through peering.", D + "azure/bastion/vnet-peering")
REPLACE[126] = ("AZ104-4.2.3", 2, "single", "Which statement about the Bastion Developer SKU is true?",
                [("It is free, needs no AzureBastionSubnet, and supports one connection at a time for dev/test", "Correct."), ("It supports native client and shareable links", "Those need Standard or Premium."),
                 ("It is the only SKU with session recording", "That is Premium."), ("It requires a /26 subnet", "That is for Basic and higher.")],
                "a", "Developer runs on shared infrastructure and is limited to certain regions.", D + "azure/bastion/quickstart-developer")
REPLACE[129] = ("AZ104-4.2.5", 3, "scenario", "On-premises clients must use a storage account's private endpoint over ExpressRoute, but they resolve its public IP. What do you add?",
                [("A conditional forwarder on-premises to Azure DNS Private Resolver for the privatelink zone", "Correct."), ("A service endpoint", "Azure subnets only."),
                 ("A public DNS zone", "Would not return the private IP."), ("A NAT gateway", "Unrelated.")],
                "a", "On-premises DNS must forward privatelink zone queries to an Azure resolver that can see the private DNS zone.", D + "azure/private-link/private-endpoint-dns-integration")
REPLACE[133] = ("AZ104-4.3.2", 3, "single", "An internal load balancer must forward all ports and protocols to a pair of firewall appliances with a single rule. What do you use?",
                [("HA ports load-balancing rule on a Standard internal load balancer", "Correct."), ("Inbound NAT rules for each port", "Too many rules."), ("A public load balancer", "Not internal."), ("Session persistence Client IP", "Not about ports.")],
                "a", "HA ports balance all TCP and UDP flows on all ports, on internal Standard load balancers.", D + "azure/load-balancer/load-balancer-ha-ports-overview")

# ---------------------------------------------------------------- domain 5
REPLACE[137] = ("AZ104-5.1.1", 2, "single", "You need the total number of storage transactions per hour. Which aggregation and granularity do you choose?",
                [("Average, 1 minute", "Average does not give a total."), ("Sum, 1 hour", "Correct."), ("Max, 1 day", "Peak, not total."), ("Count, 5 minutes", "Counts samples, not transactions.")],
                "b", "Use Sum for counters that add up, such as transactions or requests.", D + "azure/azure-monitor/essentials/metrics-aggregation-explained")
REPLACE[138] = ("AZ104-5.1.1", 2, "scenario", "You must analyse a VM's platform metrics from 8 months ago. What should have been set up?",
                [("A diagnostic setting sending AllMetrics to a Log Analytics workspace (or storage)", "Correct: platform metrics are kept only 93 days."), ("A larger VM size", "Unrelated."),
                 ("An action group", "Notifications only."), ("Nothing; metrics are kept for two years", "They are kept 93 days.")],
                "a", "Route metrics to a workspace or storage for longer retention.", D + "azure/azure-monitor/essentials/data-platform-metrics")
REPLACE[140] = ("AZ104-5.1.2", 2, "scenario", "Auditors need to see who deleted resources over the last two years. What do you configure?",
                [("A diagnostic setting on the activity log sending to a Log Analytics workspace or storage account", "Correct: the activity log itself keeps 90 days."), ("Azure Monitor Agent", "For guest data."),
                 ("A metric alert", "Not a log of operations."), ("Nothing; the activity log keeps 2 years", "It keeps 90 days.")],
                "a", "Export the activity log for longer retention and KQL.", D + "azure/azure-monitor/essentials/activity-log")
REPLACE[142] = ("AZ104-5.1.3", 2, "single", "Which KQL operator adds a calculated column, such as a CPU value rounded to a whole number?",
                [("project", "Chooses columns (it can also rename)."), ("summarize", "Aggregates rows."), ("extend", "Correct."), ("where", "Filters rows.")],
                "c", "extend adds columns: | extend CPU = round(CounterValue).", D + "kusto/query/extend-operator")
REPLACE[143] = ("AZ104-5.1.4", 2, "scenario", "A metric's normal level changes through the day, so a fixed threshold either misses problems or fires all the time. What do you use?",
                [("Dynamic thresholds on the metric alert", "Correct: the threshold is learned from history."), ("A higher fixed threshold", "Misses real problems."), ("An activity log alert", "Not for metric values."), ("A budget alert", "Cost only.")],
                "a", "Dynamic thresholds adapt to seasonal patterns.", D + "azure/azure-monitor/alerts/alerts-dynamic-thresholds")
REPLACE[144] = ("AZ104-5.1.4", 2, "scenario", "Every Sev0 alert in the subscription, from any alert rule, must also page the on-call team. What is the least effort?",
                [("Add the on-call action group to every rule", "High effort and easy to miss rules."), ("An alert processing rule scoped to the subscription, filtered on severity Sev0, that adds the on-call action group", "Correct."),
                 ("A diagnostic setting", "Collection only."), ("A workbook", "Visualisation only.")],
                "b", "Alert processing rules can add action groups to fired alerts at scale.", D + "azure/azure-monitor/alerts/alerts-processing-rules")
REPLACE[147] = ("AZ104-5.1.6", 2, "single", "A site-to-site VPN connection keeps dropping. Which Network Watcher tool diagnoses the gateway and connection?",
                [("VPN troubleshoot", "Correct."), ("IP flow verify", "NSG rules."), ("Next hop", "Routing."), ("Topology", "Diagram.")],
                "a", "VPN troubleshoot checks gateway and connection health and saves logs to storage.", D + "azure/network-watcher/vpn-troubleshoot-overview")
REPLACE[150] = ("AZ104-5.2.1", 3, "scenario", "Ransomware must not be able to shorten retention or delete recovery points in a Recovery Services vault, even with admin rights. What do you enable?",
                [("Immutability on the vault (locked)", "Correct."), ("LRS redundancy", "Unrelated."), ("Cross Region Restore", "Restore location only."), ("A larger instant restore window", "Unrelated.")],
                "a", "Immutable vaults block operations that could lose recovery points; locking makes it irreversible.", D + "azure/backup/backup-azure-immutable-vault-concept")
REPLACE[151] = ("AZ104-5.2.2", 2, "single", "You must back up AKS clusters with Azure Backup. Which vault do you create?",
                [("Recovery Services vault", "Not for AKS."), ("Backup vault", "Correct."), ("Key Vault", "Secrets."), ("Storage account", "Not a vault.")],
                "b", "AKS, disks, blobs and PostgreSQL flexible server use Backup vaults.", D + "azure/backup/azure-kubernetes-service-backup-overview")
REPLACE[153] = ("AZ104-5.2.3", 2, "single", "How long can instant restore snapshots be kept with an Enhanced VM backup policy?",
                [("1–5 days", "That is the Standard policy."), ("1–30 days", "Correct."), ("Exactly 2 days", "2 is the Standard default."), ("Up to 99 years", "That is long-term vault retention.")],
                "b", "Enhanced: snapshots 1–30 days; Standard: 1–5 days.", D + "azure/backup/backup-azure-vms-enhanced-policy")
REPLACE[154] = ("AZ104-5.2.3", 3, "scenario", "A SQL Server database running in an Azure VM must be restorable to any point in time within the last 15 minutes. What do you configure?",
                [("An Azure VM backup policy with daily backups", "Restores whole-VM points only."), ("SQL Server in Azure VM backup with log backups every 15 minutes", "Correct."),
                 ("Site Recovery", "Replication, not point-in-time database restore."), ("Blob versioning", "Unrelated.")],
                "b", "The SQL workload backup supports log backups for point-in-time restore.", D + "azure/backup/backup-azure-sql-database")
REPLACE[155] = ("AZ104-5.2.4", 2, "troubleshooting", "The original VM was deleted, and 'Replace existing' is not available when restoring. What do you do?",
                [("Create new VM or Restore disks from the recovery point", "Correct."), ("Enable soft delete", "Unrelated."), ("Use File Recovery for the whole VM", "Files only."), ("Wait 24 hours", "It will not appear.")],
                "a", "Replace existing needs the original VM; otherwise create a new VM or restore disks.", D + "azure/backup/backup-azure-arm-restore-vms")
REPLACE[157] = ("AZ104-5.2.5", 2, "single", "In Site Recovery, what does network mapping define?",
                [("Which target VNet the failed-over VMs connect to for each source VNet", "Correct."), ("Backup retention", "Backup policy."), ("NSG rules in the source", "No."), ("DNS records", "No.")],
                "a", "Network mapping pairs source and target virtual networks for failover.", D + "azure/site-recovery/azure-to-azure-network-mapping")
REPLACE[159] = ("AZ104-5.2.6", 2, "single", "What does Commit do after a Site Recovery failover?",
                [("Starts replication back to the primary", "That is re-protect."), ("Makes the failover final and removes the other recovery points", "Correct."), ("Deletes the source VM", "No."), ("Runs a test failover", "No.")],
                "b", "After commit you can no longer change the recovery point; then re-protect.", D + "azure/site-recovery/azure-to-azure-tutorial-failover-failback")
REPLACE[161] = ("AZ104-5.2.7", 2, "scenario", "Every new Recovery Services vault in the organisation must send its data to the central reporting workspace automatically. What do you use?",
                [("Azure Policy that deploys vault diagnostic settings (DeployIfNotExists)", "Correct."), ("A budget", "Cost."), ("A resource lock", "Unrelated."), ("An alert processing rule", "Routes alerts, not report data.")],
                "a", "Built-in policies can deploy diagnostic settings for vaults at scale.", D + "azure/backup/azure-policy-configure-diagnostics")
REPLACE[162] = ("AZ104-5.2.7", 3, "scenario", "You need an alert when any backup job takes longer than 3 hours. Built-in backup alerts don't cover this. What do you create?",
                [("A log search alert on the AddonAzureBackupJobs table in the reporting workspace", "Correct."), ("A metric alert on vault CPU", "No such metric."), ("A budget alert", "Cost."), ("An activity log alert", "Not job durations.")],
                "a", "Custom conditions use KQL log search alerts over the backup diagnostic tables.", D + "azure/backup/backup-azure-monitoring-use-azuremonitor")
REPLACE[87] = ("AZ104-3.3.1", 2, "scenario", "A public sample image in your registry must be pullable by anyone without credentials. What do you do?",
               [("Enable the admin user and publish the password", "Shares a credential; not anonymous and not recommended."), ("Enable anonymous pull on a Standard or Premium registry", "Correct."),
                ("Assign AcrPull to Everyone", "There is no 'Everyone' principal."), ("Move the image to a storage account", "Not a registry.")],
               "b", "Anonymous pull is a registry setting available on Standard and Premium SKUs.", D + "azure/container-registry/anonymous-pull-access")
REPLACE[103] = ("AZ104-3.4.5", 2, "single", "Why does App Service ask for a TXT record named asuid.<subdomain> when you add a custom domain?",
                [("To route traffic to the app", "Routing is done by the CNAME or A record."), ("To prove you own the domain and protect against subdomain takeover", "Correct."),
                 ("To enable HTTPS", "TLS needs a certificate binding."), ("To configure email for the domain", "That is MX.")],
                "b", "The asuid TXT record carries the app's custom domain verification ID.", D + "azure/app-service/app-service-web-tutorial-custom-domain")
