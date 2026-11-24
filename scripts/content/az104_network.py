"""AZ-104 Domain 4 (remaining): peering, public IPs, UDRs, connectivity troubleshooting, Bastion,
service and private endpoints, Azure DNS and Azure Load Balancer."""
from builder import animation, lesson, q

E = "az-104"
ML = "https://learn.microsoft.com/azure/"
T = "frontend/src/simulations/groups/network.test.ts"
_n = {"i": 0}


def qa(obj, diff, typ, stem, opts, correct, expl, doc, code=None):
    _n["i"] += 1
    L = "abcdefgh"
    mode = "ordering" if typ == "ordering" else "multiple" if len(correct) > 1 else "single"
    args = [f"az104-q-net-{_n['i']}", E, obj, diff, typ, mode, stem]
    if code:
        args.append(code)
    q(*args, [(L[i], o[0], o[1]) for i, o in enumerate(opts)], list(correct), expl, [doc])


def cfg(portal, cli, ps, prereq=("An Azure subscription and a resource group (rg-net)",), perms=("Network Contributor on the resource group",), limits=(), bicep=None):
    d = dict(prerequisites=list(prereq), permissions=list(perms), limits=list(limits) or ["See Azure networking limits in the subscription service limits page"], portal=portal, cli=cli, powershell=ps)
    if bicep:
        d["bicep"] = bicep
    return d


def lab(objective, steps, expected, validation, failures, duration=15, cost="None. The simulation runs entirely in the browser."):
    return dict(type="A", objective=objective, duration=duration, steps=steps, expected=expected, validation=validation, failures=failures, cost=cost)


animation("network-routing-sim", "Peering, public IPs, user-defined routes and connectivity troubleshooting", E, ["AZ104-4.1.2", "AZ104-4.1.3", "AZ104-4.1.4", "AZ104-4.1.5"], "accurate-model", T,
          "Hub-and-spoke peering with transitivity and gateway transit, public IP SKU rules, longest-prefix route selection through an NVA, and Network Watcher tools against hidden faults.")
animation("network-access-sim", "Azure Bastion, service endpoints and private endpoints", E, ["AZ104-4.2.3", "AZ104-4.2.4", "AZ104-4.2.5"], "accurate-model", T,
          "Bastion SKU/subnet validation, and storage access through service endpoints or private endpoints with DNS and firewall evaluation.")
animation("dns-lb-sim", "Azure DNS and Azure Load Balancer", E, ["AZ104-4.3.1", "AZ104-4.3.2", "AZ104-4.3.3"], "accurate-model", T,
          "Public zone delegation and record rules, private zones with links and autoregistration, and a Standard load balancer with probes, NSGs and failing backends.")

PEER = ML + "virtual-network/virtual-network-peering-overview"
PIP = ML + "virtual-network/ip-services/public-ip-addresses"
UDR = ML + "virtual-network/virtual-networks-udr-overview"
NW = ML + "network-watcher/network-watcher-overview"
BAS = ML + "bastion/bastion-overview"
SE = ML + "virtual-network/virtual-network-service-endpoints-overview"
PE = ML + "private-link/private-endpoint-overview"
PEDNS = ML + "private-link/private-endpoint-dns"
DNS = ML + "dns/dns-overview"
PDNS = ML + "dns/private-dns-overview"
LB = ML + "load-balancer/load-balancer-overview"
PROBE = ML + "load-balancer/load-balancer-custom-probe-overview"

# ================================================================ 4.1.2 Peering
lesson(
    id="az104-vnet-peering", exam=E, title="Virtual network peering", objectives=["AZ104-4.1.2"], minutes=40,
    objective="Create and configure regional and global VNet peering, including hub-and-spoke designs with gateway transit and forwarded traffic.",
    prereqs=[("Virtual networks and subnets", "AZ104-4.1.1", "az104-vnet-subnets")],
    foundation=["Peering connects two virtual networks so their resources talk using private IP addresses over the Microsoft backbone, as if they were one network.",
                "Peering works within a region (regional) or across regions (global). The two address spaces must not overlap.",
                "Peering is not transitive: if A is peered with Hub and Hub with B, A still cannot reach B on its own."],
    engineer=["A peering is two links, one in each VNet. Status is Initiated until both exist, then Connected. The portal creates both links in one step when you have permissions on both VNets; with the CLI you create each side.",
              "Settings per link: Allow access to the remote VNet, Allow forwarded traffic (accept traffic that an NVA in the other VNet forwards, not originated there), Allow gateway transit (on the hub: let peers use this VNet's VPN/ExpressRoute gateway), Use remote gateways (on the spoke: use the hub's gateway; the spoke must not have its own gateway).",
              "Spoke-to-spoke traffic needs a hub NVA or Azure Firewall plus UDRs in the spokes, or Azure Virtual Network Manager connectivity configurations, or Virtual WAN.",
              "Peering works across subscriptions and Microsoft Entra tenants (with permissions on both sides). Address spaces of peered VNets can be resized after peering, followed by a sync of the peering.",
              "Costs: peering traffic is charged per GB for both ingress and egress; global peering charges are higher."],
    anim=("network-routing-sim", "VNet peering tab: hub-and-spoke reachability, gateway transit and overlapping spaces."),
    diagram=([("hub", "vnet-hub 10.0.0.0/16 (VPN gateway, NVA)", 300, 20, "network"), ("s1", "vnet-spoke1 10.1.0.0/16", 80, 160, "network"), ("s2", "vnet-spoke2 10.2.0.0/16", 520, 160, "network"), ("op", "On-premises", 300, 260, "globe")],
             [("s1", "hub", "peering"), ("s2", "hub", "peering"), ("hub", "op", "VPN")]),
    example=("Shared services hub", ["Contoso runs domain controllers and a VPN gateway in vnet-hub. Each app team has a spoke peered to the hub with Use remote gateways, so spokes reach on-premises through one gateway.",
                                     "Spokes are isolated from each other until the security team adds Azure Firewall in the hub and UDRs sending 10.0.0.0/8 to it."]),
    config=cfg(["vnet-spoke1 > Peerings > Add.", "Enter both link names, choose the remote VNet, set allow access, forwarded traffic, gateway transit or use remote gateways.", "Check Peering status is Connected on both VNets."],
               "az network vnet peering create -g rg-net -n spoke1-to-hub --vnet-name vnet-spoke1 --remote-vnet vnet-hub --allow-vnet-access --allow-forwarded-traffic --use-remote-gateways\naz network vnet peering create -g rg-net -n hub-to-spoke1 --vnet-name vnet-hub --remote-vnet vnet-spoke1 --allow-vnet-access --allow-gateway-transit\naz network vnet peering list -g rg-net --vnet-name vnet-hub -o table",
               "$hub = Get-AzVirtualNetwork -Name vnet-hub -ResourceGroupName rg-net\n$sp = Get-AzVirtualNetwork -Name vnet-spoke1 -ResourceGroupName rg-net\nAdd-AzVirtualNetworkPeering -Name hub-to-spoke1 -VirtualNetwork $hub -RemoteVirtualNetworkId $sp.Id -AllowGatewayTransit\nAdd-AzVirtualNetworkPeering -Name spoke1-to-hub -VirtualNetwork $sp -RemoteVirtualNetworkId $hub.Id -UseRemoteGateways -AllowForwardedTraffic",
               limits=["500 peerings per VNet (more with Azure Virtual Network Manager)", "Address spaces must not overlap", "Use remote gateways requires the remote VNet to have a gateway and the local VNet to have none"],
               perms=["Network Contributor (or Microsoft.Network/virtualNetworks/virtualNetworkPeerings/write) on both VNets"]),
    lab=lab("Build hub-and-spoke peering and prove it is non-transitive.", ["Run the default spoke1 → spoke2 test and read why it fails.", "Apply 'Spoke to spoke via hub NVA'.", "Apply 'On-premises via gateway transit'.", "Apply 'Overlapping address space' and 'Only one side created'."],
            ["Spoke-to-spoke fails without an NVA", "Gateway transit reaches on-premises", "Overlap and one-sided peering fail"],
            [("peering-connected", "Connected a spoke to the hub"), ("peering-transit-nva", "Routed spoke to spoke via the hub NVA"), ("peering-gateway-transit", "Used gateway transit"), ("peering-failed", "Diagnosed a failed peering")],
            ["Overlapping address spaces", "Peering created on one side only", "Expecting transitive routing"]),
    troubleshooting=[("Peering status stays Initiated.", "Only one link exists.", "Create the peering from the remote VNet too."), ("Spoke1 cannot reach spoke2.", "Peering is not transitive.", "Add a hub NVA/Firewall with UDRs, or peer the spokes directly."),
                     ("Spoke cannot reach on-premises.", "Gateway transit not configured.", "Hub: Allow gateway transit; spoke: Use remote gateways."), ("Cannot create peering.", "Address spaces overlap.", "Re-address one VNet.")],
    comparisons=[("VPN gateway VNet-to-VNet", "Encrypted IPsec tunnel through gateways with bandwidth limits; peering is lower latency and higher bandwidth."), ("AWS VPC peering", "Also non-transitive; AWS Transit Gateway is the hub equivalent.")],
    misconceptions=[("Peering is transitive through a hub.", "It is not; use an NVA, Virtual WAN or direct peerings."), ("Global peering traffic is free.", "Peering is billed per GB in and out.")],
    decisions=["Use hub-and-spoke with a central firewall for shared services and inspection.", "Plan non-overlapping address spaces up front.", "Consider Azure Virtual Network Manager for many spokes."],
    docs=[("Virtual network peering", PEER), ("Configure gateway transit", ML + "vpn-gateway/vpn-gateway-peering-gateway-transit"), ("Hub-spoke topology", "https://learn.microsoft.com/azure/architecture/networking/architecture/hub-spoke")],
)
qa("AZ104-4.1.2", 2, "scenario", "VNet A is peered with Hub, and Hub with VNet B. VMs in A can't reach B. Why?", [("VNet peering is not transitive", "Correct."), ("NSGs block all peering traffic by default", "Default rules allow VirtualNetwork traffic."), ("Global peering is required", "Unrelated."), ("Peering needs public IPs", "No.")], "a", "Add an NVA/Firewall with UDRs or peer A and B directly.", PEER)
qa("AZ104-4.1.2", 2, "configuration", "Spokes must use the VPN gateway in the hub. Which settings are required?", [("Hub link: Allow gateway transit; spoke link: Use remote gateways", "Correct."), ("Spoke link: Allow gateway transit; hub link: Use remote gateways", "Reversed."), ("Allow forwarded traffic only", "Not for gateways."), ("Deploy a gateway in every spoke", "Then Use remote gateways cannot be set.")], "a", "Gateway transit is set on the hub; use remote gateways on the spoke.", PEER)
qa("AZ104-4.1.2", 2, "troubleshooting", "You created a peering from vnet-a to vnet-b with Azure CLI. Its status is Initiated. What do you do?", [("Create the peering from vnet-b to vnet-a", "Correct."), ("Delete and recreate it with a /8", "No."), ("Enable IP forwarding", "Unrelated."), ("Wait 24 hours", "It won't change on its own.")], "a", "Both links are needed for Connected.", PEER)
qa("AZ104-4.1.2", 1, "single", "Which statement about VNet peering is true?", [("Peered VNets can be in different regions and subscriptions", "Correct."), ("Address spaces may overlap", "They must not."), ("Traffic goes over the public internet", "Microsoft backbone."), ("Peering is free of data charges", "Billed per GB.")], "a", "Global and cross-subscription peering are supported.", PEER)

