"""AZ-104 Domain 3: Deploy and manage Azure compute resources (3.1–3.4)."""
from builder import animation, lesson, q

E = "az-104"
ML = "https://learn.microsoft.com/azure/"
T = "frontend/src/simulations/groups/compute.test.ts"

animation("arm-sim", "ARM templates and Bicep deployments", E, ["AZ104-3.1.1", "AZ104-3.1.2", "AZ104-3.1.3", "AZ104-3.1.4", "AZ104-3.1.5"], "accurate-model", T,
          "Validate parameters, resolve dependency order, compare Incremental and Complete modes, and export/decompile templates.")
animation("vm-sim", "Virtual machines: create, resize, disks, availability, move", E, ["AZ104-3.2.1", "AZ104-3.2.2", "AZ104-3.2.3", "AZ104-3.2.4", "AZ104-3.2.5", "AZ104-3.2.6"], "accurate-model", T,
          "Provisioning checks, availability sets vs zones with failure injection, resize and disk rules, disk encryption options and VM moves.")
animation("autoscale-sim", "Autoscale: scale sets and containers", E, ["AZ104-3.2.7", "AZ104-3.3.4"], "simplified-illustration", T,
          "Autoscale rules over a traffic peak, and Container Apps vs Container Instances sizing and scaling.")
animation("container-sim", "ACR, Container Instances and Container Apps", E, ["AZ104-3.3.1", "AZ104-3.3.2", "AZ104-3.3.3"], "accurate-model", T,
          "Build, push, authenticate, run and expose containers; Container Apps revisions and traffic splitting.")
animation("appservice-sim", "App Service plans, domains, TLS, slots, backup and networking", E, [f"AZ104-3.4.{i}" for i in range(1, 9)], "accurate-model", T,
          "Tier capabilities and scaling, custom domains and certificates, slot swaps, backups, private endpoints and VNet integration.")

# ---------------------------------------------------------------- 3.1 ARM / Bicep
lesson(
    id="az104-arm-bicep", exam=E, title="ARM templates and Bicep: read, modify, deploy, export and convert",
    objectives=["AZ104-3.1.1", "AZ104-3.1.2", "AZ104-3.1.3", "AZ104-3.1.4", "AZ104-3.1.5"], minutes=75,
    objective="Interpret and modify ARM JSON and Bicep files, deploy them safely with validation and what-if, choose the deployment mode, and export or decompile existing infrastructure.",
    prereqs=[("Infrastructure as code and ARM (AZ-900)", "AZ900-3.3.5"), ("Resource groups and scopes", "AZ104-1.3.4", "az104-resource-groups-subscriptions")],
    foundation=[
        "Infrastructure as code means describing Azure resources in a file, so you can deploy the same environment again and again without clicking through the portal.",
        "Azure Resource Manager (ARM) templates are JSON files. Bicep is a simpler language for the same thing: it is converted into ARM JSON before deployment.",
        "A template has parameters (values you supply at deployment, such as a VM name), variables (values it calculates), resources (what to create) and outputs (values it returns).",
        "Deployments are declarative: you say what you want, and ARM works out the order and creates or updates resources to match.",
    ],
    engineer=[
        "ARM JSON sections: $schema, contentVersion, parameters (type, defaultValue, allowedValues, minValue/maxValue, metadata; secureString/secureObject for secrets), variables, functions, resources (type, apiVersion, name, location, properties, dependsOn, copy, condition), outputs. Template functions include resourceId(), reference(), concat()/format(), uniqueString(), resourceGroup().location.",
        "Bicep: param (with decorators such as @secure(), @allowed(), @minLength()), var, resource symbolicName 'type@apiVersion' = {...}, module, output, existing, for-loops and if-conditions. Referencing another resource's symbolic name (vnet.id) creates an implicit dependency; explicit dependsOn is rarely needed. az bicep build compiles to JSON; az bicep decompile converts JSON to Bicep on a best-effort basis.",
        "ARM deploys resources in parallel unless dependencies say otherwise. A missing dependency causes intermittent 'not found' failures; a circular dependency fails validation.",
        "Scopes: resource group (az deployment group create), subscription (az deployment sub create, for example resource groups and policy), management group and tenant. Parameters come from the command line, a .parameters.json file or a .bicepparam file; secrets can be pulled from Key Vault references.",
        "Modes: Incremental (default) adds and updates resources and leaves others unchanged. Complete deletes resources in the resource group that are not in the template (resource group scope only). Always run what-if (az deployment group what-if) before Complete mode or risky changes; az deployment group validate runs preflight validation.",
        "Exporting: 'Export template' on a resource group captures current state with hard-coded values, and some resource types cannot be exported. The deployment history (Deployments blade) keeps the exact template and parameters used. Templates can be published as template specs for reuse with RBAC.",
    ],
    anim=("arm-sim", "Edit a template's dependencies and parameters, deploy in Incremental or Complete mode, and export/decompile."),
    diagram=([("p", "Parameters + .bicepparam", 0, 0, "service"), ("t", "main.bicep → ARM JSON", 220, 0, "service"), ("arm", "Azure Resource Manager", 440, 0, "security"),
              ("vnet", "vnet", 300, 140, "network"), ("nic", "nic (depends on vnet)", 500, 140, "network"), ("vm", "vm (depends on nic)", 700, 140, "compute")],
             [("p", "t"), ("t", "arm", "validate + what-if"), ("arm", "vnet", "wave 1"), ("vnet", "nic", "wave 2"), ("nic", "vm", "wave 3")]),
    example=("Promoting a network template", [
        "The platform team keeps network.bicep in Git. A pull request changes the subnet prefix; the pipeline runs az deployment group what-if, which shows a Modify on the subnet and no deletes.",
        "Once approved, the pipeline deploys in Incremental mode with environment-specific .bicepparam files for dev and prod. An old hand-made storage account in the resource group is untouched, because Complete mode is not used.",
    ]),
    config=dict(
        prerequisites=["Azure CLI with Bicep (az bicep install) or Azure PowerShell", "Target resource group or subscription"],
        permissions=["Microsoft.Resources/deployments/* at the target scope (Contributor or Owner)", "Permissions for every resource type in the template"],
        limits=["Template size 4 MB; 256 parameters; 800 resources per deployment", "Deployment history keeps up to 800 deployments per resource group (old ones are deleted automatically)", "Complete mode only at resource group scope"],
        portal=["Deploy a custom template > Build your own template in the editor, or load a quickstart.", "Resource group > Deployments: view history, inputs, outputs and the template; redeploy.",
                "Resource group > Automation > Export template: download or save to the template library.", "Template specs: create and version reusable templates."],
        cli="az deployment group validate -g rg-app --template-file main.bicep --parameters main.bicepparam\naz deployment group what-if -g rg-app --template-file main.bicep --parameters main.bicepparam\naz deployment group create -g rg-app --template-file main.bicep --parameters main.bicepparam\naz deployment group create -g rg-app --template-file main.json --parameters @main.parameters.json --mode Complete\naz group export --name rg-app > exported.json\naz bicep decompile --file exported.json\naz bicep build --file main.bicep\naz deployment group export -g rg-app --name main",
        powershell="Test-AzResourceGroupDeployment -ResourceGroupName rg-app -TemplateFile main.bicep -TemplateParameterFile main.parameters.json\nNew-AzResourceGroupDeployment -ResourceGroupName rg-app -TemplateFile main.bicep -TemplateParameterFile main.parameters.json -WhatIf\nNew-AzResourceGroupDeployment -ResourceGroupName rg-app -TemplateFile main.bicep -TemplateParameterFile main.parameters.json -Mode Incremental\nExport-AzResourceGroup -ResourceGroupName rg-app -Path .\\exported.json\nSave-AzResourceGroupDeploymentTemplate -ResourceGroupName rg-app -DeploymentName main",
        bicep="@description('Storage SKU')\n@allowed([ 'Standard_LRS', 'Standard_ZRS' ])\nparam storageSku string = 'Standard_LRS'\nparam location string = resourceGroup().location\n@secure()\nparam adminPassword string\n\nresource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {\n  name: 'vnet-app'\n  location: location\n  properties: {\n    addressSpace: { addressPrefixes: [ '10.20.0.0/16' ] }\n    subnets: [ { name: 'snet-app', properties: { addressPrefix: '10.20.1.0/24' } } ]\n  }\n}\n\nresource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = {\n  name: 'nic-vm1'\n  location: location\n  properties: {\n    ipConfigurations: [ { name: 'ipconfig1', properties: { subnet: { id: vnet.properties.subnets[0].id } } } ]\n  }\n}\n\noutput nicId string = nic.id",
    ),
    lab=dict(type="A", objective="Deploy a template, fix dependency and parameter errors, and understand what Complete mode deletes.", duration=20,
             steps=["Run the default Bicep deployment and read the deployment waves.", "Apply 'Missing dependency', then 'Circular dependency' and 'Parameter not in allowedValues'. Read each failure.",
                    "Open Incremental vs Complete. Compare what happens to stlegacy, with and without a lock.", "Open Export and convert. Export, then decompile."],
             expected=["Waves [vnet, storage] → [nic] → [vm]", "Validation errors for cycles and allowedValues", "Complete mode deletes stlegacy unless locked"],
             validation=[("arm-failed", "Saw a deployment fail validation"), ("arm-deployed", "Deployed successfully"), ("complete-mode", "Ran a Complete-mode deployment"), ("template-decompiled", "Exported and decompiled a template")],
             failures=["Missing dependsOn", "Circular dependency", "Complete mode deleting unmanaged resources"]),
    troubleshooting=[("InvalidTemplate: circular dependency detected.", "Two resources depend on each other directly or indirectly.", "Remove the dependency that is not needed, or split into modules."),
                     ("ResourceNotFound for a subnet during deployment, but it works on retry.", "Missing dependency causes a race.", "Reference the VNet's symbolic name (Bicep) or add dependsOn with resourceId() (JSON)."),
                     ("Deployment deleted resources unexpectedly.", "Complete mode removed resources not in the template.", "Use Incremental, or run what-if first; protect key resources with locks."),
                     ("Exported template fails to redeploy.", "Export contains hard-coded values and read-only properties, and may miss unsupported types.", "Clean it up and parameterise, or start from the deployment history or a quickstart.")],
    comparisons=[("Terraform", "Multi-cloud IaC with a state file; ARM/Bicep has no state file, because Azure is the source of truth."), ("AWS CloudFormation", "AWS's declarative templates (JSON/YAML); stacks are similar to deployments plus deployment stacks.")],
    misconceptions=[("Bicep is deployed by a separate Bicep service.", "Bicep is compiled to ARM JSON and deployed by ARM."), ("Incremental mode deletes resources removed from the template.", "Only Complete mode deletes them."),
                    ("dependsOn is always required in Bicep.", "Symbolic references create implicit dependencies.")],
    decisions=["Author in Bicep, store in Git, deploy through pipelines with what-if.", "Use modules for reusable components and template specs to share them.", "Keep secrets out of parameter files: use @secure() and Key Vault references."],
    docs=[("Template structure and syntax", ML + "azure-resource-manager/templates/syntax"), ("What is Bicep?", ML + "azure-resource-manager/bicep/overview"),
          ("Deployment modes", ML + "azure-resource-manager/templates/deployment-modes"), ("What-if operation", ML + "azure-resource-manager/templates/deploy-what-if"),
          ("Export template in the portal", ML + "azure-resource-manager/templates/export-template-portal"), ("Decompiling ARM template JSON to Bicep", ML + "azure-resource-manager/bicep/decompile"),
          ("Resource dependencies in Bicep", ML + "azure-resource-manager/bicep/resource-dependencies")],
)

q("az104-q-arm-01", E, "AZ104-3.1.1", 1, "single", "single", "In an ARM template, which section holds values supplied at deployment time, such as a VM admin username?",
  [("a", "parameters", "Correct."), ("b", "variables", "Variables are computed inside the template."), ("c", "outputs", "Outputs return values after deployment."), ("d", "resources", "Resources define what to deploy.")], ["a"], "Parameters are inputs; variables are internal values.", [ML + "azure-resource-manager/templates/syntax"])
q("az104-q-arm-02", E, "AZ104-3.1.1", 2, "command", "single", "What does this Bicep declaration do?", "@allowed([ 'Standard_LRS', 'Standard_ZRS' ])\nparam storageSku string = 'Standard_LRS'",
  [("a", "Defines a parameter that only accepts the two listed values, defaulting to Standard_LRS", "Correct."), ("b", "Creates two storage accounts", "No resources are created by a param."), ("c", "Sets a variable that cannot be overridden", "It is a parameter and can be overridden within the allowed values."), ("d", "Outputs the SKU after deployment", "That would be an output.")], ["a"], "Decorators like @allowed validate parameter values before deployment.", [ML + "azure-resource-manager/bicep/parameters"])
q("az104-q-arm-03", E, "AZ104-3.1.2", 2, "troubleshooting", "single", "An ARM JSON template creates a VNet and a NIC that uses its subnet. Deployments fail intermittently with 'subnet not found'. What should you change?",
  [("a", "Add a dependsOn entry on the NIC referencing the VNet's resourceId()", "Correct. Without it ARM may deploy both in parallel."), ("b", "Switch to Complete mode", "Mode does not affect ordering."), ("c", "Deploy twice", "A workaround, not a fix."), ("d", "Move the NIC to the outputs section", "Outputs do not create resources.")], ["a"], "In JSON, ordering comes from dependsOn; in Bicep from symbolic references.", [ML + "azure-resource-manager/templates/resource-dependency"])
q("az104-q-arm-04", E, "AZ104-3.1.2", 2, "configuration", "single", "You must make the storage account name in an existing ARM template globally unique per resource group without hard-coding it. Which expression do you use for the name?",
  [("a", "[concat('st', uniqueString(resourceGroup().id))]", "Correct. uniqueString is deterministic per resource group."), ("b", "[parameters('location')]", "That returns the location."), ("c", "[newGuid()] in the resource name", "newGuid only works in parameter defaults and changes on every deployment."), ("d", "[resourceGroup().name]", "May contain invalid characters and is not globally unique.")], ["a"], "uniqueString() returns a stable 13-character hash.", [ML + "azure-resource-manager/templates/template-functions-string"])
