"""AZ-104 domain 4 (virtual networking): easy walkthroughs and hands-on labs."""
from _az104kit import BASE, DELETE_RG, ML, NEW_RG, REGION, RG, H
from _walkkit import N, S, walk

WALK: dict[str, dict] = {}
LAB: dict[str, dict] = {}
PATCH: dict[str, list[str]] = {}

VM_COST = "Low. One B1s VM costs about US$0.01 per hour. Delete the same day."
VNET = f"A virtual network vnet-lab (10.10.0.0/16) in {RG} with a subnet snet-app (10.10.1.0/24): Virtual networks > + Create > IP addresses tab. For these labs, untick 'Enable private subnet' on snet-app so lab VMs can reach the internet (in production use a NAT gateway instead)."
VM_IN_VNET = (f"A small Linux VM vm-lab in snet-app of vnet-lab: Virtual machines > + Create. Image Ubuntu 24.04, size Standard_B1s, password authentication, "
              "Networking tab: vnet-lab / snet-app, public IP: None, NIC network security group: Basic, public inbound ports: None."
              " If the VM cannot reach the internet later, its subnet is private (the default for new networks): open the virtual network > Subnets, untick 'Enable private subnet', save, then stop and start the VM. In production use a NAT gateway instead.")
RUN_CMD = "Run a command without SSH: open the VM > Operations > Run command > RunShellScript, type the command, Run."

# ---------------------------------------------------------------- 4.1 VNets and subnets
WALK["az104-vnet-subnets"] = walk(
    "Plan a private network in Azure: address ranges, subnets, and how VMs reach the internet.",
    ["Address spaces and subnets", "Five reserved IPs per subnet", "Planning ranges that never overlap", "Private subnets and outbound internet access"],
    [N("vnet", "VNet 10.10.0.0/16", 400, 70, "network", "address space"), N("web", "snet-web 10.10.1.0/24", 180, 210, "network"), N("app", "snet-app 10.10.2.0/24", 620, 210, "network"),
     N("vm1", "Web VM 10.10.1.4", 180, 350, "compute"), N("vm2", "App VM 10.10.2.4", 620, 350, "compute"), N("nat", "NAT gateway", 400, 350, "network", "outbound internet")],
    [S("problem", "Network", "Servers need a private network",
       "Web servers, app servers and databases must talk to each other privately, and you must be able to connect it to the office later without IP clashes.",
       add=["vnet"]),
     S("concept", "Address space", "A VNet has an address space; subnets slice it",
       "A virtual network lives in one region and subscription and has one or more address ranges in CIDR notation, such as 10.10.0.0/16 (65,536 addresses). Subnets divide it, for example 10.10.1.0/24 for web and 10.10.2.0/24 for app.",
       add=["web", "app"], edges=[("vnet", "web"), ("vnet", "app")], learn=[0]),
     S("concept", "Reserved", "Azure keeps five addresses in every subnet",
       "The first four and the last address of each subnet are reserved. A /24 has 256 addresses, so 251 are usable. The smallest subnet is /29 (8 addresses, 3 usable). VMs get the next free address, starting at .4.",
       add=["vm1", "vm2"], edges=[("web", "vm1"), ("app", "vm2")], learn=[1], warn="Exam favourite: how many usable IPs in a /27? 32 − 5 = 27."),
     S("technique", "Plan", "Plan ranges that never overlap",
       "Use private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). Leave room to grow. Never overlap with on-premises or other VNets you might peer, because overlapping networks cannot be connected.\n\nSome services need their own named subnet: GatewaySubnet, AzureBastionSubnet, AzureFirewallSubnet.",
       learn=[2]),
     S("technique", "Outbound", "Private subnets: no automatic internet",
       "New VNets now create private subnets by default: VMs no longer get Azure's hidden 'default outbound access' to the internet. Give outbound access explicitly with a NAT gateway (recommended), a public IP on the VM, or a load balancer outbound rule.",
       add=["nat"], edges=[("app", "nat"), ("web", "nat")], learn=[3], tip="If a new VM cannot download updates, check how the subnet reaches the internet."),
     S("recap", "Recap", "VNets and subnets", "Plan ranges first; subnets slice them.",
       recap=["VNet = one region, address space in CIDR", "Subnets divide the space", "5 reserved IPs per subnet; /29 is smallest",
              "No overlaps if you will ever connect networks", "Private subnets need NAT gateway or a public IP for internet"])])

PATCH["az104-vnet-subnets"] = [
    "Outbound internet: new virtual networks use private subnets by default (defaultOutboundAccess = false). The portal already does this, and API versions released after 31 March 2026 do too; existing VNets keep their behaviour. VMs in a private subnet need an explicit outbound method: a NAT gateway (recommended), an instance-level public IP, or a Standard load balancer with outbound rules."]

LAB["az104-vnet-subnets"] = H(
    "Create a VNet with two subnets and work out usable addresses", 15, "free", "Free. Virtual networks and subnets cost nothing.",
    [BASE, NEW_RG],
    [(f"Search 'Virtual networks' > + Create. Group {RG}, name vnet-lab, region {REGION}.", None),
     ("IP addresses tab: set the address space to 10.10.0.0/16. Delete the default subnet. Add subnet snet-app 10.10.1.0/24 and subnet snet-web 10.10.2.0/27.", "Each subnet shows its size: 256 and 32 addresses.", "Read the 'Enable private subnet' option on each subnet. It removes default outbound internet access."),
     ("Review + create > Create. Open vnet-lab > Settings > Subnets.", "Available IPs: 251 for snet-app and 27 for snet-web (5 reserved each)."),
     ("Select + Subnet and choose Subnet purpose: Azure Bastion.", "The name is fixed to AzureBastionSubnet. Cancel without creating."),
     ("Open Settings > Address space and add 10.11.0.0/16. Save.", "The VNet now has two address ranges."),
     ("Try adding a subnet 10.10.1.128/25.", "An error: it overlaps snet-app.")],
    ["vnet-lab has two subnets; you confirmed the 5 reserved addresses."],
    ["Keep vnet-lab for the next networking labs, or: " + DELETE_RG],
    [("Quickstart: create a virtual network in the portal", ML + "azure/virtual-network/quick-create-portal"),
     ("Add, change or delete a subnet", ML + "azure/virtual-network/virtual-network-manage-subnet"),
     ("Default outbound access in Azure", ML + "azure/virtual-network/ip-services/default-outbound-access")])