# ================================================================ 4.1.3 Public IPs
lesson(
    id="az104-public-ip", exam=E, title="Public IP addresses", objectives=["AZ104-4.1.3"], minutes=30,
    objective="Create and configure public IP addresses and prefixes, choosing SKU, assignment, tier and zone settings, and associate them with resources.",
    prereqs=[("Virtual networks and subnets", "AZ104-4.1.1", "az104-vnet-subnets")],
    foundation=["A public IP address lets internet clients reach an Azure resource (or lets it be identified on the internet).", "You can attach public IPs to VM NICs, load balancers, application gateways, VPN gateways, NAT gateways, Azure Firewall and Bastion."],
    engineer=["SKU: Standard is the only SKU for new deployments (Basic public IPs were retired on 30 September 2025). Standard IPs use static assignment, are secure by default (closed to inbound until an NSG allows traffic) and support availability zones.",
              "Zones: zone-redundant (survives zone failure), zonal (pinned to one zone) or no zone. The zone setting can't be changed after creation.",
              "Tier: Regional or Global (Global is used with the cross-region load balancer). Routing preference: Microsoft network (default) or Internet (cheaper, uses ISP networks).",
              "Public IP prefixes reserve a contiguous range (for example /28) of static addresses for allow-listing. IP addresses are billed per hour, whether or not they're associated.",
              "Associate or dissociate a public IP on a NIC's IP configuration. A VM can have a public IP per IP configuration; for outbound-only internet access prefer a NAT gateway."],
    anim=("network-routing-sim", "Public IP addresses tab: SKU, assignment, zones and inbound access."),
    diagram=([("pip", "pip-web (Standard, static, zone-redundant)", 60, 120, "globe"), ("nic", "NIC ipconfig1", 330, 120, "network"), ("nsg", "NSG allow 443", 330, 20, "security"), ("vm", "vm-web", 560, 120, "compute")], [("pip", "nic"), ("nsg", "nic"), ("nic", "vm")]),
    example=("A partner allow-list", ["A partner must allow-list Contoso's outbound addresses. Contoso creates a /30 public IP prefix and assigns its addresses to a NAT gateway, so all outbound traffic uses four known IPs."]),
    config=cfg(["Create a resource > Public IP address: choose SKU Standard, tier Regional, zone-redundant, IP version IPv4.", "VM > Networking > NIC > IP configurations > ipconfig1 > associate the public IP.", "Public IP prefixes > Create to reserve a range."],
               "az network public-ip create -g rg-net -n pip-web --sku Standard --allocation-method Static --zone 1 2 3\naz network nic ip-config update -g rg-net --nic-name vm-web-nic -n ipconfig1 --public-ip-address pip-web\naz network public-ip prefix create -g rg-net -n ippre-out --length 30",
               "New-AzPublicIpAddress -ResourceGroupName rg-net -Name pip-web -Location eastus -Sku Standard -AllocationMethod Static -Zone 1,2,3\n$nic = Get-AzNetworkInterface -Name vm-web-nic -ResourceGroupName rg-net\n$nic.IpConfigurations[0].PublicIpAddress = Get-AzPublicIpAddress -Name pip-web -ResourceGroupName rg-net\n$nic | Set-AzNetworkInterface",
               limits=["Public IP quota per region (default varies by subscription)", "Zone and SKU cannot be changed after creation"]),
    lab=lab("Configure a Standard public IP correctly.", ["Run the default Basic/dynamic configuration.", "Apply 'Standard without NSG' and read why inbound fails.", "Apply 'Standard, static, zone-redundant + NSG'."], ["Standard is static and secure by default"],
            [("pip-configured", "Configured a reachable Standard public IP"), ("pip-error", "Diagnosed a public IP misconfiguration")], ["Basic SKU", "No NSG on a Standard IP", "Dynamic assignment on Standard"], duration=10),
    troubleshooting=[("VM with a Standard public IP is unreachable.", "Standard is closed to inbound by default.", "Add an NSG rule allowing the port."), ("Cannot attach the public IP to a Standard load balancer.", "SKU mismatch.", "Use Standard SKU for both."),
                     ("Public IP changed after a deallocation.", "It was dynamic (legacy Basic).", "Use a static Standard IP.")],
    comparisons=[("NAT gateway", "Outbound-only internet access for a subnet with static public IPs; no inbound."), ("AWS Elastic IP", "Static public IPv4 assigned to an instance or NAT gateway.")],
    misconceptions=[("Public IPs are free when not attached.", "Public IPv4 addresses are billed hourly."), ("A Standard public IP is open to the internet.", "Inbound is denied until an NSG allows it.")],
    decisions=["Avoid public IPs on VMs; use Bastion for admin and load balancers or Application Gateway for apps.", "Use zone-redundant Standard IPs for production.", "Use a prefix for stable allow-listed ranges."],
    docs=[("Public IP addresses", PIP), ("Public IP address prefix", ML + "virtual-network/ip-services/public-ip-address-prefix"), ("Upgrade Basic public IPs", ML + "virtual-network/ip-services/public-ip-basic-upgrade-guidance")],
)
qa("AZ104-4.1.3", 2, "troubleshooting", "A new VM has a Standard public IP, but you can't reach its website on 443. What's the likely cause?", [("No NSG rule allows inbound 443", "Correct: Standard IPs are secure by default."), ("Standard IPs are outbound-only", "No."), ("The IP is dynamic", "Standard is static."), ("The VM needs a Basic IP", "Basic is retired.")], "a", "Allow the port in an NSG.", PIP)
qa("AZ104-4.1.3", 2, "single", "Which assignment method does a Standard SKU public IPv4 address use?", [("Static only", "Correct."), ("Dynamic only", "No."), ("Either", "That was Basic."), ("DHCP from the VNet", "No.")], "a", "Standard public IPs are always static.", PIP)
qa("AZ104-4.1.3", 2, "scenario", "A partner needs a small, contiguous, fixed set of your outbound IPs for an allow-list. What do you create?", [("A public IP prefix (for example /30) used by a NAT gateway", "Correct."), ("Four Basic dynamic IPs", "Retired and changing."), ("A private endpoint", "Private IP."), ("A service endpoint", "Not for outbound internet IPs.")], "a", "Prefixes give contiguous static ranges.", ML + "virtual-network/ip-services/public-ip-address-prefix")

