"""Extra AZ-104 exam-style questions, domains 3 (compute), 4 (networking) and 5 (monitor and maintain).

Each entry: (objective, difficulty, type, stem, [(option, why)], correct letters, explanation, doc[, code]).
"""
D = "https://learn.microsoft.com/"
Q: list[tuple] = []
add = Q.append

ARM = """{
  "parameters": {
    "storageName": { "type": "string" },
    "sku": { "type": "string", "defaultValue": "Standard_LRS",
             "allowedValues": [ "Standard_LRS", "Standard_GRS" ] }
  },
  "resources": [ {
    "type": "Microsoft.Storage/storageAccounts",
    "apiVersion": "2023-05-01",
    "name": "[parameters('storageName')]",
    "location": "[resourceGroup().location]",
    "sku": { "name": "[parameters('sku')]" },
    "kind": "StorageV2"
  } ]
}"""

BICEP = """param location string = resourceGroup().location
param vmCount int = 2

resource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = [for i in range(0, vmCount): {
  name: 'nic-web-${i}'
  location: location
  properties: { ... }
}]"""

# ---------------------------------------------------------------- 3.1 templates
add(("AZ104-3.1.1", 2, "single", "You deploy the template without supplying sku. Where is the storage account created and with which SKU?",
     [("In the resource group's region, Standard_LRS", "Correct: location uses resourceGroup().location and sku has a default."), ("In East US, Standard_LRS", "No region is hard-coded."),
      ("In the resource group's region, Standard_GRS", "The default is LRS."), ("The deployment fails because sku is missing", "It has a defaultValue.")],
     "a", "Parameters with defaultValue are optional; the location comes from the target resource group.", D + "azure/azure-resource-manager/templates/syntax", ARM))
add(("AZ104-3.1.1", 2, "single", "How many network interfaces does this Bicep file create when deployed with default values?",
     [("1", "The loop runs vmCount times."), ("2", "Correct: range(0, 2) gives 0 and 1."), ("3", "No."), ("0", "No.")],
     "b", "range(0, vmCount) with vmCount = 2 creates nic-web-0 and nic-web-1.", D + "azure/azure-resource-manager/bicep/loops", BICEP))
add(("AZ104-3.1.2", 2, "configuration", "In the template shown, you must allow Standard_ZRS too. What do you change?",
     [("Add \"Standard_ZRS\" to allowedValues of the sku parameter", "Correct."), ("Change kind to ZRS", "kind is StorageV2."),
      ("Change apiVersion", "Not related."), ("Add a variable named ZRS", "Variables do not change allowed values.")],
     "a", "allowedValues restricts what can be passed; add the new SKU there.", D + "azure/azure-resource-manager/templates/parameters", ARM))
add(("AZ104-3.1.2", 2, "single", "Which template section holds values calculated inside the template and not supplied by the person deploying it?",
     [("parameters", "Supplied at deploy time."), ("variables", "Correct."), ("outputs", "Returned after deployment."), ("$schema", "Describes the template format.")],
     "b", "Variables hold values derived inside the template.", D + "azure/azure-resource-manager/templates/variables"))
add(("AZ104-3.1.3", 2, "configuration", "You want this Bicep file to create the NICs in UAE North by default instead of the resource group's region. Which line do you change?",
     [("param location string = 'uaenorth'", "Correct."), ("param vmCount int = 'uaenorth'", "Wrong parameter and type."),
      ("name: 'nic-web-${i}'", "Name, not location."), ("Remove the location property", "Location is required for NICs.")],
     "a", "Change the default value of the location parameter.", D + "azure/azure-resource-manager/bicep/parameters", BICEP))
add(("AZ104-3.1.3", 2, "single", "In Bicep, how do you make a value available to callers after deployment?",
     [("param", "Inputs."), ("var", "Internal values."), ("output", "Correct."), ("module", "Calls another file.")],
     "c", "output declares values returned by the deployment.", D + "azure/azure-resource-manager/bicep/outputs"))
add(("AZ104-3.1.4", 3, "scenario", "You redeploy a template to RG1 in Complete mode. RG1 also contains a VM that is not in the template. What happens to the VM?",
     [("Nothing", "That is Incremental mode."), ("It is deleted", "Correct."), ("It is stopped", "No."), ("The deployment fails", "No.")],
     "b", "Complete mode deletes resources in the group that are not defined in the template.", D + "azure/azure-resource-manager/templates/deployment-modes"))
add(("AZ104-3.1.4", 2, "single", "Which command previews the changes a Bicep deployment would make to a resource group without deploying?",
     [("az deployment group what-if", "Correct."), ("az bicep build", "Compiles to JSON."), ("az group export", "Exports existing resources."), ("az deployment group validate only", "Validates syntax, but what-if shows changes.")],
     "a", "what-if shows create, modify and delete changes before you deploy.", D + "azure/azure-resource-manager/templates/deploy-what-if"))
add(("AZ104-3.1.5", 2, "scenario", "You configured a resource group by hand and now want a Bicep file of it. What is the quickest path?",
     [("Export template, then az bicep decompile", "Correct."), ("az bicep build", "That goes Bicep → JSON."), ("Copy the activity log", "Not a template."), ("Write it from scratch", "Slower.")],
     "a", "Export produces ARM JSON from deployed resources; decompile turns it into Bicep.", D + "azure/azure-resource-manager/bicep/decompile"))
add(("AZ104-3.1.5", 2, "single", "Which Azure CLI command converts a Bicep file to ARM JSON?",
     [("az bicep decompile", "JSON → Bicep."), ("az bicep build", "Correct."), ("az deployment group export", "No such conversion."), ("az bicep publish", "Publishes to a registry.")],
     "b", "az bicep build compiles Bicep to ARM JSON.", D + "azure/azure-resource-manager/bicep/bicep-cli"))

# ---------------------------------------------------------------- 3.2 VMs
add(("AZ104-3.2.1", 2, "scenario", "Admins must reach new Windows VMs without any public IP on the VMs. What should you plan when creating them?",
     [("Public inbound port RDP 3389 open", "Exposes the VM."), ("No public IP, and use Azure Bastion", "Correct."), ("A Basic public IP", "Retired, and still public."), ("An availability set", "Unrelated.")],
     "b", "Bastion gives RDP/SSH from the portal without public IPs on VMs.", D + "azure/bastion/bastion-overview"))
add(("AZ104-3.2.1", 2, "troubleshooting", "Creating a D4s_v5 VM fails with 'Operation could not be completed as it results in exceeding approved Total Regional Cores quota'. What do you do?",
     [("Request a vCPU quota increase for the region (or pick a smaller size)", "Correct."), ("Change the resource group", "Quota is per subscription and region."),
      ("Add a tag", "Unrelated."), ("Use a different VNet", "Unrelated.")],
     "a", "Increase the regional and family vCPU quota in Usage + quotas.", D + "azure/quotas/per-vm-quota-requests"))
add(("AZ104-3.2.2", 3, "multiple", "VM2 has used Azure Disk Encryption since 2024. You must move it to encryption at host before ADE retires. Which TWO statements are true?",
     [("Encryption at host cannot be turned on for VM2 itself because it has had ADE", "Correct."), ("You create a new VM with new disks, enable encryption at host, and copy the data across", "Correct."),
      ("Disabling ADE on VM2 lets you then enable encryption at host on the same VM", "A VM that ever had ADE cannot use encryption at host."), ("ADE keeps working after 15 September 2028", "After retirement, ADE disks fail to unlock on reboot.")],
     "ab", "Encryption at host can't be enabled on VMs that currently or ever had Azure Disk Encryption, so migration means a new VM with new disks.", D + "azure/virtual-machines/disk-encryption-migrate"))
add(("AZ104-3.2.2", 2, "single", "Which option also encrypts a VM's temporary disk and disk caches at the Azure host, without software inside the VM?",
     [("Server-side encryption with platform keys only", "Does not cover temp disk and caches."), ("Encryption at host", "Correct."), ("Azure Disk Encryption", "Encrypts inside the guest OS."), ("TLS 1.2", "In transit only.")],
     "b", "Encryption at host encrypts temp disks and caches on the host.", D + "azure/virtual-machines/disk-encryption"))
add(("AZ104-3.2.3", 2, "scenario", "You must move a running VM from West Europe to UAE North with minimal downtime. Which service?",
     [("Move to another resource group", "Keeps the region."), ("Azure Resource Mover (or Site Recovery)", "Correct."), ("Export template and redeploy without data", "Loses disk data."), ("Change the VM size", "Unrelated.")],
     "b", "Cross-region moves use Azure Resource Mover or Site Recovery replication.", D + "azure/resource-mover/tutorial-move-region-virtual-machines"))