q("az104-q-arm-05", E, "AZ104-3.1.3", 2, "configuration", "single", "In a Bicep file, the NIC must reference the subnet of vnet (declared as resource vnet). Which property value creates the correct implicit dependency?",
  [("a", "subnet: { id: vnet.properties.subnets[0].id }", "Correct. Referencing the symbolic name creates the dependency."), ("b", "subnet: { id: 'vnet/subnets/snet-app' }", "A string has no dependency and is not a valid ID."), ("c", "dependsOn: [ 'vnet' ] with a hard-coded ID", "Works, but is unnecessary when you reference the resource."), ("d", "subnet: resourceGroup().id", "Wrong ID.")], ["a"], "Bicep infers dependencies from symbolic references.", [ML + "azure-resource-manager/bicep/resource-dependencies"])
q("az104-q-arm-06", E, "AZ104-3.1.3", 1, "single", "single", "Which keyword in Bicep references a resource that already exists without deploying it?",
  [("a", "existing", "Correct."), ("b", "module", "Modules deploy other Bicep files."), ("c", "output", "Returns values."), ("d", "param", "Declares inputs.")], ["a"], "resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = { name: 'kv1' }", [ML + "azure-resource-manager/bicep/existing-resource"])
q("az104-q-arm-07", E, "AZ104-3.1.4", 3, "scenario", "single", "RG1 contains VM1, VNet1 and Storage1. You deploy a template containing only VNet1 and Storage1 with --mode Complete. What happens to VM1?",
  [("a", "VM1 is deleted.", "Correct. Complete mode deletes resources not in the template."), ("b", "VM1 is unchanged.", "That is Incremental mode."), ("c", "The deployment fails validation.", "It is valid."), ("d", "VM1 is stopped.", "Resources are deleted, not stopped.")], ["a"], "Run what-if before Complete-mode deployments.", [ML + "azure-resource-manager/templates/deployment-modes"])
q("az104-q-arm-08", E, "AZ104-3.1.4", 2, "command", "single", "What does this command do?", "az deployment group what-if -g rg-app --template-file main.bicep --parameters main.bicepparam",
  [("a", "Shows the resources that would be created, modified or deleted, without changing anything", "Correct."), ("b", "Deploys and then rolls back", "No deployment happens."), ("c", "Exports the current resources", "That is export."), ("d", "Validates syntax only", "It goes beyond validation and predicts changes.")], ["a"], "what-if previews changes; validate checks preflight rules.", [ML + "azure-resource-manager/templates/deploy-what-if"])
q("az104-q-arm-09", E, "AZ104-3.1.5", 2, "scenario", "single", "You need an existing hand-built resource group as a Bicep file to start managing it as code. What is the fastest supported approach?",
  [("a", "Export the template from the resource group, then run az bicep decompile and clean up the result", "Correct."), ("b", "Run az bicep build on the resource group", "build compiles Bicep to JSON, not the reverse."), ("c", "Use Complete mode with an empty template", "That would delete everything."), ("d", "Copy the activity log", "Not a template.")], ["a"], "Decompilation is best-effort; parameterise hard-coded values afterwards.", [ML + "azure-resource-manager/bicep/decompile"])
q("az104-q-arm-10", E, "AZ104-3.1.5", 2, "multiple", "multiple", "Which TWO statements about exporting templates are true?",
  [("a", "A template exported from a resource group reflects current state with hard-coded values.", "Correct."), ("b", "Some resource types cannot be exported.", "Correct."), ("c", "Exported templates always include secrets such as VM passwords.", "Secrets are not exported."), ("d", "Exporting requires Complete mode.", "Export has no mode.")], ["a", "b"], "Use the deployment history to get the template exactly as it was deployed.", [ML + "azure-resource-manager/templates/export-template-portal"])

# ---------------------------------------------------------------- 3.2 VMs
VMDOCS = [("Virtual machines in Azure", ML + "virtual-machines/overview"), ("Create a Linux VM with the Azure CLI", ML + "virtual-machines/linux/quick-create-cli"),
          ("Change the size of a virtual machine", ML + "virtual-machines/sizes/resize-vm"), ("Move a VM to another resource group or subscription", ML + "azure-resource-manager/management/move-limitations/virtual-machines-move-limitations"),
          ("Move Azure VMs to another region (Resource Mover)", ML + "resource-mover/tutorial-move-region-virtual-machines"), ("Check vCPU quotas", ML + "virtual-machines/quotas")]
lesson(
    id="az104-vm-create", exam=E, title="Creating, sizing and moving virtual machines",
    objectives=["AZ104-3.2.1", "AZ104-3.2.3", "AZ104-3.2.4"], minutes=60,
    objective="Create VMs that pass quota, SKU, credential and network checks, resize them correctly, and move them across resource groups, subscriptions or regions with the right tool.",
    prereqs=[("Resources required for virtual machines (AZ-900)", "AZ900-2.2.3"), ("VNets and NSGs", "AZ104-4.2.1", "az104-nsg-asg")],
    foundation=[
        "A virtual machine is a computer you rent in Azure. You choose an operating system image, a size (CPU and memory), disks and the network it connects to.",
        "A VM is made of several resources: the VM itself, an OS disk, usually a network interface (NIC) in a subnet, and optionally a public IP and an NSG.",
        "You can change a VM's size later. If the new size is not available on the hardware it runs on, you have to stop (deallocate) it first.",
        "Moving a VM to another resource group keeps it in the same region; moving it to another region needs a different tool.",
    ],
    engineer=[
        "Creation checks: regional and per-family vCPU quotas (az vm list-usage), SKU availability per region and zone (az vm list-skus), image and generation (Gen2 with Trusted Launch is the default for supported images), admin credentials (reserved usernames such as 'admin' are rejected; Windows passwords must be 12–123 characters and meet complexity), and networking (VNet/subnet, optional public IP, NIC-level or subnet NSG).",
        "Management options at creation: boot diagnostics, auto-shutdown, backup, extensions (for example the Azure Monitor agent), and Spot pricing for interruptible workloads.",
        "VM sizes are grouped into families: B (burstable), D (general purpose), E (memory optimised), F (compute optimised), L (storage optimised), N (GPU). Each size limits vCPU, memory, data disks, NICs and throughput.",
        "Resizing restarts the VM. If the target size is not available on the current hardware cluster, deallocate first; for VMs in an availability set, all VMs in the set must be deallocated. az vm list-vm-resize-options shows the sizes available without deallocation.",
        "Moving: within or across subscriptions in the same tenant with resource move (move the VM with its disks, NICs, public IPs and other dependencies; the region stays the same, the resource ID changes). Across regions with Azure Resource Mover or by replicating with Azure Site Recovery. Moving into an availability zone requires recreating the VM or using the zone-move capability.",
        "Deallocated VMs stop compute billing but keep disk billing; 'Stopped' from inside the OS keeps compute allocated and billed.",
    ],
    anim=("vm-sim", "Create a VM and hit quota, SKU and credential errors; resize; move it."),
    diagram=([("img", "Image (Ubuntu 22.04 Gen2)", 0, 0, "storage"), ("vm", "vm1 Standard_D2s_v5", 240, 60, "compute"), ("os", "OS disk (Premium SSD)", 0, 140, "storage"),
              ("nic", "NIC → snet-app", 480, 0, "network"), ("nsg", "NSG", 480, 140, "security")],
             [("img", "vm"), ("os", "vm"), ("vm", "nic"), ("nic", "nsg")]),
    example=("Right-sizing a reporting server", [
        "A reporting VM on Standard_D2s_v5 hits 95% memory every month-end. The admin lists resize options, sees Standard_E4s_v5 is not available on the current cluster, deallocates the VM in a maintenance window, resizes and starts it again.",
        "Later the team moves the VM, its disks and NIC to a new resource group with resource move, and uses Azure Resource Mover to create a copy in North Europe.",
    ]),
    config=dict(
        prerequisites=["VNet and subnet", "vCPU quota for the family in the region", "SSH key or compliant password"],
        permissions=["Virtual Machine Contributor (VM) plus Network Contributor or join permissions on the subnet", "Microsoft.Resources/subscriptions/resourceGroups/moveResources/action for moves"],
        limits=["Quotas per region and VM family", "Resizing restarts the VM", "Resource move keeps the region"],
        portal=["Virtual machines > Create: Basics (image, size, auth, inbound ports), Disks, Networking, Management, Monitoring, Advanced, Tags.", "VM > Availability + scale > Size: choose a new size (deallocate if required).",
                "VM > Overview > Move > Move to another resource group / subscription / region (region launches Resource Mover).", "Subscriptions > Usage + quotas: request vCPU increases."],
        cli="az vm list-skus --location westeurope --size Standard_D --zone -o table\naz vm list-usage --location westeurope -o table\naz vm create -g rg-app -n vm1 --image Ubuntu2204 --size Standard_D2s_v5 --zone 1 \\\n  --admin-username azureuser --generate-ssh-keys --vnet-name vnet-app --subnet snet-app --public-ip-address \"\" --nsg \"\"\naz vm list-vm-resize-options -g rg-app -n vm1 -o table\naz vm deallocate -g rg-app -n vm1 && az vm resize -g rg-app -n vm1 --size Standard_E4s_v5 && az vm start -g rg-app -n vm1\naz resource move --destination-group rg-app-prod --ids <vm-id> <osdisk-id> <nic-id>",
        powershell="New-AzVM -ResourceGroupName rg-app -Name vm1 -Location westeurope -Image Ubuntu2204 -Size Standard_D2s_v5 -Zone 1 `\n  -VirtualNetworkName vnet-app -SubnetName snet-app -Credential (Get-Credential)\nGet-AzVMSize -ResourceGroupName rg-app -VMName vm1\n$vm = Get-AzVM -ResourceGroupName rg-app -Name vm1\n$vm.HardwareProfile.VmSize = 'Standard_E4s_v5'\nUpdate-AzVM -ResourceGroupName rg-app -VM $vm\nMove-AzResource -DestinationResourceGroupName rg-app-prod -ResourceId $vm.Id, $vm.StorageProfile.OsDisk.ManagedDisk.Id",
        bicep="resource vm 'Microsoft.Compute/virtualMachines@2024-03-01' = {\n  name: 'vm1'\n  location: location\n  zones: [ '1' ]\n  properties: {\n    hardwareProfile: { vmSize: 'Standard_D2s_v5' }\n    osProfile: { computerName: 'vm1', adminUsername: 'azureuser', linuxConfiguration: { disablePasswordAuthentication: true, ssh: { publicKeys: [ { path: '/home/azureuser/.ssh/authorized_keys', keyData: sshKey } ] } } }\n    storageProfile: { imageReference: { publisher: 'Canonical', offer: '0001-com-ubuntu-server-jammy', sku: '22_04-lts-gen2', version: 'latest' }, osDisk: { createOption: 'FromImage', managedDisk: { storageAccountType: 'Premium_LRS' } } }\n    networkProfile: { networkInterfaces: [ { id: nicId } ] }\n  }\n}\nparam location string = resourceGroup().location\nparam sshKey string\nparam nicId string",
    ),
    lab=dict(type="A", objective="Create a VM, then resize and move it with the right method.", duration=20,
             steps=["Create VM: try the quota, reserved username and zone presets, then fix them.", "Resize, disks and encryption: untick 'available on cluster' and read the resize message.",
                    "Move a VM: try a region move with resource move, then with Azure Resource Mover."],
             expected=["Quota, SKU and username errors explained", "Resize requires deallocation when the size is not on the cluster", "Region moves need Resource Mover or Site Recovery"],
             validation=[("vm-create-failed", "Saw a VM creation fail"), ("vm-created", "Created a VM"), ("resize-deallocate", "Resized with deallocation"), ("vm-moved-region", "Moved a VM to another region")],
             failures=["Quota exhausted", "Reserved username", "Resource move across regions"]),
    troubleshooting=[("OperationNotAllowed: exceeds approved Total Regional Cores quota.", "Quota exhausted.", "Request an increase in Usage + quotas or choose a smaller size."),
                     ("SkuNotAvailable.", "Size not offered in the region/zone or restricted for the subscription.", "az vm list-skus to find alternatives."),
                     ("Resize option is missing for the running VM.", "Size not on the current cluster.", "Deallocate (all VMs in the availability set) and resize."),
                     ("Move validation fails for the VM.", "Dependent disks/NICs not included, or the VM has unsupported configurations.", "Include all dependencies; check the VM move limitations page.")],
    comparisons=[("Amazon EC2", "Comparable IaaS; EC2 instance types correspond to Azure VM sizes; stopping an EBS-backed instance is similar to deallocating."), ("Azure App Service / Container Apps", "PaaS options without OS management.")],
    misconceptions=[("Shutting down from inside Windows stops billing.", "Only deallocating (Stop in the portal) releases compute billing."), ("Moving a VM to another resource group changes its region.", "Region is unchanged."),
                    ("You can always resize a running VM to any size.", "Only sizes available on its current hardware cluster.")],
    decisions=["Use Bastion instead of public IPs for admin access.", "Pick sizes by measured CPU/memory; use Advisor for right-sizing.", "Automate creation with Bicep and image definitions (Compute Gallery)."],
    docs=VMDOCS,
)