# ================================================================ 4.1.4 UDR
lesson(
    id="az104-udr", exam=E, title="User-defined routes", objectives=["AZ104-4.1.4"], minutes=40,
    objective="Create route tables and user-defined routes, associate them with subnets, and predict which route Azure selects.",
    prereqs=[("Virtual network peering", "AZ104-4.1.2", "az104-vnet-peering")],
    foundation=["Azure automatically routes traffic between subnets, peered VNets, on-premises and the internet using system routes.", "A user-defined route (UDR) overrides that, for example to send all traffic through a firewall."],
    engineer=["Route table: a resource with routes (address prefix → next hop type), associated with one or more subnets (in the same region and subscription). A subnet has at most one route table.",
              "Next hop types: Virtual appliance (an IP address of an NVA or Azure Firewall), Virtual network gateway, Virtual network, Internet, None (drop).",
              "Selection: longest prefix match first; if prefixes are equal, user-defined routes win over BGP routes, which win over system routes.",
              "An NVA must have IP forwarding enabled on its NIC (and forwarding in its OS) to pass traffic for other destinations.",
              "Propagate gateway routes: disable it on a route table to stop BGP routes from on-premises being added to a subnet (for example to force everything through the firewall).",
              "Service tags can be used as the address prefix of a route (for example Storage)."],
    anim=("network-routing-sim", "User-defined routes tab: winning route per destination and NVA forwarding."),
    diagram=([("app", "snet-app", 40, 120, "compute"), ("rt", "rt-app: 0.0.0.0/0 → 10.1.0.4", 220, 20, "network"), ("nva", "Firewall NVA 10.1.0.4", 300, 120, "security"), ("db", "snet-db", 560, 60, "storage"), ("net", "Internet", 560, 190, "globe")],
             [("rt", "app", "associated"), ("app", "nva"), ("nva", "db"), ("nva", "net")]),
    example=("Forced tunnelling through Azure Firewall", ["Route table rt-spokes with 0.0.0.0/0 → Virtual appliance 10.0.1.4 (Azure Firewall private IP) is associated with every spoke subnet. Internet traffic is inspected and logged before leaving."]),
    config=cfg(["Create a resource > Route table; set Propagate gateway routes.", "Route table > Routes > Add: prefix 0.0.0.0/0, next hop Virtual appliance, address 10.1.0.4.", "Route table > Subnets > Associate snet-app.", "NVA NIC > IP configurations > IP forwarding: Enabled."],
               "az network route-table create -g rg-net -n rt-app\naz network route-table route create -g rg-net --route-table-name rt-app -n default-to-fw --address-prefix 0.0.0.0/0 --next-hop-type VirtualAppliance --next-hop-ip-address 10.1.0.4\naz network vnet subnet update -g rg-net --vnet-name vnet-app -n snet-app --route-table rt-app\naz network nic update -g rg-net -n nva-nic --ip-forwarding true\naz network nic show-effective-route-table -g rg-net -n vm-app-nic -o table",
               "$rt = New-AzRouteTable -Name rt-app -ResourceGroupName rg-net -Location eastus\nAdd-AzRouteConfig -RouteTable $rt -Name default-to-fw -AddressPrefix 0.0.0.0/0 -NextHopType VirtualAppliance -NextHopIpAddress 10.1.0.4 | Set-AzRouteTable\n$vnet = Get-AzVirtualNetwork -Name vnet-app -ResourceGroupName rg-net\nSet-AzVirtualNetworkSubnetConfig -VirtualNetwork $vnet -Name snet-app -AddressPrefix 10.1.1.0/24 -RouteTable $rt | Set-AzVirtualNetwork\nGet-AzEffectiveRouteTable -NetworkInterfaceName vm-app-nic -ResourceGroupName rg-net",
               limits=["400 routes per route table", "One route table per subnet"]),
    lab=lab("Route traffic through an NVA and predict route selection.", ["Run the default internet test and read why the NVA drops it.", "Apply 'Enable IP forwarding'.", "Apply 'Inspect traffic to the DB subnet' (a more specific route wins).", "Apply 'Route table not associated' and 'Black-hole a prefix'."],
            ["Longest prefix wins", "NVA needs IP forwarding", "Route table must be associated"], [("udr-via-nva", "Routed traffic through the NVA"), ("udr-delivered", "Saw system routing deliver traffic"), ("udr-dropped", "Saw traffic dropped")],
            ["IP forwarding disabled", "Route table not associated", "Next hop None"]),
    troubleshooting=[("Traffic doesn't go through the firewall.", "Route table not associated, or a more specific system/BGP route wins.", "Check Effective routes on the NIC."), ("Traffic reaches the NVA but goes no further.", "IP forwarding disabled on the NIC or in the OS.", "Enable both."),
                     ("Asymmetric routing breaks connections.", "Return traffic bypasses the stateful firewall.", "Add matching UDRs on the return path.")],
    comparisons=[("AWS route tables", "Also associated with subnets; next hops are gateways, NAT, ENIs or Transit Gateway."), ("Azure Route Server", "Exchanges BGP routes with NVAs dynamically instead of static UDRs.")],
    misconceptions=[("A UDR always beats a system route.", "Only for equal prefixes; a longer prefix always wins."), ("Route tables apply to NICs.", "They apply to subnets.")],
    decisions=["Use Azure Firewall with 0.0.0.0/0 UDRs for centralised egress.", "Keep route tables few and shared where possible.", "Verify with Effective routes and Next hop after each change."],
    docs=[("Virtual network traffic routing", UDR), ("Create, change or delete a route table", ML + "virtual-network/manage-route-table"), ("Diagnose routing with next hop", ML + "network-watcher/next-hop-overview")],
)
qa("AZ104-4.1.4", 2, "scenario", "A route table has 0.0.0.0/0 → Virtual appliance. A VM sends traffic to another subnet in its VNet (10.1.2.4). Which route is used?", [("The system VNet route (10.1.0.0/16 → Virtual network)", "Correct: longer prefix."), ("The 0.0.0.0/0 UDR", "Shorter prefix."), ("Internet", "No."), ("None", "No.")], "a", "Longest prefix match wins before route source.", UDR)
qa("AZ104-4.1.4", 2, "troubleshooting", "Traffic reaches your NVA but never reaches the destination. Effective routes are correct. What should you check?", [("IP forwarding is enabled on the NVA's NIC and in its OS", "Correct."), ("The NVA has a public IP", "Not required."), ("The route table is associated with the NVA subnet", "Not the problem here."), ("Accelerated networking", "Unrelated.")], "a", "Without IP forwarding the NVA drops traffic not addressed to it.", UDR)
qa("AZ104-4.1.4", 2, "configuration", "Which next hop type drops traffic to a prefix?", [("None", "Correct."), ("Internet", "Sends to internet."), ("Virtual network", "Delivers inside the VNet."), ("Virtual network gateway", "Sends to the gateway.")], "a", "Next hop None black-holes traffic.", UDR)
qa("AZ104-4.1.4", 1, "single", "What do you associate a route table with?", [("Subnets", "Correct."), ("NICs", "No."), ("VMs", "No."), ("Public IPs", "No.")], "a", "Route tables are associated with subnets.", UDR)

