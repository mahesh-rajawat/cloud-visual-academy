"""Real-Azure hands-on labs for AZ-305 lessons where trying it in the portal helps a design decision stick.

AZ-305 is a design exam, so only lessons with a free or near-free exercise get a lab. Steps are
(what to do, what you should see[, tip[, code]]), as in _az104kit.H.
"""
from _az104kit import H

ML = "https://learn.microsoft.com/"
RG = "rg-az305-lab"
REGION = "UAE North (or any region near you)"
BASE = f"Signed in at portal.azure.com as Owner of a subscription. Work in a resource group called {RG}."
NEW_RG = f"If {RG} does not exist yet: Resource groups > Create > name {RG}, region {REGION} > Review + create > Create."
DELETE_RG = f"Resource groups > {RG} > Delete resource group > type the name > Delete."

LAB: dict[str, dict] = {}

LAB["az305-monitoring"] = H(
    "Route the activity log to a workspace and query it", 20, "low", "Low. A new workspace with a little activity-log data costs cents; the activity log itself is free.",
    [BASE, NEW_RG],
    [("Create a Log Analytics workspace: search 'Log Analytics workspaces' > Create > rg-az305-lab, name law-az305, your region.", "The workspace deploys in about a minute."),
     ("Search 'Monitor' > Activity log > Export Activity Logs > + Add diagnostic setting. Name to-law; tick Administrative and Policy; destination Send to Log Analytics workspace > law-az305. Save.", "A diagnostic setting for the subscription's activity log.", "This is the 'routing' decision: here you chose the workspace (query). Storage would be archive; Event Hubs would stream out."),
     ("Make a change so there is something to log: create a tag on rg-az305-lab (Tags > Environment = Lab > Apply).", "The tag appears on the resource group."),
     ("Wait 5–10 minutes. Open law-az305 > Logs, switch to KQL mode and run the query.", "Rows showing your tag write and who did it.", "If there are no rows yet, wait a few more minutes; ingestion is not instant.",
      "AzureActivity\n| where TimeGenerated > ago(1h)\n| project TimeGenerated, OperationNameValue, Caller, ActivityStatusValue\n| order by TimeGenerated desc"),
     ("Open law-az305 > Settings > Tables, select AzureActivity.", "The table plan and retention settings you would tune for cost.")],
    ["The KQL query returns your own recent operations."],
    ["Monitor > Activity log > Export Activity Logs: delete the to-law setting.", DELETE_RG],
    [("Create diagnostic settings", ML + "azure/azure-monitor/essentials/create-diagnostic-settings"), ("Log Analytics tutorial", ML + "azure/azure-monitor/logs/log-analytics-tutorial")])

LAB["az305-governance"] = H(
    "Enforce a rule with Azure Policy and watch it block a deployment", 20, "free", "Free. Policy assignments and compliance scans cost nothing.",
    [BASE, NEW_RG],
    [("Search 'Policy' > Assignments > Assign policy. Scope: your subscription, resource group rg-az305-lab. Policy definition: search 'Allowed locations'.", "The built-in 'Allowed locations' definition selected.", "Assigning at a resource group keeps the lab from affecting anything else. In a real design you'd assign at a management group."),
     ("Parameters: Allowed locations = only your lab region. Review + create > Create.", "The assignment appears; it can take up to 30 minutes to take effect, usually less."),
     ("Try to create a storage account in rg-az305-lab in a DIFFERENT region (for example West US).", "Validation fails with 'RequestDisallowedByPolicy'.", "This is a Deny effect: the request is stopped before anything is created."),
     ("Create the storage account again in your lab region (any unique name, Standard LRS).", "It deploys successfully."),
     ("Policy > Compliance > select the assignment.", "Resources listed as compliant; a scan may take a while to appear."),
     ("Policy > Assignments > select it > Create exemption (look but don't save).", "Exemption options: Waiver or Mitigated, with an expiry date.")],
    ["The out-of-region deployment was blocked; the in-region one worked."],
    ["Policy > Assignments: delete the Allowed locations assignment.", DELETE_RG],
    [("Tutorial: create and manage policies", ML + "azure/governance/policy/tutorials/create-and-manage"), ("Azure Policy effects", ML + "azure/governance/policy/concepts/effect-basics")])

