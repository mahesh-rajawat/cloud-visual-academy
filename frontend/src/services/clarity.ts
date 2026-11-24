/**
 * "Clear the confusion" content: plain-language explanations for the areas learners mix up most
 * (deploying with templates and CLI, networking, and look-alike services). Facts follow Microsoft Learn
 * as of November 2026; each group links to the lesson that teaches it in depth.
 */

export interface LookalikeOption {
  name: string
  /** What it is, in one plain sentence. */
  what: string
  /** When to choose it. */
  pick: string
  /** Words in an exam question that point to this answer. */
  clues: string[]
}

export interface Drill {
  scenario: string
  answer: string
  why: string
}

export interface LookalikeGroup {
  id: string
  area: 'Deploying' | 'Networking' | 'Identity and governance' | 'Storage' | 'Compute' | 'Monitor and backup'
  title: string
  /** The one rule to remember. */
  rule: string
  analogy?: string
  options: LookalikeOption[]
  drills: Drill[]
  lesson: string
}

export const LOOKALIKES: LookalikeGroup[] = [
  // ------------------------------------------------------------------ Deploying
  {
    id: 'deploy-tools', area: 'Deploying', title: 'ARM template, Bicep, Azure CLI or PowerShell?',
    rule: 'Templates describe the end result (declarative). CLI and PowerShell run one step at a time (imperative), and are also what you use to deploy a template.',
    analogy: 'A template is a recipe card you can hand to anyone. CLI commands are you cooking step by step.',
    options: [
      { name: 'ARM template (JSON)', what: 'A JSON file listing the resources you want. Azure Resource Manager makes Azure match it.', pick: 'Repeatable deployments; the format the portal exports.', clues: ['JSON', '"$schema"', '"resources": [', 'export template'] },
      { name: 'Bicep file', what: 'A shorter, easier language for the same thing. It is converted (compiled) to an ARM template before deployment.', pick: 'New template work; easier to read and write.', clues: ['.bicep', 'param', 'resource … = {', 'module'] },
      { name: 'Azure CLI (az)', what: 'Commands you type in Bash or Cloud Shell: az <service> <thing> <action>.', pick: 'Quick one-off changes, scripts, or deploying a template with az deployment … create.', clues: ['az vm create', 'az deployment group create', '--resource-group'] },
      { name: 'Azure PowerShell (Az)', what: 'The same jobs as Verb-AzNoun cmdlets in PowerShell.', pick: 'Windows/PowerShell scripting; New-AzResourceGroupDeployment to deploy templates.', clues: ['New-AzVM', 'Get-Az…', 'New-AzResourceGroupDeployment'] },
    ],
    drills: [
      { scenario: 'You must create 20 identical environments the same way every time and keep the definition in Git. Which do you write?', answer: 'Bicep file', why: 'A template (Bicep or ARM) describes the result and can be deployed again and again. Bicep is the easier-to-read choice for new work.' },
      { scenario: 'A colleague sends a file that starts with "$schema" and "contentVersion". What is it?', answer: 'ARM template (JSON)', why: '$schema and contentVersion are the first lines of every ARM JSON template.' },
      { scenario: 'You need to restart one VM right now from Cloud Shell (Bash).', answer: 'Azure CLI (az)', why: 'A single action is quickest as one command: az vm restart -g rg -n vm1.' },
    ],
    lesson: 'az104-arm-bicep',
  },
  {
    id: 'deploy-modes', area: 'Deploying', title: 'Incremental mode, Complete mode or what-if?',
    rule: 'Incremental (default) only adds and updates. Complete also DELETES anything in the resource group that is not in the template. What-if shows the changes without making them.',
    analogy: 'Incremental: add what is on the list. Complete: make the room match the list exactly, throwing out everything else.',
    options: [
      { name: 'Incremental mode', what: 'Creates or updates the resources in the template; leaves other resources in the group alone.', pick: 'Almost always (it is the default).', clues: ['default', 'existing resources must stay', 'add a resource'] },
      { name: 'Complete mode', what: 'Makes the resource group match the template: resources not in the template are deleted.', pick: 'Only when the template is the full truth for that group.', clues: ['remove resources not in the template', 'delete', 'exactly match'] },
      { name: 'What-if', what: 'A preview listing what would be created, changed or deleted. Nothing is deployed.', pick: 'Before a risky deployment, especially Complete mode.', clues: ['preview', 'before deploying', 'without making changes', '--what-if', 'az deployment group what-if'] },
    ],
    drills: [
      { scenario: 'A resource group has VM1 and VM2. The template only contains VM1. The deployment must remove VM2 because it is not in the template. Which mode?', answer: 'Complete mode', why: 'Complete mode deletes resources in the group that are not in the template. In Incremental mode (the default) VM2 would stay.' },
      { scenario: 'You want to see exactly what a template would change before running it.', answer: 'What-if', why: 'az deployment group what-if (or New-AzResourceGroupDeployment -WhatIf) previews changes without deploying.' },
      { scenario: 'You add a storage account to a template and redeploy. Other resources in the group must not be touched.', answer: 'Incremental mode', why: 'Incremental is the default and only adds or updates what is in the template.' },
    ],
    lesson: 'az104-arm-bicep',
  },
  {
    id: 'deploy-scope', area: 'Deploying', title: 'Which deployment command (scope)?',
    rule: 'Pick the command by WHERE the resources live: inside a resource group → group; creating resource groups or subscription-wide policy → sub; management group → mg; whole tenant → tenant.',
    options: [
      { name: 'az deployment group create', what: 'Deploys into one existing resource group. PowerShell: New-AzResourceGroupDeployment.', pick: 'VMs, storage, VNets… anything that lives in a resource group.', clues: ['--resource-group', 'into rg-…', 'most deployments'] },
      { name: 'az deployment sub create', what: 'Deploys at subscription level. PowerShell: New-AzSubscriptionDeployment (alias New-AzDeployment).', pick: 'Creating resource groups, subscription-level policy or role assignments, budgets.', clues: ['create the resource group', 'targetScope = \'subscription\'', '--location (required)'] },
      { name: 'az deployment mg create', what: 'Deploys at a management group. PowerShell: New-AzManagementGroupDeployment.', pick: 'Policy or role assignments for many subscriptions.', clues: ['management group', 'many subscriptions'] },
      { name: 'az deployment tenant create', what: 'Deploys at the tenant root. PowerShell: New-AzTenantDeployment.', pick: 'Rare: creating management groups and tenant-wide settings.', clues: ['tenant root', 'create management groups'] },
    ],
    drills: [
      { scenario: 'A Bicep file creates a new resource group and then a storage account inside it (using a module). Which command deploys it?', answer: 'az deployment sub create', why: 'Resource groups are created at subscription scope, so the file uses targetScope = \'subscription\' and you deploy with az deployment sub create (it needs --location).' },
      { scenario: 'You deploy a VNet template into the existing group rg-net.', answer: 'az deployment group create', why: 'Resources inside a resource group use the group scope: az deployment group create -g rg-net -f main.bicep.' },
    ],
    lesson: 'az104-arm-bicep',
  },
  {
    id: 'template-parts', area: 'Deploying', title: 'Parameter, variable, output or resource?',
    rule: 'Parameters are the questions you ask the person deploying. Variables are values you work out inside the file. Resources are what gets built. Outputs are what you hand back at the end.',
    analogy: 'Ordering a pizza: parameters = the size and toppings you choose; variables = the kitchen\'s own working-out; resources = the pizza; outputs = the receipt.',
    options: [
      { name: 'Parameter', what: 'A value supplied at deployment time, optionally with a default and allowed values. Bicep: param.', pick: 'Anything that changes between deployments (name, size, environment).', clues: ['different for each deployment', 'allowedValues / @allowed', '@secure()', 'parameter file'] },
      { name: 'Variable', what: 'A value calculated inside the template, not asked for. Bicep: var.', pick: 'Building a name from other values, or reusing a long expression.', clues: ['concat(…)', 'uniqueString(…)', 'computed', 'not supplied by the user'] },
      { name: 'Resource', what: 'Something Azure will create or update, with a type and API version. Bicep: resource sa \'Microsoft.Storage/storageAccounts@…\'.', pick: 'Every item you want to exist.', clues: ['"type": "Microsoft.…"', 'apiVersion', 'properties'] },
      { name: 'Output', what: 'A value returned after deployment, such as an endpoint or ID. Bicep: output.', pick: 'Passing a result to a script or another deployment.', clues: ['return', 'after deployment', 'outputs'] },
    ],
    drills: [
      { scenario: 'Each team must choose Standard_LRS or Standard_GRS when deploying, and nothing else.', answer: 'Parameter', why: 'A parameter with allowedValues (@allowed in Bicep) limits the choices offered at deployment.' },
      { scenario: 'The storage account name must be globally unique, so the template builds it with uniqueString(resourceGroup().id).', answer: 'Variable', why: 'A value worked out inside the template is a variable.' },
      { scenario: 'A pipeline needs the blob endpoint of the storage account the template just created.', answer: 'Output', why: 'Outputs return values after the deployment finishes.' },
      { scenario: 'The VM admin password must not appear in logs or deployment history.', answer: 'Parameter', why: 'Make it a parameter marked @secure() (securestring in JSON), ideally filled from a Key Vault reference.' },
    ],
    lesson: 'az104-arm-bicep',
  },
  {
    id: 'export-convert', area: 'Deploying', title: 'Export, decompile or build?',
    rule: 'Export gets a template FROM Azure. Decompile turns JSON INTO Bicep. Build turns Bicep INTO JSON.',
    options: [
      { name: 'Export template', what: 'Portal: resource group or resource > Automation > Export template, or a past deployment\'s template. Gives ARM JSON (and in the portal, Bicep).', pick: 'You built something by hand and want a template of it.', clues: ['existing resources', 'already deployed', 'capture'] },
      { name: 'az bicep decompile', what: 'Converts an ARM JSON file into a Bicep file (best effort; you may need to tidy it).', pick: 'Moving existing JSON templates to Bicep.', clues: ['convert JSON to Bicep', 'migrate templates to Bicep'] },
      { name: 'az bicep build', what: 'Compiles a Bicep file into ARM JSON.', pick: 'You need the JSON (for a tool that only reads ARM JSON).', clues: ['generate JSON from Bicep', 'compile'] },
    ],
    drills: [
      { scenario: 'You have 30 old ARM JSON templates and want to maintain them as Bicep.', answer: 'az bicep decompile', why: 'decompile converts JSON to Bicep.' },
      { scenario: 'An admin built a VNet by hand in the portal. You want a template of it to reuse.', answer: 'Export template', why: 'Export template captures existing resources as a template.' },
    ],
    lesson: 'az104-arm-bicep',
  },

  // ------------------------------------------------------------------ Networking
  {
    id: 'paas-private', area: 'Networking', title: 'Service endpoint or private endpoint?',
    rule: 'Service endpoint: your subnet gets a private road to the service\'s PUBLIC address. Private endpoint: the service gets its own PRIVATE IP inside your VNet.',
    analogy: 'Service endpoint = a fast lane from your street to the shop\'s front door. Private endpoint = the shop opens a counter inside your building.',
    options: [
      { name: 'Service endpoint', what: 'Turned on per subnet. Traffic from that subnet reaches the service over the Azure backbone; the service keeps its public endpoint and its firewall allows your subnet.', pick: 'Simple, free, VNet-only access to a whole service type.', clues: ['subnet', 'no extra cost', 'Allow access from selected virtual networks', 'Microsoft.Storage on the subnet'] },
      { name: 'Private endpoint', what: 'A network interface with a private IP from your subnet, connected to ONE resource (for example one storage account). Needs a private DNS zone such as privatelink.blob.core.windows.net.', pick: 'Access from on-premises or peered networks, a private IP, or turning public access off completely.', clues: ['private IP', 'on-premises', 'disable public network access', 'privatelink', 'data exfiltration', 'one specific account'] },
    ],
    drills: [
      { scenario: 'Servers in your datacenter, connected by VPN, must reach a storage account privately, and the account must have public access disabled.', answer: 'Private endpoint', why: 'Only a private endpoint gives the account a private IP reachable from on-premises; service endpoints work only from the Azure subnet.' },
      { scenario: 'VMs in one subnet must reach Azure SQL over the Azure backbone. There is no budget for extra resources.', answer: 'Service endpoint', why: 'Service endpoints are free and turned on per subnet.' },
      { scenario: 'Which option needs a privatelink private DNS zone, so the storage account name resolves to an IP address inside your VNet?', answer: 'Private endpoint', why: 'A private endpoint gives the account a private IP; DNS (privatelink.blob.core.windows.net linked to the VNet) must point the name at it. Service endpoints keep using the public name and IP.' },
    ],
    lesson: 'az104-service-private-endpoints',
  },
  {
    id: 'connect-networks', area: 'Networking', title: 'Peering, VPN gateway or ExpressRoute?',
    rule: 'Azure ↔ Azure: peering. Your office ↔ Azure over the internet: VPN gateway (site-to-site; one laptop = point-to-site). Your office ↔ Azure on a private line: ExpressRoute.',
    analogy: 'Peering joins two Azure estates with a private road. A VPN is an armoured tunnel across the public internet. ExpressRoute is your own private motorway.',
    options: [
      { name: 'VNet peering', what: 'Connects two Azure VNets (same or different regions) over Microsoft\'s network. No gateway needed. Address ranges must not overlap. Not transitive: A–B and B–C does not give A–C.', pick: 'Joining Azure VNets.', clues: ['two VNets', 'low latency', 'hub and spoke', 'global peering'] },
      { name: 'VPN gateway (site-to-site)', what: 'An encrypted IPsec tunnel over the internet between Azure and your on-premises VPN device. Needs a GatewaySubnet and a local network gateway.', pick: 'Connecting an office or datacenter cheaply and quickly.', clues: ['on-premises', 'over the internet', 'IPsec', 'VPN device', 'local network gateway'] },
      { name: 'Point-to-site VPN', what: 'A VPN from individual computers to Azure.', pick: 'Remote workers or a few admins\' laptops.', clues: ['individual users', 'laptops', 'from home'] },
      { name: 'ExpressRoute', what: 'A private dedicated connection through a connectivity provider. Does not use the public internet.', pick: 'Predictable performance, high bandwidth, compliance that forbids the internet.', clues: ['private connection', 'not over the internet', 'connectivity provider', 'guaranteed bandwidth'] },
    ],
    drills: [
      { scenario: 'Two Azure VNets in different regions must talk privately over Microsoft\'s network, with the lowest latency and no gateway.', answer: 'VNet peering', why: 'Global VNet peering connects VNets across regions over the Microsoft backbone. Remember it is not transitive: A–Hub and Hub–B does not connect A to B.' },
      { scenario: 'Spoke VNets must reach the office through the hub\'s existing VPN gateway. What connects each spoke to the hub?', answer: 'VNet peering', why: 'Peer each spoke to the hub with gateway transit: "Allow gateway transit" on the hub side and "Use remote gateways" on the spoke side.' },
      { scenario: 'Compliance says traffic to Azure must never cross the public internet.', answer: 'ExpressRoute', why: 'ExpressRoute is a private connection through a provider; a VPN still uses the internet (encrypted).' },
      { scenario: 'Ten admins working from home need access to Azure VMs\' private IPs.', answer: 'Point-to-site VPN', why: 'Point-to-site connects individual devices.' },
    ],
    lesson: 'az104-vnet-peering',
  },
  {
    id: 'filter-traffic', area: 'Networking', title: 'NSG, application security group, Azure Firewall or route table?',
    rule: 'NSGs and Azure Firewall ALLOW or DENY. A route table (UDR) only decides WHERE traffic goes. An ASG is just a label for VMs used inside NSG rules.',
    analogy: 'NSG = the guard at each gate with a list. ASG = name badges, so the list can say "web servers" instead of IPs. Azure Firewall = the central checkpoint. Route table = road signs.',
    options: [
      { name: 'Network security group (NSG)', what: 'A list of allow/deny rules (source, destination, port, protocol), checked from the lowest priority number (100) up; first match wins. Attach to a subnet or a NIC. Stateful.', pick: 'Basic allow/deny on ports and IPs.', clues: ['port 3389 / 22 / 443', 'priority', 'inbound rule', 'subnet or NIC'] },
      { name: 'Application security group (ASG)', what: 'A group of VM NICs (for example asg-web) that you use as source or destination in NSG rules. It filters nothing by itself.', pick: 'Rules by role ("web can talk to db") instead of IP addresses.', clues: ['group VMs by role', 'without IP addresses', 'web tier / db tier'] },
      { name: 'Azure Firewall', what: 'A managed, stateful firewall service for many VNets, with FQDN (domain name) rules and threat intelligence. Traffic is sent to it with route tables.', pick: 'Central control, filtering by domain name, logging all traffic.', clues: ['FQDN', '*.microsoft.com', 'central', 'threat intelligence', 'hub'] },
      { name: 'Route table (user-defined route)', what: 'Overrides Azure\'s default routes for a subnet: next hop can be a virtual appliance (IP), virtual network gateway, internet or none.', pick: 'Forcing traffic through a firewall or appliance, or dropping it (next hop None).', clues: ['next hop', 'virtual appliance', 'force traffic through', '0.0.0.0/0'] },
    ],
    drills: [
      { scenario: 'Outbound web traffic from all subnets may go only to *.contoso.com.', answer: 'Azure Firewall', why: 'NSGs cannot filter by domain name; Azure Firewall application rules can.' },
      { scenario: 'Web VMs may reach database VMs on 1433, without writing IP addresses into rules.', answer: 'Application security group (ASG)', why: 'Put NICs into asg-web and asg-db and write one NSG rule using those groups.' },
      { scenario: 'All internet-bound traffic from a subnet must pass through a firewall at 10.0.1.4.', answer: 'Route table (user-defined route)', why: 'A route 0.0.0.0/0 → next hop Virtual appliance 10.0.1.4, associated with the subnet.' },
      { scenario: 'Block RDP (3389) from the internet to every VM in one subnet, at no extra cost.', answer: 'Network security group (NSG)', why: 'An NSG on the subnet with an inbound deny rule (or simply no allow rule) does it for free. Remember: lowest priority number is checked first.' },
    ],
    lesson: 'az104-nsg-asg',
  },
  {
    id: 'balance-traffic', area: 'Networking', title: 'Load Balancer, Application Gateway, Front Door or Traffic Manager?',
    rule: 'Ask two questions: one region or global? Any TCP/UDP, or web (HTTP/HTTPS) only? Regional + any port = Load Balancer. Regional + web = Application Gateway. Global + web = Front Door. Global + DNS-based, any protocol = Traffic Manager.',
    options: [
      { name: 'Azure Load Balancer', what: 'Layer 4 (TCP/UDP) in one region. Public (internet-facing) or internal (private IP). Health probes take bad VMs out.', pick: 'Spreading any TCP/UDP traffic across VMs in a region.', clues: ['TCP/UDP', 'layer 4', 'internal load balancer', 'health probe', 'any port', 'RDP or SQL traffic'] },
      { name: 'Application Gateway', what: 'Layer 7 web traffic in one region: URL path routing (/images, /api), TLS termination, cookie affinity, optional Web Application Firewall.', pick: 'Web apps in one region needing path-based routing or WAF.', clues: ['URL path', '/api', 'WAF', 'SSL/TLS offload', 'layer 7', 'regional'] },
      { name: 'Azure Front Door', what: 'Global layer 7 entry point for web apps, with caching and WAF, routing users to the closest healthy region.', pick: 'Web apps in several regions, global users.', clues: ['global', 'multiple regions', 'caching / CDN', 'web'] },
      { name: 'Traffic Manager', what: 'DNS-based global routing: it answers DNS queries with the best endpoint (priority, performance, geographic…). Works for any protocol because it never touches the traffic itself.', pick: 'Global failover or geo-routing for non-HTTP services.', clues: ['DNS-based', 'any protocol', 'priority routing / failover', 'geographic routing'] },
    ],
    drills: [
      { scenario: 'Three VMs in one region run a TCP service on port 5000. Spread the connections across them.', answer: 'Azure Load Balancer', why: 'Non-HTTP, single region: Load Balancer (layer 4).' },
      { scenario: 'In one region, /images must go to one pool and /api to another, with a web application firewall.', answer: 'Application Gateway', why: 'Path-based routing and WAF in one region are Application Gateway features.' },
      { scenario: 'A website runs in West Europe and East US. Users worldwide should reach the closest healthy copy, with caching.', answer: 'Azure Front Door', why: 'Global HTTP(S) with caching and health-based routing is Front Door.' },
      { scenario: 'A non-HTTP service in two regions needs automatic failover to the second region.', answer: 'Traffic Manager', why: 'Traffic Manager works at DNS level for any protocol, with priority routing for failover.' },
    ],
    lesson: 'az104-load-balancer',
  },
  {
    id: 'reach-vms', area: 'Networking', title: 'Bastion, public IP, or VPN to reach a VM?',
    rule: 'Bastion gives RDP/SSH in the browser (or native client) without any public IP on the VM. A public IP with RDP/SSH open is the least safe option.',
    options: [
      { name: 'Azure Bastion', what: 'A managed service in AzureBastionSubnet (/26 or larger for Basic and above). You connect from the portal over TLS 443; the VM only needs a private IP. Works for VMs in peered VNets (not on the Developer SKU).', pick: 'Secure admin access to VMs with no public IPs.', clues: ['no public IP on the VM', 'from the Azure portal', 'AzureBastionSubnet', 'browser'] },
      { name: 'Public IP + open RDP/SSH', what: 'The VM gets a public IP and the NSG allows 3389/22 from the internet.', pick: 'Avoid; only for short tests with the source restricted to your IP.', clues: ['public IP', 'port 3389 from Any'] },
      { name: 'Point-to-site VPN', what: 'Your computer joins the VNet over VPN, then you use the private IP.', pick: 'Admins who need many tools (not just RDP/SSH) on private IPs.', clues: ['VPN client', 'private IP from a laptop'] },
    ],
    drills: [
      { scenario: 'Admins must RDP to VMs from the Azure portal. The VMs must not have public IPs.', answer: 'Azure Bastion', why: 'Bastion connects to the VM\'s private IP from the portal.' },
      { scenario: 'Admins working from home need their own tools (database clients, file copy, scripts) against VMs\' private IPs, not just an RDP/SSH session.', answer: 'Point-to-site VPN', why: 'Point-to-site puts the laptop on the VNet so any tool can reach private IPs. Bastion gives RDP/SSH sessions only.' },
    ],
    lesson: 'az104-bastion',
  },
  {
    id: 'dns', area: 'Networking', title: 'Public DNS zone, private DNS zone or DNS Private Resolver?',
    rule: 'Public zone = names the internet can look up. Private zone = names only your linked VNets can look up. Private Resolver = lets on-premises and Azure ask each other\'s DNS without running DNS VMs.',
    options: [
      { name: 'Public DNS zone', what: 'Hosts records like www.contoso.com for the internet. Point the domain to Azure by updating the name server (NS) records at your registrar.', pick: 'Your internet domain.', clues: ['internet', 'registrar', 'NS records', 'delegate'] },
      { name: 'Private DNS zone', what: 'Records visible only to VNets linked to the zone. A link can auto-register VM names (a VNet can auto-register in only one private zone).', pick: 'Name resolution between VMs in VNets; privatelink zones for private endpoints.', clues: ['inside the VNet', 'virtual network link', 'auto-registration', 'privatelink'] },
      { name: 'DNS Private Resolver', what: 'Managed inbound and outbound endpoints that forward DNS queries between Azure and on-premises.', pick: 'On-premises servers must resolve Azure private zones (or Azure must resolve on-premises names).', clues: ['on-premises DNS', 'conditional forwarding', 'hybrid', 'without DNS VMs'] },
    ],
    drills: [
      { scenario: 'VMs in VNet1 and VNet2 must find each other by name (vm1.corp.internal) automatically when created.', answer: 'Private DNS zone', why: 'Create a private zone, link both VNets; enable auto-registration on the links (each VNet can auto-register in one zone).' },
      { scenario: 'On-premises servers must resolve the private endpoint name of a storage account.', answer: 'DNS Private Resolver', why: 'On-premises DNS forwards privatelink queries to the resolver\'s inbound endpoint, which answers from the private zone.' },
      { scenario: 'You bought contoso.com and want Azure to host its records for the internet.', answer: 'Public DNS zone', why: 'Create the public zone, then update the NS records at the registrar to Azure\'s name servers.' },
    ],
    lesson: 'az104-azure-dns',
  },
  {
    id: 'network-watcher', area: 'Networking', title: 'Which Network Watcher tool?',
    rule: 'Pick by the question asked: "is it allowed?" → IP flow verify / NSG diagnostics. "Where does it go?" → Next hop. "Can A reach B right now?" → Connection troubleshoot. "Tell me if it breaks over time" → Connection monitor. "Show me the packets" → Packet capture. "Keep a record of all flows" → VNet flow logs.',
    options: [
      { name: 'IP flow verify', what: 'Tests one packet (5-tuple) to or from a VM and says Allowed or Denied, plus WHICH NSG rule decided.', pick: 'Is my NSG blocking this?', clues: ['which rule', 'allowed or denied', 'NSG blocking'] },
      { name: 'NSG diagnostics', what: 'Checks a flow against all NSGs in its path (subnet and NIC) and shows each one\'s decision.', pick: 'Several NSGs might be involved.', clues: ['all NSGs in the path', 'subnet and NIC NSG'] },
      { name: 'Next hop', what: 'Shows where a packet from a VM will be routed next (internet, virtual appliance, gateway, none) and which route table caused it.', pick: 'Routing problems, user-defined routes.', clues: ['route', 'next hop', 'virtual appliance', 'UDR'] },
      { name: 'Connection troubleshoot', what: 'A one-time end-to-end test from a VM to a destination (VM, FQDN, IP, port) showing hops, latency and what blocked it.', pick: 'Can A reach B right now, and if not, why?', clues: ['one-time', 'right now', 'end to end'] },
      { name: 'Connection monitor', what: 'Continuous tests between endpoints over time, with metrics and alerts.', pick: 'Watch a connection and alert when it degrades.', clues: ['continuously', 'over time', 'alert when latency', 'monitor'] },
      { name: 'Packet capture', what: 'Records packets on a VM (with the Network Watcher extension) to a file for analysis.', pick: 'You need the actual packets.', clues: ['capture packets', 'Wireshark', '.cap file'] },
      { name: 'VNet flow logs', what: 'Logs every IP flow through a VNet to a storage account (Traffic Analytics can analyse them). Replaces NSG flow logs.', pick: 'Auditing or analysing traffic patterns over time.', clues: ['log all traffic', 'traffic analytics', 'flow logs', 'audit'] },
    ],
    drills: [
      { scenario: 'You need to know which NSG rule is blocking RDP from 203.0.113.5 to VM1.', answer: 'IP flow verify', why: 'IP flow verify returns Allowed/Denied and the exact rule name.' },
      { scenario: 'Traffic from a subnet should go to a firewall, but seems to go straight to the internet.', answer: 'Next hop', why: 'Next hop shows the actual route and which route table (if any) is applied.' },
      { scenario: 'Alert the team whenever latency from the web VMs to an on-premises server exceeds 100 ms.', answer: 'Connection monitor', why: 'Connection monitor tests continuously and supports alerts; connection troubleshoot is a one-time check.' },
      { scenario: 'Security wants a record of all allowed and denied flows in a VNet for 90 days.', answer: 'VNet flow logs', why: 'Flow logs record flows to storage for later analysis.' },
    ],
    lesson: 'az104-insights-network-watcher',
  },

  // ------------------------------------------------------------------ Identity and governance
  {
    id: 'control', area: 'Identity and governance', title: 'RBAC, Entra role, Azure Policy or resource lock?',
    rule: 'RBAC: WHO can do WHAT to Azure resources. Entra roles: who can manage users, groups and the directory. Policy: WHAT resources may look like (applies even to Owners). Lock: stop deletes or changes for EVERYONE.',
    options: [
      { name: 'Azure RBAC role', what: 'Role assignment = person/group/identity + role (Owner, Contributor, Reader…) + scope (management group, subscription, resource group, resource).', pick: 'Giving people permission to manage Azure resources.', clues: ['Contributor', 'Reader', 'scope', 'allow the team to manage VMs'] },
      { name: 'Microsoft Entra role', what: 'Directory roles such as User Administrator or Global Administrator.', pick: 'Managing users, groups, licences, app registrations.', clues: ['create users', 'reset passwords', 'directory', 'Global Administrator'] },
      { name: 'Azure Policy', what: 'Rules about resource properties: Deny, Audit, Modify, Append, DeployIfNotExists… It does not care who you are.', pick: 'Allowed regions, required tags, allowed VM sizes, compliance reports.', clues: ['allowed locations', 'require a tag', 'compliance', 'even owners'] },
      { name: 'Resource lock', what: 'CanNotDelete (can change, cannot delete) or ReadOnly (cannot change or delete). Applies to everyone, including Owners, until the lock is removed.', pick: 'Protecting critical resources from accidents.', clues: ['prevent accidental deletion', 'even administrators', 'CanNotDelete', 'ReadOnly'] },
    ],
    drills: [
      { scenario: 'Resources may only be created in UAE North and West Europe.', answer: 'Azure Policy', why: 'The Allowed locations policy with Deny enforces it for everyone.' },
      { scenario: 'Nobody, not even an Owner, should be able to delete the production VNet by accident.', answer: 'Resource lock', why: 'A CanNotDelete lock blocks deletion for everyone until it is removed.' },
      { scenario: 'The helpdesk must reset users\' passwords but not manage Azure resources.', answer: 'Microsoft Entra role', why: 'Directory tasks use Entra roles (for example Helpdesk Administrator or User Administrator), not Azure RBAC.' },
      { scenario: 'A team must manage VMs in rg-app only.', answer: 'Azure RBAC role', why: 'Assign Virtual Machine Contributor (or Contributor) at the rg-app scope.' },
    ],
    lesson: 'az104-rbac',
  },

  // ------------------------------------------------------------------ Storage
  {
    id: 'storage-access', area: 'Storage', title: 'Access key, SAS, stored access policy or Entra RBAC?',
    rule: 'Access key = master password (full access). SAS = a time-limited ticket with chosen permissions. Stored access policy = lets you change or cancel service SAS tickets later. Entra RBAC = sign in with an identity, no secret to leak.',
    options: [
      { name: 'Account access key', what: 'One of two keys giving full access to the whole account. Rotate them; anyone with a key can do anything.', pick: 'Avoid for apps; prefer Entra ID.', clues: ['full access', 'rotate keys', 'key1 / key2'] },
      { name: 'Shared access signature (SAS)', what: 'A signed URL token with permissions, services, start/expiry and optional IP range. User delegation SAS (signed with Entra credentials, blobs only) is the most secure kind; service and account SAS are signed with an account key.', pick: 'Giving temporary, limited access to someone without an Azure identity.', clues: ['temporary', 'partner', 'expiry', 'read only for 7 days', 'sv=…&sig=…'] },
      { name: 'Stored access policy', what: 'Settings (permissions, expiry) stored on a container, share, queue or table and referenced by service SAS tokens. Change or delete the policy to change or revoke those tokens.', pick: 'You must be able to revoke a SAS without rotating the account key.', clues: ['revoke a SAS', 'without regenerating keys', 'change expiry later'] },
      { name: 'Microsoft Entra ID + RBAC', what: 'Users or managed identities get data roles such as Storage Blob Data Reader.', pick: 'Apps and users inside your organisation; best practice.', clues: ['managed identity', 'Storage Blob Data …', 'no keys in code'] },
    ],
    drills: [
      { scenario: 'You gave a partner a service SAS valid for 30 days. You must be able to cancel it early without breaking other apps.', answer: 'Stored access policy', why: 'Link the SAS to a stored access policy; deleting or changing the policy revokes it. Otherwise you would have to rotate the account key.' },
      { scenario: 'An Azure VM app must read blobs without any secret in its configuration.', answer: 'Microsoft Entra ID + RBAC', why: 'Give the VM a managed identity and assign Storage Blob Data Reader.' },
      { scenario: 'An external auditor needs read access to one container for 7 days.', answer: 'Shared access signature (SAS)', why: 'A read-only SAS with a 7-day expiry gives limited, temporary access.' },
    ],
    lesson: 'az104-storage-keys-sas',
  },
  {
    id: 'blob-recovery', area: 'Storage', title: 'Soft delete, versioning or snapshot?',
    rule: 'Deleted by mistake → soft delete (blob or container). Overwritten by mistake → versioning. A copy you take yourself at a moment you choose → snapshot.',
    options: [
      { name: 'Blob soft delete', what: 'Keeps deleted blobs for 1–365 days so you can undelete them.', pick: 'Recovering deleted blobs.', clues: ['deleted blob', 'undelete', 'retention days'] },
      { name: 'Container soft delete', what: 'Keeps deleted containers (with their blobs) for 1–365 days. Blob soft delete does NOT cover a deleted container.', pick: 'Recovering a whole deleted container.', clues: ['deleted container', 'whole container'] },
      { name: 'Blob versioning', what: 'Automatically keeps the previous version every time a blob is changed or deleted.', pick: 'Recovering from overwrites.', clues: ['overwritten', 'previous version', 'restore earlier content'] },
      { name: 'Snapshot', what: 'A read-only copy of a blob (or of a whole Azure file share) that you create at a point in time.', pick: 'A manual or scheduled point-in-time copy; for Azure Files, recovering single files.', clues: ['point in time', 'manual copy', 'file share snapshot', 'previous versions in Windows'] },
    ],
    drills: [
      { scenario: 'A script overwrote 500 blobs with empty files. You need yesterday\'s content.', answer: 'Blob versioning', why: 'Versioning keeps the previous version on every overwrite.' },
      { scenario: 'Someone deleted the container "invoices".', answer: 'Container soft delete', why: 'Only container soft delete (enabled before the delete) restores a deleted container.' },
      { scenario: 'Users need to restore single files from an Azure file share as they were 6 hours ago.', answer: 'Snapshot', why: 'Share snapshots keep point-in-time copies of the whole share; you restore individual files from them.' },
    ],
    lesson: 'az104-data-protection',
  },

  // ------------------------------------------------------------------ Compute
  {
    id: 'containers', area: 'Compute', title: 'Container Instances, Container Apps or App Service?',
    rule: 'ACI = just run a container, quickly. Container Apps = containers that scale automatically (even to zero) with revisions. App Service = web apps (code or container) with plans, slots and custom domains.',
    options: [
      { name: 'Azure Container Instances (ACI)', what: 'Runs a container group on demand, billed per second. No built-in autoscale.', pick: 'Simple tasks, batch jobs, quick tests.', clues: ['run a container quickly', 'batch job', 'per second', 'container group', 'no orchestration'] },
      { name: 'Azure Container Apps', what: 'Serverless containers with scale rules (HTTP, queues, KEDA), scale to zero, revisions and traffic splitting.', pick: 'Microservices and APIs that must scale with demand.', clues: ['scale to zero', 'KEDA', 'revisions', 'microservices', 'scale rule'] },
      { name: 'Azure App Service', what: 'Managed web hosting for code or containers, on an App Service plan, with deployment slots, custom domains and TLS.', pick: 'Web apps and APIs needing slots, custom domains and backups.', clues: ['deployment slot', 'App Service plan', 'custom domain', 'web app'] },
    ],
    drills: [
      { scenario: 'A container should run a nightly 10-minute job and cost nothing the rest of the day, with no scaling needed.', answer: 'Azure Container Instances (ACI)', why: 'ACI runs a container on demand and bills per second.' },
      { scenario: 'An API in a container must scale from 0 to 30 copies based on queue length.', answer: 'Azure Container Apps', why: 'Container Apps uses KEDA scale rules and can scale to zero.' },
      { scenario: 'A web app needs a staging slot to test before swapping into production.', answer: 'Azure App Service', why: 'Deployment slots are an App Service feature (Standard tier and above).' },
    ],
    lesson: 'az104-containers',
  },
  {
    id: 'vm-availability', area: 'Compute', title: 'Availability set, availability zones or scale set?',
    rule: 'Availability set = spread VMs across racks in ONE datacenter (99.95%). Zones = spread VMs across separate datacenters in a region (99.99%). Scale set = many identical VMs that grow and shrink automatically.',
    options: [
      { name: 'Availability set', what: 'Fault domains (racks/power) and update domains (maintenance groups) inside one datacenter. Chosen when the VM is created.', pick: 'Protect against rack failure and planned maintenance.', clues: ['fault domain', 'update domain', 'rack', '99.95%'] },
      { name: 'Availability zones', what: 'Physically separate datacenters in a region with independent power, cooling and networking.', pick: 'Survive a whole datacenter failure.', clues: ['datacenter failure', 'zone 1, 2, 3', '99.99%'] },
      { name: 'Virtual Machine Scale Set', what: 'A group of VMs managed together with autoscale rules; can be spread across zones.', pick: 'Load that changes, needing more or fewer VMs automatically.', clues: ['autoscale', 'CPU above 70% add instances', 'identical VMs'] },
    ],
    drills: [
      { scenario: 'An app must keep running if an entire datacenter in the region fails.', answer: 'Availability zones', why: 'Zones are separate datacenters; an availability set lives in one datacenter.' },
      { scenario: 'The number of web VMs must increase when CPU is above 75% and decrease at night.', answer: 'Virtual Machine Scale Set', why: 'Scale sets have autoscale rules.' },
    ],
    lesson: 'az104-vm-availability',
  },

  // ------------------------------------------------------------------ Monitor and backup
  {
    id: 'monitor', area: 'Monitor and backup', title: 'Metric, log, activity log, alert rule, action group or processing rule?',
    rule: 'Metrics = numbers over time. Logs = detailed records you query with KQL. Activity log = who did what to resources. Alert rule = WHEN to fire. Action group = WHO to tell / WHAT to run. Alert processing rule = change fired alerts (silence or add actions).',
    options: [
      { name: 'Metrics', what: 'Numeric values collected automatically (CPU %, transactions), kept 93 days.', pick: 'Charts and fast threshold alerts.', clues: ['CPU percentage', 'chart', 'near real time'] },
      { name: 'Logs (Log Analytics)', what: 'Records in a Log Analytics workspace, queried with KQL. Resource logs need a diagnostic setting; VM guest data needs Azure Monitor Agent + a data collection rule.', pick: 'Detailed analysis and complex queries.', clues: ['KQL', 'workspace', 'diagnostic setting', 'data collection rule'] },
      { name: 'Activity log', what: 'Control-plane events: create, update, delete, role changes, service health. Kept 90 days.', pick: 'Who deleted or changed a resource?', clues: ['who deleted', 'who changed', 'administrative operations'] },
      { name: 'Alert rule', what: 'The condition: a metric threshold, log query result or activity log event.', pick: 'Defining when something is wrong.', clues: ['when CPU exceeds', 'condition', 'signal'] },
      { name: 'Action group', what: 'Who is notified and what runs: email, SMS, push, voice, webhook, Logic App, Function, runbook.', pick: 'Reusable notification list for many alert rules.', clues: ['email the team', 'SMS', 'webhook', 'runbook'] },
      { name: 'Alert processing rule', what: 'Acts on alerts after they fire: suppress notifications (for example during maintenance) or add action groups at scale.', pick: 'Maintenance windows; one place to route many alerts.', clues: ['maintenance window', 'suppress', 'every Saturday 01:00–03:00', 'all alerts in a subscription'] },
    ],
    drills: [
      { scenario: 'During planned maintenance every Saturday 01:00–03:00, no alert notifications should be sent.', answer: 'Alert processing rule', why: 'A processing rule with a weekly schedule suppresses notifications without disabling the alert rules.' },
      { scenario: 'Find out who deleted a public IP yesterday.', answer: 'Activity log', why: 'The activity log records delete operations and who made them.' },
      { scenario: 'Ten alert rules must all email the same on-call team.', answer: 'Action group', why: 'Create one action group and attach it to each rule.' },
    ],
    lesson: 'az104-alerts',
  },
  {
    id: 'vaults', area: 'Monitor and backup', title: 'Recovery Services vault or Backup vault?',
    rule: 'Recovery Services vault: Azure VMs, SQL/SAP HANA in VMs, Azure Files, on-premises (MARS) and Site Recovery. Backup vault: newer data sources such as Azure Blobs, managed disks, PostgreSQL flexible server and AKS.',
    options: [
      { name: 'Recovery Services vault', what: 'The original vault type, also used by Azure Site Recovery.', pick: 'Backing up Azure VMs, Azure Files, SQL in a VM, MARS agent; any Site Recovery work.', clues: ['Azure VM backup', 'Azure Files', 'MARS', 'Site Recovery'] },
      { name: 'Backup vault', what: 'The newer vault type for operational and vaulted backups of newer workloads.', pick: 'Blobs, managed disks, PostgreSQL flexible server, AKS.', clues: ['Azure Blobs', 'managed disk backup', 'PostgreSQL flexible server', 'AKS'] },
    ],
    drills: [
      { scenario: 'You must back up Azure VMs and replicate them to another region for disaster recovery.', answer: 'Recovery Services vault', why: 'VM backup and Site Recovery both use a Recovery Services vault.' },
      { scenario: 'You must back up Azure Blobs with vaulted backup.', answer: 'Backup vault', why: 'Azure Blobs backup uses a Backup vault.' },
    ],
    lesson: 'az104-backup-vaults',
  },
]