# ---------------------------------------------------------------- 4.1 peering
WALK["az104-vnet-peering"] = walk(
    "Connect two virtual networks so they talk privately over Microsoft's backbone.",
    ["What peering does", "Peering is not transitive", "Gateway transit and forwarded traffic", "Rules: no overlaps, both directions"],
    [N("hub", "Hub VNet 10.0.0.0/16", 400, 80, "network"), N("s1", "Spoke 1 10.1.0.0/16", 180, 260, "network"), N("s2", "Spoke 2 10.2.0.0/16", 620, 260, "network"),
     N("gw", "VPN gateway", 680, 80, "network", "in the hub"), N("fw", "Firewall / NVA", 400, 390, "security", "in the hub")],
    [S("problem", "Separate networks", "Two teams, two VNets, one app",
       "The web team's VNet must reach the database team's VNet, privately and fast, without a VPN.",
       add=["s1", "hub"]),
     S("concept", "Peering", "Peering joins two VNets",
       "VNet peering connects two VNets so their resources talk using private IPs over the Microsoft backbone, with low latency. It works in the same region or across regions (global peering) and across subscriptions and tenants.",
       edges=[("s1", "hub", "peering")], learn=[0]),
     S("concept", "Not transitive", "Peering is not transitive",
       "If Spoke 1 is peered to the hub and Spoke 2 is peered to the hub, Spoke 1 still cannot reach Spoke 2. Either peer the spokes directly, or route through a firewall or NVA in the hub with user-defined routes.",
       add=["s2", "fw"], edges=[("s2", "hub", "peering"), ("hub", "fw")], learn=[1], warn="Exam favourite: A↔B and B↔C does not give A↔C."),
     S("technique", "Options", "Peering settings that matter",
       "'Allow gateway transit' on the hub plus 'Use remote gateways' on the spoke lets spokes use the hub's VPN gateway. 'Allow forwarded traffic' accepts traffic that did not start in the peered VNet, which is needed when routing through an NVA.",
       add=["gw"], edges=[("gw", "hub")], learn=[2]),
     S("technique", "Rules", "Rules of peering",
       "Address spaces must not overlap. A peering has two links, one in each VNet; both must show Connected. Inbound and outbound data across peering is charged.",
       learn=[3]),
     S("recap", "Recap", "Peering", "Private, fast, but not transitive.",
       recap=["Regional or global, cross-subscription and tenant", "Not transitive", "Gateway transit + use remote gateways to share a VPN gateway",
              "Allow forwarded traffic for NVA routing", "No overlapping ranges; both links Connected"])])

LAB["az104-vnet-peering"] = H(
    "Peer two VNets and confirm both links", 15, "free", "Free without VMs. Data across peering is charged per GB, but you send none.",
    [BASE, NEW_RG, VNET],
    [(f"Create a second VNet in {RG}: vnet-lab2, address space 10.20.0.0/16, subnet snet-db 10.20.1.0/24.", None),
     ("Open vnet-lab > Settings > Peerings > + Add.", "A form with two sections: this VNet and the remote VNet."),
     ("Remote peering link name: lab2-to-lab; remote VNet: vnet-lab2. Local peering link name: lab-to-lab2. Leave 'Allow access' ticked on both sides. Add.", "After a moment the peering status shows Connected."),
     ("Open vnet-lab2 > Peerings.", "The matching link lab2-to-lab, also Connected. The portal created both directions."),
     ("Try a third VNet with an overlapping range (10.10.0.0/16) and peer it to vnet-lab.", "Peering is refused because the address spaces overlap. Delete that VNet."),
     ("Read the options 'Allow gateway transit' and 'Use remote gateways' on the peering.", "They are only useful when a VNet has a VPN or ExpressRoute gateway.")],
    ["Both peering links show Connected."],
    ["Delete the peering, or: " + DELETE_RG],
    [("Connect virtual networks with peering using the portal", ML + "azure/virtual-network/tutorial-connect-virtual-networks-portal"),
     ("Virtual network peering overview", ML + "azure/virtual-network/virtual-network-peering-overview")])

# ---------------------------------------------------------------- 4.1 public IPs
WALK["az104-public-ip"] = walk(
    "Give a resource a public address on the internet, with the right type and settings.",
    ["Standard SKU only", "Static allocation and zones", "Secure by default", "Where public IPs attach, and IP prefixes"],
    [N("net", "Internet", 120, 220, "globe"), N("pip", "Public IP", 380, 220, "network", "Standard, static"), N("vm", "VM NIC", 640, 90, "compute"),
     N("lb", "Load balancer", 640, 220, "network"), N("nat", "NAT gateway", 640, 350, "network"), N("nsg", "NSG", 380, 380, "security", "must allow inbound")],
    [S("problem", "Reachable", "A server must be reachable from the internet",
       "Customers need a fixed address that does not change, and you want nothing else exposed.",
       add=["net"]),
     S("concept", "SKU", "Standard public IPs",
       "Basic public IPs were retired in September 2025, so new ones are Standard. Standard IPs are static (the address never changes), and can be zone-redundant, zonal or non-zonal. Tier is regional, or global for cross-region load balancers.",
       add=["pip"], edges=[("net", "pip")], learn=[0, 1]),
     S("concept", "Secure", "Closed until you open it",
       "A Standard public IP is secure by default: inbound traffic is blocked unless a network security group allows it.",
       add=["nsg"], edges=[("nsg", "pip", "allow 443")], learn=[2], warn="VM has a public IP but nobody can connect? Check the NSG on its NIC and subnet."),
     S("technique", "Attach", "What uses public IPs",
       "Attach to a VM's network interface, a load balancer frontend, a NAT gateway, a VPN gateway, Application Gateway, Azure Firewall or Bastion. A public IP prefix reserves a contiguous block of addresses, handy for allow-lists.",
       add=["vm", "lb", "nat"], edges=[("pip", "vm"), ("pip", "lb"), ("pip", "nat")], learn=[3]),
     S("recap", "Recap", "Public IPs", "Standard, static, closed by default.",
       recap=["Standard SKU only (Basic retired)", "Static; zone-redundant, zonal or no zone", "Secure by default: NSG must allow",
              "Attach to NIC, LB, NAT gateway, gateways, Bastion", "Public IP prefix = block of addresses"])])