add(("AZ104-3.2.3", 2, "single", "When you move a VM to another subscription, what must you move with it?",
     [("Nothing", "Dependencies must move too."), ("Its dependent resources such as disks, NIC and public IP", "Correct."), ("The whole region", "No."), ("Its Recovery Services vault only", "No.")],
     "b", "VMs move together with their dependent resources.", D + "azure/azure-resource-manager/management/move-limitations/virtual-machines-move-limitations"))
add(("AZ104-3.2.4", 2, "troubleshooting", "The size you want is not listed on a running VM's Size page. What should you try first?",
     [("Stop (deallocate) the VM, then resize", "Correct: more sizes become available."), ("Delete the VM", "Unnecessary."), ("Move it to another resource group", "Does not change the cluster."), ("Add a data disk", "Unrelated.")],
     "a", "If a size is not available on the current hardware cluster, deallocating lets Azure place the VM elsewhere.", D + "azure/virtual-machines/sizes/resize-vm"))
add(("AZ104-3.2.4", 1, "single", "Which VM family is designed for memory-heavy workloads such as large databases?",
     [("B-series", "Burstable."), ("F-series", "Compute optimised."), ("E-series", "Correct."), ("N-series", "GPU.")],
     "c", "E-series are memory optimised.", D + "azure/virtual-machines/sizes/overview"))
add(("AZ104-3.2.5", 2, "single", "Which disk should never be used for data you must keep?",
     [("OS disk", "Persistent."), ("Temporary disk", "Correct: lost on deallocation or host moves."), ("Premium SSD data disk", "Persistent."), ("Ultra Disk", "Persistent.")],
     "b", "The temporary disk is not persistent.", D + "azure/virtual-machines/managed-disks-overview"))
add(("AZ104-3.2.5", 2, "troubleshooting", "You need to shrink a 1 TiB managed data disk to 512 GiB. What can you do?",
     [("Edit the size to 512 GiB", "Managed disks cannot be shrunk."), ("Create a new 512 GiB disk and copy the data", "Correct."),
      ("Take a snapshot and resize it", "A snapshot keeps the size."), ("Change to Standard HDD", "Type, not size.")],
     "b", "Managed disks can only be increased; to go smaller, copy data to a new disk.", D + "azure/virtual-machines/linux/expand-disks"))
add(("AZ104-3.2.6", 2, "scenario", "Two VMs must stay available if an entire datacenter in the region fails. What do you use?",
     [("An availability set", "Protects within one datacenter."), ("Availability zones, one VM per zone", "Correct."), ("A proximity placement group", "Keeps VMs close, not apart."), ("A larger VM size", "Still one VM.")],
     "b", "Zones are separate datacenters; VMs across two or more zones get the 99.99% SLA.", D + "azure/virtual-machines/availability"))
add(("AZ104-3.2.6", 2, "troubleshooting", "You want to add an existing running VM to an availability set. What must you do?",
     [("Edit the VM's availability settings", "Not possible after creation."), ("Recreate the VM in the availability set (for example from its disks)", "Correct."),
      ("Move the availability set into the VM's group", "Does not add the VM."), ("Resize the VM", "No.")],
     "b", "The availability set is chosen at creation; existing VMs must be recreated.", D + "azure/virtual-machines/windows/change-availability-set"))
add(("AZ104-3.2.7", 2, "scenario", "A scale set must grow when average CPU is over 75% and shrink when it is under 25%, between 2 and 10 instances. What do you configure?",
     [("Custom autoscale with scale-out and scale-in rules, min 2, max 10", "Correct."), ("Manual scale to 10", "Not automatic."), ("An availability set", "Unrelated."), ("A VM size change", "Scale up, not out.")],
     "a", "Autoscale profiles define limits and metric rules in both directions.", D + "azure/virtual-machine-scale-sets/virtual-machine-scale-sets-autoscale-portal"))
add(("AZ104-3.2.7", 2, "single", "Which scale set upgrade policy updates instances in batches to avoid downtime?",
     [("Manual", "You update each instance."), ("Automatic", "All at once."), ("Rolling", "Correct."), ("Incremental", "Not an upgrade policy.")],
     "c", "Rolling upgrades update instances in batches.", D + "azure/virtual-machine-scale-sets/virtual-machine-scale-sets-upgrade-policy"))

# ---------------------------------------------------------------- 3.3 containers
add(("AZ104-3.3.1", 2, "scenario", "Your container registry must replicate images to three regions and be reachable only through private endpoints. Which SKU?",
     [("Basic", "No geo-replication."), ("Standard", "No geo-replication."), ("Premium", "Correct."), ("Free", "Does not exist.")],
     "c", "Geo-replication and private link require ACR Premium.", D + "azure/container-registry/container-registry-skus"))
add(("AZ104-3.3.1", 2, "single", "A container app must pull images from ACR without storing passwords. What should you use?",
     [("The registry admin user", "Uses a password."), ("A managed identity with the AcrPull role on the registry", "Correct."), ("An account SAS", "Storage, not ACR."), ("Anonymous pull", "Not for private images.")],
     "b", "Managed identities with AcrPull avoid stored credentials.", D + "azure/container-registry/container-registry-authentication-managed-identity"))
add(("AZ104-3.3.2", 2, "scenario", "A nightly job runs a container for 20 minutes and must not restart after it finishes. Which ACI setting?",
     [("Restart policy: Always", "Restarts after exit."), ("Restart policy: Never (or OnFailure)", "Correct."), ("Scale rule", "ACI has none."), ("A private IP", "Unrelated.")],
     "b", "Run-once tasks use the Never or OnFailure restart policy.", D + "azure/container-instances/container-instances-restart-policy"))
add(("AZ104-3.3.2", 1, "single", "What does a container group in Azure Container Instances contain?",
     [("One or more containers on the same host sharing network and lifecycle", "Correct."), ("Several Kubernetes clusters", "No."), ("Only images", "No."), ("Scale sets", "No.")],
     "a", "Containers in a group share a host, network and storage volumes.", D + "azure/container-instances/container-instances-container-groups"))
add(("AZ104-3.3.3", 2, "scenario", "A web API in containers must scale with HTTP traffic, scale to zero overnight and support blue-green releases, without managing Kubernetes. Which service?",
     [("Azure Container Instances", "No autoscale or revisions."), ("Azure Container Apps", "Correct."), ("A VM scale set with Docker", "You manage the VMs."), ("Azure Container Registry", "Stores images only.")],
     "b", "Container Apps offers HTTP scaling, scale to zero and revision traffic splitting.", D + "azure/container-apps/overview"))
add(("AZ104-3.3.3", 2, "single", "In Azure Container Apps, what creates a new revision?",
     [("Changing the app's template, for example the container image", "Correct."), ("Viewing logs", "No."), ("Changing a tag on the resource group", "No."), ("Reading metrics", "No.")],
     "a", "Revision-scope changes (template) create new revisions; app-scope changes such as secrets do not.", D + "azure/container-apps/revisions"))
add(("AZ104-3.3.4", 2, "single", "How do you give an existing ACI container more memory?",
     [("Enable autoscale", "ACI has none."), ("Redeploy the container group with a larger memory request", "Correct."), ("Add replicas", "ACI has no replicas."), ("Resize the VM", "There is no VM to manage.")],
     "b", "ACI resources are fixed per deployment; redeploy to change them.", D + "azure/container-instances/container-instances-overview"))
add(("AZ104-3.3.4", 2, "scenario", "A container app should run between 0 and 20 replicas, adding replicas when there are more than 50 concurrent HTTP requests each. What do you configure?",
     [("Min replicas 0, max 20, HTTP scale rule with concurrency 50", "Correct."), ("ACI restart policy Always", "Wrong service."), ("An App Service plan autoscale rule", "Wrong service."), ("A VM scale set", "Wrong service.")],
     "a", "Container Apps scale rules plus min/max replicas.", D + "azure/container-apps/scale-app"))

# ---------------------------------------------------------------- 3.4 App Service
add(("AZ104-3.4.1", 2, "scenario", "You need deployment slots and autoscale for a production web app at the lowest cost. Which plan tier?",
     [("Free", "No slots or autoscale."), ("Basic", "No slots or autoscale."), ("Standard", "Correct."), ("Isolated v2", "Much more expensive.")],
     "c", "Standard is the lowest tier with deployment slots and autoscale.", D + "azure/app-service/overview-hosting-plans"))