# ================================================================ 4.1.5 Troubleshoot connectivity
lesson(
    id="az104-network-troubleshooting", exam=E, title="Troubleshooting network connectivity", objectives=["AZ104-4.1.5"], minutes=35,
    objective="Diagnose connectivity problems between Azure resources using effective routes and security rules and Network Watcher tools.",
    prereqs=[("NSGs and ASGs", "AZ104-4.2.1", "az104-nsg-asg"), ("User-defined routes", "AZ104-4.1.4", "az104-udr")],
    foundation=["When a connection fails, check each hop in order: source NSG outbound, routing, destination NSG inbound, then the guest OS firewall and the application.",
                "Network Watcher is Azure's built-in toolkit for this. It's enabled automatically per region."],
    engineer=["IP flow verify: tests a 5-tuple against the NIC's NSGs and returns Allow/Deny plus the rule name.",
              "NSG diagnostics: like IP flow verify, but evaluates NSGs at the subnet and NIC levels for a flow and shows each.",
              "Next hop: returns the next hop type, IP and route table for a destination from a VM.",
              "Effective security rules / effective routes (on the NIC): the merged view Azure actually applies.",
              "Connection troubleshoot: an end-to-end TCP/ICMP test from a VM (or Bastion/App Gateway) to a destination, reporting hops, latency and the failing component, including when the destination doesn't respond (for example a stopped service).",
              "Packet capture records traffic on a VM; VNet flow logs record IP flows for analysis (NSG flow logs are being retired: new ones can't be created after 30 June 2025). Connection troubleshoot and packet capture need the Network Watcher agent VM extension."],
    anim=("network-routing-sim", "Troubleshoot connectivity tab: pick a tool and see whether it reveals the hidden fault."),
    diagram=([("web", "web-vm", 40, 120, "compute"), ("o", "NSG outbound", 180, 120, "security"), ("r", "Routes", 320, 120, "network"), ("i", "NSG inbound", 460, 120, "security"), ("db", "db-vm :1433", 620, 120, "storage"), ("nw", "Network Watcher", 330, 10, "service")],
             [("web", "o"), ("o", "r"), ("r", "i"), ("i", "db"), ("nw", "r", "next hop"), ("nw", "i", "IP flow verify")]),
    example=("An app can't reach its database", ["IP flow verify reports Allow. Next hop shows VnetLocal. Connection troubleshoot reports the destination port is not reachable: the SQL Server service had stopped after patching."]),
    config=cfg(["Network Watcher > IP flow verify: choose VM, NIC, protocol, direction, local/remote IP and port.", "Network Watcher > Next hop: VM, source IP, destination IP.", "Network Watcher > Connection troubleshoot: source VM, destination and port.", "VM > Networking > Effective security rules; NIC > Effective routes."],
               "az network watcher test-ip-flow -g rg-net --vm web-vm --direction Outbound --protocol TCP --local 10.1.1.4:60000 --remote 10.1.2.4:1433\naz network watcher show-next-hop -g rg-net --vm web-vm --source-ip 10.1.1.4 --dest-ip 10.1.2.4\naz network watcher test-connectivity -g rg-net --source-resource web-vm --dest-address 10.1.2.4 --dest-port 1433\naz network nic list-effective-nsg -g rg-net -n web-vm-nic",
               "$nw = Get-AzNetworkWatcher -Location eastus\n$vm = Get-AzVM -Name web-vm -ResourceGroupName rg-net\nTest-AzNetworkWatcherIPFlow -NetworkWatcher $nw -TargetVirtualMachineId $vm.Id -Direction Outbound -Protocol TCP -LocalIPAddress 10.1.1.4 -LocalPort 60000 -RemoteIPAddress 10.1.2.4 -RemotePort 1433\nGet-AzNetworkWatcherNextHop -NetworkWatcher $nw -TargetVirtualMachineId $vm.Id -SourceIPAddress 10.1.1.4 -DestinationIPAddress 10.1.2.4\nTest-AzNetworkWatcherConnectivity -NetworkWatcher $nw -SourceId $vm.Id -DestinationAddress 10.1.2.4 -DestinationPort 1433",
               perms=["Network Contributor, or a custom role with Network Watcher permissions plus read on the VMs"]),
    lab=lab("Match each fault to the Network Watcher tool that reveals it.", ["Run the default (Next hop against an NSG fault) and read why it can't see it.", "Apply 'Use IP flow verify'.", "Apply 'Routing fault'.", "Set fault to 'SQL service stopped' and find the only tool that detects it."],
            ["NSG faults: IP flow verify / effective rules", "Routing faults: Next hop", "Application faults: Connection troubleshoot"], [("conn-root-cause", "Found a root cause with the right tool"), ("conn-wrong-tool", "Saw a tool's limits")], ["Using Next hop for NSG problems", "Ignoring the guest OS"]),
    troubleshooting=[("IP flow verify says Allow but the connection fails.", "Problem is routing, guest firewall or the app.", "Use Next hop and Connection troubleshoot."), ("Connection troubleshoot fails to start.", "Network Watcher agent extension missing.", "Install the extension (it installs automatically when possible).")],
    comparisons=[("AWS Reachability Analyzer and VPC Flow Logs", "AWS equivalents for path analysis and flow logging."), ("ping/tcping inside the VM", "Tests from the guest, but doesn't show which Azure rule blocks traffic.")],
    misconceptions=[("If NSGs allow it, the app must be reachable.", "Routes, guest firewalls and the application can still block it."), ("Network Watcher must be bought separately.", "It's enabled automatically; some features (flow logs, Connection Monitor) incur charges.")],
    decisions=["Troubleshoot hop by hop: NSG out, route, NSG in, guest, app.", "Enable VNet flow logs on critical networks before incidents happen."],
    docs=[("Network Watcher overview", NW), ("IP flow verify", ML + "network-watcher/ip-flow-verify-overview"), ("Next hop", ML + "network-watcher/next-hop-overview"), ("Connection troubleshoot", ML + "network-watcher/connection-troubleshoot-overview")],
)
qa("AZ104-4.1.5", 2, "scenario", "You need to know which NSG rule blocks TCP 1433 from web-vm to db-vm. Which tool?", [("IP flow verify", "Correct: returns Allow/Deny and the rule."), ("Next hop", "Routing only."), ("Packet capture", "Shows packets, not the rule."), ("Azure Advisor", "No.")], "a", "IP flow verify names the matching rule.", ML + "network-watcher/ip-flow-verify-overview")
qa("AZ104-4.1.5", 2, "scenario", "Traffic to an on-premises range seems to bypass the firewall. Which tool shows the route a VM uses?", [("Next hop", "Correct."), ("IP flow verify", "NSGs."), ("Connection Monitor", "Monitoring over time."), ("Resource Health", "Platform health.")], "a", "Next hop returns the next hop type and route table.", ML + "network-watcher/next-hop-overview")
qa("AZ104-4.1.5", 3, "troubleshooting", "IP flow verify returns Allow and Next hop returns VnetLocal, but the app still can't connect to port 1433. Which tool helps next?", [("Connection troubleshoot", "Correct: end-to-end including the destination's response."), ("IP flow verify again", "Already allowed."), ("Effective routes", "Already checked."), ("Public IP configuration", "Irrelevant.")], "a", "The problem is likely the guest firewall or service.", ML + "network-watcher/connection-troubleshoot-overview")