LAB["az104-public-ip"] = H(
    "Create a static public IP and attach it to a VM", 20, "low", VM_COST + " A Standard public IP adds about US$0.005 per hour.",
    [BASE, NEW_RG, VNET, VM_IN_VNET],
    [(f"Search 'Public IP addresses' > + Create. Group {RG}, name pip-lab, region {REGION}, SKU Standard, tier Regional, availability zone: Zone-redundant.", "Assignment is Static (no other choice for Standard)."),
     ("Create, then open pip-lab.", "The IP address, already allocated, and 'Associated to: -'."),
     ("Open vm-lab > Networking > the network interface > IP configurations > ipconfig1. Associate public IP address: pip-lab. Save.", None),
     ("Open pip-lab again.", "Associated to: the VM's network interface."),
     ("From Cloud Shell try: curl --max-time 5 http://<the IP>", "It times out: nothing allows inbound traffic. Standard IPs are closed by default."),
     ("Dissociate the public IP from the NIC (IP configuration > public IP: Disassociate). Save.", "The VM has no public IP again.")],
    ["You saw a Standard public IP stay closed until an NSG allows traffic."],
    [DELETE_RG],
    [("Create a public IP address in the portal", ML + "azure/virtual-network/ip-services/create-public-ip-portal"),
     ("Public IP addresses in Azure", ML + "azure/virtual-network/ip-services/public-ip-addresses"),
     ("Associate a public IP address to a VM", ML + "azure/virtual-network/ip-services/associate-public-ip-address-vm")])

# ---------------------------------------------------------------- 4.1 UDR
WALK["az104-udr"] = walk(
    "Change where traffic goes, for example through a firewall, with your own routes.",
    ["System routes", "Route tables and next hop types", "Longest prefix match and priority", "Routing through a network virtual appliance"],
    [N("vm", "App VM", 120, 220, "compute", "snet-app"), N("rt", "Route table", 380, 90, "network", "0.0.0.0/0 → 10.0.3.4"), N("fw", "Firewall / NVA", 380, 260, "security", "10.0.3.4"),
     N("net", "Internet", 660, 260, "globe"), N("on", "On-premises", 660, 90, "network", "via VPN"), N("drop", "None", 380, 400, "security", "drops traffic")],
    [S("problem", "Uninspected", "Traffic goes straight out to the internet",
       "Security wants every packet from the app subnet to pass through a firewall first.",
       add=["vm", "net"], edges=[("vm", "net", "system route")]),
     S("concept", "System routes", "Azure already routes for you",
       "System routes send traffic within the VNet, to peered VNets, to VPN gateways and to the internet, automatically. You see them in a NIC's Effective routes.",
       learn=[0]),
     S("technique", "Route table", "A route table overrides them",
       "Create a route table, add routes (address prefix + next hop), and associate it with subnets. Next hop types: Virtual appliance (an IP address), Virtual network gateway, Virtual network, Internet, or None (drop).",
       add=["rt", "fw", "drop"], edges=[("rt", "vm", "applies to subnet"), ("vm", "fw", "0.0.0.0/0"), ("fw", "net")], learn=[1]),
     S("concept", "Which route", "Which route wins?",
       "The most specific prefix wins (a /24 beats a /16). If prefixes are equal: user-defined route, then BGP route, then system route.",
       add=["on"], edges=[("fw", "on")], learn=[2], tip="Use Network Watcher Next hop to see which route a packet will use."),
     S("technique", "NVA", "Making an appliance work",
       "Enable IP forwarding on the appliance's NIC in Azure, and inside its operating system. Remember the return path: routes are needed in both directions, or traffic becomes asymmetric and is dropped.",
       focus=["fw"], learn=[3], warn="Route tables apply to whole subnets, not to single VMs."),
     S("recap", "Recap", "User-defined routes", "Your routes beat Azure's, most specific first.",
       recap=["System routes exist by default", "Route table → routes → associate to subnets", "Next hops: appliance, gateway, VNet, Internet, None",
              "Longest prefix wins; then UDR > BGP > system", "Enable IP forwarding on the NVA NIC"])])