add(("AZ104-3.4.1", 2, "single", "Three web apps run on one App Service plan. One app has a memory leak. What is the effect?",
     [("Only that app is affected", "They share instances."), ("All apps on the plan can be slowed because they share the same instances", "Correct."),
      ("The plan moves the app automatically", "No."), ("Azure creates a new plan", "No.")],
     "b", "Apps on a plan share its compute; isolate noisy apps on their own plan.", D + "azure/app-service/overview-hosting-plans"))
add(("AZ104-3.4.2", 2, "single", "What is the difference between scaling up and scaling out an App Service plan?",
     [("Up = more instances; out = bigger instances", "Reversed."), ("Up = bigger tier/size; out = more instances", "Correct."), ("They are the same", "No."), ("Up = another region", "No.")],
     "b", "Scale up changes tier or size; scale out changes the instance count.", D + "azure/app-service/manage-scale-up"))
add(("AZ104-3.4.2", 2, "troubleshooting", "On a Basic B2 plan you cannot find rule-based autoscale. Why?",
     [("Autoscale needs Standard or higher", "Correct."), ("Autoscale is only for Linux", "No."), ("You need a VNet", "No."), ("You need a custom domain", "No.")],
     "a", "Rule-based autoscale requires Standard, Premium or Isolated tiers.", D + "azure/app-service/manage-scale-up"))
add(("AZ104-3.4.3", 1, "single", "When creating a web app, which choice decides the region, tier and instance size it runs on?",
     [("The runtime stack", "Language only."), ("The App Service plan", "Correct."), ("The resource group", "A container."), ("The publish model", "Code or container.")],
     "b", "The plan defines where and on what the app runs.", D + "azure/app-service/overview-hosting-plans"))
add(("AZ104-3.4.3", 2, "single", "You need to run a custom Docker image as a web app. Which publish option do you select?",
     [("Code", "For source code with a built-in stack."), ("Container", "Correct."), ("Static Web App", "A different service."), ("Function", "A different service.")],
     "b", "Choose Container (Docker) when creating the web app.", D + "azure/app-service/quickstart-custom-container"))
add(("AZ104-3.4.4", 2, "scenario", "You need a free TLS certificate for www.contoso.com on a web app. Which option? (The app is on Basic tier.)",
     [("App Service managed certificate", "Correct."), ("Self-signed certificate", "Browsers will not trust it."), ("A wildcard managed certificate", "Managed certificates do not support wildcards."), ("Free tier certificate", "Free tier has no custom TLS.")],
     "a", "App Service managed certificates are free on Basic and higher for non-wildcard names.", D + "azure/app-service/configure-ssl-certificate"))
add(("AZ104-3.4.4", 2, "single", "Which settings force browsers onto encrypted connections and reject old protocols?",
     [("HTTPS Only On and Minimum TLS version 1.2", "Correct."), ("ARR affinity", "Session stickiness."), ("Always On", "Keeps the app loaded."), ("HTTP 2.0", "Protocol version, not a redirect.")],
     "a", "HTTPS Only redirects HTTP; the minimum TLS version blocks older protocols.", D + "azure/app-service/configure-ssl-bindings"))
add(("AZ104-3.4.5", 2, "multiple", "You map www.contoso.com to app1.azurewebsites.net. Which TWO DNS records do you create?",
     [("CNAME www → app1.azurewebsites.net", "Correct."), ("TXT asuid.www with the domain verification ID", "Correct."), ("MX www", "Mail."), ("NS www", "Delegation.")],
     "ab", "A CNAME points the name at the app; the TXT asuid record proves ownership.", D + "azure/app-service/app-service-web-tutorial-custom-domain"))
add(("AZ104-3.4.5", 2, "single", "Which record type maps the root domain contoso.com to a web app?",
     [("CNAME", "Not allowed at the apex in standard DNS."), ("A record to the app's IP, plus TXT asuid", "Correct."), ("SRV", "No."), ("PTR", "Reverse lookup.")],
     "b", "The apex uses an A record (or an alias record in Azure DNS) plus the TXT verification record.", D + "azure/app-service/app-service-web-tutorial-custom-domain"))
add(("AZ104-3.4.6", 2, "single", "Which is the lowest App Service tier that supports backups?",
     [("Free", "No backups."), ("Shared", "No backups."), ("Basic", "Correct."), ("Standard", "Supported, but not the lowest.")],
     "c", "Backups are available on Basic and higher.", D + "azure/app-service/manage-backup"))
add(("AZ104-3.4.6", 2, "scenario", "You need backups of a web app and its linked database on your own schedule, stored in your storage account. What do you configure?",
     [("A custom backup with a storage account and schedule", "Correct."), ("Only automatic backups", "No control over storage or schedule."), ("A deployment slot", "Not a backup."), ("Azure Site Recovery", "For VMs.")],
     "a", "Custom backups store to your storage account on your schedule and can include linked databases.", D + "azure/app-service/manage-backup"))
add(("AZ104-3.4.7", 2, "scenario", "A web app must call a SQL database that only has a private endpoint in VNet1. What do you configure on the app?",
     [("Access restrictions", "Inbound only."), ("VNet integration with a subnet in VNet1", "Correct."), ("A private endpoint for the app", "Makes the app private inbound; does not route outbound."), ("Hybrid connections to the internet", "Not needed.")],
     "b", "VNet integration routes the app's outbound traffic into the VNet.", D + "azure/app-service/overview-vnet-integration"))
add(("AZ104-3.4.7", 2, "single", "Only your office IP range should reach a web app. What do you use?",
     [("Access restrictions allowing the office range", "Correct."), ("VNet integration", "Outbound only."), ("A deployment slot", "Unrelated."), ("ARR affinity", "Unrelated.")],
     "a", "Access restrictions filter inbound traffic by IP, service tag or subnet.", D + "azure/app-service/app-service-ip-restrictions"))
add(("AZ104-3.4.8", 3, "scenario", "After swapping staging into production, production starts using the staging database. How do you prevent this?",
     [("Mark the connection string as a deployment slot setting in each slot", "Correct."), ("Disable auto swap", "Not the cause."), ("Use a different App Service plan", "Not needed."), ("Turn off ARR affinity", "Unrelated.")],
     "a", "Sticky (slot) settings stay with their slot during swaps.", D + "azure/app-service/deploy-staging-slots"))
add(("AZ104-3.4.8", 2, "single", "You want 10% of production traffic to test the staging slot. What do you configure?",
     [("Traffic % on the staging slot in Deployment slots", "Correct."), ("A new App Service plan", "No."), ("An Azure Load Balancer", "Not for App Service slots."), ("Auto swap", "Swaps fully.")],
     "a", "Deployment slots support routing a percentage of traffic to a slot.", D + "azure/app-service/deploy-staging-slots"))

# ---------------------------------------------------------------- 4.1 networking
add(("AZ104-4.1.1", 2, "single", "How many IP addresses can you assign to VMs in a /28 subnet?",
     [("16", "Total addresses."), ("14", "Not how Azure counts."), ("11", "Correct: 16 − 5 reserved."), ("8", "No.")],
     "c", "Azure reserves five addresses in every subnet.", D + "azure/virtual-network/virtual-networks-faq"))
add(("AZ104-4.1.1", 2, "troubleshooting", "A new VM in a newly created VNet cannot download updates from the internet, though NSGs allow outbound. What is the likely reason?",
     [("The subnet is private (no default outbound access); add a NAT gateway or public IP", "Correct."), ("VMs never have internet", "They can, with an explicit method."),
      ("The VM size is too small", "Unrelated."), ("DNS is disabled", "Azure DNS works by default.")],
     "a", "New VNets use private subnets by default; configure explicit outbound connectivity.", D + "azure/virtual-network/ip-services/default-outbound-access"))
add(("AZ104-4.1.2", 3, "scenario", "VNet A is peered with VNet B, and VNet B with VNet C. VMs in A must reach VMs in C. What is the simplest fix?",
     [("Nothing; peering is transitive", "It is not."), ("Peer VNet A directly with VNet C", "Correct."), ("Add an NSG rule", "NSGs cannot create routes."), ("Enable gateway transit on B", "Only for gateway traffic.")],
     "b", "Peering is not transitive; peer A and C, or route through an NVA in B.", D + "azure/virtual-network/virtual-network-peering-overview"))
add(("AZ104-4.1.2", 2, "multiple", "Spoke VNets must use the VPN gateway in the hub VNet. Which TWO settings do you enable?",
     [("Allow gateway transit on the hub's peering", "Correct."), ("Use remote gateways on the spoke's peering", "Correct."), ("Allow forwarded traffic on both", "Needed for NVAs, not gateways."), ("A service endpoint", "Unrelated.")],
     "ab", "Gateway transit (hub) plus use remote gateways (spoke).", D + "azure/vpn-gateway/vpn-gateway-peering-gateway-transit"))