lesson(
    id="az104-vm-disks-encryption", exam=E, title="Managed disks and disk encryption",
    objectives=["AZ104-3.2.2", "AZ104-3.2.5"], minutes=50,
    objective="Add, expand, convert, snapshot and detach managed disks, and choose and configure the right encryption option, including Azure Disk Encryption.",
    prereqs=[("Creating VMs", "AZ104-3.2.1", "az104-vm-create"), ("Customer-managed keys", "AZ104-2.2.4", "az104-storage-accounts")],
    foundation=[
        "VM disks in Azure are managed disks: Azure handles the underlying storage. Each VM has an OS disk, can have data disks, and often a temporary disk that is wiped on redeployment.",
        "Disk types trade speed for price: Standard HDD, Standard SSD, Premium SSD, Premium SSD v2 and Ultra Disk.",
        "All managed disks are encrypted at rest automatically. You can add your own keys, encryption at the host, or Azure Disk Encryption, which encrypts the volumes inside the operating system.",
    ],
    engineer=[
        "Operations: attach or detach data disks while the VM runs; expand disk size (shrinking is not supported; data disks can often be expanded without downtime, then extend the partition in the OS); change disk type (for example Standard SSD → Premium SSD) with the VM deallocated; incremental snapshots for backup or cloning; host caching (None/ReadOnly/ReadWrite) per disk.",
        "Limits: the VM size sets the maximum number of data disks and combined IOPS/throughput; Premium SSD performance depends on disk size (P-tiers) unless you use Premium SSD v2 or Ultra, where IOPS and throughput are set independently. Ultra and Premium SSD v2 have restrictions such as no OS disk support (Ultra) and zone requirements.",
        "Encryption options: server-side encryption (SSE) with platform-managed keys (default, always on); SSE with customer-managed keys through a disk encryption set pointing to a Key Vault key; encryption at host (also encrypts temp disks and disk caches, needs the feature enabled and a supported size); Azure Disk Encryption (ADE), which uses BitLocker (Windows) or DM-Crypt (Linux) inside the guest with keys and secrets in Key Vault.",
        "ADE requirements: Key Vault in the same region and subscription as the VM, with 'Azure Disk Encryption for volume encryption' enabled (enabledForDiskEncryption); optionally a key encryption key (KEK). ADE does not work on some sizes and images, and cannot be combined with encryption at host. Microsoft recommends encryption at host for new deployments and has announced a retirement date for ADE, so check current guidance before choosing it.",
        "Confidential disk encryption is available for confidential VMs.",
    ],
    anim=("vm-sim", "Open 'Resize, disks and encryption': try disk operations and encryption options."),
    diagram=([("vm", "vm1", 0, 60, "compute"), ("os", "OS disk", 220, 0, "storage"), ("data", "Data disk 256 GiB (Premium SSD)", 220, 130, "storage"),
              ("des", "Disk encryption set (CMK)", 480, 0, "security"), ("kv", "Key Vault (enabledForDiskEncryption)", 480, 130, "security")],
             [("vm", "os"), ("vm", "data"), ("os", "des", "SSE + CMK"), ("data", "kv", "ADE (in-guest)")]),
    example=("Expanding a full data disk", [
        "A database VM's 128 GiB data disk is 95% full. The admin expands it to 256 GiB in the portal while the VM runs, then extends the volume in Disk Management.",
        "Compliance later requires customer-managed keys, so the team creates a disk encryption set with a Key Vault key and assigns it to the disks.",
    ]),
    config=dict(
        prerequisites=["Supported VM size for the disk type", "For ADE: Key Vault in the same region/subscription, enabled for disk encryption", "For encryption at host: feature registered"],
        permissions=["Virtual Machine Contributor / Disk Pool roles for disk operations", "Key Vault access for disk encryption sets or ADE"],
        limits=["Disks cannot be shrunk", "Changing disk type requires deallocation", "Max data disks depends on VM size"],
        portal=["VM > Disks > + Create and attach a new disk / Attach existing; Detach.", "Disk > Size + performance: increase size or change tier.", "Disk > Encryption: choose encryption type and disk encryption set.",
                "Disk > Create snapshot (incremental).", "VM > Disks > Additional settings: encryption at host, Azure Disk Encryption."],
        cli="az vm disk attach -g rg-app --vm-name vm1 --name vm1-data1 --new --size-gb 128 --sku Premium_LRS\naz disk update -g rg-app -n vm1-data1 --size-gb 256\naz vm deallocate -g rg-app -n vm1 && az disk update -g rg-app -n vm1-data1 --sku Premium_LRS\naz snapshot create -g rg-app -n vm1-data1-snap --source vm1-data1 --incremental true\naz keyvault update -n kv-contoso --enabled-for-disk-encryption true\naz vm encryption enable -g rg-app -n vm1 --disk-encryption-keyvault kv-contoso --volume-type All\naz feature register --namespace Microsoft.Compute --name EncryptionAtHost\naz vm update -g rg-app -n vm1 --set securityProfile.encryptionAtHost=true",
        powershell="$vm = Get-AzVM -ResourceGroupName rg-app -Name vm1\n$cfg = New-AzDiskConfig -Location westeurope -CreateOption Empty -DiskSizeGB 128 -SkuName Premium_LRS\n$disk = New-AzDisk -ResourceGroupName rg-app -DiskName vm1-data1 -Disk $cfg\nAdd-AzVMDataDisk -VM $vm -Name vm1-data1 -CreateOption Attach -ManagedDiskId $disk.Id -Lun 0 | Update-AzVM\n$kv = Get-AzKeyVault -VaultName kv-contoso\nSet-AzVMDiskEncryptionExtension -ResourceGroupName rg-app -VMName vm1 -DiskEncryptionKeyVaultUrl $kv.VaultUri -DiskEncryptionKeyVaultId $kv.ResourceId -VolumeType All",
    ),
    lab=dict(type="A", objective="Predict which disk operations need downtime and which encryption prerequisites are missing.", duration=15,
             steps=["Try each disk operation, with the VM running and deallocated.", "Select Azure Disk Encryption and fix the Key Vault prerequisites.", "Compare SSE with CMK and encryption at host."],
             expected=["Shrinking is blocked; type change needs deallocation", "ADE needs Key Vault enabled for disk encryption in the same region"],
             validation=[("disk-blocked", "Saw a disk operation blocked"), ("ade-enabled", "Enabled Azure Disk Encryption successfully")],
             failures=["Shrinking a disk", "Key Vault in another region", "Too many data disks for the size"]),
    troubleshooting=[("Cannot reduce disk size.", "Shrinking is not supported.", "Create a smaller disk and copy data."), ("ADE extension fails.", "Key Vault not enabled for disk encryption or in another region.", "az keyvault update --enabled-for-disk-encryption true; use a vault in the VM's region."),
                     ("New disk size not visible in the OS.", "Partition not extended.", "Extend the volume (Disk Management / growpart and resize2fs)."), ("Cannot attach another data disk.", "Size limit reached.", "Resize the VM to one with more data disk slots.")],
    comparisons=[("Amazon EBS", "Block volumes similar to managed disks; gp3/io2 correspond to Premium SSD v2/Ultra-like provisioning."), ("Azure Files", "Shared SMB/NFS file storage rather than a block device.")],
    misconceptions=[("Disks are unencrypted unless you enable ADE.", "SSE with platform-managed keys is always on."), ("You can switch a disk to Premium while the VM runs.", "Disk type changes need the VM deallocated."), ("Temp disk data survives redeployment.", "The temp disk is wiped.")],
    decisions=["Use Premium SSD (or v2) for production databases.", "Prefer encryption at host or SSE with CMK over ADE for new deployments.", "Snapshot before risky changes."],
    docs=[("Azure managed disk types", ML + "virtual-machines/disks-types"), ("Expand virtual hard disks on a Linux VM", ML + "virtual-machines/linux/expand-disks"),
          ("Change the disk type of a managed disk", ML + "virtual-machines/disks-convert-types"), ("Overview of managed disk encryption options", ML + "virtual-machines/disk-encryption-overview"),
          ("Azure Disk Encryption for Windows VMs", ML + "virtual-machines/windows/disk-encryption-overview"), ("Encryption at host", ML + "virtual-machines/disks-enable-host-based-encryption-portal")],
)

lesson(
    id="az104-vm-availability", exam=E, title="Availability sets and availability zones for VMs",
    objectives=["AZ104-3.2.6"], minutes=35,
    objective="Deploy VMs into availability sets or zones, explain fault and update domains, and match each option to the failures it survives and its SLA.",
    prereqs=[("Availability zones (AZ-900)", "AZ900-2.1.2"), ("Creating VMs", "AZ104-3.2.1", "az104-vm-create")],
    foundation=[
        "One VM can fail when its server or rack fails, or reboot during maintenance. Running two or more VMs spread out keeps your app up.",
        "An availability set spreads VMs across different racks (fault domains) and maintenance groups (update domains) inside one datacenter.",
        "Availability zones are separate datacenters in a region. Spreading VMs across zones also survives the loss of a whole datacenter.",
        "You choose the set or zone when you create the VM.",
    ],
    engineer=[
        "Availability set: up to 3 fault domains (shared power and network; 2 or 3 depending on region) and up to 20 update domains (default 5) that are rebooted one at a time during planned maintenance. Use the Aligned SKU for managed disks so disks follow fault domains. Compute SLA: 99.95% for two or more VMs in a set.",
        "Availability zones: physically separate locations with independent power, cooling and networking. Place VMs in different zones (zones: ['1'], ['2'], ['3']) and use zone-redundant services (Standard Load Balancer, Standard public IP, ZRS disks where supported). SLA: 99.99% for two or more VMs across two or more zones.",
        "Single VM SLA: 99.9% when all disks are Premium SSD, Premium SSD v2 or Ultra (lower for other disk types).",
        "Constraints: a VM's availability set is set at creation (you cannot add an existing VM to a set; recreate it from its disks). A VM cannot be in both an availability set and a zone. Virtual Machine Scale Sets in Flexible mode can spread across zones and fault domains automatically.",
        "Neither option protects against a region-wide outage; use Azure Site Recovery to a second region for that. Proximity placement groups reduce latency, at the cost of spreading.",
    ],
    anim=("vm-sim", "Open 'Availability sets vs zones': place VMs and inject rack, maintenance, zone and region failures."),
    diagram=([("lb", "Standard Load Balancer", 260, 0, "network"), ("z1", "Zone 1: vm-web-1", 0, 140, "compute"), ("z2", "Zone 2: vm-web-2", 260, 140, "compute"), ("z3", "Zone 3: vm-web-3", 520, 140, "compute")],
             [("lb", "z1"), ("lb", "z2"), ("lb", "z3")]),
    example=("Choosing for an intranet app", [
        "An intranet app with modest uptime needs runs on two VMs in an availability set (99.95%). A customer-facing checkout service runs three VMs across zones behind a zone-redundant Standard Load Balancer (99.99%).",
        "Both teams also replicate to a paired region with Site Recovery, because neither option protects against regional disasters.",
    ]),
    config=dict(
        prerequisites=["Region with availability zones (for zones)", "Load balancer to distribute traffic"],
        permissions=["Virtual Machine Contributor"], limits=["Fault domains up to 3; update domains up to 20", "Set or zone chosen at VM creation", "Not both set and zone"],
        portal=["Create VM > Availability options: Availability zone (pick zones) or Availability set (create/select).", "Availability sets > Create: fault and update domain counts."],
        cli="az vm availability-set create -g rg-app -n avset-web --platform-fault-domain-count 2 --platform-update-domain-count 5\naz vm create -g rg-app -n vm-web-1 --image Ubuntu2204 --availability-set avset-web --admin-username azureuser --generate-ssh-keys\naz vm create -g rg-app -n vm-web-z1 --image Ubuntu2204 --zone 1 --admin-username azureuser --generate-ssh-keys\naz vm create -g rg-app -n vm-web-z2 --image Ubuntu2204 --zone 2 --admin-username azureuser --generate-ssh-keys",
        powershell="New-AzAvailabilitySet -ResourceGroupName rg-app -Name avset-web -Location westeurope -PlatformFaultDomainCount 2 -PlatformUpdateDomainCount 5 -Sku Aligned\nNew-AzVM -ResourceGroupName rg-app -Name vm-web-z1 -Location westeurope -Image Ubuntu2204 -Zone 1 -Credential (Get-Credential)",
        bicep="resource avset 'Microsoft.Compute/availabilitySets@2024-03-01' = {\n  name: 'avset-web'\n  location: resourceGroup().location\n  sku: { name: 'Aligned' }\n  properties: { platformFaultDomainCount: 2, platformUpdateDomainCount: 5 }\n}",
    ),
    lab=dict(type="A", objective="Show which placement survives which failure.", duration=10,
             steps=["Availability set with 4 VMs: inject host failure and maintenance.", "Inject a zone failure with the availability set.", "Switch to zones with 3 VMs and inject a zone failure, then a region outage."],
             expected=["Sets survive rack/maintenance events", "Only zones survive a datacenter loss", "Nothing in one region survives a region outage"],
             validation=[("placement-set", "Tested an availability set"), ("zone-survived", "Survived a zone failure with zones")],
             failures=["Single VM", "Region outage"]),
    troubleshooting=[("Cannot add an existing VM to an availability set.", "Set membership is defined at creation.", "Recreate the VM from its disks in the set."), ("Allocation failure when adding VMs to a set.", "Cluster capacity for that size.", "Deallocate all VMs and start them together, or choose another size."),
                     ("Zone option missing.", "Region or size has no zone support.", "Choose a zone-enabled region/size.")],
    comparisons=[("AWS placement groups / multi-AZ", "EC2 spread placement groups resemble availability sets; deploying across AZs resembles Azure zones."), ("VM Scale Sets (Flexible)", "Automate spreading across zones and fault domains with autoscale.")],
    misconceptions=[("An availability set protects against datacenter failure.", "It spreads across racks in one datacenter."), ("A single VM in a zone gets 99.99%.", "99.99% needs two or more VMs across zones.")],
    decisions=["Use zones for business-critical tiers when the region supports them.", "Pair VM redundancy with zone-redundant load balancing and storage.", "Add a second region for disaster recovery."],
    docs=[("Availability options for Azure VMs", ML + "virtual-machines/availability"), ("Availability sets overview", ML + "virtual-machines/availability-set-overview"),
          ("Availability zones overview", ML + "reliability/availability-zones-overview"), ("SLA for online services", "https://www.microsoft.com/licensing/docs/view/Service-Level-Agreements-SLA-for-Online-Services")],
)