LAB["az104-udr"] = H(
    "Send a subnet's internet traffic nowhere, then prove it with Next hop", 20, "low", VM_COST,
    [BASE, NEW_RG, VNET, VM_IN_VNET],
    [("Open vm-lab > Networking > the NIC > Help > Effective routes.", "System routes: the VNet range with next hop Virtual network, and 0.0.0.0/0 with next hop Internet."),
     (f"Search 'Route tables' > + Create. Group {RG}, name rt-lab, region {REGION}. Create.", None),
     ("Open rt-lab > Settings > Routes > + Add. Name: block-internet, destination 0.0.0.0/0 (IP addresses), next hop type: None. Add.", "The route listed."),
     ("Open rt-lab > Subnets > + Associate: vnet-lab / snet-app. OK.", None),
     ("Check the NIC's Effective routes again.", "0.0.0.0/0 now shows source User and next hop None; the system route shows as Invalid."),
     ("Search 'Network Watcher' > Network diagnostic tools > Next hop. VM: vm-lab, destination IP 8.8.8.8. Next hop.", "Next hop type: None, and the route table rt-lab named as the reason."),
     ("Change the route's next hop to Virtual appliance with IP 10.10.1.100 and run Next hop again.", "Next hop type VirtualAppliance, 10.10.1.100.")],
    ["Effective routes and Next hop both show your user-defined route winning."],
    ["Dissociate rt-lab from the subnet, or: " + DELETE_RG],
    [("Tutorial: route network traffic with a route table", ML + "azure/virtual-network/tutorial-create-route-table-portal"),
     ("Virtual network traffic routing", ML + "azure/virtual-network/virtual-networks-udr-overview"),
     ("Diagnose a VM routing problem (Next hop)", ML + "azure/network-watcher/diagnose-vm-network-routing-problem")])

# ---------------------------------------------------------------- 4.1 troubleshooting
WALK["az104-network-troubleshooting"] = walk(
    "Find out why two things cannot talk, step by step, with Network Watcher.",
    ["A checklist from source to destination", "IP flow verify and effective security rules", "Next hop and effective routes", "Connection troubleshoot, packet capture and flow logs"],
    [N("src", "Source VM", 110, 220, "compute"), N("nsg1", "NSG outbound", 300, 120, "security"), N("route", "Route", 400, 260, "network"), N("nsg2", "NSG inbound", 500, 120, "security"),
     N("dst", "Destination", 690, 220, "compute"), N("nw", "Network Watcher", 400, 400, "service", "diagnostic tools")],
    [S("problem", "Can't connect", "'The app server cannot reach the database'",
       "That sentence could mean a stopped VM, a blocking NSG, a wrong route, a DNS error or a firewall inside the OS. Guessing wastes hours.",
       add=["src", "dst"]),
     S("technique", "Checklist", "Walk the path",
       "Check in order: is the VM running? Does DNS resolve? Does the source NSG allow outbound? Which route is used? Does the destination NSG allow inbound? Is the app listening, and is the OS firewall open?",
       add=["nsg1", "route", "nsg2"], edges=[("src", "nsg1"), ("nsg1", "route"), ("route", "nsg2"), ("nsg2", "dst")], learn=[0]),
     S("technique", "NSG tools", "Is a security rule blocking it?",
       "IP flow verify tests one packet (direction, protocol, ports, IPs) and names the rule that allows or denies it. Effective security rules shows the combined rules of the NIC and subnet NSGs.",
       add=["nw"], edges=[("nw", "nsg1"), ("nw", "nsg2")], learn=[1]),
     S("technique", "Route tools", "Is traffic going the right way?",
       "Next hop shows where a packet would go and which route table decided it. Effective routes on a NIC lists every route in force.",
       edges=[("nw", "route")], learn=[2]),
     S("technique", "Deeper", "When you need more",
       "Connection troubleshoot tests a real connection end to end and reports where it fails. Packet capture records traffic on a VM. VNet flow logs record allowed and denied flows for later analysis (they replace NSG flow logs). Connection monitor watches a path continuously.",
       learn=[3], tip="Network Watcher is enabled automatically per region when you create a VNet."),
     S("recap", "Recap", "Troubleshooting", "Walk the path; let the tools name the culprit.",
       recap=["Running? DNS? NSG out? Route? NSG in? App listening?", "IP flow verify names the blocking rule", "Effective security rules = NIC + subnet NSGs",
              "Next hop / effective routes for routing", "Connection troubleshoot, packet capture, VNet flow logs"])])

LAB["az104-network-troubleshooting"] = H(
    "Diagnose a blocked port with Network Watcher", 25, "low", VM_COST,
    [BASE, NEW_RG, VNET, VM_IN_VNET],
    [("Search 'Network Watcher' > Network diagnostic tools > IP flow verify. VM: vm-lab, protocol TCP, direction Inbound, local port 22, remote IP 203.0.113.10, remote port 50000. Check.", "Access denied, with the rule DenyAllInBound named."),
     ("Open vm-lab > Networking > Network settings > Create port rule > Inbound port rule. Source: IP addresses 203.0.113.10, destination port 22, TCP, Allow, priority 300, name allow-ssh-test. Add.", None),
     ("Run IP flow verify again with the same values.", "Access allowed, by rule allow-ssh-test."),
     ("Open Network Watcher > Effective security rules, choose vm-lab's NIC.", "All rules in force, including the default rules at priorities 65000–65500."),
     ("Open Network Watcher > Connection troubleshoot. Source: vm-lab, destination URI www.microsoft.com, port 443. Run.", "Either Reachable, or Unreachable with the hop where it failed (private subnets without NAT have no internet)."),
     ("Open Network Watcher > Topology (or the VNet > Diagram) for vnet-lab.", "A picture of the VNet, subnets, NIC and NSG.")],
    ["IP flow verify showed denied, then allowed, naming the rule each time."],
    [DELETE_RG],
    [("Diagnose a VM network traffic filter problem (IP flow verify)", ML + "azure/network-watcher/diagnose-vm-network-traffic-filtering-problem"),
     ("Connection troubleshoot overview", ML + "azure/network-watcher/connection-troubleshoot-overview"),
     ("VNet flow logs overview", ML + "azure/network-watcher/vnet-flow-logs-overview")])