add(("AZ104-4.1.3", 2, "troubleshooting", "A VM has a Standard public IP, but nobody can connect to its website on port 443. What should you check first?",
     [("That an NSG on the NIC or subnet allows inbound 443", "Correct: Standard IPs are closed by default."), ("That the IP is Basic", "Basic is retired."),
      ("That the IP is dynamic", "Standard is static."), ("The VM's tags", "Unrelated.")],
     "a", "Standard public IPs are secure by default; an NSG must allow inbound traffic.", D + "azure/virtual-network/ip-services/public-ip-addresses"))
add(("AZ104-4.1.3", 2, "single", "Partners must allow-list a block of 16 contiguous public IPs for your services. What do you create?",
     [("16 separate public IPs", "Not guaranteed contiguous."), ("A public IP address prefix /28", "Correct."), ("A NAT gateway only", "Uses IPs, but you still need contiguous ones."), ("A private endpoint", "Private.")],
     "b", "A public IP prefix reserves a contiguous range.", D + "azure/virtual-network/ip-services/public-ip-address-prefix"))
add(("AZ104-4.1.4", 3, "scenario", "All internet-bound traffic from subnet snet-app must pass through a firewall VM at 10.0.3.4. What do you configure?",
     [("A route table with 0.0.0.0/0 next hop Virtual appliance 10.0.3.4, associated with snet-app; IP forwarding on the firewall's NIC", "Correct."),
      ("An NSG on snet-app", "NSGs filter; they do not route."), ("Peering to the firewall's VNet only", "Peering alone does not force traffic."), ("A private endpoint", "Unrelated.")],
     "a", "UDRs send traffic to an NVA, which needs IP forwarding.", D + "azure/virtual-network/tutorial-create-route-table-portal"))
add(("AZ104-4.1.4", 2, "single", "A route table has routes for 10.0.0.0/16 (to an NVA) and 10.0.1.0/24 (to Virtual network). Which route is used for 10.0.1.5?",
     [("10.0.0.0/16", "Less specific."), ("10.0.1.0/24", "Correct: longest prefix wins."), ("Both, load balanced", "No."), ("The system route always", "UDRs override system routes for the same prefix.")],
     "b", "Azure selects the longest matching prefix.", D + "azure/virtual-network/virtual-networks-udr-overview"))
add(("AZ104-4.1.5", 2, "single", "Which Network Watcher tool tells you which NSG rule allows or denies a specific packet to a VM?",
     [("Next hop", "Routing."), ("IP flow verify", "Correct."), ("Packet capture", "Records traffic."), ("Topology", "Shows resources.")],
     "b", "IP flow verify names the rule that matches.", D + "azure/network-watcher/ip-flow-verify-overview"))
add(("AZ104-4.1.5", 2, "scenario", "You suspect a route table sends traffic from VM1 to the wrong place. Which tool confirms where packets to 10.1.2.4 go?",
     [("Next hop", "Correct."), ("IP flow verify", "NSG rules."), ("Connection monitor", "Continuous tests, less direct."), ("Azure Advisor", "Recommendations.")],
     "a", "Next hop returns the next hop type and the route that decided it.", D + "azure/network-watcher/next-hop-overview"))

# ---------------------------------------------------------------- 4.2 security
add(("AZ104-4.2.1", 2, "scenario", "Web VMs must accept HTTPS from the internet and only web VMs may reach database VMs on 1433. VMs are added often. What is the easiest rule design?",
     [("Rules using application security groups asg-web and asg-db", "Correct."), ("Rules listing each VM's IP", "Breaks when VMs change."), ("One rule allowing VirtualNetwork to all ports", "Too open."), ("Disable NSGs", "No.")],
     "a", "ASGs let rules target roles; new VMs just join the ASG.", D + "azure/virtual-network/application-security-groups"))
add(("AZ104-4.2.1", 2, "single", "An NSG has rule 300 Deny TCP 22 from Any and rule 200 Allow TCP 22 from 203.0.113.0/24. A connection on port 22 arrives from 203.0.113.9. Result?",
     [("Denied, deny rules win", "Priority decides, not the action."), ("Allowed by rule 200", "Correct: lower number first."), ("Denied by the default rule", "Rule 200 matched first."), ("Allowed only if outbound allows", "NSGs are stateful.")],
     "b", "Rules are processed by priority; the first match wins.", D + "azure/virtual-network/network-security-groups-overview"))
add(("AZ104-4.2.2", 3, "scenario", "The subnet NSG allows inbound 80. The NIC NSG has only default rules. Can internet traffic reach the VM on port 80?",
     [("Yes, the subnet NSG allows it", "The NIC NSG must also allow it."), ("No, the NIC NSG's DenyAllInBound blocks it", "Correct."),
      ("Yes, NIC NSGs only filter outbound", "They filter both directions."), ("Only from the same VNet", "Not for internet traffic.")],
     "b", "Inbound traffic must be allowed by both the subnet NSG and the NIC NSG.", D + "azure/virtual-network/network-security-group-how-it-works"))
add(("AZ104-4.2.2", 2, "single", "Where can you see the combined result of the subnet NSG and NIC NSG for a VM?",
     [("Effective security rules on the VM's NIC (or in Network Watcher)", "Correct."), ("The activity log", "Shows changes, not rules."), ("Azure Advisor", "No."), ("Cost analysis", "No.")],
     "a", "Effective security rules shows all applied rules.", D + "azure/network-watcher/effective-security-rules-overview"))
add(("AZ104-4.2.3", 2, "troubleshooting", "Bastion deployment fails. The subnet is called BastionSubnet with range /27. What do you fix?",
     [("Name it AzureBastionSubnet and make it /26 or larger", "Correct."), ("Add a NAT gateway", "Unrelated."), ("Give the VMs public IPs", "Not needed."), ("Use Basic public IP", "Retired.")],
     "a", "Bastion needs a subnet named exactly AzureBastionSubnet, /26 or larger.", D + "azure/bastion/configuration-settings"))
add(("AZ104-4.2.3", 2, "single", "Admins want to connect with their own SSH client (native client) through Bastion. Minimum SKU?",
     [("Developer", "No native client."), ("Basic", "No native client."), ("Standard", "Correct."), ("Any SKU", "No.")],
     "c", "Native client support needs Standard or Premium.", D + "azure/bastion/native-client"))
add(("AZ104-4.2.4", 2, "single", "With a service endpoint for Microsoft.Storage on a subnet, which address does the storage account use when VMs in that subnet connect?",
     [("A private IP in the subnet", "That is a private endpoint."), ("Its public endpoint, reached over the Azure backbone", "Correct."), ("A NAT gateway IP", "No."), ("A loopback address", "No.")],
     "b", "Service endpoints keep the service's public IP but identify traffic from the subnet.", D + "azure/virtual-network/virtual-network-service-endpoints-overview"))
add(("AZ104-4.2.4", 2, "scenario", "On-premises servers connected through VPN must reach a storage account privately. Do service endpoints solve this?",
     [("Yes", "Service endpoints apply only to Azure subnets."), ("No; use a private endpoint with DNS resolution from on-premises", "Correct."), ("Yes, with a public IP rule", "That is public access."), ("No; storage cannot be private", "It can.")],
     "b", "Private endpoints are reachable from peered and on-premises networks.", D + "azure/private-link/private-endpoint-overview"))
add(("AZ104-4.2.5", 3, "troubleshooting", "You created a private endpoint for a storage account, but VMs still connect to its public IP. What is the most likely cause?",
     [("The VNet is not linked to the privatelink.blob.core.windows.net private DNS zone", "Correct."), ("The private endpoint needs a public IP", "No."),
      ("Soft delete is on", "Unrelated."), ("The account is LRS", "Unrelated.")],
     "a", "Name resolution must return the private IP; link the private DNS zone to the VNet.", D + "azure/private-link/private-endpoint-dns"))
add(("AZ104-4.2.5", 2, "single", "What does a private endpoint add to your virtual network?",
     [("A network interface with a private IP mapped to one service resource", "Correct."), ("A VPN gateway", "No."), ("A route table", "No."), ("A public IP", "No.")],
     "a", "A private endpoint is a NIC with a private IP for a specific resource.", D + "azure/private-link/private-endpoint-overview"))