# VM questions
q("az104-q-vm-01", E, "AZ104-3.2.1", 2, "troubleshooting", "single", "Creating a Standard_E16s_v5 VM fails with 'Operation could not be completed as it results in exceeding approved standardESv5Family Cores quota'. What do you do?",
  [("a", "Request a quota increase for that VM family in the region (Usage + quotas)", "Correct."), ("b", "Change the OS image", "Unrelated to quota."), ("c", "Add a public IP", "Unrelated."), ("d", "Deploy to an availability set", "Quota still applies.")], ["a"], "Quotas apply per region and VM family.", [ML + "virtual-machines/quotas"])
q("az104-q-vm-02", E, "AZ104-3.2.1", 1, "single", "single", "Which VM admin username is rejected by Azure?",
  [("a", "admin", "Correct. It is on the reserved list."), ("b", "azureuser", "Valid."), ("c", "opsadmin01", "Valid."), ("d", "contosoops", "Valid.")], ["a"], "Names such as admin, administrator, root and guest are reserved.", ["https://learn.microsoft.com/azure/virtual-machines/windows/faq"])
q("az104-q-vm-03", E, "AZ104-3.2.4", 2, "scenario", "single", "VM1 in an availability set must be resized to a size not available on the current hardware cluster. What must you do?",
  [("a", "Deallocate all VMs in the availability set, resize VM1, then start them", "Correct."), ("b", "Resize VM1 while running", "The size is not offered on the current cluster."), ("c", "Move VM1 to another region first", "Unnecessary."), ("d", "Delete the availability set", "Destructive and unnecessary.")], ["a"], "Deallocating all VMs in the set lets them be placed on a cluster that supports the new size.", [ML + "virtual-machines/sizes/resize-vm"])
q("az104-q-vm-04", E, "AZ104-3.2.4", 1, "command", "single", "Which command lists the sizes VM1 can be resized to without deallocating?", "",
  [("a", "az vm list-vm-resize-options -g rg -n VM1", "Correct."), ("b", "az vm list-sizes --location westeurope", "Lists all sizes in the region, not those available on the current cluster."), ("c", "az vm list-usage", "Shows quota usage."), ("d", "az vm show -d", "Shows instance details.")], ["a"], "Use list-vm-resize-options before resizing a running VM.", ["https://learn.microsoft.com/cli/azure/vm#az-vm-list-vm-resize-options"])
q("az104-q-vm-05", E, "AZ104-3.2.3", 2, "scenario", "single", "You must move VM1 from West Europe to North Europe. Which tool should you use?",
  [("a", "Azure Resource Mover (or replicate with Azure Site Recovery)", "Correct."), ("b", "az resource move", "Resource move changes the resource group/subscription, not the region."), ("c", "Change the resource group's location", "That only changes metadata location."), ("d", "Export template and change location only", "Possible as a rebuild, but does not move disks/data.")], ["a"], "Region moves recreate the VM in the target region.", [ML + "resource-mover/tutorial-move-region-virtual-machines"])
q("az104-q-vm-06", E, "AZ104-3.2.3", 2, "troubleshooting", "single", "Moving VM1 to another resource group fails validation. VM1 has a managed OS disk, one data disk and a NIC. What is the most likely fix?",
  [("a", "Select the VM together with its disks and NIC in the same move", "Correct."), ("b", "Stop VM1 first", "Running state is not the dependency problem."), ("c", "Detach the NIC", "A VM needs a NIC."), ("d", "Convert disks to unmanaged", "Not supported and unnecessary.")], ["a"], "Dependent resources must move together.", [ML + "azure-resource-manager/management/move-limitations/virtual-machines-move-limitations"])
q("az104-q-vm-07", E, "AZ104-3.2.5", 2, "scenario", "single", "A 512 GiB data disk is only 10% used. You want a 128 GiB disk to save cost. What do you do?",
  [("a", "Create a new 128 GiB disk, copy the data, then swap the disks", "Correct. Managed disks cannot be shrunk."), ("b", "Reduce the size in Size + performance", "Shrinking is not supported."), ("c", "Change to Standard HDD", "Changes type, not size."), ("d", "Take a snapshot at 128 GiB", "A snapshot keeps the source size.")], ["a"], "Disks can only grow.", [ML + "virtual-machines/disks-types"])
q("az104-q-vm-08", E, "AZ104-3.2.5", 2, "troubleshooting", "single", "Changing a running VM's data disk from Standard SSD to Premium SSD fails. Why?",
  [("a", "Changing disk type requires the VM to be deallocated", "Correct (also check that the VM size supports premium storage)."), ("b", "Premium SSD cannot be used as a data disk", "It can."), ("c", "Disk must be detached and deleted", "No."), ("d", "Premium requires an availability set", "No.")], ["a"], "Deallocate, change the SKU, start again.", [ML + "virtual-machines/disks-convert-types"])
q("az104-q-vm-09", E, "AZ104-3.2.2", 2, "troubleshooting", "single", "Enabling Azure Disk Encryption on VM1 (West Europe) fails. The key vault is in North Europe. What is required?",
  [("a", "A key vault in the same region and subscription as the VM, enabled for disk encryption", "Correct."), ("b", "Geo-redundant disks", "Unrelated."), ("c", "A public IP on the VM", "Unrelated."), ("d", "Encryption at host enabled first", "ADE and encryption at host cannot be combined.")], ["a"], "ADE requires enabledForDiskEncryption on a vault in the VM's region.", [ML + "virtual-machines/windows/disk-encryption-key-vault"])
q("az104-q-vm-10", E, "AZ104-3.2.2", 2, "architecture", "single", "Security wants temp disks and disk caches encrypted too, without running encryption software inside the guest OS. Which option meets this?",
  [("a", "Encryption at host", "Correct."), ("b", "Azure Disk Encryption", "Works inside the guest (BitLocker/DM-Crypt)."), ("c", "SSE with platform-managed keys only", "Does not cover temp disks and caches."), ("d", "Storage account encryption scopes", "Not for managed disks.")], ["a"], "Encryption at host encrypts data on the VM host, including temp disks and caches.", [ML + "virtual-machines/disk-encryption"])
q("az104-q-vm-11", E, "AZ104-3.2.6", 2, "architecture", "single", "A web tier must survive the failure of an entire datacenter in the region with a 99.99% VM SLA. What do you deploy?",
  [("a", "Two or more VMs across availability zones", "Correct."), ("b", "Two VMs in an availability set", "99.95%, single datacenter."), ("c", "One VM with Premium SSD", "99.9%."), ("d", "Two VMs in a proximity placement group", "Reduces latency, not resilience.")], ["a"], "Zones protect against datacenter failures.", [ML + "virtual-machines/availability"])
q("az104-q-vm-12", E, "AZ104-3.2.6", 2, "scenario", "single", "Six VMs are in an availability set with 3 fault domains and 5 update domains. During planned maintenance, at most how many VMs reboot at the same time?",
  [("a", "2 (one update domain at a time; 6 VMs over 5 UDs puts at most 2 in one UD)", "Correct."), ("b", "6", "Update domains are rebooted one at a time."), ("c", "3", "That reflects fault domains, not maintenance."), ("d", "0", "Maintenance can require reboots.")], ["a"], "Update domains are serviced sequentially.", [ML + "virtual-machines/availability-set-overview"])
q("az104-q-vm-13", E, "AZ104-3.2.6", 1, "single", "single", "You created VM5 without an availability set. Can you add it to an existing availability set?",
  [("a", "No; recreate the VM in the set (for example from its disks)", "Correct."), ("b", "Yes, from the VM's Availability blade", "Not possible after creation."), ("c", "Yes, if the VM is deallocated", "Still not possible."), ("d", "Yes, with az vm update --availability-set", "No such update.")], ["a"], "Availability set membership is set at creation.", [ML + "virtual-machines/windows/change-availability-set"])

# ---------------------------------------------------------------- 3.2.7 VMSS
lesson(
    id="az104-vmss", exam=E, title="Virtual Machine Scale Sets and autoscale",
    objectives=["AZ104-3.2.7"], minutes=45,
    objective="Deploy a scale set with the right orchestration mode and upgrade policy, and design autoscale rules that scale out and in without flapping.",
    prereqs=[("Availability zones and sets", "AZ104-3.2.6", "az104-vm-availability"), ("Scalability and elasticity (AZ-900)", "AZ900-1.2.1")],
    foundation=[
        "A Virtual Machine Scale Set manages a group of VMs as one unit, so you can run many identical web servers and add or remove them automatically.",
        "Autoscale watches a metric such as CPU and adds instances when it is high and removes them when it is low, within a minimum and maximum you set.",
        "Scale sets can spread instances across availability zones and fault domains for resilience.",
    ],
    engineer=[
        "Orchestration modes: Flexible (recommended): standard VMs that can mix sizes, can be managed with VM APIs, and are spread across fault domains and zones. Uniform: identical instances from one scale set model, managed through VMSS APIs, suited to large stateless fleets.",
        "Upgrade policy for model changes (for example a new image): Manual (you upgrade instances), Automatic (all instances updated in an undefined order, possibly simultaneously) or Rolling (batches with pauses and health checks via the Application Health extension or a load balancer probe).",
        "Autoscale settings (Azure Monitor autoscale): a profile with minimum, maximum and default instance counts; rules with metric, time aggregation, operator, threshold, duration (look-back window, for example 10 minutes), action (increase/decrease by count or percent) and cooldown (default 5 minutes). Schedule-based profiles handle predictable peaks.",
        "Behaviour: autoscale scales out if any scale-out rule is met, and scales in only when the scale-in conditions are met. Flapping protection estimates the post-scale-in metric and skips scale-in if it would immediately trigger a scale-out. Keep a gap between thresholds (for example out > 70%, in < 30%).",
        "Scale-in policy: Default (balance across zones/FDs, then remove highest instance ID), NewestVM or OldestVM. Instance protection prevents specific instances from scale-in or model updates. Use custom images from Azure Compute Gallery and cloud-init or extensions for configuration.",
        "Limits: up to 1,000 VM instances in a scale set (lower with custom images in some cases). Autoscale needs a metric source; the guest-level metrics require the Azure Monitor agent.",
    ],
    anim=("autoscale-sim", "Tune VMSS autoscale rules against a traffic peak and watch instances follow."),
    diagram=([("lb", "Load balancer", 0, 60, "network"), ("vmss", "vmss-web (Flexible, zones 1–3)", 240, 60, "compute"), ("mon", "Azure Monitor: CPU", 500, 0, "service"), ("as", "Autoscale: 2–10, out>70%, in<30%", 500, 130, "security")],
             [("lb", "vmss"), ("vmss", "mon", "metrics"), ("mon", "as"), ("as", "vmss", "set capacity")]),
    example=("Black Friday web tier", [
        "The shop's web tier runs as a Flexible scale set across three zones with autoscale 3–30 instances: +2 when average CPU > 70% for 10 minutes, -1 when < 30% for 15 minutes, cooldown 5 minutes.",
        "A scheduled profile raises the minimum to 10 on the event day. Rolling upgrades with health probes roll out a patched image without downtime.",
    ]),
    config=dict(
        prerequisites=["VNet/subnet and load balancer or Application Gateway", "Image (marketplace or Compute Gallery)"],
        permissions=["Virtual Machine Contributor", "Monitoring Contributor to edit autoscale settings"],
        limits=["Up to 1,000 instances", "Cooldown default 5 minutes", "Autoscale needs metric data"],
        portal=["Virtual machine scale sets > Create: orchestration mode, image, size, zones, scaling (manual or autoscale), upgrade policy, health monitoring.",
                "Scale set > Scaling: Custom autoscale > add rules and schedule profiles; view run history.", "Scale set > Instances: upgrade, protect or delete instances."],
        cli="az vmss create -g rg-app -n vmss-web --image Ubuntu2204 --orchestration-mode Flexible --vm-sku Standard_D2s_v5 \\\n  --instance-count 2 --zones 1 2 3 --admin-username azureuser --generate-ssh-keys\naz monitor autoscale create -g rg-app --resource vmss-web --resource-type Microsoft.Compute/virtualMachineScaleSets \\\n  --name as-web --min-count 2 --max-count 10 --count 2\naz monitor autoscale rule create -g rg-app --autoscale-name as-web --condition \"Percentage CPU > 70 avg 10m\" --scale out 1\naz monitor autoscale rule create -g rg-app --autoscale-name as-web --condition \"Percentage CPU < 30 avg 10m\" --scale in 1\naz vmss scale -g rg-app -n vmss-web --new-capacity 5",
        powershell="New-AzVmss -ResourceGroupName rg-app -VMScaleSetName vmss-web -Location westeurope -OrchestrationMode Flexible -VmSize Standard_D2s_v5 `\n  -InstanceCount 2 -Zone 1,2,3 -ImageName Ubuntu2204 -Credential (Get-Credential)\nUpdate-AzVmss -ResourceGroupName rg-app -VMScaleSetName vmss-web -SkuCapacity 5\nGet-AzAutoscaleSetting -ResourceGroupName rg-app",
    ),
    lab=dict(type="A", objective="Design autoscale rules that handle a peak without flapping or saturation.", duration=15,
             steps=["Run the default rules and read the instance curve.", "Apply 'Flapping' and 'Max too low' presets and explain each warning.", "Find settings that keep CPU unsaturated with the fewest scale actions."],
             expected=["Close thresholds flag flapping risk", "Low max causes saturation"], validation=[("autoscale-problem", "Diagnosed a poor autoscale configuration"), ("autoscale-tuned", "Tuned autoscale to a healthy result")],
             failures=["Thresholds too close", "Maximum too low", "Duration too short"]),
    troubleshooting=[("Instances never scale in.", "Scale-in threshold too low or flapping protection prevents it.", "Widen the gap between thresholds and check autoscale run history."),
                     ("Autoscale does nothing.", "Metric unavailable (for example guest metrics without the agent) or the profile is disabled.", "Check run history and metric availability."),
                     ("Model update did not reach instances.", "Upgrade policy Manual.", "Upgrade instances, or switch to Rolling."), ("New instances fail health checks during rolling upgrade.", "Bad image or app config.", "Rolling upgrade pauses; fix the image and resume.")],
    comparisons=[("AWS EC2 Auto Scaling groups", "Equivalent concept with launch templates and scaling policies."), ("App Service autoscale", "Same Azure Monitor autoscale engine, applied to App Service plans.")],
    misconceptions=[("Autoscale reacts instantly.", "It evaluates over the duration window and waits for the cooldown."), ("Uniform mode is required for autoscale.", "Both modes support autoscale; Flexible is recommended for new deployments.")],
    decisions=["Use Flexible orchestration across zones.", "Combine metric rules with schedule profiles for predictable peaks.", "Use rolling upgrades with health probes."],
    docs=[("What are Virtual Machine Scale Sets?", ML + "virtual-machine-scale-sets/overview"), ("Orchestration modes", ML + "virtual-machine-scale-sets/virtual-machine-scale-sets-orchestration-modes"),
          ("Autoscale best practices", ML + "azure-monitor/autoscale/autoscale-best-practices"), ("Upgrade policies", ML + "virtual-machine-scale-sets/virtual-machine-scale-sets-upgrade-policy"),
          ("Scale-in policies", ML + "virtual-machine-scale-sets/virtual-machine-scale-sets-scale-in-policy")],
)
q("az104-q-vmss-01", E, "AZ104-3.2.7", 2, "configuration", "single", "A scale set should add one instance when average CPU exceeds 75% for 10 minutes and never run fewer than 2 or more than 8 instances. Which settings do you configure?",
  [("a", "Autoscale min 2, max 8, and a scale-out rule Percentage CPU > 75 avg 10m, increase by 1 (plus a matching scale-in rule)", "Correct."), ("b", "Manual scale to 8 instances", "No automatic behaviour."), ("c", "Upgrade policy Automatic", "Controls model updates, not instance count."), ("d", "An availability set with 8 fault domains", "Not related, and the max is 3 FDs.")], ["a"], "Always pair scale-out with a scale-in rule.", [ML + "azure-monitor/autoscale/autoscale-best-practices"])