# ---------------------------------------------------------------- 4.2 NSG and ASG
WALK["az104-nsg-asg"] = walk(
    "Allow only the traffic you need, and understand exactly which rule wins.",
    ["NSG rules: priority, source, destination, port, action", "Default rules", "Subnet NSG plus NIC NSG", "Application security groups and service tags"],
    [N("net", "Internet", 110, 90, "globe"), N("sub", "Subnet NSG", 360, 90, "security", "checked 1st inbound"), N("nic", "NIC NSG", 600, 90, "security", "checked 2nd inbound"),
     N("web", "Web VMs", 600, 240, "compute", "ASG: asg-web"), N("db", "DB VMs", 600, 380, "database", "ASG: asg-db"), N("rule", "Rule 200", 260, 300, "security", "asg-web → asg-db 1433")],
    [S("problem", "Open ports", "Every port open to everyone",
       "A VM with RDP open to the internet is attacked within minutes. You need a firewall at the network level.",
       add=["net", "web"], edges=[("net", "web", "any port")]),
     S("concept", "Rules", "How an NSG rule works",
       "Each rule has a priority (100–4096, lower number is checked first), source, destination, protocol, port range and action (Allow or Deny). The first matching rule wins; later rules are ignored. NSGs are stateful: replies to allowed traffic are allowed automatically.",
       add=["sub"], edges=[("net", "sub")], learn=[0]),
     S("concept", "Defaults", "Default rules you cannot delete",
       "Inbound: allow within the VNet (65000), allow the Azure load balancer (65001), deny everything else (65500). Outbound: allow within the VNet, allow the internet, deny everything else. Override them with lower-numbered rules.",
       learn=[1], warn="Default inbound denies the internet. Default outbound allows the internet."),
     S("technique", "Two NSGs", "Subnet and NIC NSGs together",
       "You can attach an NSG to a subnet and another to a NIC. Inbound traffic is checked by the subnet NSG, then the NIC NSG; outbound in the reverse order. Both must allow it.",
       add=["nic"], edges=[("sub", "nic"), ("nic", "web")], learn=[2], tip="Effective security rules shows both together."),
     S("technique", "ASGs", "Rules by role, not by IP",
       "An application security group (ASG) is a label for NICs, such as asg-web. Use ASGs as rule sources and destinations: 'asg-web may reach asg-db on 1433'. New VMs just join the ASG. Service tags (Internet, VirtualNetwork, Storage, AzureLoadBalancer) stand for Microsoft-managed ranges.",
       add=["db", "rule"], edges=[("web", "db", "1433 only"), ("rule", "db")], learn=[3]),
     S("recap", "Recap", "NSGs", "Lowest number first; both NSGs must agree.",
       recap=["Priority 100–4096; first match wins; stateful", "Defaults: deny inbound internet, allow outbound internet", "Subnet then NIC inbound; NIC then subnet outbound",
              "ASGs group NICs by role", "Service tags for Azure ranges"])])

LAB["az104-nsg-asg"] = H(
    "Write NSG rules with an ASG and read the effective rules", 30, "low", VM_COST,
    [BASE, NEW_RG, VNET, VM_IN_VNET],
    [(f"Search 'Application security groups' > + Create. Group {RG}, name asg-web, region {REGION}. Create.", None),
     ("Open vm-lab > Networking > Application security groups > Add application security groups > asg-web. Save.", "asg-web listed on the VM's NIC."),
     ("Open the VM's NIC NSG (vm-lab-nsg) > Inbound security rules > + Add. Source: Any, destination: Application security group asg-web, port 80, TCP, Allow, priority 200, name allow-http-web. Add.", None),
     ("Add another rule: destination asg-web, port 80, TCP, Deny, priority 100, name deny-http-test.", None),
     ("Open Network Watcher > IP flow verify: vm-lab, inbound, TCP, local port 80, remote IP 198.51.100.1, port 40000.", "Denied by deny-http-test: priority 100 is checked before 200."),
     ("Delete deny-http-test and run IP flow verify again.", "Allowed by allow-http-web."),
     (f"Create an NSG nsg-subnet in {RG} and associate it with snet-app (NSG > Subnets > Associate). Run IP flow verify again.", "Denied: the subnet NSG has only default rules, so it blocks port 80 before the NIC NSG is checked."),
     ("Open vm-lab > Networking > Effective security rules.", "Two sections, one for the subnet NSG and one for the NIC NSG.")],
    ["You saw priority order and the two-NSG rule in action."],
    [DELETE_RG],
    [("Create, change or delete an NSG", ML + "azure/virtual-network/manage-network-security-group"),
     ("Filter network traffic with an NSG (with ASGs)", ML + "azure/virtual-network/tutorial-filter-network-traffic"),
     ("How network security groups filter traffic", ML + "azure/virtual-network/network-security-group-how-it-works")])

# ---------------------------------------------------------------- 4.2 Bastion
WALK["az104-bastion"] = walk(
    "Connect to VMs with RDP or SSH from the browser, without giving them public IPs.",
    ["Why not open RDP/SSH to the internet", "How Bastion works", "SKUs and what they add", "Subnet and NSG requirements"],
    [N("admin", "Admin browser", 120, 220, "user", "HTTPS 443"), N("bas", "Azure Bastion", 380, 220, "security", "AzureBastionSubnet"), N("vm1", "VM (no public IP)", 650, 120, "compute"),
     N("vm2", "VM (no public IP)", 650, 320, "compute"), N("bad", "Open RDP 3389", 380, 380, "security", "attacked")],
    [S("problem", "Exposed", "RDP open to the world",
       "Opening RDP or SSH on a public IP invites password-guessing attacks around the clock.",
       add=["admin", "bad"], edges=[("admin", "bad")]),
     S("concept", "Bastion", "Bastion is a managed jump box",
       "Azure Bastion runs in your VNet. You open the portal, select Connect > Bastion, and get an RDP or SSH session in the browser over TLS (port 443). The VMs need only private IPs.",
       add=["bas", "vm1", "vm2"], hide=["bad"], edges=[("admin", "bas", "443"), ("bas", "vm1", "RDP/SSH"), ("bas", "vm2")], learn=[0, 1]),
     S("concept", "SKUs", "Bastion SKUs",
       "Developer: free, shared, one VM connection at a time, for dev and test. Basic: dedicated host. Standard: adds native client (connect from your own RDP/SSH app), shareable links, host scaling, IP-based connection. Premium: adds session recording and private-only deployment.",
       learn=[2], tip="Native client support requires Standard or Premium."),
     S("technique", "Network", "What Bastion needs",
       "Basic and higher need a subnet named exactly AzureBastionSubnet, size /26 or larger, and a Standard public IP (except private-only Premium). The target VMs' NSGs must allow RDP/SSH from the Bastion subnet.",
       focus=["bas"], learn=[3], warn="Wrong subnet name or a subnet smaller than /26 = deployment fails."),
     S("recap", "Recap", "Bastion", "Browser RDP/SSH, no public IPs on VMs.",
       recap=["No RDP/SSH exposed to the internet", "Sessions over HTTPS 443 in the browser", "Developer, Basic, Standard (native client), Premium (recording)",
              "AzureBastionSubnet, /26 or larger", "VM NSGs must allow from the Bastion subnet"])])