# ---------------------------------------------------------------- 4.3 DNS and load balancing
add(("AZ104-4.3.1", 2, "scenario", "You bought contoso.com from a registrar and created an Azure DNS zone for it. Records do not resolve on the internet. What is missing?",
     [("Update the domain's name servers at the registrar to Azure's four NS servers", "Correct."), ("Create a private DNS zone", "Private only."), ("Add an A record for @", "Delegation first."), ("Enable auto-registration", "Private zones only.")],
     "a", "Delegation: the registrar must point to Azure DNS name servers.", D + "azure/dns/dns-delegate-domain-azure-dns"))
add(("AZ104-4.3.1", 2, "single", "VMs in VNet1 must automatically get DNS records in contoso.internal when created. What do you configure?",
     [("A public DNS zone", "Public only."), ("A private DNS zone with a virtual network link to VNet1 and auto-registration enabled", "Correct."), ("A CNAME for each VM", "Manual."), ("A custom DNS server on each VM", "Unnecessary.")],
     "b", "Auto-registration on a VNet link registers VM records automatically.", D + "azure/dns/private-dns-autoregistration"))
add(("AZ104-4.3.2", 2, "scenario", "App-tier VMs must be reached only from web-tier VMs in the same VNet, balanced on TCP 8080. Which load balancer?",
     [("Public Standard load balancer", "Has a public frontend."), ("Internal Standard load balancer", "Correct."), ("Traffic Manager", "DNS-based, global."), ("Application Gateway with WAF", "Layer 7; not required.")],
     "b", "An internal load balancer has a private frontend IP.", D + "azure/load-balancer/load-balancer-overview"))
add(("AZ104-4.3.2", 2, "single", "Users must stay on the same backend VM for their whole session, based on their IP. Which setting?",
     [("Session persistence: Client IP", "Correct."), ("Session persistence: None", "Spreads connections."), ("Floating IP", "Different feature."), ("TCP reset", "Different feature.")],
     "a", "Client IP persistence keeps a client on one backend.", D + "azure/load-balancer/distribution-mode-concepts"))
add(("AZ104-4.3.3", 3, "troubleshooting", "A Standard public load balancer sends no traffic to its two VMs. The health probe on HTTP port 80 shows 0% for both. The apps run on port 8080. Fix?",
     [("Change the probe (and rule backend port) to 8080", "Correct."), ("Switch to Basic SKU", "Retired."), ("Add a third VM", "Same problem."), ("Remove the NSG", "Unsafe and not the cause here.")],
     "a", "The probe must target a port and path the app actually answers on.", D + "azure/load-balancer/load-balancer-custom-probe-overview"))
add(("AZ104-4.3.3", 2, "troubleshooting", "Probes are healthy but clients still cannot reach a Standard load balancer's frontend on port 443. What should you check?",
     [("That the backend VMs' NSGs allow inbound 443 from the clients", "Correct: Standard is secure by default."), ("That the VMs have public IPs", "Not required."), ("That session persistence is on", "Unrelated."), ("That the VMs are in an availability set", "Not required.")],
     "a", "Standard load balancers need NSG rules allowing the client traffic.", D + "azure/load-balancer/load-balancer-troubleshoot"))

# ---------------------------------------------------------------- 5.1 monitor
add(("AZ104-5.1.1", 2, "troubleshooting", "Users reported a 3-minute slowdown, but the CPU chart (Avg, 1 hour granularity) looks flat. What should you change?",
     [("Use Max aggregation with 1-minute granularity", "Correct."), ("Use Count aggregation", "Not useful for CPU."), ("Extend the time range to 30 days", "Hides it more."), ("Switch to the activity log", "Not performance data.")],
     "a", "Short spikes disappear in hourly averages; use Max and a small time grain.", D + "azure/azure-monitor/essentials/metrics-aggregation-explained"))
add(("AZ104-5.1.1", 1, "single", "How long are Azure platform metrics kept by default?",
     [("7 days", "No."), ("30 days", "No."), ("93 days", "Correct."), ("2 years", "No.")],
     "c", "Platform metrics are stored for 93 days.", D + "azure/azure-monitor/essentials/data-platform-metrics"))
add(("AZ104-5.1.2", 2, "scenario", "You need every read and write on a storage account's blobs logged and queryable with KQL. What do you create?",
     [("A diagnostic setting for the blob service sending StorageRead/StorageWrite to a Log Analytics workspace", "Correct."), ("An activity log alert", "Control plane only."),
      ("A metric alert", "Numbers, not logs."), ("Nothing; it is automatic", "Resource logs need a diagnostic setting.")],
     "a", "Resource logs are collected only through diagnostic settings.", D + "azure/storage/blobs/monitor-blob-storage"))
add(("AZ104-5.1.2", 2, "single", "You need Windows event logs and memory counters from VMs in a Log Analytics workspace. What do you use?",
     [("Diagnostic settings on the VM resource", "Platform data only."), ("Azure Monitor Agent with a data collection rule", "Correct."), ("The Log Analytics agent", "Retired."), ("Activity log export", "Control plane.")],
     "b", "Guest OS data uses the Azure Monitor Agent and DCRs.", D + "azure/azure-monitor/agents/azure-monitor-agent-overview"))
add(("AZ104-5.1.3", 2, "single", "Which query returns the number of heartbeats per computer in the last hour?",
     [("Heartbeat | where TimeGenerated > ago(1h) | summarize count() by Computer", "Correct."), ("Heartbeat | count by Computer", "Invalid syntax."),
      ("Heartbeat | project count()", "project does not aggregate."), ("summarize Heartbeat by Computer", "A query starts with a table.")],
     "a", "Filter with where/ago, then aggregate with summarize ... by.", D + "azure/azure-monitor/logs/get-started-queries"))
add(("AZ104-5.1.3", 2, "single", "Which KQL function groups TimeGenerated into 5-minute buckets for a chart?",
     [("bin(TimeGenerated, 5m)", "Correct."), ("ago(5m)", "A time offset."), ("take 5", "Returns rows."), ("top 5", "Returns top rows.")],
     "a", "bin() rounds values into buckets.", D + "kusto/query/bin-function"))
add(("AZ104-5.1.4", 2, "scenario", "Ops wants email and SMS for 20 different alert rules, and the recipients change often. What is the best design?",
     [("One action group used by all 20 rules", "Correct."), ("Add the recipients to each rule", "Rules use action groups, and 20 copies are hard to maintain."), ("A budget", "Cost only."), ("A dashboard", "Not a notification.")],
     "a", "Action groups are reusable; change recipients once.", D + "azure/azure-monitor/alerts/action-groups"))
add(("AZ104-5.1.4", 2, "single", "During a planned Saturday maintenance window, you want no alert notifications for one subscription, but alerts should still be recorded. What do you use?",
     [("An alert processing rule that suppresses notifications on a schedule", "Correct."), ("Disable all alert rules", "Nothing would be recorded."), ("Delete the action group", "Breaks other rules."), ("A resource lock", "Unrelated.")],
     "a", "Alert processing rules can suppress actions during a schedule.", D + "azure/azure-monitor/alerts/alerts-processing-rules"))
add(("AZ104-5.1.5", 2, "single", "What does enabling VM insights install or create?",
     [("The Azure Monitor Agent and a data collection rule sending to Log Analytics", "Correct."), ("A Recovery Services vault", "No."), ("A load balancer", "No."), ("Nothing; it uses platform metrics only", "It needs guest data.")],
     "a", "VM insights uses AMA plus a DCR and a workspace.", D + "azure/azure-monitor/vm/vminsights-enable-overview"))
add(("AZ104-5.1.5", 2, "single", "Which view shows capacity, availability and latency across all your storage accounts without extra setup?",
     [("Storage insights in Azure Monitor", "Correct."), ("VM insights", "VMs."), ("Activity log", "Operations."), ("Cost analysis", "Cost.")],
     "a", "Storage insights build on platform metrics.", D + "azure/storage/common/storage-insights-overview"))
add(("AZ104-5.1.6", 2, "scenario", "You must continuously test connectivity from a VM to an on-premises API on TCP 443 and be alerted when checks fail. Which tool?",
     [("Connection troubleshoot", "One-off test."), ("Connection monitor", "Correct."), ("IP flow verify", "Checks NSG rules only."), ("Next hop", "Routing only.")],
     "b", "Connection monitor runs scheduled tests with thresholds and alerts.", D + "azure/network-watcher/connection-monitor-overview"))
add(("AZ104-5.1.6", 2, "single", "Which Network Watcher feature records allowed and denied IP flows across a VNet for later analysis?",
     [("VNet flow logs", "Correct."), ("Packet capture", "Captures packets on one VM."), ("Topology", "Diagram."), ("VPN troubleshoot", "Gateways.")],
     "a", "VNet flow logs (successor to NSG flow logs) record flows.", D + "azure/network-watcher/vnet-flow-logs-overview"))