# ================================================================ 4.2.3 Bastion
lesson(
    id="az104-bastion", exam=E, title="Azure Bastion", objectives=["AZ104-4.2.3"], minutes=30,
    objective="Deploy Azure Bastion with the right SKU and subnet to give secure RDP and SSH access to VMs without public IPs.",
    prereqs=[("NSGs and ASGs", "AZ104-4.2.1", "az104-nsg-asg")],
    foundation=["Azure Bastion is a managed jump host: admins connect to VMs from the Azure portal (or a native client) over TLS, and the VMs don't need public IPs or open RDP/SSH ports to the internet."],
    engineer=["SKUs: Developer (free, shared infrastructure, one connection at a time, no dedicated subnet, limited regions), Basic, Standard (native client support, shareable links, host scaling, IP-based connection, custom ports), Premium (adds session recording and private-only deployment).",
              "Basic/Standard/Premium need a subnet named AzureBastionSubnet of /26 or larger and a Standard SKU public IP (except Premium private-only).",
              "Bastion connects to VMs in its VNet and in peered VNets. VM NSGs must allow RDP/SSH from the AzureBastionSubnet address range; an NSG on AzureBastionSubnet itself needs specific required rules.",
              "Native client: az network bastion rdp / az network bastion ssh (Standard or Premium, with Native client support enabled).",
              "Pricing is hourly per deployment plus outbound data; scale units on Standard/Premium add hourly cost."],
    anim=("network-access-sim", "Azure Bastion tab: SKU, subnet, public IP and NSG checks."),
    diagram=([("adm", "Admin (portal / native client)", 20, 120, "user"), ("bas", "Azure Bastion (AzureBastionSubnet /26)", 260, 120, "security"), ("vm1", "vm-app (no public IP)", 520, 60, "compute"), ("vm2", "vm-db in peered VNet", 520, 190, "compute")],
             [("adm", "bas", "TLS 443"), ("bas", "vm1", "RDP/SSH private IP"), ("bas", "vm2", "via peering")]),
    example=("Removing public IPs from admin access", ["Contoso deploys Standard Bastion in the hub VNet, removes all VM public IPs and lets admins connect from the portal or with az network bastion ssh from their laptops."]),
    config=cfg(["vnet-hub > Subnets > + Subnet: name AzureBastionSubnet, /26.", "Create a resource > Bastion: choose tier, VNet, new Standard public IP.", "VM > Connect > Bastion: enter credentials (or a Key Vault secret)."],
               "az network vnet subnet create -g rg-net --vnet-name vnet-hub -n AzureBastionSubnet --address-prefixes 10.0.254.0/26\naz network public-ip create -g rg-net -n pip-bastion --sku Standard\naz network bastion create -g rg-net -n bas-hub --vnet-name vnet-hub --public-ip-address pip-bastion --sku Standard --enable-tunneling true\naz network bastion ssh -g rg-net -n bas-hub --target-resource-id <vm-id> --auth-type AAD",
               "$vnet = Get-AzVirtualNetwork -Name vnet-hub -ResourceGroupName rg-net\nAdd-AzVirtualNetworkSubnetConfig -Name AzureBastionSubnet -VirtualNetwork $vnet -AddressPrefix 10.0.254.0/26 | Set-AzVirtualNetwork\n$pip = New-AzPublicIpAddress -ResourceGroupName rg-net -Name pip-bastion -Location eastus -AllocationMethod Static -Sku Standard\nNew-AzBastion -ResourceGroupName rg-net -Name bas-hub -PublicIpAddressRgName rg-net -PublicIpAddressName pip-bastion -VirtualNetworkRgName rg-net -VirtualNetworkName vnet-hub -Sku Standard",
               limits=["AzureBastionSubnet /26 or larger", "Native client and shareable links need Standard or Premium"]),
    lab=lab("Deploy Bastion correctly and enable native client access.", ["Run the default (wrong subnet name and size).", "Apply 'Correct Basic deployment'.", "Apply 'Native client on Basic' and read the SKU error.", "Apply 'Standard with native client'."],
            ["AzureBastionSubnet /26+", "Native client needs Standard"], [("bastion-connected", "Connected through Bastion"), ("bastion-native", "Used native client with Standard"), ("bastion-error", "Diagnosed a Bastion configuration error")],
            ["Wrong subnet name", "/27 subnet", "Basic SKU for native client"], duration=10),
    troubleshooting=[("Bastion deployment fails.", "Subnet isn't named AzureBastionSubnet or is smaller than /26.", "Create the correct subnet."), ("az network bastion ssh fails.", "Basic SKU or native client support disabled.", "Upgrade to Standard and enable native client support."),
                     ("Connection times out.", "VM NSG blocks RDP/SSH from the Bastion subnet.", "Allow 3389/22 from the AzureBastionSubnet range.")],
    comparisons=[("Jump box VM", "You patch and secure it yourself and expose it publicly."), ("AWS Systems Manager Session Manager", "AWS's agent-based alternative for shell access without open ports.")],
    misconceptions=[("VMs need public IPs to use Bastion.", "They don't; Bastion uses private IPs."), ("Any subnet name works.", "It must be AzureBastionSubnet.")],
    decisions=["Deploy Bastion in the hub and reach spokes through peering.", "Use Standard for native client and shareable links; Premium for session recording."],
    docs=[("What is Azure Bastion?", BAS), ("Bastion configuration settings and SKUs", ML + "bastion/configuration-settings"), ("Connect using native client", ML + "bastion/native-client")],
)
qa("AZ104-4.2.3", 2, "configuration", "Which subnet is required to deploy a Standard Azure Bastion?", [("AzureBastionSubnet, /26 or larger", "Correct."), ("BastionSubnet, /29", "Wrong name and size."), ("GatewaySubnet", "For VPN/ExpressRoute gateways."), ("Any subnet with an NSG", "No.")], "a", "Name and size are mandatory.", ML + "bastion/configuration-settings")
qa("AZ104-4.2.3", 2, "scenario", "Admins want to SSH to VMs with az network bastion ssh from their laptops. Which SKU is the minimum?", [("Standard", "Correct."), ("Developer", "No native client."), ("Basic", "No native client."), ("Any SKU", "No.")], "a", "Native client requires Standard or Premium.", ML + "bastion/native-client")
qa("AZ104-4.2.3", 2, "troubleshooting", "Bastion is deployed, but RDP to a VM times out. What should you check?", [("The VM's NSG allows 3389 from the AzureBastionSubnet range", "Correct."), ("The VM has a public IP", "Not needed."), ("The VM uses a Basic public IP", "Irrelevant."), ("DNS zone delegation", "Unrelated.")], "a", "Bastion connects from its subnet to the VM's private IP.", BAS)