q("az104-q-vmss-02", E, "AZ104-3.2.7", 2, "scenario", "single", "You update a scale set's image. Instances must update in batches with health checks, so the app never goes fully offline. Which upgrade policy do you set?",
  [("a", "Rolling", "Correct."), ("b", "Automatic", "Updates instances in an undefined order, possibly at the same time."), ("c", "Manual", "You would upgrade instances yourself."), ("d", "Scale-in policy OldestVM", "That controls removal order.")], ["a"], "Rolling upgrades use batch size, pause time and health.", [ML + "virtual-machine-scale-sets/virtual-machine-scale-sets-upgrade-policy"])
q("az104-q-vmss-03", E, "AZ104-3.2.7", 2, "troubleshooting", "single", "Autoscale scales out to 6 instances during a peak and then repeatedly scales in and out every few minutes. Rules: out > 60%, in < 55%. What is the fix?",
  [("a", "Widen the gap between the thresholds (for example out > 70%, in < 30%) and/or lengthen the scale-in duration", "Correct."), ("b", "Reduce the cooldown to 1 minute", "Makes flapping worse."), ("c", "Switch to Uniform mode", "Mode does not fix thresholds."), ("d", "Remove the maximum", "Unrelated.")], ["a"], "Close thresholds cause flapping.", [ML + "azure-monitor/autoscale/autoscale-flapping"])

# ---------------------------------------------------------------- 3.3 containers
lesson(
    id="az104-containers", exam=E, title="Azure Container Registry, Container Instances and Container Apps",
    objectives=["AZ104-3.3.1", "AZ104-3.3.2", "AZ104-3.3.3"], minutes=55,
    objective="Create and secure a container registry, build and push images, and run containers on ACI and Container Apps with the right authentication, networking, restart and revision settings.",
    prereqs=[("Compare containers, VMs and functions (AZ-900)", "AZ900-2.2.1"), ("RBAC roles", "AZ104-1.2.1", "az104-rbac")],
    foundation=[
        "A container packages an application with everything it needs, so it runs the same everywhere. Images are stored in a registry, and Azure Container Registry (ACR) is Azure's private registry.",
        "Azure Container Instances (ACI) runs a container quickly with no servers to manage. It suits simple tasks and short-lived jobs.",
        "Azure Container Apps runs containerised apps and microservices with HTTPS ingress, automatic scaling (even to zero), and versioned revisions.",
    ],
    engineer=[
        "ACR: names are 5–50 alphanumeric characters, globally unique (<name>.azurecr.io). SKUs Basic, Standard and Premium differ in included storage and throughput; Premium adds geo-replication, private endpoints, content trust and dedicated agent pools. Build in the cloud with az acr build (ACR Tasks), or locally with docker push after az acr login.",
        "ACR authentication: Entra identities with AcrPull/AcrPush roles (managed identities for services, service principals for CI), repository-scoped tokens, or the admin user (disabled by default; one shared credential, not recommended). Anonymous pull is a Standard/Premium option.",
        "ACI: a container group is the deployment unit (containers on the same host sharing network, lifecycle and volumes; multi-container groups are Linux only). Settings: CPU and memory per container, OS type, ports, public IP with an optional DNS name label (<label>.<region>.azurecontainer.io) or deployment into a VNet subnet, restart policy Always (default), OnFailure or Never, environment variables (secure values), Azure Files volumes. Private ACR pulls need credentials or a managed identity.",
        "Container Apps: apps run in a Container Apps environment (shared VNet, logging). Ingress can be external or internal with a target port and automatic HTTPS. Revisions are immutable snapshots created by revision-scope changes (image, containers, scale rules). Single revision mode replaces the active revision; Multiple mode allows traffic splitting between revisions (blue/green, canary). Secrets, managed identities, Dapr and jobs are supported.",
        "Choosing: ACI for simple isolated containers and batch tasks; Container Apps for HTTP APIs, microservices and event-driven apps that need scaling and revisions; AKS when you need full Kubernetes control.",
    ],
    anim=("container-sim", "Build, push, authenticate and run a container on ACI or Container Apps; split traffic between revisions."),
    diagram=([("dev", "Code + Dockerfile", 0, 60, "user"), ("acr", "acrcontoso01.azurecr.io", 220, 60, "storage"), ("aci", "ACI container group", 460, 0, "compute"), ("aca", "Container App (revisions)", 460, 130, "compute"), ("mi", "Managed identity: AcrPull", 220, 200, "identity")],
             [("dev", "acr", "az acr build"), ("acr", "aci", "pull"), ("acr", "aca", "pull"), ("mi", "acr", "auth")]),
    example=("Nightly job and public API", [
        "A nightly data-cleanup container runs on ACI with restart policy OnFailure: it exits when done, so it is billed only for its runtime. It pulls from ACR with a user-assigned managed identity holding AcrPull.",
        "The public API runs on Container Apps with external ingress. Version 2 is deployed as a new revision receiving 20% of traffic; after monitoring, traffic moves to 100%.",
    ]),
    config=dict(
        prerequisites=["Resource group; Dockerfile or image", "For VNet deployment: delegated subnet (ACI) or environment VNet (Container Apps)"],
        permissions=["Contributor to create registries and apps", "AcrPush for CI, AcrPull for runtimes", "User Access Administrator/Owner to assign AcrPull"],
        limits=["ACR name 5–50 alphanumeric", "Geo-replication Premium only", "ACI resources are fixed per container group (redeploy to change)"],
        portal=["Container registries > Create: name, SKU; Access keys (admin user); Networking (Premium private endpoints); Replications (Premium).",
                "Container instances > Create: image source (ACR/Docker Hub/other), size, networking (DNS label, ports or VNet), Advanced (restart policy, env vars).",
                "Container Apps > Create: environment, container image and resources, ingress, scale; Revisions blade: revision mode and traffic."],
        cli="az acr create -g rg-app -n acrcontoso01 --sku Standard\naz acr build --registry acrcontoso01 --image web:v1 .\naz acr replication create -r acrcontoso01 -l northeurope   # Premium only\naz role assignment create --assignee <principal-id> --role AcrPull --scope $(az acr show -n acrcontoso01 --query id -o tsv)\naz container create -g rg-app -n aci-cleanup --image acrcontoso01.azurecr.io/cleanup:v1 --os-type Linux --cpu 1 --memory 1.5 \\\n  --restart-policy OnFailure --assign-identity <identity-id> --acr-identity <identity-id>\naz containerapp env create -g rg-app -n cae-prod -l westeurope\naz containerapp create -g rg-app -n api --environment cae-prod --image acrcontoso01.azurecr.io/api:v2 \\\n  --target-port 8080 --ingress external --registry-server acrcontoso01.azurecr.io --registry-identity system\naz containerapp revision set-mode -g rg-app -n api --mode multiple\naz containerapp ingress traffic set -g rg-app -n api --revision-weight api--v1=80 api--v2=20",
        powershell="New-AzContainerRegistry -ResourceGroupName rg-app -Name acrcontoso01 -Sku Standard -Location westeurope\n$c = New-AzContainerInstanceObject -Name cleanup -Image acrcontoso01.azurecr.io/cleanup:v1 -RequestCpu 1 -RequestMemoryInGb 1.5\nNew-AzContainerGroup -ResourceGroupName rg-app -Name aci-cleanup -Location westeurope -Container $c -OsType Linux -RestartPolicy OnFailure",
    ),
    lab=dict(type="A", objective="Get an image from source to a running container with least-privilege pull access.", duration=20,
             steps=["Run the default pipeline (ACI).", "Apply each preset: no pull credentials, geo-replication on Standard, invalid name; fix them.", "Switch to Container Apps with internal ingress.", "Open Container Apps revisions and split traffic 80/20."],
             expected=["Pull fails without credentials", "Geo-replication needs Premium", "Traffic split requires Multiple revision mode"],
             validation=[("container-failed", "Diagnosed a failed container deployment"), ("aci-running", "Ran a container on ACI"), ("aca-running", "Ran a container on Container Apps"), ("aca-traffic-split", "Split traffic between revisions")],
             failures=["Missing AcrPull", "Hyphen in registry name", "Restart policy Always for a batch job"]),
    troubleshooting=[("ACI stuck pulling: unauthorized.", "No credentials or identity for the private registry.", "Assign AcrPull to the managed identity and pass --acr-identity, or provide registry credentials."),
                     ("ACI batch job runs again and again.", "Restart policy Always (default).", "Use OnFailure or Never."), ("Container App unreachable from the internet.", "Ingress internal or disabled, or wrong target port.", "Enable external ingress with the container's port."),
                     ("New revision gets no traffic.", "Multiple revision mode with traffic pinned to the old revision.", "Adjust traffic weights or use latest-revision routing.")],
    comparisons=[("AKS", "Full Kubernetes with node pools and cluster management; Container Apps abstracts Kubernetes."), ("AWS ECR / ECS on Fargate / App Runner", "ECR ≈ ACR; Fargate tasks ≈ ACI; App Runner/ECS services ≈ Container Apps.")],
    misconceptions=[("ACI autoscales.", "ACI has no autoscale; use Container Apps or AKS."), ("The ACR admin user is the recommended way to pull.", "Use Entra identities with AcrPull."), ("Every Container Apps change creates a revision.", "Only revision-scope changes do.")],
    decisions=["Build with ACR Tasks to avoid local Docker on build agents.", "Pull with managed identities; keep the admin user disabled.", "Use Premium ACR with geo-replication for multi-region deployments."],
    docs=[("Azure Container Registry service tiers", ML + "container-registry/container-registry-skus"), ("Authenticate with ACR", ML + "container-registry/container-registry-authentication"),
          ("Azure Container Instances overview", ML + "container-instances/container-instances-overview"), ("Container groups in ACI", ML + "container-instances/container-instances-container-groups"),
          ("Restart policies in ACI", ML + "container-instances/container-instances-restart-policy"), ("Azure Container Apps overview", ML + "container-apps/overview"), ("Revisions in Container Apps", ML + "container-apps/revisions")],
)
q("az104-q-cont-acr-01", E, "AZ104-3.3.1", 2, "architecture", "single", "Images must be replicated automatically to registries in West Europe and East US behind one login server. Which ACR SKU is required?",
  [("a", "Premium", "Correct. Geo-replication is Premium only."), ("b", "Standard", "No geo-replication."), ("c", "Basic", "No geo-replication."), ("d", "Any SKU with a second registry", "That would be two login servers.")], ["a"], "Premium adds geo-replication, private link and more.", [ML + "container-registry/container-registry-geo-replication"])
q("az104-q-cont-acr-02", E, "AZ104-3.3.1", 2, "scenario", "single", "A container app's system-assigned managed identity must pull images from ACR. Which role do you assign on the registry?",
  [("a", "AcrPull", "Correct. Least privilege for pulling."), ("b", "AcrPush", "Includes push, more than needed."), ("c", "Owner", "Far too broad."), ("d", "Reader", "Control-plane read; does not grant pulls.")], ["a"], "Use AcrPull for runtimes and AcrPush for CI.", [ML + "container-registry/container-registry-roles"])
q("az104-q-cont-acr-03", E, "AZ104-3.3.1", 1, "command", "single", "What does this command do?", "az acr build --registry acrcontoso01 --image web:v1 .",
  [("a", "Builds the image in Azure with ACR Tasks from the local context and pushes it to the registry", "Correct."), ("b", "Builds locally with Docker and leaves it local", "ACR Tasks builds in the cloud."), ("c", "Creates a new registry", "That is az acr create."), ("d", "Runs the container", "No container is run.")], ["a"], "No local Docker engine is needed.", [ML + "container-registry/container-registry-tutorial-quick-task"])