/** One storage account three ways, with the same numbered parts so a learner can match them. */
export const SAME_THING_THREE_WAYS = {
  arm: `{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {                                   // (1) questions asked at deployment
    "storageName": { "type": "string", "minLength": 3, "maxLength": 24 },
    "sku": { "type": "string", "defaultValue": "Standard_LRS",
             "allowedValues": [ "Standard_LRS", "Standard_GRS" ] }
  },
  "variables": {                                    // (2) worked out inside the file
    "location": "[resourceGroup().location]"
  },
  "resources": [                                    // (3) what gets built
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-05-01",
      "name": "[parameters('storageName')]",
      "location": "[variables('location')]",
      "sku": { "name": "[parameters('sku')]" },
      "kind": "StorageV2",
      "properties": { "minimumTlsVersion": "TLS1_2" }
    }
  ],
  "outputs": {                                      // (4) handed back at the end
    "blobEndpoint": { "type": "string",
      "value": "[reference(parameters('storageName')).primaryEndpoints.blob]" }
  }
}`,
  bicep: `@minLength(3)
@maxLength(24)
param storageName string                 // (1) parameter

@allowed([ 'Standard_LRS', 'Standard_GRS' ])
param sku string = 'Standard_LRS'        // (1) parameter with a default

var location = resourceGroup().location  // (2) variable

resource sa 'Microsoft.Storage/storageAccounts@2023-05-01' = {   // (3) resource
  name: storageName
  location: location
  sku: { name: sku }
  kind: 'StorageV2'
  properties: { minimumTlsVersion: 'TLS1_2' }
}

output blobEndpoint string = sa.properties.primaryEndpoints.blob  // (4) output`,
  cli: `# The same account with one CLI command (imperative)
az storage account create \\
  --resource-group rg-az104-lab \\
  --name stlab$RANDOM \\
  --sku Standard_LRS \\
  --kind StorageV2 \\
  --min-tls-version TLS1_2

# Deploying the Bicep or JSON file instead (declarative)
az deployment group create \\
  --resource-group rg-az104-lab \\
  --template-file main.bicep \\
  --parameters storageName=stlab12345 sku=Standard_GRS

# Preview first
az deployment group what-if --resource-group rg-az104-lab --template-file main.bicep --parameters storageName=stlab12345`,
}