LAB["az305-authorization"] = H(
    "Create a least-privilege custom role", 15, "free", "Free. Role definitions and assignments cost nothing.",
    [BASE, NEW_RG, "Open Cloud Shell (Bash) from the portal toolbar."],
    [("Save your subscription ID in a variable.", "A GUID is printed.", None, "SUB=$(az account show --query id -o tsv); echo $SUB"),
     ("Create a role definition file that allows only reading, starting and restarting VMs in the lab resource group.", "No output; the file vm-operator.json exists.", None,
      "cat > vm-operator.json <<EOF\n{\n  \"Name\": \"VM Operator (lab)\",\n  \"Description\": \"Read, start and restart VMs only\",\n  \"Actions\": [\n    \"Microsoft.Compute/virtualMachines/read\",\n    \"Microsoft.Compute/virtualMachines/start/action\",\n    \"Microsoft.Compute/virtualMachines/restart/action\"\n  ],\n  \"AssignableScopes\": [ \"/subscriptions/$SUB/resourceGroups/rg-az305-lab\" ]\n}\nEOF"),
     ("Create the custom role.", "JSON describing the new role, with type CustomRole.", None, "az role definition create --role-definition @vm-operator.json"),
     ("In the portal: rg-az305-lab > Access control (IAM) > Roles, search 'VM Operator'.", "Your custom role listed. Open it > Permissions to see exactly three actions.", "Compare with Virtual Machine Contributor, which also allows delete, resize and more."),
     ("Access control (IAM) > Add > Add role assignment: look at the Conditions tab on a Storage Blob Data role (don't save).", "The ABAC condition builder (for example filtering by blob index tags).")],
    ["The custom role shows only read, start and restart."],
    ["Delete the role: az role definition delete --name \"VM Operator (lab)\"", DELETE_RG],
    [("Create a custom role with the CLI", ML + "azure/role-based-access-control/custom-roles-cli"), ("ABAC conditions", ML + "azure/role-based-access-control/conditions-overview")])

LAB["az305-secrets"] = H(
    "Store a secret in Key Vault and read it with RBAC", 15, "low", "Low. Key Vault Standard charges per 10,000 operations; this lab uses a handful (well under one US cent).",
    [BASE, NEW_RG, "Open Cloud Shell (Bash)."],
    [("Create a vault with the Azure RBAC permission model (use a unique name).", "The vault's JSON, with enableRbacAuthorization true and enableSoftDelete true.", "Purge protection is left off so the lab can be cleaned up today. Turn it on for production.",
      "KV=kv-az305-$RANDOM; az keyvault create -g rg-az305-lab -n $KV --enable-rbac-authorization true; echo $KV"),
     ("Try to add a secret right away.", "An error: you are not authorized.", "Owner manages the vault (control plane) but has no data-plane role yet.", "az keyvault secret set --vault-name $KV -n db-password --value 'Lab-Only-123!'"),
     ("Give yourself the Key Vault Secrets Officer role on the vault, wait a minute, then retry.", "The secret is created.", None,
      "az role assignment create --assignee $(az ad signed-in-user show --query id -o tsv) --role \"Key Vault Secrets Officer\" --scope $(az keyvault show -n $KV --query id -o tsv)\nsleep 60\naz keyvault secret set --vault-name $KV -n db-password --value 'Lab-Only-123!'"),
     ("Read it back.", "The secret value.", None, "az keyvault secret show --vault-name $KV -n db-password --query value -o tsv"),
     ("Portal: open the vault > Properties.", "Soft-delete retention days and the purge protection setting.")],
    ["You saw RBAC block access until a data-plane role was assigned."],
    ["Delete the resource group (the vault becomes soft-deleted).", "Optional: Key vaults > Manage deleted vaults > Purge, to free the name."],
    [("Key Vault RBAC guide", ML + "azure/key-vault/general/rbac-guide"), ("Quickstart: secrets with the CLI", ML + "azure/key-vault/secrets/quick-create-cli")])

LAB["az305-relational"] = H(
    "Create a free serverless Azure SQL database", 20, "free", "Free with the Azure SQL Database free tier (100,000 vCore seconds and 32 GB of data per database each month). If the free tier is not offered, choose serverless with auto-pause and delete it today.",
    [BASE, NEW_RG],
    [("Search 'Azure SQL' > Create > SQL databases > Single database. Look for the banner to apply the free tier and apply it.", "Compute + storage shows General Purpose, Serverless."),
     ("Resource group rg-az305-lab; database name sqldb-lab; Server: Create new (unique name, your region, Microsoft Entra-only authentication with yourself as admin).", "A new logical server configured."),
     ("Open Configure database.", "General Purpose / Hyperscale / Business Critical options, provisioned vs serverless, and the auto-pause delay.", "Notice what you'd change for a 40 TB database (Hyperscale) or the lowest-latency OLTP (Business Critical)."),
     ("Networking: allow your client IP. Review + create > Create.", "Deployment completes in a few minutes."),
     ("Open the database > Query editor, sign in with Entra, and run a query.", "Your SQL version and the service objective.", None, "SELECT @@VERSION AS version, DATABASEPROPERTYEX(DB_NAME(), 'ServiceObjective') AS objective;"),
     ("Open Compute + storage again.", "Auto-pause settings: the database pauses when idle and resumes on the next connection.")],
    ["The query returned the service objective (a GP serverless objective)."],
    [DELETE_RG],
    [("Azure SQL Database free tier", ML + "azure/azure-sql/database/free-tier"), ("Serverless compute tier", ML + "azure/azure-sql/database/serverless-tier-overview")])