q("az104-q-aci-01", E, "AZ104-3.3.2", 2, "configuration", "single", "An ACI container runs a nightly batch task and should not restart after it completes successfully. Which restart policy do you set?",
  [("a", "OnFailure", "Correct. It restarts only if the process exits with an error."), ("b", "Always", "The default; it restarts even after success."), ("c", "Never", "Also stops after success, but does not retry failures; OnFailure is the better fit here."), ("d", "Rolling", "Not an ACI policy.")], ["a"], "OnFailure suits run-to-completion tasks that should retry on errors.", [ML + "container-instances/container-instances-restart-policy"])
q("az104-q-aci-02", E, "AZ104-3.3.2", 1, "single", "single", "You deploy an ACI container group with DNS name label 'contoso-web' in West Europe. What is its FQDN?",
  [("a", "contoso-web.westeurope.azurecontainer.io", "Correct."), ("b", "contoso-web.azurewebsites.net", "That is App Service."), ("c", "contoso-web.azurecr.io", "That is a registry."), ("d", "contoso-web.westeurope.cloudapp.azure.com", "That is a public IP DNS label for VMs.")], ["a"], "DNS labels must be unique per region.", [ML + "container-instances/container-instances-quickstart"])
q("az104-q-aca-01", E, "AZ104-3.3.3", 2, "scenario", "single", "You want to send 10% of traffic to a new version of a container app. What is required?",
  [("a", "Revision mode set to Multiple, then traffic weights 90/10", "Correct."), ("b", "Single revision mode", "Only one active revision."), ("c", "Two container app environments", "Not needed."), ("d", "An ACI container group", "Unrelated.")], ["a"], "Multiple revision mode enables traffic splitting.", [ML + "container-apps/traffic-splitting"])
q("az104-q-aca-02", E, "AZ104-3.3.3", 2, "troubleshooting", "single", "A container app is reachable only from inside its environment's VNet, but must be public. What do you change?",
  [("a", "Set ingress to external", "Correct."), ("b", "Increase max replicas", "Scaling does not affect exposure."), ("c", "Enable the ACR admin user", "Unrelated."), ("d", "Use revision mode Single", "Unrelated.")], ["a"], "Internal ingress limits access to the environment.", [ML + "container-apps/ingress-overview"])

lesson(
    id="az104-container-scaling", exam=E, title="Sizing and scaling ACI and Container Apps",
    objectives=["AZ104-3.3.4"], minutes=30,
    objective="Size container CPU and memory correctly, and configure Container Apps scale rules (including scale to zero), knowing that ACI does not autoscale.",
    prereqs=[("Containers on Azure", "AZ104-3.3.2", "az104-containers"), ("Autoscale concepts", "AZ104-3.2.7", "az104-vmss")],
    foundation=["Each container needs a certain amount of CPU and memory, which you set when you deploy it.", "Azure Container Instances runs exactly what you deploy and does not add copies by itself.",
                "Azure Container Apps adds and removes copies (replicas) automatically based on rules such as HTTP traffic, and can go down to zero when idle."],
    engineer=[
        "ACI sizing: CPU and memory requests per container (the group's total must fit the region's limits); GPU in supported regions. Resources cannot be changed on a running group; redeploy with new values. Scale out by creating more container groups (for example behind Application Gateway), or use Container Apps or AKS.",
        "Container Apps sizing: in the Consumption plan, CPU/memory combinations are fixed pairs (for example 0.25 vCPU/0.5 GiB up to 4 vCPU/8 GiB, memory = 2 × vCPU). Workload profiles (dedicated) allow larger sizes.",
        "Container Apps scaling: min and max replicas per revision (min can be 0; max defaults to 10 and can be raised). Scale rules: HTTP (concurrent requests per replica, default 10), TCP (concurrent connections), CPU/memory utilisation, and custom KEDA scalers (for example Azure Service Bus queue length). With min replicas 0, an idle app costs nothing for compute but has a cold start.",
        "Scaling decisions are per revision; the KEDA-based scaler polls event sources and adds replicas up to max. Set min replicas to 1+ for latency-sensitive APIs.",
    ],
    anim=("autoscale-sim", "Open 'Container sizing and scaling': compare ACI with Container Apps HTTP scaling and scale to zero."),
    diagram=([("req", "HTTP requests", 0, 60, "globe"), ("ing", "Container Apps ingress", 220, 60, "network"), ("keda", "Scale rule: 10 concurrent/replica", 440, 0, "security"), ("reps", "Replicas 0…10", 440, 130, "compute")],
             [("req", "ing"), ("ing", "reps"), ("keda", "reps", "adjusts")]),
    example=("Queue-driven worker", ["An order-processing worker on Container Apps uses a Service Bus scale rule: one replica per 20 messages, min 0, max 30. Overnight it scales to zero; at peak it reaches 30 replicas.",
                                     "A legacy report job stays on ACI with 2 vCPU / 4 GiB, run on demand by a Logic App."]),
    config=dict(prerequisites=["Container Apps environment", "Scale source (HTTP ingress, queue, etc.)"], permissions=["Contributor on the container app"],
                limits=["ACI: no autoscale; resources fixed per deployment", "ACA Consumption: CPU/memory pairs", "Max replicas configurable (default 10)"],
                portal=["Container App > Scale: min/max replicas and scale rules (HTTP, TCP, custom).", "Container App > Containers: CPU/memory.", "ACI: redeploy with new CPU/memory values."],
                cli="az containerapp update -g rg-app -n api --cpu 0.5 --memory 1.0Gi --min-replicas 1 --max-replicas 20 \\\n  --scale-rule-name http-rule --scale-rule-type http --scale-rule-http-concurrency 50\naz container create -g rg-app -n aci-report --image mcr.microsoft.com/azuredocs/aci-helloworld --os-type Linux --cpu 2 --memory 4",
                powershell="Update-AzContainerApp -ResourceGroupName rg-app -Name api -ScaleMinReplica 1 -ScaleMaxReplica 20\n$c = New-AzContainerInstanceObject -Name report -Image mcr.microsoft.com/azuredocs/aci-helloworld -RequestCpu 2 -RequestMemoryInGb 4\nNew-AzContainerGroup -ResourceGroupName rg-app -Name aci-report -Location westeurope -Container $c -OsType Linux"),
    lab=dict(type="A", objective="Size containers and configure scaling for idle and peak load.", duration=10,
             steps=["Run with 250 concurrent requests and max 10 replicas; read the cap warning.", "Apply 'Idle (scale to zero)'.", "Switch to ACI under load and read why it cannot scale.", "Try 1 vCPU / 8 GiB on Container Apps."],
             expected=["Replicas capped at max", "Zero replicas when idle", "ACI has no autoscale", "CPU/memory pair rule"],
             validation=[("aci-fixed", "Saw ACI's fixed capacity"), ("aca-scale-zero", "Scaled a container app to zero"), ("aca-scaled", "Scaled a container app out")], failures=["Max replicas too low", "Invalid CPU/memory pair"]),
    troubleshooting=[("Container app slow on the first request in the morning.", "Scaled to zero; cold start.", "Set min replicas to 1."), ("Requests queue during peak.", "Max replicas reached.", "Raise max replicas or the per-replica concurrency."),
                     ("Invalid CPU/memory combination error.", "Consumption profile requires fixed pairs.", "Use a valid pair or a dedicated workload profile.")],
    comparisons=[("AKS Horizontal Pod Autoscaler / KEDA", "Container Apps uses KEDA under the hood without exposing the cluster."), ("AWS Fargate", "ECS services on Fargate use Application Auto Scaling; App Runner scales on concurrency.")],
    misconceptions=[("Scale to zero means the app is deleted.", "Revisions remain; replicas start again on demand."), ("ACI can scale with rules like VMSS.", "It cannot.")],
    decisions=["Use HTTP concurrency rules for APIs and event-source rules for workers.", "Keep min replicas ≥ 1 where cold starts are unacceptable."],
    docs=[("Scaling in Azure Container Apps", ML + "container-apps/scale-app"), ("Containers in Azure Container Apps (CPU and memory)", ML + "container-apps/containers"),
          ("Resource availability for ACI", ML + "container-instances/container-instances-region-availability"), ("ACI FAQ (scaling)", ML + "container-instances/container-instances-faq")],
)
q("az104-q-cscale-01", E, "AZ104-3.3.4", 2, "configuration", "single", "A container app should run no replicas when there is no traffic and one replica per 20 concurrent HTTP requests, up to 15. What do you configure?",
  [("a", "Min replicas 0, max replicas 15, HTTP scale rule with concurrency 20", "Correct."), ("b", "Min 1, max 15", "Min 1 never scales to zero."), ("c", "An ACI container group with 15 containers", "ACI does not scale on traffic."), ("d", "Autoscale on the Container Apps environment CPU", "Scaling is configured per app.")], ["a"], "HTTP rules scale on concurrent requests per replica.", [ML + "container-apps/scale-app"])
q("az104-q-cscale-02", E, "AZ104-3.3.4", 2, "scenario", "single", "An ACI container group needs more CPU. What do you do?",
  [("a", "Redeploy the container group with higher CPU values", "Correct."), ("b", "Enable autoscale on the group", "ACI has no autoscale."), ("c", "Resize it in place while it runs", "Not supported."), ("d", "Add an availability set", "Not applicable.")], ["a"], "ACI resources are fixed per deployment.", [ML + "container-instances/container-instances-faq"])
q("az104-q-cscale-03", E, "AZ104-3.3.4", 1, "single", "single", "Which statement about Container Apps with min replicas set to 0 is true?",
  [("a", "No compute is billed while idle, but the first request after idle has a cold start.", "Correct."), ("b", "The app is deleted after inactivity.", "It is kept and restarts on demand."), ("c", "It cannot receive HTTP traffic.", "Ingress wakes it."), ("d", "It requires Premium ACR.", "Unrelated.")], ["a"], "Choose min replicas based on latency needs.", [ML + "container-apps/scale-app"])

# ---------------------------------------------------------------- 3.4 App Service
ASD = [("App Service plans overview", ML + "app-service/overview-hosting-plans"), ("Scale up an app", ML + "app-service/manage-scale-up"), ("Get started with autoscale", ML + "azure-monitor/autoscale/autoscale-get-started"),
       ("App Service limits", ML + "azure-resource-manager/management/azure-subscription-service-limits#app-service-limits")]