export const READ_A_TEMPLATE = [
  { step: 'Find the resources', detail: 'Look only at "resources" (JSON) or the resource lines (Bicep). Read each "type": that is what will be built. Ignore everything else at first.' },
  { step: 'Find what you are asked', detail: 'Look at parameters. Which have a default? Which have allowed values (a fixed list)? Which are @secure()? Exam questions often ask what you may enter.' },
  { step: 'Follow the expressions', detail: 'Anything in [square brackets] (JSON) or after = (Bicep) is calculated. resourceGroup().location means "the same region as the resource group". uniqueString(…) makes a repeatable unique text.' },
  { step: 'Check order and results', detail: 'dependsOn (JSON) says "build that first". Bicep usually works out order itself when one resource refers to another (sa.id). Outputs show what you get back.' },
]

export const CLI_GRAMMAR = [
  { pattern: 'az group create -n rg-app -l uaenorth', meaning: 'Create a resource group (name, location).' },
  { pattern: 'az vm create -g rg-app -n vm1 --image Ubuntu2204 --size Standard_B1s', meaning: 'Create a VM.' },
  { pattern: 'az vm deallocate / start / resize -g rg-app -n vm1', meaning: 'Stop (stops billing for compute), start, change size.' },
  { pattern: 'az network vnet create -g rg-net -n vnet1 --address-prefixes 10.1.0.0/16 --subnet-name app --subnet-prefixes 10.1.1.0/24', meaning: 'Create a VNet with one subnet.' },
  { pattern: 'az network nsg rule create -g rg-net --nsg-name nsg-app -n allow-https --priority 100 --destination-port-ranges 443 --access Allow', meaning: 'Add an NSG rule (lower priority number = checked first).' },
  { pattern: 'az network vnet peering create -g rg-net -n hub-to-spoke --vnet-name hub --remote-vnet spoke --allow-vnet-access', meaning: 'Peer two VNets (create it from both sides).' },
  { pattern: 'az deployment group create -g rg-app -f main.bicep -p env=prod', meaning: 'Deploy a template into a resource group.' },
  { pattern: 'az deployment sub create -l uaenorth -f rg.bicep', meaning: 'Deploy at subscription scope (for example to create resource groups).' },
  { pattern: 'az bicep decompile -f old.json', meaning: 'Convert ARM JSON to Bicep.' },
]