# ---------------------------------------------------------------- 5.2 backup and DR
add(("AZ104-5.2.1", 2, "troubleshooting", "You cannot select VM1 (in UAE North) when configuring backup in a Recovery Services vault in West Europe. Why?",
     [("The vault must be in the same region as the VM", "Correct."), ("VM1 is running", "Running VMs can be backed up."), ("The vault is LRS", "Unrelated."), ("VM1 has tags", "Unrelated.")],
     "a", "Create the vault in the same region as the resources to protect.", D + "azure/backup/backup-azure-arm-vms-prepare"))
add(("AZ104-5.2.1", 2, "single", "When can you change a Recovery Services vault's storage redundancy from GRS to LRS?",
     [("At any time", "No."), ("Only before any item is protected", "Correct."), ("Only after the first backup", "No."), ("Never", "You can, before protecting items.")],
     "b", "Storage replication type must be set before the first backup is configured.", D + "azure/backup/backup-create-recovery-services-vault"))
add(("AZ104-5.2.2", 2, "scenario", "You must back up individual managed disks (not whole VMs) with snapshots. Which vault?",
     [("Recovery Services vault", "Used for whole VMs."), ("Backup vault", "Correct."), ("Key Vault", "Secrets."), ("Storage account", "Not a vault.")],
     "b", "Azure Disk Backup uses a Backup vault.", D + "azure/backup/disk-backup-overview"))
add(("AZ104-5.2.2", 2, "single", "Which of these is protected with a Backup vault rather than a Recovery Services vault?",
     [("Azure Blobs (operational and vaulted backup)", "Correct."), ("Azure VMs", "RSV."), ("SQL Server in an Azure VM", "RSV."), ("Azure Files", "RSV.")],
     "a", "Blobs, disks, PostgreSQL and AKS use Backup vaults.", D + "azure/backup/backup-vault-overview"))
add(("AZ104-5.2.3", 2, "scenario", "A VM must be backed up every 4 hours. Which policy type?",
     [("Standard policy", "Once a day."), ("Enhanced policy", "Correct."), ("Lifecycle policy", "Storage tiers."), ("Azure Policy", "Governance.")],
     "b", "Enhanced policy supports multiple backups per day.", D + "azure/backup/backup-azure-vms-enhanced-policy"))
add(("AZ104-5.2.3", 2, "single", "What does the 'instant restore' setting in a VM backup policy control?",
     [("How long snapshots are kept with the VM's disks for fast restores", "Correct."), ("How quickly the first backup runs", "No."), ("Cross-region restore", "No."), ("Vault redundancy", "No.")],
     "a", "Instant restore snapshots are kept for 1–5 days (Standard) for fast recovery.", D + "azure/backup/backup-instant-restore-capability"))
add(("AZ104-5.2.4", 2, "scenario", "A user deleted one config file on a backed-up Linux VM. You want just that file back. What do you use?",
     [("File Recovery from the VM backup (mount the recovery point with the script)", "Correct."), ("Restore VM > Replace existing", "Overkill."), ("Site Recovery failover", "DR, not file restore."), ("Azure Files snapshot", "Different service.")],
     "a", "File recovery mounts a recovery point so you copy single files.", D + "azure/backup/backup-azure-restore-files-from-vm"))
add(("AZ104-5.2.4", 2, "single", "Before a risky change you want a recovery point now, kept for 30 days. What do you do?",
     [("Backup now with a retention date 30 days ahead", "Correct."), ("Change the policy schedule", "Not immediate."), ("Take a resource lock", "Unrelated."), ("Enable soft delete", "Unrelated.")],
     "a", "On-demand backups have their own retention date.", D + "azure/backup/backup-azure-vms-first-look-arm"))
add(("AZ104-5.2.5", 2, "single", "Where should the Recovery Services vault used by Azure Site Recovery be located when protecting VMs in UAE North?",
     [("In UAE North", "The vault must not be in the source region."), ("In a region other than the source, typically the target region (for example UAE Central)", "Correct."), ("Any region", "No."), ("In the same resource group as the VMs", "Region is what matters.")],
     "b", "For Azure-to-Azure DR the vault can be in any region except the source region; the portal creates it in the target region.", D + "azure/site-recovery/azure-to-azure-tutorial-enable-replication"))
add(("AZ104-5.2.5", 2, "single", "What does a Site Recovery recovery plan let you do?",
     [("Order the failover of VM groups and add scripts or manual steps", "Correct."), ("Set backup retention", "Backup policy."), ("Choose storage tiers", "No."), ("Scale VMs", "No.")],
     "a", "Recovery plans group and sequence machines with actions.", D + "azure/site-recovery/recovery-plan-overview"))
add(("AZ104-5.2.6", 2, "ordering", "Put the Site Recovery steps in order for a real failover and return.",
     [("Failover to the target region", "First."), ("Commit the failover", "Make it final."), ("Re-protect (replicate back)", "Start reverse replication."), ("Fail back to the original region", "Last.")],
     "abcd", "Failover, commit, re-protect, then fail back.", D + "azure/site-recovery/azure-to-azure-tutorial-failover-failback"))
add(("AZ104-5.2.6", 2, "scenario", "You must prove DR works without affecting production or replication. What do you run?",
     [("Test failover into an isolated VNet, then clean up", "Correct."), ("Planned failover", "Affects production."), ("Disable replication", "Removes protection."), ("Backup now", "Backup, not DR.")],
     "a", "Test failover is non-disruptive.", D + "azure/site-recovery/azure-to-azure-tutorial-dr-drill"))
add(("AZ104-5.2.7", 2, "scenario", "Backup reports across 15 vaults show no data. What is required?",
     [("Diagnostic settings on each vault sending backup data to a Log Analytics workspace", "Correct."), ("An Enhanced backup policy", "Unrelated."), ("Cross-region restore", "Unrelated."), ("A management group", "Unrelated.")],
     "a", "Backup reports read from Log Analytics; configure vault diagnostic settings.", D + "azure/backup/configure-reports"))
add(("AZ104-5.2.7", 2, "single", "Backup job failures should email the backup team. What do you configure?",
     [("An alert processing rule routing Azure Backup alerts to an action group", "Correct."), ("A budget", "Cost."), ("Soft delete", "Protection, not notification."), ("A resource lock", "Unrelated.")],
     "a", "Built-in backup alerts are routed to notifications via processing rules and action groups.", D + "azure/backup/backup-azure-monitoring-alerts"))

# Added for the April 2026 skills outline: soft delete for blobs and containers.
add(("AZ104-2.3.7", 2, "troubleshooting", "A user deleted container 'invoices' an hour ago. Blob soft delete (14 days) is on; container soft delete is off. Can you recover the container?",
     [("Yes, with Undelete under Show deleted blobs", "Blob soft delete does not cover deleting the whole container."), ("No: container deletion is only recoverable when container soft delete was on before the delete", "Correct."),
      ("Yes, from the storage account's snapshots", "Storage accounts have no account-level snapshots."), ("Yes, by turning on container soft delete now", "It does not apply to containers deleted before it was enabled.")],
     "b", "Container soft delete must already be enabled to restore a deleted container; blob soft delete alone does not protect against container deletion.", D + "azure/storage/blobs/soft-delete-container-overview"))
add(("AZ104-2.3.7", 2, "configuration", "Policy says deleted blobs must be recoverable for 30 days, and versioning is off. What do you configure, and how do you recover a blob?",
     [("Blob soft delete with 30 days retention; recover with Show deleted blobs > Undelete", "Correct (retention can be 1 to 365 days)."), ("Container soft delete with 30 days; it also covers single blobs", "Container soft delete only restores deleted containers."),
      ("A lifecycle rule that keeps blobs for 30 days", "Lifecycle rules move or delete data; they do not undelete."), ("A resource lock on the storage account", "Locks protect the account, not blob data.")],
     "a", "Blob soft delete keeps deleted blobs (and snapshots) for the retention period you choose, from 1 to 365 days; without versioning, you restore them with Undelete.", D + "azure/storage/blobs/soft-delete-blob-overview"))

# Added for learners who find deployments hard: reading and changing templates and CLI.
add(("AZ104-3.1.1", 2, "command", "You deploy this Bicep file with sku=Premium_LRS. What happens?",
     [("The deployment fails validation and nothing is created", "Correct: Premium_LRS is not in the @allowed list."), ("A Standard_LRS account is created", "The default is used only when no value is given."),
      ("A Premium_LRS account is created", "Values outside @allowed are rejected."), ("The account is created, then the deployment reports a warning", "Validation happens before anything is deployed.")],
     "a", "@allowed (allowedValues in JSON) limits what can be passed; any other value fails validation before deployment.", D + "azure/azure-resource-manager/bicep/parameters",
     "@allowed([ 'Standard_LRS', 'Standard_GRS' ])\nparam sku string = 'Standard_LRS'\n\nresource sa 'Microsoft.Storage/storageAccounts@2023-05-01' = {\n  name: 'stapp${uniqueString(resourceGroup().id)}'\n  location: resourceGroup().location\n  sku: { name: sku }\n  kind: 'StorageV2'\n}"))