LAB["az305-messaging-events"] = H(
    "Publish to a Service Bus topic with filtered subscriptions", 20, "low", "Low. A Standard namespace is billed hourly (a few US cents for this lab). Delete it the same day.",
    [BASE, NEW_RG],
    [("Search 'Service Bus' > Create: rg-az305-lab, unique namespace name, your region, pricing tier Standard.", "The namespace deploys.", "Basic tier has no topics; topics need Standard or Premium."),
     ("Namespace > Topics > + Topic: name orders.", "Topic orders created."),
     ("Open orders > + Subscription: name billing. Create another: shipping.", "Two subscriptions."),
     ("Open the shipping subscription > Filters: replace the default rule with a SQL filter.", "Only messages with Country = 'AE' will reach shipping.", None, "Country = 'AE'"),
     ("Open the orders topic > Service Bus Explorer > Send messages: body {\"id\":1}, add a custom property Country = AE. Send. Send another with Country = US.", "Two messages sent."),
     ("Subscriptions > billing > Service Bus Explorer > Peek from start; then shipping.", "billing has both messages; shipping has only the AE one.", "This is publish-subscribe with filters — the sender doesn't know who listens.")],
    ["Each subscription received the messages its filter allows."],
    [DELETE_RG],
    [("Quickstart: topics and subscriptions in the portal", ML + "azure/service-bus-messaging/service-bus-quickstart-topics-subscriptions-portal"), ("Topic filters and actions", ML + "azure/service-bus-messaging/topic-filters")])

LAB["az305-migration-planning"] = H(
    "Assess servers with Azure Migrate (CSV import)", 30, "free", "Free. Azure Migrate discovery and assessment are free; this lab imports a CSV instead of deploying an appliance.",
    [BASE, NEW_RG],
    [("Search 'Azure Migrate' > Servers, databases and web apps > Create project: rg-az305-lab, project name migrate-lab, a geography near you.", "The project opens."),
     ("Discover > Import using CSV > Download the template.", "A CSV template with columns such as server name, cores, memory, OS and disks."),
     ("Fill in three rows, for example: web01 (2 cores, 8 GB, Windows Server 2019), app01 (4 cores, 16 GB), db01 (8 cores, 64 GB). Save and upload.", "Import succeeds; three servers appear in the inventory after a few minutes."),
     ("Assess > Azure VM: sizing criteria As on-premises (CSV has no performance data); target region near you. Group: create a group with the three servers. Create assessment.", "An assessment computes."),
     ("Open the assessment.", "Azure readiness, recommended VM sizes and monthly cost estimates.", "With the real appliance, performance-based sizing usually recommends smaller, cheaper sizes."),
     ("Look at the Business case option (don't build it).", "On-premises vs Azure cost comparison over time.")],
    ["The assessment shows readiness and a cost estimate for three servers."],
    ["Delete the Azure Migrate project (or the resource group).", DELETE_RG],
    [("Import servers using a CSV", ML + "azure/migrate/tutorial-discover-import"), ("Assessment overview", ML + "azure/migrate/concepts-assessment-calculation")])

LAB["az305-compute"] = H(
    "Compare compute options with the pricing calculator", 20, "free", "Free. Uses the public Azure pricing calculator; nothing is deployed.",
    ["A browser. No Azure sign-in is needed."],
    [("Open azure.microsoft.com/pricing/calculator. Add a Virtual Machines estimate: your region, D2s v5, Linux, 730 hours.", "A monthly pay-as-you-go price."),
     ("In the same item, switch savings options to 1-year and 3-year reserved, then Spot (if shown).", "Large discounts for commitment; the deepest for Spot.", "Spot fits interruptible work only."),
     ("Add an App Service estimate: Linux, Premium v3 P1v3, 1 instance.", "A price for managed web hosting (no OS to patch)."),
     ("Add an Azure Container Apps estimate (Consumption) with a few million requests and a modest vCPU-second usage.", "Usage-based cost that can drop near zero when idle."),
     ("Compare the three for a small web API that is idle at night.", "Container Apps or App Service usually cost less to operate than a VM you must patch.")],
    ["You can explain when reservations, Spot and serverless each save money."],
    ["Nothing to delete."],
    [("Choose a compute service", ML + "azure/architecture/guide/technology-choices/compute-decision-tree"), ("Azure Spot VMs", ML + "azure/virtual-machines/spot-vms")])