LAB["az104-bastion"] = H(
    "Connect to a VM with no public IP through Bastion", 25, "watch", VM_COST + " Bastion Developer is free where offered; otherwise Basic costs about US$0.19 per hour, so delete it straight after.",
    [BASE, NEW_RG, VNET, VM_IN_VNET],
    [("Open vm-lab > Connect > Connect via Bastion (or Bastion in the menu).", "Options to deploy Bastion. If 'Deploy Bastion Developer' is offered, choose it (free, no extra subnet)."),
     ("If Developer is not offered: open vnet-lab > Subnets > + Subnet, purpose Azure Bastion (name AzureBastionSubnet), range 10.10.3.0/26. Then deploy Bastion Basic from the VM's Bastion page.", "Deployment takes 5–10 minutes."),
     ("When Bastion is ready, enter azureuser and the VM's password, and Connect.", "A new browser tab with a Linux terminal on vm-lab."),
     ("In that terminal type: hostname && ip addr", "The VM's name and its private IP 10.10.1.x. It has no public IP."),
     ("Open the Bastion resource > Settings > Configuration.", "The tier and the features available, such as native client support and shareable link (Standard+).")],
    ["You opened an SSH session to a VM that has no public IP."],
    ["Delete the Bastion resource right away if it is Basic or higher (billed hourly).", DELETE_RG],
    [("Quickstart: deploy Bastion Developer", ML + "azure/bastion/quickstart-developer"),
     ("Tutorial: deploy Bastion with specified settings", ML + "azure/bastion/tutorial-create-host-portal"),
     ("Bastion configuration settings and SKUs", ML + "azure/bastion/configuration-settings")])

# ---------------------------------------------------------------- 4.2 service and private endpoints
WALK["az104-service-private-endpoints"] = walk(
    "Reach Azure services like Storage and SQL privately from your VNet.",
    ["Service endpoints", "Private endpoints and Private Link", "Private DNS for private endpoints", "Choosing between them"],
    [N("vm", "VM in subnet", 120, 220, "compute"), N("se", "Service endpoint", 380, 90, "network", "on the subnet"), N("pe", "Private endpoint", 380, 330, "network", "10.10.1.5"),
     N("sa", "Storage account", 660, 220, "storage", "public endpoint"), N("dns", "Private DNS zone", 660, 380, "network", "privatelink.blob...")],
    [S("problem", "Public path", "The VM reaches Storage over its public endpoint",
       "Security wants storage reachable only from your network, and ideally not over the internet at all.",
       add=["vm", "sa"], edges=[("vm", "sa", "public endpoint")]),
     S("technique", "Service endpoint", "Service endpoints: trusted subnet",
       "Enable a service endpoint (for example Microsoft.Storage) on a subnet. Traffic to that service goes over the Azure backbone with the subnet's identity, and the storage firewall can allow just that subnet. The service still uses its public IP address. Free.",
       add=["se"], edges=[("vm", "se"), ("se", "sa", "VNet rule")], learn=[0]),
     S("technique", "Private endpoint", "Private endpoints: a private IP for the service",
       "A private endpoint is a NIC in your subnet with a private IP that maps to one resource (for example the blob service of one account). It works from peered VNets and on-premises too, and you can then disable public access completely. Billed per hour and per GB.",
       add=["pe"], edges=[("vm", "pe"), ("pe", "sa", "Private Link")], learn=[1]),
     S("technique", "DNS", "Make the name point to the private IP",
       "The account name must resolve to the private IP. A private DNS zone such as privatelink.blob.core.windows.net, linked to the VNet, does this; the portal can create it for you.",
       add=["dns"], edges=[("dns", "pe", "A record")], learn=[2], warn="Private endpoint created but traffic still goes public? Almost always DNS."),
     S("case", "Choose", "Which one?",
       "Need on-premises or peered access, or no public endpoint at all: private endpoint. Simple and free subnet restriction: service endpoint.",
       learn=[3]),
     S("recap", "Recap", "Endpoints", "Service endpoint: trusted subnet. Private endpoint: private IP.",
       recap=["Service endpoint: per subnet, free, public IP still used", "Private endpoint: private IP for one resource", "Private DNS zone privatelink.* must resolve the name",
              "Private endpoints work from peered VNets and on-premises", "Disable public access once private"])])