add(("AZ104-3.1.1", 2, "command", "In this ARM template fragment, which resource does Azure Resource Manager create first?",
     [("nic-web", "Correct: the VM dependsOn the NIC, so the NIC is deployed first."), ("vm-web", "It waits for its dependency."), ("Both at the same time", "Only resources without dependencies between them deploy in parallel."), ("Whichever is listed first in the file", "Order in the file does not matter; dependsOn does.")],
     "a", "dependsOn tells Resource Manager to finish one resource before starting another. Without it, resources deploy in parallel.", D + "azure/azure-resource-manager/templates/resource-dependency",
     "{\n  \"type\": \"Microsoft.Compute/virtualMachines\",\n  \"name\": \"vm-web\",\n  \"dependsOn\": [\n    \"[resourceId('Microsoft.Network/networkInterfaces', 'nic-web')]\"\n  ],\n  ...\n},\n{\n  \"type\": \"Microsoft.Network/networkInterfaces\",\n  \"name\": \"nic-web\",\n  ...\n}"))
add(("AZ104-3.1.3", 2, "command", "This Bicep file has no dependsOn. Will the VM wait for the NIC?",
     [("Yes: referencing nic.id creates an implicit dependency", "Correct."), ("No: you must add dependsOn", "Bicep infers it from the symbolic reference."), ("Only if both are in the same module", "Not required."), ("No: Bicep always deploys in file order", "Order in the file does not matter.")],
     "a", "In Bicep, using another resource's symbolic name (nic.id) makes Resource Manager deploy that resource first. Explicit dependsOn is rarely needed.", D + "azure/azure-resource-manager/bicep/resource-dependencies",
     "resource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = { ... }\n\nresource vm 'Microsoft.Compute/virtualMachines@2024-03-01' = {\n  name: 'vm-web'\n  properties: {\n    networkProfile: {\n      networkInterfaces: [ { id: nic.id } ]\n    }\n  }\n}"))
add(("AZ104-3.1.4", 2, "command", "This Bicep file creates a resource group. Which command deploys it?",
     [("az deployment sub create --location uaenorth --template-file rg.bicep", "Correct: subscription scope, and --location is required."), ("az deployment group create -g rg-app --template-file rg.bicep", "A resource group cannot be created inside a resource group deployment."),
      ("az group create --template-file rg.bicep", "az group create does not take templates."), ("az deployment mg create --template-file rg.bicep", "Management group scope is for management-group-level resources.")],
     "a", "Resource groups are subscription-level resources: targetScope = 'subscription' and az deployment sub create (New-AzSubscriptionDeployment in PowerShell).", D + "azure/azure-resource-manager/bicep/deploy-to-subscription",
     "targetScope = 'subscription'\n\nresource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {\n  name: 'rg-app'\n  location: 'uaenorth'\n}"))
add(("AZ104-3.1.2", 2, "configuration", "You must change an ARM template so the location can be chosen at deployment but defaults to the resource group's region. What do you add?",
     [("A parameter: \"location\": { \"type\": \"string\", \"defaultValue\": \"[resourceGroup().location]\" }, then use [parameters('location')]", "Correct."), ("A variable \"location\": \"[resourceGroup().location]\"", "A variable cannot be changed at deployment."),
      ("An output named location", "Outputs return values; they do not take input."), ("A dependsOn on the resource group", "Unrelated to location.")],
     "a", "Inputs are parameters; defaultValue can use template functions such as resourceGroup().location.", D + "azure/azure-resource-manager/templates/parameters"))
add(("AZ104-3.1.3", 2, "command", "How many storage accounts does this Bicep file create?",
     [("Three, one per name in the array", "Correct: the for loop creates one resource per item."), ("One", "The for expression repeats the resource."), ("None: loops need a module", "Loops work directly on resources."), ("Three, but only if dependsOn is added", "Not needed.")],
     "a", "Bicep loops ([for item in array: {...}]) create one copy per item; in ARM JSON the same is done with copy.", D + "azure/azure-resource-manager/bicep/loops",
     "param names array = [ 'stlogs01', 'stdata01', 'stbak01' ]\n\nresource sa 'Microsoft.Storage/storageAccounts@2023-05-01' = [for n in names: {\n  name: n\n  location: resourceGroup().location\n  sku: { name: 'Standard_LRS' }\n  kind: 'StorageV2'\n}]"))
add(("AZ104-3.1.1", 3, "single", "A template names a storage account [concat('st', uniqueString(resourceGroup().id))]. You deploy it twice to the same resource group. What happens the second time?",
     [("The same name is generated, so the existing account is updated (not duplicated)", "Correct: uniqueString is deterministic for the same input."), ("A second account with a new random name is created", "uniqueString is not random."),
      ("The deployment fails because the name exists", "Redeploying the same resource updates it."), ("The name changes every deployment", "Only a different resource group ID gives a different value.")],
     "a", "uniqueString(seed) always returns the same 13-character value for the same seed, which keeps names stable across redeployments.", D + "azure/azure-resource-manager/templates/template-functions-string#uniquestring"))
add(("AZ104-3.1.4", 2, "command", "What does --parameters @prod.parameters.json do in this command?",
     [("Reads parameter values from the file prod.parameters.json", "Correct."), ("Creates a new parameter file", "It reads, not writes."), ("Validates the file without deploying", "That is what-if or validate."), ("Exports the current settings", "Export is az group export.")],
     "a", "Parameter files keep values per environment (dev, prod). Bicep can also use a .bicepparam file.", D + "azure/azure-resource-manager/templates/parameter-files",
     "az deployment group create \\\n  --resource-group rg-prod \\\n  --template-file main.bicep \\\n  --parameters @prod.parameters.json"))
add(("AZ104-3.1.4", 3, "command", "rg-app contains vnet1, st01 and vm1. main.bicep defines only vnet1 and st01. What happens when you run this command?",
     [("vm1 is deleted; vnet1 and st01 are created or updated", "Correct: Complete mode removes resources that are not in the template."), ("Nothing is deleted", "That is Incremental mode (the default)."),
      ("The deployment fails because vm1 exists", "Complete mode does not fail; it deletes."), ("Only a preview is shown", "That is what-if.")],
     "a", "Complete mode makes the resource group match the template exactly. Run what-if first to see the deletions.", D + "azure/azure-resource-manager/templates/deployment-modes",
     "az deployment group create -g rg-app -f main.bicep --mode Complete"))
add(("AZ104-3.1.3", 3, "command", "A reviewer flags this Bicep file. What is the problem?",
     [("The secure password is returned as an output, so it appears in deployment history", "Correct: never output secure values."), ("@secure() cannot be used on strings", "It can."), ("Parameters cannot be used in VM properties", "They can."), ("Outputs must be declared before resources", "Order does not matter.")],
     "a", "Outputs are stored in the deployment history and visible to anyone with read access. Keep secrets in @secure() parameters or Key Vault references and never output them.", D + "azure/azure-resource-manager/bicep/outputs",
     "@secure()\nparam adminPassword string\n\nresource vm 'Microsoft.Compute/virtualMachines@2024-03-01' = {\n  ...\n  properties: { osProfile: { adminPassword: adminPassword } }\n}\n\noutput password string = adminPassword"))
add(("AZ104-3.1.5", 2, "command", "What does this command produce?",
     [("An ARM JSON template describing the resources currently in rg-app", "Correct."), ("A Bicep file", "Use az bicep decompile on the JSON, or export as Bicep in the portal."), ("A backup of the data in rg-app", "Templates describe resources, not data."), ("A list of deployments", "That is az deployment group list.")],
     "a", "az group export (portal: Export template) captures existing resources as a template, which you usually tidy before reuse.", D + "azure/azure-resource-manager/templates/export-template-cli",
     "az group export --name rg-app > rg-app.json"))
add(("AZ104-3.1.5", 1, "command", "What does this command do?",
     [("Converts the ARM JSON template into a Bicep file (azuredeploy.bicep)", "Correct."), ("Converts Bicep into JSON", "That is az bicep build."), ("Deploys the template", "That is az deployment … create."), ("Validates the JSON only", "It converts it.")],
     "a", "decompile = JSON → Bicep (best effort); build = Bicep → JSON.", D + "azure/azure-resource-manager/bicep/decompile",
     "az bicep decompile --file azuredeploy.json"))