lesson(
    id="az104-app-service-plans", exam=E, title="App Service plans, scaling and creating web apps",
    objectives=["AZ104-3.4.1", "AZ104-3.4.2", "AZ104-3.4.3"], minutes=45,
    objective="Choose an App Service plan tier, scale up and out (manually and with autoscale), and create web apps with the right runtime and settings.",
    prereqs=[("Application hosting options (AZ-900)", "AZ900-2.2.4"), ("Autoscale", "AZ104-3.2.7", "az104-vmss")],
    foundation=["Azure App Service hosts web apps and APIs without managing servers. The App Service plan is the set of VMs underneath, and its tier decides features and price.",
                "Scaling up means a bigger tier (more power and features); scaling out means more instances of the plan.", "Several apps can share one plan, and they then share its instances."],
    engineer=[
        "Tiers: Free and Shared run on shared infrastructure (Free: no custom domains; Shared: custom domains without TLS bindings). Basic: dedicated, custom domains and TLS, manual scale up to 3 instances. Standard: autoscale up to 10 instances, 5 deployment slots, backups. Premium v3: up to 30 instances, 20 slots, faster hardware, zone redundancy. Isolated v2 (App Service Environment): up to 100 instances, network isolation.",
        "A plan belongs to one region and OS (Windows or Linux). All apps on a plan run on every instance; one noisy app affects the rest, so split heavy apps into their own plans.",
        "Scale out manually (instance count) or with rule-based autoscale (Standard and above, the same Azure Monitor autoscale engine as VMSS: metrics such as CPU, memory or HTTP queue length, and schedules). Premium plans also offer automatic scaling (platform-managed).",
        "Creating an app: name (forms <name>.azurewebsites.net, globally unique), publish model (code or container), runtime stack and version, OS, region, plan. Configure app settings and connection strings (environment variables), general settings (Always On, HTTP version, ARR affinity), and deployment (ZIP deploy, GitHub Actions, Azure DevOps, container image).",
        "Moving an app to a different plan is possible within the same resource group and region (webspace).",
    ],
    anim=("appservice-sim", "Open 'Plan and scale': compare tiers and scale up/out."),
    diagram=([("plan", "asp-web (Standard S1, 3 instances)", 200, 0, "compute"), ("a1", "app-shop", 0, 130, "globe"), ("a2", "app-api", 200, 130, "globe"), ("a3", "app-admin", 400, 130, "globe"), ("as", "Autoscale 2–10", 460, 0, "security")],
             [("plan", "a1"), ("plan", "a2"), ("plan", "a3"), ("as", "plan", "instances")]),
    example=("Consolidating small sites", ["Five low-traffic marketing sites share one Standard S1 plan (cheaper than five plans). The busy checkout API gets its own Premium v3 plan with autoscale 3–20 and zone redundancy."]),
    config=dict(prerequisites=["Resource group and region", "Runtime stack chosen"], permissions=["Website Contributor / Web Plan Contributor or Contributor"],
                limits=["Instances: Basic 3, Standard 10, Premium v3 30, Isolated v2 100", "Autoscale: Standard and above", "App name is global (*.azurewebsites.net)"],
                portal=["App Service plans > Create: OS, region, pricing tier.", "Plan > Scale up (App Service plan) / Scale out (manual or custom autoscale).", "App Services > Create > Web App: name, publish, runtime, OS, region, plan.",
                        "Web app > Configuration (Environment variables): app settings, connection strings, general settings."],
                cli="az appservice plan create -g rg-web -n asp-web --sku S1 --is-linux\naz webapp create -g rg-web -p asp-web -n app-contoso-shop --runtime \"NODE:20-lts\"\naz webapp config appsettings set -g rg-web -n app-contoso-shop --settings API_URL=https://api.contoso.com\naz appservice plan update -g rg-web -n asp-web --sku P1V3\naz appservice plan update -g rg-web -n asp-web --number-of-workers 3\naz monitor autoscale create -g rg-web --resource asp-web --resource-type Microsoft.Web/serverfarms --name as-asp --min-count 2 --max-count 10 --count 2\naz monitor autoscale rule create -g rg-web --autoscale-name as-asp --condition \"CpuPercentage > 70 avg 10m\" --scale out 1",
                powershell="New-AzAppServicePlan -ResourceGroupName rg-web -Name asp-web -Location westeurope -Tier Standard -NumberofWorkers 2 -WorkerSize Small -Linux\nNew-AzWebApp -ResourceGroupName rg-web -Name app-contoso-shop -AppServicePlan asp-web\nSet-AzAppServicePlan -ResourceGroupName rg-web -Name asp-web -Tier PremiumV3 -NumberofWorkers 3",
                bicep="resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {\n  name: 'asp-web'\n  location: resourceGroup().location\n  kind: 'linux'\n  sku: { name: 'S1', capacity: 2 }\n  properties: { reserved: true }\n}\nresource app 'Microsoft.Web/sites@2023-12-01' = {\n  name: 'app-contoso-shop'\n  location: resourceGroup().location\n  properties: {\n    serverFarmId: plan.id\n    httpsOnly: true\n    siteConfig: { linuxFxVersion: 'NODE|20-lts', minTlsVersion: '1.2', alwaysOn: true }\n  }\n}"),
    lab=dict(type="A", objective="Pick a tier that supports the required instances and autoscale.", duration=10,
             steps=["Run the default (Basic with autoscale) and read the failure.", "Apply 'Free tier, 2 instances'.", "Apply 'Standard with autoscale'."],
             expected=["Basic has no rule-based autoscale", "Free is limited to 1 shared instance"], validation=[("plan-limit", "Hit a tier limit"), ("plan-configured", "Configured a valid plan"), ("plan-autoscale", "Enabled autoscale on a supported tier")],
             failures=["Autoscale on Basic", "More instances than the tier allows"]),
    troubleshooting=[("Scale out option greyed out.", "Free/Shared tier.", "Scale up to Basic or higher."), ("Custom autoscale not available.", "Basic tier.", "Scale up to Standard."),
                     ("One app slows down every app on the plan.", "Apps share plan instances.", "Move heavy apps to their own plan."), ("Name not available.", "Global *.azurewebsites.net namespace.", "Choose another name.")],
    comparisons=[("Azure Functions (Premium/Dedicated)", "Can run on App Service plans; event-driven model."), ("AWS Elastic Beanstalk / App Runner", "Managed app hosting; App Service plans are explicit VM pools.")],
    misconceptions=[("Each app has its own instances.", "Apps share the plan's instances."), ("Scaling up adds instances.", "Scaling up changes the tier; scaling out adds instances.")],
    decisions=["Group apps by load and lifecycle into plans.", "Use Premium v3 with zone redundancy for production.", "Turn on Always On for apps that must stay warm."],
    docs=ASD + [("Create a web app (quickstart)", ML + "app-service/quickstart-nodejs"), ("Configure an App Service app", ML + "app-service/configure-common")],
)
q("az104-q-asp-01", E, "AZ104-3.4.1", 2, "architecture", "single", "A web app needs custom domains with TLS, autoscale up to 8 instances and deployment slots, at the lowest tier. Which tier do you choose?",
  [("a", "Standard", "Correct."), ("b", "Basic", "No autoscale, no slots, max 3 instances."), ("c", "Shared", "No TLS bindings or scale-out."), ("d", "Isolated v2", "Works, but is far more expensive.")], ["a"], "Standard is the lowest tier with autoscale and slots.", [ML + "app-service/overview-hosting-plans"])
q("az104-q-asp-02", E, "AZ104-3.4.1", 1, "single", "single", "Three web apps share one App Service plan with 2 instances. How many instances does each app run on?",
  [("a", "2", "Correct. Every app runs on every instance of the plan."), ("b", "1", "Apps are not distributed one per instance."), ("c", "6", "Instances are shared."), ("d", "It depends on the app's own instance setting", "Instances are set at plan level (per-app scaling is a separate feature).")], ["a"], "Scaling the plan scales all apps on it.", [ML + "app-service/overview-hosting-plans"])
q("az104-q-asp-03", E, "AZ104-3.4.2", 2, "troubleshooting", "single", "The Custom autoscale option is not available for an App Service plan. What is the cause?",
  [("a", "The plan is Basic or lower", "Correct."), ("b", "The app uses Linux", "Linux plans support autoscale."), ("c", "The app has no slots", "Unrelated."), ("d", "Autoscale requires Application Insights", "Not required.")], ["a"], "Rule-based autoscale needs Standard or higher.", [ML + "app-service/manage-scale-up"])
q("az104-q-asp-04", E, "AZ104-3.4.2", 1, "single", "single", "What is the difference between scaling up and scaling out an App Service plan?",
  [("a", "Up changes the tier/instance size; out changes the number of instances", "Correct."), ("b", "Up adds instances; out changes the tier", "Reversed."), ("c", "Both add instances", "No."), ("d", "Out moves the plan to another region", "No.")], ["a"], "Vertical vs horizontal scaling.", [ML + "app-service/manage-scale-up"])
q("az104-q-asp-05", E, "AZ104-3.4.3", 2, "command", "single", "What does this command create?", "az webapp create -g rg-web -p asp-web -n app-contoso-shop --runtime \"NODE:20-lts\"",
  [("a", "A Node.js 20 web app named app-contoso-shop on the existing plan asp-web", "Correct."), ("b", "A new App Service plan", "The plan must exist (-p)."), ("c", "A deployment slot", "That is az webapp deployment slot create."), ("d", "A function app", "That is az functionapp create.")], ["a"], "The default hostname is app-contoso-shop.azurewebsites.net.", ["https://learn.microsoft.com/cli/azure/webapp#az-webapp-create"])
q("az104-q-asp-06", E, "AZ104-3.4.3", 2, "scenario", "single", "A web app needs a database connection string that is not stored in code. Where do you configure it?",
  [("a", "Web app > Configuration: connection strings (or app settings with a Key Vault reference)", "Correct."), ("b", "In the App Service plan", "Plans hold compute, not app settings."), ("c", "In a deployment slot name", "No."), ("d", "In the custom domain blade", "No.")], ["a"], "App settings and connection strings are injected as environment variables.", [ML + "app-service/configure-common"])

lesson(
    id="az104-app-service-domains", exam=E, title="Custom domains, certificates and TLS for App Service",
    objectives=["AZ104-3.4.4", "AZ104-3.4.5"], minutes=40,
    objective="Map custom domains to App Service with the right DNS records and verification, and secure them with the right certificate type and TLS settings.",
    prereqs=[("Azure DNS", "AZ104-4.3.1"), ("App Service plans", "AZ104-3.4.1", "az104-app-service-plans")],
    foundation=["Every web app gets a free name like app-contoso.azurewebsites.net. To use www.contoso.com you add DNS records and prove you own the domain.",
                "To serve https:// on your own domain you need a TLS certificate bound to the app. App Service can issue a free managed certificate for many cases."],
    engineer=[
        "DNS mapping: subdomains (www) use a CNAME to <app>.azurewebsites.net. The apex (contoso.com) uses an A record to the app's inbound IP (or an alias record in Azure DNS). Domain verification uses a TXT record asuid.<subdomain> (asuid for the apex) containing the app's custom domain verification ID. Custom domains require Shared tier or higher; TLS bindings require Basic or higher.",
        "Certificates: App Service managed certificate (free, auto-renewing, no wildcard, not exportable); import from Key Vault (the app needs access to the vault; renewals sync automatically); upload a PFX (password-protected, includes the private key, at least 2048-bit RSA); App Service Certificate (purchased, stored in Key Vault).",
        "Bindings: SNI SSL (standard) or IP-based SSL (dedicated IP). Enable HTTPS Only to redirect HTTP, and set the minimum TLS version (1.2 recommended). End-to-end TLS through Front Door or Application Gateway may need certificates there too.",
        "Troubleshoot with nslookup/dig for CNAME/A/TXT, and remember DNS propagation and TTL.",
    ],
    anim=("appservice-sim", "Open 'Custom domain + TLS': choose records, verification and certificates for subdomain, apex and wildcard hosts."),
    diagram=([("dns", "DNS: CNAME www → app-contoso.azurewebsites.net, TXT asuid.www", 0, 0, "network"), ("app", "app-contoso (Basic+)", 300, 60, "globe"), ("cert", "Managed certificate (SNI)", 560, 0, "security"), ("user", "https://www.contoso.com", 560, 130, "user")],
             [("dns", "app", "verify + route"), ("cert", "app", "binding"), ("user", "app", "TLS 1.2")]),
    example=("Launching www and apex", ["www.contoso.com gets a CNAME and asuid.www TXT record and a free managed certificate. The apex contoso.com uses an A record to the app's IP and a TXT asuid record; HTTPS Only redirects HTTP traffic.",
                                         "A future *.contoso.com requirement is met with a wildcard certificate imported from Key Vault, because managed certificates do not support wildcards."]),
    config=dict(prerequisites=["Access to the DNS zone", "Basic tier or higher for TLS"], permissions=["Website Contributor on the app", "DNS Zone Contributor (Azure DNS) or registrar access", "Key Vault Secrets User for the app's identity (Key Vault certs)"],
                limits=["Free tier: no custom domains", "Managed certificates: no wildcard, not exportable", "PFX must include the private key"],
                portal=["Web app > Custom domains > Add custom domain: choose hostname record type, copy the A/CNAME and TXT values, validate, add.", "Web app > Certificates: create managed certificate, import from Key Vault, or upload PFX.",
                        "Custom domains > Add binding (SNI SSL).", "Configuration > General settings: HTTPS Only, minimum TLS version."],
                cli="az webapp show -g rg-web -n app-contoso --query customDomainVerificationId -o tsv\naz network dns record-set cname set-record -g rg-dns -z contoso.com -n www -c app-contoso.azurewebsites.net\naz network dns record-set txt add-record -g rg-dns -z contoso.com -n asuid.www -v <verification-id>\naz webapp config hostname add -g rg-web --webapp-name app-contoso --hostname www.contoso.com\naz webapp config ssl create -g rg-web -n app-contoso --hostname www.contoso.com\naz webapp config ssl bind -g rg-web -n app-contoso --certificate-thumbprint <thumbprint> --ssl-type SNI\naz webapp update -g rg-web -n app-contoso --https-only true\naz webapp config set -g rg-web -n app-contoso --min-tls-version 1.2",
                powershell="New-AzWebAppSSLBinding -ResourceGroupName rg-web -WebAppName app-contoso -Name www.contoso.com -CertificateFilePath .\\www.pfx -CertificatePassword (Read-Host -AsSecureString) -SslState SniEnabled\nSet-AzWebApp -ResourceGroupName rg-web -Name app-contoso -HttpsOnly $true -HostNames @('www.contoso.com','app-contoso.azurewebsites.net')"),
    lab=dict(type="A", objective="Map and secure subdomain, apex and wildcard hostnames.", duration=10,
             steps=["Run the default (www, CNAME, TXT, managed cert).", "Apply 'Apex with CNAME' and fix the record type.", "Apply 'Wildcard with free certificate' and fix the certificate.", "Apply 'Shared tier with TLS'."],
             expected=["Apex needs an A (or alias) record", "Wildcard needs a non-managed certificate", "TLS needs Basic+"],
             validation=[("domain-failed", "Diagnosed a mapping problem"), ("domain-mapped", "Mapped a custom domain"), ("tls-bound", "Bound a TLS certificate")], failures=["Missing TXT record", "CNAME at apex", "Free tier"]),
    troubleshooting=[("Domain validation fails.", "TXT asuid record missing/incorrect or not yet propagated.", "Check with nslookup -type=TXT asuid.www.contoso.com and wait for TTL."),
                     ("Browser shows certificate warning.", "No binding for that hostname, or certificate does not match.", "Add an SNI binding with a matching certificate."),
                     ("Cannot create managed certificate for *.contoso.com.", "Wildcards not supported.", "Use Key Vault or upload a wildcard PFX."), ("Uploading the PFX fails.", "No private key, weak key or wrong password.", "Export the PFX with private key and password, RSA ≥ 2048.")],
    comparisons=[("Azure Front Door managed certificates", "Front Door can terminate TLS and manage certificates at the edge for apps behind it."), ("AWS Certificate Manager + CloudFront/ALB", "ACM issues free certificates for AWS endpoints.")],
    misconceptions=[("A CNAME works at the zone apex.", "DNS does not allow a CNAME at the apex; use A or alias records."), ("Free managed certificates can be exported.", "They cannot.")],
    decisions=["Use managed certificates for simple hostnames, Key Vault for wildcards and central rotation.", "Always enable HTTPS Only and TLS 1.2."],
    docs=[("Map an existing custom DNS name", ML + "app-service/app-service-web-tutorial-custom-domain"), ("Add and manage TLS/SSL certificates", ML + "app-service/configure-ssl-certificate"),
          ("Secure a custom DNS name with a TLS/SSL binding", ML + "app-service/configure-ssl-bindings"), ("Enforce HTTPS and TLS versions", ML + "app-service/configure-ssl-bindings#enforce-https")],
)
q("az104-q-asd-01", E, "AZ104-3.4.5", 2, "configuration", "multiple", "You map www.contoso.com to app-contoso. Which TWO DNS records do you create?",
  [("a", "CNAME www → app-contoso.azurewebsites.net", "Correct."), ("b", "TXT asuid.www → the app's custom domain verification ID", "Correct."), ("c", "MX www → app-contoso", "MX is for mail."), ("d", "CNAME @ → app-contoso.azurewebsites.net", "CNAME at the apex is not allowed, and this is the wrong host.")], ["a", "b"], "CNAME routes; TXT asuid proves ownership.", [ML + "app-service/app-service-web-tutorial-custom-domain"])