# ================================================================ 4.2.4 + 4.2.5 Endpoints
lesson(
    id="az104-service-private-endpoints", exam=E, title="Service endpoints and private endpoints for PaaS", objectives=["AZ104-4.2.4", "AZ104-4.2.5"], minutes=50,
    objective="Configure service endpoints and private endpoints for Azure PaaS services, including firewall rules and private DNS, and choose between them.",
    prereqs=[("Storage network access", "AZ104-2.1.1", "az104-storage-network")],
    foundation=["PaaS services like Azure Storage and Azure SQL have public endpoints. You can restrict who reaches them from your VNets in two ways.",
                "Service endpoint: your subnet reaches the service's public endpoint over the Azure backbone, and the service can allow only that subnet.",
                "Private endpoint: the service gets a private IP address inside your VNet, so traffic never uses the public endpoint."],
    engineer=["Service endpoints: enable per subnet per service (Microsoft.Storage, Microsoft.Sql, Microsoft.KeyVault…), then add a virtual network rule on the resource's firewall. The source IP seen by the service becomes the VM's private IP, so existing IP rules for the VNet's public IPs stop matching. They don't work from on-premises or (generally) peered VNets. Service endpoint policies can restrict traffic to specific storage accounts. Free.",
              "Private endpoints: a NIC with a private IP in a subnet, connected to one sub-resource (for example blob, file, sqlServer). Works from peered VNets and on-premises over VPN/ExpressRoute. You can then disable public network access. Billed per hour and per GB.",
              "DNS is the usual problem: the public name (stcontoso.blob.core.windows.net) gets a CNAME to stcontoso.privatelink.blob.core.windows.net. A private DNS zone privatelink.blob.core.windows.net linked to the VNet returns the private IP. On-premises needs a DNS forwarder (for example Azure DNS Private Resolver).",
              "Private endpoint connections can be auto-approved (same permissions) or require manual approval by the resource owner. Network policies (NSG/UDR support) for private endpoints can be enabled on the subnet."],
    anim=("network-access-sim", "Service endpoints vs private endpoints tab: DNS, path and firewall."),
    diagram=([("vm", "VM 10.1.1.4", 20, 120, "compute"), ("se", "Service endpoint (subnet)", 230, 40, "network"), ("pe", "Private endpoint 10.1.3.5", 230, 200, "network"), ("dns", "privatelink DNS zone", 430, 200, "service"), ("st", "Storage account", 620, 120, "storage")],
             [("vm", "se", "backbone, public endpoint"), ("se", "st"), ("vm", "pe", "private IP"), ("pe", "st", "Private Link"), ("dns", "pe")]),
    example=("Locking down a storage account", ["Phase 1: the team enables a Microsoft.Storage service endpoint on snet-app and adds a VNet rule; the IP rule for the old NAT IP stops working for those VMs, as expected.",
                                                "Phase 2: for on-premises access they add a private endpoint for blob, a linked privatelink DNS zone and a DNS Private Resolver, then set public network access to Disabled."]),
    config=cfg(["Subnet > Service endpoints: add Microsoft.Storage. Storage account > Networking > Firewalls and virtual networks: add the VNet/subnet.", "Storage account > Networking > Private endpoint connections > + Private endpoint: choose sub-resource blob, VNet/subnet, and integrate with a private DNS zone.", "Storage account > Networking > Public network access: Disabled."],
               "# Service endpoint\naz network vnet subnet update -g rg-net --vnet-name vnet-app -n snet-app --service-endpoints Microsoft.Storage\naz storage account network-rule add -g rg-net --account-name stcontoso --vnet-name vnet-app --subnet snet-app\naz storage account update -g rg-net -n stcontoso --default-action Deny\n# Private endpoint + DNS\naz network private-endpoint create -g rg-net -n pe-st-blob --vnet-name vnet-app --subnet snet-pe --private-connection-resource-id $(az storage account show -n stcontoso -g rg-net --query id -o tsv) --group-id blob --connection-name st-blob\naz network private-dns zone create -g rg-net -n privatelink.blob.core.windows.net\naz network private-dns link vnet create -g rg-net -z privatelink.blob.core.windows.net -n link-app -v vnet-app -e false\naz network private-endpoint dns-zone-group create -g rg-net --endpoint-name pe-st-blob -n default --private-dns-zone privatelink.blob.core.windows.net --zone-name blob\naz storage account update -g rg-net -n stcontoso --public-network-access Disabled",
               "$vnet = Get-AzVirtualNetwork -Name vnet-app -ResourceGroupName rg-net\nSet-AzVirtualNetworkSubnetConfig -VirtualNetwork $vnet -Name snet-app -AddressPrefix 10.1.1.0/24 -ServiceEndpoint Microsoft.Storage | Set-AzVirtualNetwork\n$st = Get-AzStorageAccount -ResourceGroupName rg-net -Name stcontoso\n$conn = New-AzPrivateLinkServiceConnection -Name st-blob -PrivateLinkServiceId $st.Id -GroupId blob\nNew-AzPrivateEndpoint -ResourceGroupName rg-net -Name pe-st-blob -Location eastus -Subnet ($vnet.Subnets | ? Name -eq snet-pe) -PrivateLinkServiceConnection $conn",
               limits=["Private endpoints are billed per hour and per GB processed", "One private endpoint per sub-resource type you need (blob, file, queue…)"]),
    lab=lab("Give a VM private access to storage two ways and lock down the public endpoint.", ["Run the default (service endpoint not enabled, IP rule only).", "Apply 'Service endpoint done right'.", "Apply 'Private endpoint without DNS zone' and read the DNS failure.", "Apply 'Private endpoint with DNS zone'."],
            ["Service endpoint changes the source IP", "Private endpoints need private DNS"], [("se-vnet-rule", "Allowed a subnet through a service endpoint"), ("pe-private-ip", "Reached storage through a private endpoint"), ("endpoint-error", "Diagnosed an endpoint error")],
            ["Missing VNet rule", "Missing privatelink DNS zone", "Disabling public access while using service endpoints"], duration=20),
    troubleshooting=[("After enabling a service endpoint, VMs get 403 from storage.", "Source is now the private IP; the old IP rule no longer matches.", "Add a virtual network rule."), ("Private endpoint created but the name resolves to a public IP.", "Private DNS zone not linked or record missing.", "Link privatelink.blob.core.windows.net to the VNet and add a DNS zone group."),
                     ("On-premises clients can't use the private endpoint.", "On-premises DNS doesn't resolve the privatelink zone.", "Forward to Azure DNS Private Resolver.")],
    comparisons=[("AWS VPC gateway endpoints and interface endpoints", "Gateway endpoints resemble service endpoints (S3/DynamoDB); interface endpoints (PrivateLink) resemble private endpoints."), ("Private Link service", "Exposes your own service behind a Standard load balancer to consumers through private endpoints.")],
    misconceptions=[("Service endpoints give the service a private IP.", "The service keeps its public IP; only the source and path change."), ("Private endpoints need no DNS changes.", "Clients must resolve the name to the private IP.")],
    decisions=["Use private endpoints for on-premises access, data-exfiltration protection and to disable public access.", "Use service endpoints for simple, free subnet restriction within a region.", "Centralise privatelink DNS zones in the hub."],
    docs=[("Virtual network service endpoints", SE), ("What is a private endpoint?", PE), ("Private endpoint DNS configuration", PEDNS), ("Configure Azure Storage firewalls and virtual networks", ML + "storage/common/storage-network-security")],
)
qa("AZ104-4.2.4", 2, "scenario", "You enable a Microsoft.Storage service endpoint on snet-app. Storage requests from its VMs now fail with 403, although an IP rule allows your NAT public IP. Why?", [("Traffic now comes from the VMs' private IPs; add a virtual network rule", "Correct."), ("Service endpoints disable the storage firewall", "No."), ("The storage account needs a private DNS zone", "That's for private endpoints."), ("The subnet needs a public IP", "No.")], "a", "Service endpoints switch the source to private addresses.", SE)
qa("AZ104-4.2.4", 2, "single", "Which statement about service endpoints is true?", [("They are enabled per subnet and per service and are free", "Correct."), ("They give the service a private IP in your VNet", "That's a private endpoint."), ("They work from on-premises over VPN", "No."), ("They require a private DNS zone", "No.")], "a", "Subnet-level, service-specific, no charge.", SE)
qa("AZ104-4.2.5", 2, "troubleshooting", "A private endpoint for blob storage exists, but nslookup from a VM returns a public IP. What's missing?", [("A privatelink.blob.core.windows.net private DNS zone linked to the VNet (with the A record)", "Correct."), ("A service endpoint on the subnet", "Not needed."), ("A public IP on the endpoint", "No."), ("A route table", "No.")], "a", "Private endpoints rely on private DNS.", PEDNS)
qa("AZ104-4.2.5", 2, "scenario", "On-premises servers connected by ExpressRoute must reach a storage account privately and the account must have no public access. What do you use?", [("A private endpoint plus DNS forwarding for the privatelink zone, and disable public network access", "Correct."), ("A service endpoint", "Doesn't work from on-premises and needs public access."), ("A Basic public IP", "No."), ("Azure Bastion", "For VM sessions.")], "a", "Private endpoints work from on-premises.", PE)
qa("AZ104-4.2.5", 2, "configuration", "When creating a private endpoint for a storage account, which value selects the blob service?", [("Target sub-resource (group ID) blob", "Correct."), ("SKU Standard_LRS", "Storage SKU."), ("Access tier Hot", "Tier."), ("Service tag Storage", "For NSGs/routes.")], "a", "Each private endpoint targets one sub-resource.", PE)