LAB["az104-service-private-endpoints"] = H(
    "Add a private endpoint to a storage account and check DNS", 30, "low", VM_COST + " A private endpoint costs about US$0.01 per hour.",
    [BASE, NEW_RG, VNET, VM_IN_VNET, f"A storage account in {RG}."],
    [(RUN_CMD + " Run: nslookup <storageaccount>.blob.core.windows.net", "A public IP address in the answer."),
     ("Open vnet-lab > Subnets > snet-app. Under Service endpoints add Microsoft.Storage. Save.", None),
     ("Open the storage account > Networking > 'Enabled from selected virtual networks and IP addresses' > + Add existing virtual network: vnet-lab / snet-app. Save.", "The subnet listed with endpoint status Enabled."),
     ("Open the storage account > Networking > Private endpoint connections > + Private endpoint. Name pe-blob, target sub-resource: blob, VNet vnet-lab, subnet snet-app, integrate with private DNS zone: Yes. Create.", "Deployment creates a private endpoint, a NIC and a private DNS zone privatelink.blob.core.windows.net."),
     ("Repeat the nslookup Run command on vm-lab.", "The name now resolves through privatelink.blob.core.windows.net to a private 10.10.1.x address."),
     ("Open the private DNS zone > Recordsets.", "An A record for your storage account pointing to the private IP."),
     ("On the storage account Networking page set Public network access to Disabled. Save.", "Only the private endpoint can reach it now; the portal's data browser from your PC will be blocked.")],
    ["The storage name resolves to a private IP from inside the VNet."],
    [DELETE_RG],
    [("Tutorial: connect to a storage account using a private endpoint", ML + "azure/private-link/tutorial-private-endpoint-storage-portal"),
     ("Virtual network service endpoints", ML + "azure/virtual-network/virtual-network-service-endpoints-overview"),
     ("Private endpoint DNS configuration", ML + "azure/private-link/private-endpoint-dns")])

# ---------------------------------------------------------------- 4.3 Azure DNS
WALK["az104-azure-dns"] = walk(
    "Host your domain's DNS in Azure, and give VMs friendly private names.",
    ["Public DNS zones and records", "Delegating a domain to Azure DNS", "Private DNS zones and VNet links", "Auto-registration and alias records"],
    [N("user", "Internet user", 120, 90, "user"), N("reg", "Domain registrar", 380, 90, "service", "NS → Azure"), N("pub", "Public zone", 640, 90, "network", "contoso.com"),
     N("vm", "VM in VNet", 120, 330, "compute"), N("priv", "Private zone", 380, 330, "network", "contoso.internal"), N("link", "VNet link", 640, 330, "network", "auto-registration")],
    [S("problem", "Names", "People and apps use names, not IPs",
       "Customers type contoso.com. VMs should find db01 by name, and the names must update when IPs change.",
       add=["user"]),
     S("concept", "Public zone", "Public DNS zones",
       "A public zone holds the records for a domain: A and AAAA (addresses), CNAME (alias name), MX (mail), TXT (verification), plus NS and SOA created automatically. Azure DNS hosts the zone; it does not sell domains.",
       add=["pub"], learn=[0]),
     S("technique", "Delegate", "Delegate the domain to Azure",
       "At your registrar, replace the domain's name servers with the four Azure name servers shown on the zone. For a subdomain, add NS records in the parent zone.",
       add=["reg"], edges=[("user", "reg", "who serves contoso.com?"), ("reg", "pub", "NS records")], learn=[1]),
     S("technique", "Private zone", "Private DNS zones for VNets",
       "A private zone resolves names only inside VNets that are linked to it. Turn on auto-registration on a link and VMs' names are added and updated automatically (one auto-registration zone per VNet).",
       add=["vm", "priv", "link"], edges=[("vm", "priv", "db01.contoso.internal"), ("link", "priv")], learn=[2]),
     S("technique", "Alias", "Alias records follow Azure resources",
       "An alias record points at an Azure resource (public IP, Traffic Manager, Front Door) instead of a fixed address, and updates when the resource changes. It can also be used at the zone apex, where CNAMEs are not allowed.",
       learn=[3], tip="Azure-provided DNS (168.63.129.16) is what VMs use by default."),
     S("recap", "Recap", "Azure DNS", "Public zones for the internet; private zones for VNets.",
       recap=["Records: A, AAAA, CNAME, MX, TXT, NS, SOA", "Delegate by changing NS at the registrar", "Private zones work only in linked VNets",
              "Auto-registration adds VM records", "Alias records track Azure resources, even at the apex"])])

LAB["az104-azure-dns"] = H(
    "Create public and private DNS zones and query them", 25, "low", VM_COST + " Each DNS zone costs about US$0.50 per month.",
    [BASE, NEW_RG, VNET, VM_IN_VNET],
    [(f"Search 'DNS zones' > + Create. Group {RG}, name lab<yourinitials>.com (any name; you do not need to own it). Create.", "The zone with four name servers like ns1-01.azure-dns.com."),
     ("Open the zone > + Record set. Name www, type A, IP 203.0.113.10, TTL 1 hour. Add.", "www listed with the IP."),
     ("Cloud Shell: nslookup www.lab<yourinitials>.com <first name server from the zone>", "The answer 203.0.113.10, straight from Azure DNS."),
     (f"Search 'Private DNS zones' > + Create. Group {RG}, name contoso.internal. Create.", None),
     ("Open contoso.internal > DNS Management > Virtual network links > + Add. Name link-lab, VNet vnet-lab, tick 'Enable auto registration'. Create.", None),
     ("Open contoso.internal > Recordsets after a minute.", "An A record for vm-lab with its private IP, added automatically."),
     (RUN_CMD + " Run: nslookup vm-lab.contoso.internal", "The VM's private IP, resolved by Azure-provided DNS.")],
    ["The public zone answers for www; the private zone auto-registered the VM."],
    [DELETE_RG],
    [("Quickstart: create a DNS zone and record in the portal", ML + "azure/dns/dns-getstarted-portal"),
     ("Quickstart: create a private DNS zone in the portal", ML + "azure/dns/private-dns-getstarted-portal"),
     ("Delegate a domain to Azure DNS", ML + "azure/dns/dns-delegate-domain-azure-dns")])