add(("AZ104-3.1.1", 2, "command", "What does the existing keyword mean in this Bicep file?",
     [("It refers to vnet-hub, which already exists; Bicep does not create or change it", "Correct."), ("It creates vnet-hub if it does not exist", "existing never creates."), ("It deletes vnet-hub after deployment", "No."), ("It locks vnet-hub", "Locks are separate resources.")],
     "a", "existing lets a template read an already deployed resource (for example to use its ID) without managing it.", D + "azure/azure-resource-manager/bicep/existing-resource",
     "resource hub 'Microsoft.Network/virtualNetworks@2023-09-01' existing = {\n  name: 'vnet-hub'\n}\n\noutput hubId string = hub.id"))

# Networking, read the configuration and decide.
add(("AZ104-4.2.2", 2, "command", "An NSG on VM1's subnet has these inbound rules. Can 10.1.1.4 connect to VM1 on RDP (3389)?",
     [("No: rule 100 denies 3389 from any source and is checked first", "Correct."), ("Yes: rule 200 allows 10.0.0.0/8", "It is never reached; the lower number wins."), ("Yes: VirtualNetwork traffic is always allowed", "Your rules come before the default rules."), ("Only if VM1 has a public IP", "Unrelated.")],
     "a", "NSG rules are checked from the lowest priority number up and the first match wins. Move the allow rule to a number below 100.", D + "azure/virtual-network/network-security-groups-overview",
     "Priority  Name          Port  Source        Action\n100       deny-rdp      3389  Any           Deny\n200       allow-rdp-in  3389  10.0.0.0/8    Allow\n65000     AllowVnetInBound      VirtualNetwork Allow"))
add(("AZ104-4.2.2", 3, "troubleshooting", "The subnet's NSG allows inbound 443 from the internet. VM1's NIC also has an NSG with only the default rules. Can users reach VM1 on 443?",
     [("No: inbound traffic must be allowed by BOTH the subnet NSG and the NIC NSG; the NIC NSG's DenyAllInBound blocks it", "Correct."), ("Yes: the subnet NSG is enough", "Both NSGs are evaluated."),
      ("Yes: the NIC NSG is ignored when a subnet NSG exists", "It is not ignored."), ("No: NSGs cannot allow 443", "They can.")],
     "a", "Inbound: subnet NSG first, then NIC NSG. Outbound: NIC NSG first, then subnet NSG. Traffic needs an allow at every NSG it passes.", D + "azure/virtual-network/network-security-group-how-it-works"))
add(("AZ104-4.1.4", 3, "troubleshooting", "Subnet app has this route table. The firewall VM at 10.0.2.4 receives nothing and internet traffic from app VMs fails. What is the most likely fix?",
     [("Enable IP forwarding on the firewall VM's network interface (and in its OS)", "Correct: without it Azure drops traffic not addressed to the VM itself."), ("Change the next hop type to Internet", "That bypasses the firewall."),
      ("Associate the route table with the firewall's subnet", "The route belongs on the source subnet."), ("Add a public IP to every app VM", "Defeats the purpose.")],
     "a", "A network virtual appliance must have IP forwarding enabled on its NIC to forward traffic it receives for other destinations.", D + "azure/virtual-network/virtual-network-network-interface#enable-or-disable-ip-forwarding",
     "Route table rt-app (associated with subnet app)\nAddress prefix   Next hop type        Next hop IP\n0.0.0.0/0        VirtualAppliance     10.0.2.4"))
add(("AZ104-4.1.2", 2, "command", "You ran only this command. The peering shows status Initiated and traffic does not flow. Why?",
     [("A peering must be created from both VNets; create spoke-to-hub too", "Correct."), ("--allow-vnet-access blocks traffic", "It allows it."), ("Peering needs a VPN gateway", "It does not."), ("The VNets must be in the same resource group", "Not required.")],
     "a", "Each side needs its own peering link. The status becomes Connected when both exist.", D + "azure/virtual-network/virtual-network-manage-peering",
     "az network vnet peering create -g rg-net -n hub-to-spoke \\\n  --vnet-name vnet-hub --remote-vnet vnet-spoke --allow-vnet-access"))
add(("AZ104-4.1.2", 2, "single", "VNet1 uses 10.0.0.0/16 and VNet2 uses 10.0.128.0/17. Can you peer them?",
     [("No: the address spaces overlap", "Correct: 10.0.128.0/17 is inside 10.0.0.0/16."), ("Yes, peering ignores address spaces", "Overlap is not allowed."), ("Yes, if they are in different regions", "Overlap is still not allowed."), ("Only with gateway transit", "Unrelated.")],
     "a", "Peered VNets must have non-overlapping address spaces. Plan unique ranges for every VNet.", D + "azure/virtual-network/virtual-network-peering-overview"))
add(("AZ104-4.1.1", 1, "single", "How many IP addresses can you assign to VMs in a /27 subnet?",
     [("27", "Correct: 32 addresses minus 5 reserved by Azure."), ("32", "Azure reserves 5."), ("30", "Azure reserves 5, not 2."), ("16", "A /27 has 32 addresses.")],
     "a", "Azure reserves the first four and the last address of every subnet: /24 = 251, /27 = 27, /28 = 11, /29 = 3.", D + "azure/virtual-network/virtual-networks-faq"))
add(("AZ104-4.3.3", 2, "troubleshooting", "The web app on the backend VMs listens on port 8080. The load balancer has this health probe. Users get no response. Why?",
     [("The probe checks port 80, where nothing listens, so every backend is marked unhealthy", "Correct."), ("HTTP probes are not supported", "They are."), ("The probe interval is too short", "5 seconds is normal."), ("The VMs need public IPs", "Not for a load-balanced backend.")],
     "a", "If all probes fail, the load balancer sends traffic nowhere. Point the probe at the port and path the app serves, for example 8080 /health.", D + "azure/load-balancer/load-balancer-custom-probe-overview",
     "Health probe hp-web\nProtocol: HTTP   Port: 80   Path: /health   Interval: 5 seconds"))
add(("AZ104-4.2.5", 3, "troubleshooting", "You created a private endpoint for stdata01. From a VM in the VNet you run the command below. What should you fix?",
     [("Link the privatelink.blob.core.windows.net private DNS zone to the VNet (with the endpoint's A record)", "Correct: the name still resolves to the public IP."), ("Create a service endpoint as well", "Not needed."), ("Enable public network access", "The opposite of the goal."), ("Add a public IP to the VM", "Unrelated.")],
     "a", "Private endpoints depend on DNS. The account name must resolve to the endpoint's private IP through the privatelink zone linked to the VNet (or your DNS forwarding).", D + "azure/private-link/private-endpoint-dns",
     "$ nslookup stdata01.blob.core.windows.net\nName:    blob.dxb21prdstr01a.store.core.windows.net\nAddress: 20.60.152.68"))
add(("AZ104-4.2.1", 2, "command", "What does this NSG rule allow?",
     [("SQL traffic (1433) from VMs whose NICs are in asg-web to VMs whose NICs are in asg-db", "Correct."), ("All traffic between the two subnets", "Only port 1433, only between those groups."), ("Internet access to the databases on 1433", "The source is asg-web."), ("Nothing until IP addresses are added", "ASGs replace IP addresses.")],
     "a", "Application security groups let NSG rules use VM roles instead of IP addresses. NICs join an ASG; the ASG and NICs must be in the same VNet.", D + "azure/virtual-network/application-security-groups",
     "az network nsg rule create -g rg-app --nsg-name nsg-db -n allow-web-sql \\\n  --priority 110 --direction Inbound --access Allow --protocol Tcp \\\n  --source-asgs asg-web --destination-asgs asg-db --destination-port-ranges 1433"))
add(("AZ104-4.1.3", 2, "single", "A VM has a new Standard SKU public IP. Neither its NIC nor its subnet has an NSG. Can you RDP to it from the internet?",
     [("No: Standard public IPs are closed to inbound traffic until an NSG allows it", "Correct."), ("Yes: without an NSG all traffic is allowed", "That was the retired Basic SKU behaviour."), ("Yes, but only on port 3389", "No inbound traffic is allowed."), ("Only with Azure Bastion", "Bastion does not use the VM's public IP.")],
     "a", "Standard public IPs are secure by default. Add an NSG with an allow rule (ideally limited to your IP), or better, use Bastion with no public IP.", D + "azure/virtual-network/ip-services/public-ip-addresses"))