# ================================================================ 4.3.1 DNS
lesson(
    id="az104-azure-dns", exam=E, title="Azure DNS: public and private zones", objectives=["AZ104-4.3.1"], minutes=40,
    objective="Host public DNS zones in Azure DNS, delegate domains, manage record sets including alias records, and configure private DNS zones with virtual network links and autoregistration.",
    prereqs=[("Virtual networks and subnets", "AZ104-4.1.1", "az104-vnet-subnets")],
    foundation=["DNS turns names (www.contoso.com) into IP addresses. Azure DNS hosts your DNS zones on Microsoft's global name servers.",
                "Public zones answer internet queries. Private DNS zones answer only for VNets you link to them."],
    engineer=["Delegation: buying a domain stays with your registrar; after creating the zone in Azure, update the domain's NS records at the registrar to the four Azure name servers shown on the zone (ns1-0x.azure-dns.com/.net/.org/.info). Child zones are delegated with NS records in the parent zone.",
              "Record sets: A, AAAA, CNAME, MX, NS, PTR, SOA, SRV, TXT, CAA. A CNAME can't be at the zone apex (@) and can't share a name with other records. Alias records (A/AAAA/CNAME) point to Azure resources (public IP, Traffic Manager, Front Door, another record set) and can be used at the apex; they update automatically when the resource's IP changes.",
              "TTL (seconds) controls how long resolvers cache answers; lower it before planned changes. Azure DNS doesn't sell domain names: buy them from a registrar (or App Service domains).",
              "Private DNS zones: link to VNets with virtual network links. Autoregistration on a link creates A records for VMs in that VNet; a VNet can have autoregistration with only one private zone but can be linked (resolution) to many. Resolution needs Azure-provided DNS (168.63.129.16) or custom DNS servers that forward to it.",
              "Azure DNS Private Resolver provides inbound/outbound endpoints for hybrid name resolution without DNS VMs."],
    anim=("dns-lb-sim", "Public DNS zone and Private DNS zone tabs."),
    diagram=([("reg", "Registrar NS → Azure", 20, 40, "globe"), ("zone", "contoso.com (Azure DNS)", 250, 40, "network"), ("rec", "@ alias → pip-web, www CNAME", 500, 40, "service"), ("pz", "contoso.internal (private)", 250, 200, "network"), ("vnet", "vnet-app (link + autoreg)", 500, 200, "compute")],
             [("reg", "zone", "delegation"), ("zone", "rec"), ("pz", "vnet", "virtual network link")]),
    example=("Moving contoso.com to Azure DNS", ["The team creates the zone, recreates all records, lowers TTLs, then switches NS records at the registrar. The apex points to the web load balancer's public IP with an alias A record, so it follows IP changes automatically."]),
    config=cfg(["Create a resource > DNS zone: contoso.com. Note the four name servers.", "Zone > + Record set: name, type, TTL, values (or alias to an Azure resource).", "Private DNS zones > Create contoso.internal > Virtual network links > Add, enable auto registration."],
               "az network dns zone create -g rg-net -n contoso.com\naz network dns zone show -g rg-net -n contoso.com --query nameServers\naz network dns record-set a add-record -g rg-net -z contoso.com -n www -a 20.10.1.5 --ttl 3600\naz network dns record-set a create -g rg-net -z contoso.com -n @ --target-resource $(az network public-ip show -g rg-net -n pip-web --query id -o tsv)\naz network private-dns zone create -g rg-net -n contoso.internal\naz network private-dns link vnet create -g rg-net -z contoso.internal -n link-app -v vnet-app -e true",
               "New-AzDnsZone -Name contoso.com -ResourceGroupName rg-net\nNew-AzDnsRecordSet -Name www -RecordType A -ZoneName contoso.com -ResourceGroupName rg-net -Ttl 3600 -DnsRecords (New-AzDnsRecordConfig -IPv4Address 20.10.1.5)\nNew-AzPrivateDnsZone -Name contoso.internal -ResourceGroupName rg-net\nNew-AzPrivateDnsVirtualNetworkLink -ZoneName contoso.internal -ResourceGroupName rg-net -Name link-app -VirtualNetworkId (Get-AzVirtualNetwork -Name vnet-app -ResourceGroupName rg-net).Id -EnableRegistration",
               perms=["DNS Zone Contributor for public zones; Private DNS Zone Contributor for private zones (plus Network Contributor on the VNet to link)"], limits=["Autoregistration: one private zone per VNet", "Record sets per zone: see Azure DNS limits"]),
    lab=lab("Delegate a public zone, add apex and www records, and resolve VM names privately.", ["Public DNS zone: run the default (CNAME at apex, not delegated).", "Apply 'Delegate + alias at apex'.", "Apply 'www CNAME'.", "Private DNS zone: apply 'Link with autoregistration', then 'Custom DNS without forwarding'."],
            ["No CNAME at the apex: use alias", "Private zones need links and Azure DNS"], [("dns-alias", "Created an alias record at the apex"), ("dns-resolves", "Resolved a public record"), ("dns-private-resolves", "Resolved a private name"), ("dns-error", "Diagnosed a DNS error")],
            ["Forgot to update registrar NS", "CNAME at the apex", "VNet not linked"]),
    troubleshooting=[("Records exist in Azure but the internet sees old values.", "Domain not delegated, or old TTL still cached.", "Update NS at the registrar; wait for TTL."), ("Cannot create a CNAME at @.", "DNS standard forbids it.", "Use an alias record."),
                     ("VMs can't resolve private zone names.", "No virtual network link, or custom DNS not forwarding to 168.63.129.16.", "Link the VNet; configure forwarding.")],
    comparisons=[("Amazon Route 53", "AWS DNS with public and private hosted zones; alias records are similar."), ("Azure-provided DNS", "Resolves VM names within one VNet only; private zones span VNets with custom names.")],
    misconceptions=[("Azure DNS makes you the domain's registrar.", "You still buy the domain from a registrar (or App Service Domains)."), ("Autoregistration can be enabled in many zones for one VNet.", "Only one autoregistration zone per VNet.")],
    decisions=["Use alias records for apex records pointing to Azure resources.", "Centralise private DNS zones and link spokes.", "Use DNS Private Resolver for hybrid resolution."],
    docs=[("What is Azure DNS?", DNS), ("Delegate a domain to Azure DNS", ML + "dns/dns-delegate-domain-azure-dns"), ("Alias records", ML + "dns/dns-alias"), ("Private DNS zones", PDNS), ("Private DNS autoregistration", ML + "dns/private-dns-autoregistration")],
)
qa("AZ104-4.3.1", 2, "ordering", "Order the steps to host an existing domain in Azure DNS.", [("Create the DNS zone in Azure DNS", "Step 1."), ("Recreate the record sets in the zone", "Step 2."), ("Update the NS records at the registrar to the Azure name servers", "Step 3."), ("Verify resolution with nslookup", "Step 4.")], "abcd", "Create, populate, delegate, verify.", ML + "dns/dns-delegate-domain-azure-dns")
qa("AZ104-4.3.1", 2, "scenario", "contoso.com must point to a public IP that may change. You can't use a CNAME at the apex. What do you create?", [("An alias A record at @ targeting the public IP resource", "Correct."), ("A CNAME at @", "Not allowed."), ("A TXT record", "No."), ("An MX record", "Mail.")], "a", "Alias records work at the apex and track the resource.", ML + "dns/dns-alias")
qa("AZ104-4.3.1", 2, "troubleshooting", "VMs in vnet-app can't resolve db01.contoso.internal. The private zone exists. What do you check first?", [("A virtual network link from the zone to vnet-app (with autoregistration or a record)", "Correct."), ("Registrar NS records", "Public zones only."), ("A public IP on db01", "No."), ("Bastion", "No.")], "a", "Private zones resolve only for linked VNets.", PDNS)
qa("AZ104-4.3.1", 2, "single", "How many private DNS zones can have autoregistration enabled for one VNet?", [("One", "Correct."), ("Unlimited", "Links for resolution are many; autoregistration is one."), ("Five", "No."), ("None", "It's supported.")], "a", "One registration zone per VNet.", ML + "dns/private-dns-autoregistration")