# ---------------------------------------------------------------- 4.3 load balancer
WALK["az104-load-balancer"] = walk(
    "Spread traffic across several VMs, and fix it when it stops working.",
    ["Public vs internal load balancers", "Frontend, backend pool, health probe, rule", "Session persistence and NAT rules", "Troubleshooting probes and NSGs", "Load Balancer vs Application Gateway"],
    [N("users", "Users", 110, 220, "user"), N("fe", "Frontend IP", 320, 220, "network", "public or private"), N("rule", "LB rule", 520, 100, "network", "TCP 80 → 80"),
     N("probe", "Health probe", 520, 340, "service", "HTTP /health"), N("vm1", "VM 1", 700, 160, "compute"), N("vm2", "VM 2", 700, 290, "compute")],
    [S("problem", "One server", "One web server cannot handle the load, or survive a failure",
       "You add a second VM. Now something must share the traffic and stop sending it to a VM that is down.",
       add=["users", "vm1"], edges=[("users", "vm1")]),
     S("concept", "Types", "Azure Load Balancer works at layer 4",
       "It balances TCP and UDP traffic, without looking at URLs. A public load balancer has a public frontend IP for internet traffic; an internal one has a private frontend IP for traffic inside the VNet. Standard SKU is the one to use (Basic was retired).",
       add=["fe", "vm2"], hide=[], edges=[("users", "fe")], learn=[0]),
     S("technique", "Parts", "Four parts to configure",
       "Frontend IP configuration; backend pool (the VMs or scale set); health probe (TCP, HTTP or HTTPS check, every few seconds); load-balancing rule (frontend port to backend port, using a probe).",
       add=["rule", "probe"], edges=[("fe", "rule"), ("rule", "vm1"), ("rule", "vm2"), ("probe", "vm1"), ("probe", "vm2")], learn=[1]),
     S("technique", "Options", "Persistence and NAT rules",
       "Session persistence: None (spread every connection), Client IP, or Client IP and protocol (keep a user on one VM). Inbound NAT rules forward a port to one specific VM, for example 50001 to VM 1 port 22. Outbound rules give the backend VMs internet access.",
       learn=[2]),
     S("case", "Troubleshoot", "Case: the load balancer returns nothing",
       "Check: is the health probe passing? (The app must answer on the probe port and path.) Does the VM's NSG allow the traffic, and the AzureLoadBalancer service tag for the probe? Standard load balancers are closed by default, so an NSG must allow the client traffic. Is the VM in the backend pool?",
       focus=["probe"], learn=[3], warn="All probes failing = no traffic is sent anywhere."),
     S("concept", "Compare", "When to use something else",
       "Need URL paths, TLS termination or a web application firewall: Application Gateway (layer 7, regional). Global HTTP with caching: Front Door. DNS-based global routing: Traffic Manager.",
       learn=[4]),
     S("recap", "Recap", "Load Balancer", "Frontend, pool, probe, rule.",
       recap=["Layer 4; public or internal; Standard SKU", "Frontend, backend pool, health probe, rule", "Persistence: None / Client IP / Client IP + protocol",
              "Probes and NSGs are the usual problems", "Layer 7 needs: Application Gateway"])])

LAB["az104-load-balancer"] = H(
    "Balance two web VMs and break the health probe", 45, "watch", "About US$0.05 per hour for two B1s VMs, a Standard load balancer and a public IP. Do it in one sitting and delete straight after.",
    [BASE, NEW_RG, VNET],
    [("Create two VMs, vm-web1 and vm-web2, in vnet-lab / snet-app (Ubuntu 24.04, Standard_B1s, no public IP, NIC NSG Basic, inbound ports None).", None),
     (RUN_CMD + " On each VM run the command in the box. It starts a tiny web server with Python, which Ubuntu already has, so no internet access is needed.", "The command completes. Each VM now serves a page with its own name on port 80.", None,
      "sudo mkdir -p /srv/web && echo \"Hello from $(hostname)\" | sudo tee /srv/web/index.html && sudo systemd-run --unit web python3 -m http.server 80 --directory /srv/web"),
     (f"Search 'Load balancers' > + Create. Group {RG}, name lb-lab, SKU Standard, type Public, tier Regional.", None),
     ("Frontend IP configuration: add fe-lab with a new public IP pip-lb. Backend pools: add pool-web, vnet-lab, add both VMs' NICs.", None),
     ("Inbound rules: add a load balancing rule: frontend fe-lab, port 80, backend port 80, pool-web, new health probe HTTP port 80 path /. Session persistence: None. Review + create > Create.", "Deployment completes."),
     ("On each VM's NSG add an inbound rule allowing TCP 80 from Any (priority 300).", "Standard load balancers are secure by default: without this the page never loads."),
     ("Browse to the load balancer's public IP and refresh a few times (or use curl from Cloud Shell).", "'Hello from vm-web1' and 'Hello from vm-web2' alternate."),
     (RUN_CMD + " On vm-web1 run: sudo systemctl stop web", "After about 15 seconds every request goes to vm-web2: the probe marked vm-web1 unhealthy."),
     ("Open lb-lab > Monitoring > Insights or Metrics > Health Probe Status.", "Probe status dropping for one backend.")],
    ["Traffic was shared across both VMs, then moved away from the failed one."],
    ["Delete the resource group now: this lab is billed hourly.", DELETE_RG],
    [("Quickstart: create a public load balancer in the portal", ML + "azure/load-balancer/quickstart-load-balancer-standard-public-portal"),
     ("Health probes", ML + "azure/load-balancer/load-balancer-custom-probe-overview"),
     ("Troubleshoot Azure Load Balancer", ML + "azure/load-balancer/load-balancer-troubleshoot"),
     ("Load-balancing options", ML + "azure/architecture/guide/technology-choices/load-balancing-overview")])