/** Plain-language networking: one picture to hang every topic on. */
export const NETWORK_STORY = [
  { term: 'Virtual network (VNet)', plain: 'Your private estate in Azure, with an address range such as 10.1.0.0/16.' },
  { term: 'Subnet', plain: 'A street inside the estate (10.1.1.0/24). Azure keeps 5 addresses in every subnet for itself.' },
  { term: 'NIC and private IP', plain: 'A VM\'s front door and house number on that street.' },
  { term: 'Public IP', plain: 'A gate to the outside world. Standard public IPs are closed until an NSG allows traffic in.' },
  { term: 'NSG', plain: 'A guard with a numbered list of allow/deny rules, standing at the street (subnet) and/or the front door (NIC). Lowest number is checked first; first match wins.' },
  { term: 'Route table (UDR)', plain: 'Road signs: they change where traffic drives, for example "all internet traffic goes via the firewall first". They never allow or block.' },
  { term: 'Peering', plain: 'A private road between two estates. Not transitive: A–B and B–C does not connect A to C.' },
  { term: 'VPN gateway / ExpressRoute', plain: 'A tunnel through the public internet / a private motorway to your office.' },
  { term: 'Service endpoint / private endpoint', plain: 'A fast lane to a shop\'s public door / the shop opening a counter inside your estate with a private address.' },
  { term: 'Load balancer', plain: 'A receptionist sending each visitor to a healthy server.' },
  { term: 'DNS', plain: 'The phone book that turns names into addresses. Private DNS zones are phone books only your estates can read.' },
  { term: 'Bastion', plain: 'A secure reception desk: you reach VMs through the portal without giving them public gates.' },
]

/** When something cannot connect, check in this order. Each step names the tool that answers it. */
export const TROUBLESHOOT_ORDER = [
  { check: 'Does the name resolve to the right IP?', tool: 'nslookup from the VM; private DNS zone links' },
  { check: 'Where does the packet go?', tool: 'Next hop / Effective routes (route tables, peering, gateways)' },
  { check: 'Do the NSGs allow it?', tool: 'IP flow verify / Effective security rules. Inbound: subnet NSG first, then NIC NSG. Outbound: NIC NSG first, then subnet NSG. Both must allow.' },
  { check: 'Is anything listening at the other end?', tool: 'Connection troubleshoot; check the service/port on the VM and its OS firewall' },
  { check: 'Does it keep failing over time?', tool: 'Connection monitor with an alert; VNet flow logs for history' },
]