q("az104-q-asd-02", E, "AZ104-3.4.5", 2, "troubleshooting", "single", "You cannot add custom domains to a web app at all. What is the likely reason?",
  [("a", "The app runs on the Free tier", "Correct."), ("b", "The app runs on Linux", "Linux apps support custom domains."), ("c", "The app has slots", "Unrelated."), ("d", "HTTPS Only is enabled", "Unrelated.")], ["a"], "Custom domains require Shared tier or above (TLS requires Basic+).", [ML + "app-service/app-service-web-tutorial-custom-domain"])
q("az104-q-asd-03", E, "AZ104-3.4.4", 2, "scenario", "single", "You need TLS for shop.contoso.com, blog.contoso.com and any future subdomain with automatic renewal and central storage. What do you use?",
  [("a", "A wildcard certificate stored in Key Vault, imported to App Service", "Correct."), ("b", "An App Service managed certificate for *.contoso.com", "Managed certificates do not support wildcards."), ("c", "A self-signed certificate", "Untrusted by browsers."), ("d", "No certificate; enable HTTPS Only", "HTTPS Only needs a valid binding.")], ["a"], "Key Vault certificates sync to App Service on renewal.", [ML + "app-service/configure-ssl-certificate"])
q("az104-q-asd-04", E, "AZ104-3.4.4", 1, "single", "single", "Which setting redirects all HTTP requests to HTTPS?",
  [("a", "HTTPS Only", "Correct."), ("b", "Minimum TLS version", "Rejects older TLS versions but does not redirect HTTP."), ("c", "ARR affinity", "Session stickiness."), ("d", "Always On", "Keeps the app loaded.")], ["a"], "Pair HTTPS Only with minimum TLS 1.2.", [ML + "app-service/configure-ssl-bindings"])

lesson(
    id="az104-app-service-ops", exam=E, title="App Service backups, networking and deployment slots",
    objectives=["AZ104-3.4.6", "AZ104-3.4.7", "AZ104-3.4.8"], minutes=50,
    objective="Configure backup and restore, inbound and outbound networking (access restrictions, private endpoints, VNet integration), and deployment slots with safe swaps.",
    prereqs=[("App Service plans", "AZ104-3.4.1", "az104-app-service-plans"), ("Private endpoints", "AZ104-4.2.5")],
    foundation=["Backups keep copies of your app's content and configuration so you can restore after a mistake.", "Networking settings control who can reach your app (inbound) and what your app can reach (outbound), such as a database on a private network.",
                "Deployment slots are extra copies of your app, such as 'staging'. You deploy there, test it, then swap it into production with no downtime."],
    engineer=[
        "Backups: automatic backups (platform-managed, hourly, kept 30 days) are available in Basic and higher. Automatic backups need no storage account and have a 30 GB limit. Custom backups are also available from Basic (on Basic, only the production slot can be backed up): they go to your storage account on demand or on a schedule (at most every 2 hours), have a 10 GB limit including any linked database, and keep backups 0–30 days or indefinitely. Automatic backups never include databases; support for linked databases in custom backups ends on 31 March 2028, so plan database-native backups. Restore to the same app, another app or a slot.",
        "Inbound networking: access restrictions (priority-ordered allow/deny rules by IP range, service tag or VNet subnet with service endpoint; separate rules for the SCM/Kudu site); private endpoints (Basic and higher) give the app a private IP and can be combined with disabling public network access, plus privatelink.azurewebsites.net private DNS.",
        "Outbound networking: regional VNet integration (Basic and higher) lets the app call resources in or through a VNet (private endpoints, VMs, on-premises over gateways) from a dedicated, delegated integration subnet; enable route-all (vnetRouteAllEnabled) to send all outbound traffic through the VNet for NSGs, UDRs and NAT gateway. Hybrid connections reach specific host:port endpoints on-premises.",
        "Deployment slots (Standard: 5, Premium/Isolated: 20): each slot has its own hostname and can be deployed independently. Swap exchanges content and non-sticky settings; settings marked 'Deployment slot setting' stay with the slot. Some settings never swap: custom domains, TLS bindings, scale settings, IP restrictions, Always On, VNet integration, managed identities, WebJobs schedulers and diagnostic settings.",
        "Swap safety: the target slot's settings are applied to the source instances, which are warmed up (applicationInitialization) before routing switches. Swap with preview (multi-phase) pauses so you can validate. Auto swap is available for Windows apps. Testing in production routes a percentage of traffic to a slot. Rollback = swap again.",
    ],
    anim=("appservice-sim", "Open 'Deployment slots' and 'Backup and networking'."),
    diagram=([("users", "Users", 0, 60, "user"), ("pe", "Private endpoint (inbound)", 220, 0, "network"), ("prod", "app-contoso (production)", 440, 0, "globe"), ("stg", "app-contoso-staging (slot)", 440, 130, "globe"),
              ("vnet", "VNet integration → SQL private endpoint", 680, 60, "network"), ("st", "Backup storage account", 680, 180, "storage")],
             [("users", "pe"), ("pe", "prod"), ("stg", "prod", "swap"), ("prod", "vnet", "outbound"), ("prod", "st", "backups")]),
    example=("Zero-downtime releases", ["Every release deploys to the staging slot, which has its own sticky connection string to a staging database. A smoke test runs against app-contoso-staging.azurewebsites.net, then a swap with preview promotes it.",
                                         "The production app is reachable only through a private endpoint from Front Door, calls Azure SQL through VNet integration, and has daily custom backups to a storage account."]),
    config=dict(prerequisites=["Basic tier for backups (Standard for deployment slots)", "Integration subnet (delegated to Microsoft.Web/serverFarms) for VNet integration", "Storage account for custom backups"],
                permissions=["Website Contributor", "Network Contributor on the VNet/subnet", "Storage Blob Data Contributor or SAS for backup storage"],
                limits=["Slots: Standard 5, Premium/Isolated 20", "Custom backup limit 10 GB including databases", "Some settings never swap"],
                portal=["Web app > Backups: configure custom backups (storage container, schedule, databases); restore.", "Web app > Networking: Access restriction, Private endpoints, VNet integration, Hybrid connections.",
                        "Web app > Deployment slots > Add slot; Swap (with preview); Traffic %.", "Configuration: tick 'Deployment slot setting' on app settings that must stay with a slot."],
                cli="az webapp config backup create -g rg-web --webapp-name app-contoso --backup-name manual1 --container-url \"<container-SAS-URL>\"\naz webapp config backup update -g rg-web --webapp-name app-contoso --container-url \"<container-SAS-URL>\" --frequency 1d --retain-one true --retention 30\naz webapp config access-restriction add -g rg-web -n app-contoso --rule-name office --action Allow --ip-address 203.0.113.0/24 --priority 100\naz webapp vnet-integration add -g rg-web -n app-contoso --vnet vnet-app --subnet snet-integration\naz resource update -g rg-web -n app-contoso --resource-type Microsoft.Web/sites --set properties.vnetRouteAllEnabled=true\naz webapp deployment slot create -g rg-web -n app-contoso --slot staging\naz webapp config appsettings set -g rg-web -n app-contoso --slot staging --slot-settings ConnectionStrings__Db=\"<staging-db>\"\naz webapp traffic-routing set -g rg-web -n app-contoso --distribution staging=10\naz webapp deployment slot swap -g rg-web -n app-contoso --slot staging --target-slot production",
                powershell="New-AzWebAppBackup -ResourceGroupName rg-web -Name app-contoso -StorageAccountUrl '<container-SAS-URL>'\nNew-AzWebAppSlot -ResourceGroupName rg-web -Name app-contoso -Slot staging\nSwitch-AzWebAppSlot -ResourceGroupName rg-web -Name app-contoso -SourceSlotName staging -DestinationSlotName production\nAdd-AzWebAppAccessRestrictionRule -ResourceGroupName rg-web -WebAppName app-contoso -Name office -Priority 100 -Action Allow -IpAddress 203.0.113.0/24"),
    lab=dict(type="A", objective="Configure backups and private networking, and perform a safe slot swap.", duration=15,
             steps=["Deployment slots: run with defaults, then apply 'Staging DB string not sticky' and 'Basic tier'.", "Backup and networking: run with defaults, then apply 'Free tier backup' and 'No VNet integration'."],
             expected=["Slots need Standard+", "Non-sticky connection strings swap into production", "Backups need Basic or higher", "Private DB access needs VNet integration"],
             validation=[("slot-problem", "Found a slot swap risk"), ("slot-swapped", "Swapped slots safely"), ("app-backup", "Configured a backup"), ("app-networking", "Configured private inbound and outbound networking")],
             failures=["Swapping production DB settings", "Basic tier for slots", "Calling a private endpoint without VNet integration"]),
    troubleshooting=[("After a swap, production uses the staging database.", "Connection string not marked as a deployment slot setting.", "Mark it sticky, swap back, then swap again."),
                     ("App cannot reach SQL through its private endpoint.", "No VNet integration, or private DNS not resolving from the integration subnet.", "Enable VNet integration and link privatelink.database.windows.net to the VNet."),
                     ("403 from the office after adding access restrictions.", "Rule priority or missing allow rule for the office range.", "Check rules; remember the implicit deny once any allow rule exists."), ("Backup fails.", "Content plus database exceeds 10 GB or storage SAS expired.", "Exclude files, renew SAS, or use database-native backups.")],
    comparisons=[("Azure Front Door + private link to App Service", "Global entry point with WAF in front of a privately reachable app."), ("AWS Elastic Beanstalk environment swap", "Similar blue/green CNAME swap.")],
    misconceptions=[("Slot swaps cause downtime.", "Instances are warmed before routing switches."), ("All settings swap.", "Sticky settings and a list of platform settings never swap."), ("VNet integration makes the app private.", "It is outbound only; use private endpoints/access restrictions for inbound.")],
    decisions=["Use staging slots plus swap with preview for every production release.", "Combine private endpoints (inbound) and VNet integration (outbound) for private apps.", "Back up databases with their native features as well."],
    docs=[("Back up and restore your app", ML + "app-service/manage-backup"), ("Set up staging environments (slots)", ML + "app-service/deploy-staging-slots"),
          ("App Service networking features", ML + "app-service/networking-features"), ("Integrate your app with a VNet", ML + "app-service/overview-vnet-integration"),
          ("Access restrictions", ML + "app-service/app-service-ip-restrictions"), ("Private endpoints for App Service", ML + "app-service/overview-private-endpoint")],
)
q("az104-q-aso-01", E, "AZ104-3.4.8", 2, "scenario", "single", "After swapping staging into production, production starts using the staging database. What should have been configured?",
  [("a", "The connection string marked as a deployment slot setting in both slots", "Correct. Sticky settings stay with their slot."), ("b", "Swap with preview", "Helps validate, but does not keep settings in place."), ("c", "Auto swap", "Would swap automatically, with the same problem."), ("d", "A second App Service plan", "Unrelated.")], ["a"], "Mark environment-specific settings as slot settings.", [ML + "app-service/deploy-staging-slots"])
q("az104-q-aso-02", E, "AZ104-3.4.8", 2, "multiple", "multiple", "Which TWO settings are NOT swapped during a slot swap?",
  [("a", "Custom domain names", "Correct."), ("b", "Scale settings", "Correct."), ("c", "Application code", "Code swaps."), ("d", "App settings not marked as slot settings", "These swap.")], ["a", "b"], "Domains, TLS bindings, scale, IP restrictions, VNet integration and identities stay with the slot.", [ML + "app-service/deploy-staging-slots#which-settings-are-swapped"])
q("az104-q-aso-03", E, "AZ104-3.4.7", 2, "troubleshooting", "single", "A web app must call a VM at 10.20.1.4 in a VNet. Calls time out. What do you configure?",
  [("a", "Regional VNet integration for the app", "Correct. It provides outbound access into the VNet."), ("b", "A private endpoint for the app", "That is inbound only."), ("c", "Access restrictions", "Inbound filtering."), ("d", "A custom domain", "Unrelated.")], ["a"], "VNet integration is outbound; private endpoints are inbound.", [ML + "app-service/overview-vnet-integration"])
q("az104-q-aso-04", E, "AZ104-3.4.7", 2, "configuration", "single", "Only Front Door should reach the app; direct internet access must be blocked. Which configuration works without private endpoints?",
  [("a", "An access restriction allowing the AzureFrontDoor.Backend service tag (with the X-Azure-FDID header check) and denying everything else", "Correct."), ("b", "VNet integration", "Outbound only."), ("c", "HTTPS Only", "Does not restrict sources."), ("d", "A deployment slot", "Unrelated.")], ["a"], "Access restrictions support service tags and header filters.", [ML + "app-service/app-service-ip-restrictions"])
q("az104-q-aso-05", E, "AZ104-3.4.6", 2, "scenario", "single", "A Basic-tier app needs scheduled backups that include its Azure SQL database. What must you do?",
  [("a", "Scale up to Standard first, then configure a custom backup", "Unnecessary: custom backups are available on Basic."), ("b", "Rely on automatic backups", "Automatic backups do not include databases."), ("c", "Configure a custom backup with a storage account, a schedule and the linked database", "Correct."), ("d", "Use AzCopy on the web root", "Not an App Service backup.")], ["c"], "Custom backups work from the Basic tier (production slot only on Basic) and can include a linked database up to 10 GB in total. Linked database support ends on 31 March 2028.", [ML + "app-service/manage-backup"])
q("az104-q-aso-06", E, "AZ104-3.4.6", 1, "single", "single", "Where do App Service custom backups get stored?",
  [("a", "In a storage account container you specify", "Correct."), ("b", "In the App Service plan", "No."), ("c", "In a Recovery Services vault", "That is Azure Backup for VMs and others."), ("d", "In the deployment slot", "No.")], ["a"], "Automatic backups are platform-managed; custom backups use your storage.", [ML + "app-service/manage-backup"])