# ================================================================ 4.3.2 + 4.3.3 Load balancer
lesson(
    id="az104-load-balancer", exam=E, title="Azure Load Balancer: configure and troubleshoot", objectives=["AZ104-4.3.2", "AZ104-4.3.3"], minutes=50,
    objective="Configure a public or internal Standard load balancer with frontends, backend pools, health probes and rules, and troubleshoot load balancing failures.",
    prereqs=[("NSGs and ASGs", "AZ104-4.2.1", "az104-nsg-asg"), ("Availability sets and zones", "AZ104-3.2.6", "az104-vm-availability")],
    foundation=["Azure Load Balancer spreads TCP/UDP traffic across healthy VMs. It works at layer 4: it doesn't look at URLs or cookies.",
                "Public load balancer: internet traffic to a public frontend IP. Internal load balancer: traffic inside the VNet (or from peered/on-premises networks) to a private frontend IP."],
    engineer=["Components: frontend IP configuration, backend pool (NICs or IP addresses in one VNet), health probe (TCP, HTTP or HTTPS, interval and threshold), load-balancing rule (frontend port → backend port, protocol, probe, session persistence: None (5-tuple), Client IP, or Client IP and protocol), inbound NAT rules (port-forward to one VM), and outbound rules.",
              "SKU: Standard (Basic was retired on 30 September 2025). Standard is zone-redundant or zonal, secure by default (backend NSG must allow traffic), supports HA ports on internal load balancers and gives multi-dimensional metrics.",
              "Health probes come from 168.63.129.16 (service tag AzureLoadBalancer). The default NSG rule AllowAzureLoadBalancerInBound allows them; a custom deny rule with higher priority breaks probing. Instances failing the probe stop receiving new flows.",
              "Troubleshooting: Health Probe Status and Data Path Availability metrics, Load Balancer Insights, check that the app listens on the probe port/path (HTTP probe needs 200), guest firewall, NSGs, backend in the pool, and that clients aren't backend members calling their own internal frontend (not supported for the same VM).",
              "Choose Application Gateway for layer 7 (paths, TLS, WAF), Front Door for global HTTP, Traffic Manager for DNS-based global routing."],
    anim=("dns-lb-sim", "Load balancer and troubleshooting, and Choose a load balancing service tabs."),
    diagram=([("c", "Clients", 20, 120, "user"), ("fe", "Frontend IP (public or private)", 200, 120, "network"), ("rule", "Rule TCP 80 + probe /health", 400, 120, "service"), ("v1", "vm1", 620, 40, "compute"), ("v2", "vm2", 620, 120, "compute"), ("v3", "vm3 (probe failing)", 620, 200, "compute")],
             [("c", "fe"), ("fe", "rule"), ("rule", "v1"), ("rule", "v2"), ("rule", "v3", "out of rotation")]),
    example=("Three web servers across zones", ["A zone-redundant public Standard load balancer fronts three VMs in zones 1–3 with an HTTP probe on /health. During patching, one VM fails the probe and is removed from rotation automatically; users don't notice.",
                                               "An internal load balancer fronts the SQL tier with HA ports for an availability group listener."]),
    config=cfg(["Create a resource > Load balancer: SKU Standard, type Public or Internal, tier Regional.", "Add a frontend IP, a backend pool (VMs or IPs), a health probe (HTTP 80 /health), and a load-balancing rule.", "Monitor: Load balancer > Insights; Metrics > Health Probe Status."],
               "az network lb create -g rg-net -n lb-web --sku Standard --public-ip-address pip-lb --frontend-ip-name fe-web --backend-pool-name be-web\naz network lb probe create -g rg-net --lb-name lb-web -n hp-http --protocol Http --port 80 --path /health\naz network lb rule create -g rg-net --lb-name lb-web -n rule-http --protocol Tcp --frontend-port 80 --backend-port 80 --frontend-ip-name fe-web --backend-pool-name be-web --probe-name hp-http\naz network nic ip-config address-pool add -g rg-net --nic-name vm1-nic --ip-config-name ipconfig1 --lb-name lb-web --address-pool be-web\n# Internal LB\naz network lb create -g rg-net -n lb-sql --sku Standard --vnet-name vnet-app --subnet snet-db --private-ip-address 10.1.2.10 --frontend-ip-name fe-sql --backend-pool-name be-sql",
               "$fe = New-AzLoadBalancerFrontendIpConfig -Name fe-web -PublicIpAddress (Get-AzPublicIpAddress -Name pip-lb -ResourceGroupName rg-net)\n$be = New-AzLoadBalancerBackendAddressPoolConfig -Name be-web\n$hp = New-AzLoadBalancerProbeConfig -Name hp-http -Protocol Http -Port 80 -RequestPath /health -IntervalInSeconds 5 -ProbeCount 1\n$rule = New-AzLoadBalancerRuleConfig -Name rule-http -FrontendIpConfiguration $fe -BackendAddressPool $be -Probe $hp -Protocol Tcp -FrontendPort 80 -BackendPort 80\nNew-AzLoadBalancer -ResourceGroupName rg-net -Name lb-web -Location eastus -Sku Standard -FrontendIpConfiguration $fe -BackendAddressPool $be -Probe $hp -LoadBalancingRule $rule",
               limits=["Backend pool members must be in one VNet", "HA ports only on internal Standard load balancers"]),
    lab=lab("Configure a Standard load balancer and fix four common failures.", ["Run the default and read why clients are blocked.", "Apply 'Allow client traffic'.", "Apply 'Probe on wrong port', 'NSG blocks the probe' and 'One VM down'.", "Switch Type to Internal.", "Choose a load balancing service: answer every case."],
            ["Standard LB needs NSG allow rules", "Failed probes remove instances", "Layer 4 vs layer 7 choice"], [("lb-public", "Load balanced public traffic"), ("lb-internal", "Configured an internal load balancer"), ("lb-troubleshoot", "Diagnosed a load balancing failure"), ("lb-degraded", "Saw a failed instance taken out of rotation"), ("lb-choice-correct", "Chose the right load balancing service")],
            ["NSG missing allow rule", "Probe port without listener", "NSG denies AzureLoadBalancer"], duration=20),
    troubleshooting=[("All backends unhealthy.", "Probe port/path wrong, app down, or NSG/guest firewall blocks 168.63.129.16.", "Fix the probe, allow AzureLoadBalancer, check the app returns 200."), ("Clients time out on a public Standard LB.", "Backend NSG doesn't allow the client traffic.", "Add an inbound allow rule."),
                     ("Traffic always goes to one VM.", "Session persistence Client IP with few clients, or others unhealthy.", "Check probe status and distribution mode."), ("A backend VM can't reach the internal LB frontend.", "Backend calling its own frontend isn't supported.", "Call the service directly or use a separate client.")],
    comparisons=[("Application Gateway", "Layer 7 regional with path routing, TLS and WAF."), ("AWS Network Load Balancer", "AWS layer 4 equivalent; Application Load Balancer is layer 7.")],
    misconceptions=[("Load Balancer can route by URL path.", "It's layer 4; use Application Gateway."), ("Standard LB allows traffic without NSGs.", "Standard is secure by default; NSGs must allow traffic.")],
    decisions=["Use zone-redundant Standard load balancers for production.", "Use HTTP probes on a health endpoint that checks dependencies lightly.", "Use NAT gateway or outbound rules for predictable outbound."],
    docs=[("What is Azure Load Balancer?", LB), ("Health probes", PROBE), ("Troubleshoot Azure Load Balancer", ML + "load-balancer/load-balancer-troubleshoot"), ("Load balancing options", "https://learn.microsoft.com/azure/architecture/guide/technology-choices/load-balancing-overview")],
)
qa("AZ104-4.3.2", 2, "scenario", "You need to load-balance TCP 1433 across SQL VMs, reachable only from inside the VNet. What do you create?", [("An internal Standard load balancer", "Correct."), ("A public load balancer", "Exposes it publicly."), ("Azure Front Door", "Global HTTP."), ("Traffic Manager", "DNS-based.")], "a", "Internal load balancer with a private frontend.", LB)
qa("AZ104-4.3.2", 2, "configuration", "Which components must a load-balancing rule reference?", [("Frontend IP, backend pool, health probe, protocol and ports", "Correct."), ("Public IP prefix and route table", "No."), ("DNS zone and NSG", "No."), ("Only the backend pool", "Incomplete.")], "a", "A rule maps frontend:port to backend pool:port using a probe.", LB)
qa("AZ104-4.3.2", 2, "single", "Which session persistence option sends a client's requests to the same backend based on its source IP?", [("Client IP", "Correct."), ("None (5-tuple)", "Default; may change per connection."), ("Cookie-based affinity", "Application Gateway."), ("HA ports", "Rule type.")], "a", "Client IP affinity uses a 2-tuple hash.", LB)
qa("AZ104-4.3.3", 2, "troubleshooting", "All backends of a Standard load balancer show as unhealthy. The app works when tested locally on each VM. An NSG has a deny-all inbound rule at priority 100. What's wrong?", [("The NSG blocks health probes from AzureLoadBalancer (168.63.129.16)", "Correct."), ("The backend pool is in another region", "Not allowed anyway."), ("Session persistence", "Doesn't affect health."), ("The public IP is static", "Expected.")], "a", "Allow the AzureLoadBalancer service tag above the deny rule.", PROBE)
qa("AZ104-4.3.3", 2, "troubleshooting", "An HTTP probe on /health fails on one VM only. What happens and what do you check?", [("That VM stops receiving new flows; check the app returns HTTP 200 on /health", "Correct."), ("The whole load balancer stops", "Only that instance."), ("Traffic doubles to that VM", "No."), ("The VM is deleted", "No.")], "a", "Unhealthy instances leave rotation.", PROBE)
qa("AZ104-4.3.3", 2, "scenario", "Which metric best shows whether each backend passes its health probe?", [("Health Probe Status", "Correct."), ("CPU percentage", "Indirect."), ("SNAT connection count", "Outbound."), ("Disk IOPS", "No.")], "a", "Health Probe Status (DIP availability).", ML + "load-balancer/load-balancer-standard-diagnostics")
