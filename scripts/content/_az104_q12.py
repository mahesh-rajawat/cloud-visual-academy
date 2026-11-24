"""Extra AZ-104 exam-style questions, domains 1 (identity and governance) and 2 (storage).

Each entry: (objective, difficulty, type, stem, [(option, why)], correct letters, explanation, doc[, code]).
"""
D = "https://learn.microsoft.com/"
Q: list[tuple] = []
add = Q.append

# ---------------------------------------------------------------- 1.1 Entra users and groups
add(("AZ104-1.1.1", 2, "scenario", "You must add 400 new employees to Microsoft Entra ID tomorrow with the least effort. What should you use?",
     [("Create each user in the portal", "Works, but far too slow for 400 users."), ("Bulk create with a CSV file in Users > Bulk operations", "Correct: upload one CSV to create all users."),
      ("Invite them as B2B guests", "Employees should be member users, not guests."), ("Create a dynamic group", "A group does not create user accounts.")],
     "b", "Bulk create uploads a CSV template to create many users at once.", D + "entra/identity/users/users-bulk-add"))
add(("AZ104-1.1.1", 2, "single", "Which group type gives users a shared mailbox, calendar and Teams workspace?",
     [("Security group", "Used for access, not collaboration features."), ("Distribution list", "Not created in Entra ID for collaboration."),
      ("Microsoft 365 group", "Correct."), ("Administrative unit", "An admin unit scopes administration; it is not a group.")],
     "c", "Microsoft 365 groups include collaboration resources such as a mailbox and Teams.", D + "entra/fundamentals/concept-learn-about-groups"))
add(("AZ104-1.1.2", 2, "troubleshooting", "You created a dynamic membership group with the rule user.department -eq \"Sales\". A new user in Sales is not in the group. Their profile shows Department: (blank). What should you do?",
     [("Add the user to the group manually", "You cannot manually add members to a dynamic group."), ("Set the user's Department property to Sales", "Correct: the rule evaluates user properties."),
      ("Change the group type to Microsoft 365", "Group type does not affect rule evaluation."), ("Assign the user a P2 licence", "A P1 or P2 licence must exist in the tenant; the missing property is the problem.")],
     "b", "Dynamic membership follows user properties. Fix the property and the user is added automatically.", D + "entra/identity/users/groups-dynamic-membership"))
add(("AZ104-1.1.2", 1, "single", "Which user property must be set before you can assign a licence directly to that user?",
     [("Job title", "Optional."), ("Manager", "Optional."), ("Department", "Optional."), ("Usage location", "Correct.")],
     "d", "Direct licence assignment requires a usage location because services differ by country. (Group-based licensing falls back to the tenant's country.)", D + "entra/fundamentals/license-users-groups"))

# ---------------------------------------------------------------- 1.1 licences and guests
add(("AZ104-1.1.3", 2, "scenario", "Every member of the Finance group must automatically get Microsoft Entra ID P1, and lose it when they leave the group. What should you configure?",
     [("Group-based licensing on the Finance group", "Correct."), ("A dynamic group with the licence as a rule", "Rules select members; they do not assign licences."),
      ("Assign the licence to each user", "Not automatic when people join or leave."), ("An Azure Policy assignment", "Policy governs Azure resources, not Entra licences.")],
     "a", "Group-based licensing assigns and removes licences as membership changes.", D + "entra/identity/users/licensing-groups-assign"))
add(("AZ104-1.1.3", 2, "troubleshooting", "A group-based licence shows an error for one member. The other members are licensed. What is the most likely cause?",
     [("The group is a security group", "Security groups support group-based licensing."), ("The tenant has no Azure subscription", "Not related to Entra licensing."),
      ("All purchased licences are already assigned", "Correct: the group has more members than available licences."), ("The user has no usage location", "With group-based licensing the user inherits the tenant's country, so this alone does not cause the error.")],
     "c", "Common group licence errors are not enough licences (CountViolation), conflicting service plans and services not available in the usage location.", D + "entra/identity/users/licensing-groups-resolve-problems"))
add(("AZ104-1.1.4", 2, "scenario", "Only members of the Partner Managers group should be able to invite guest users. What should you configure?",
     [("A Conditional Access policy", "Controls sign-in, not who can invite."), ("Assign the Guest Inviter role to Partner Managers and restrict invitations to admins and Guest Inviters", "Correct."),
      ("Block all external domains", "That stops all invitations."), ("Make Partner Managers Global Administrators", "Far more privilege than needed.")],
     "b", "External collaboration settings can limit invitations to admins and users in the Guest Inviter role.", D + "entra/external-id/external-collaboration-settings-configure"))
add(("AZ104-1.1.4", 1, "single", "A partner user accepts your B2B invitation. How do they sign in to your apps?",
     [("With a new password you set for them in your tenant", "B2B guests use their own identity."), ("With their own work, school or personal account", "Correct."),
      ("With a shared guest account", "Shared accounts are not how B2B works."), ("Only through a VPN", "Not required.")],
     "b", "B2B guests authenticate with their home identity provider.", D + "entra/external-id/what-is-b2b"))
add(("AZ104-1.1.5", 2, "scenario", "You want to pilot SSPR with the Helpdesk group before rolling it out. Which SSPR setting do you choose?",
     [("None", "Disables SSPR for users."), ("All", "Enables it for everyone."), ("Selected, with the Helpdesk group", "Correct."), ("Administrators only", "Not an option; admins are always enabled.")],
     "c", "SSPR 'Selected' scopes it to one security group, ideal for a pilot.", D + "entra/identity/authentication/tutorial-enable-sspr"))
add(("AZ104-1.1.5", 2, "troubleshooting", "A cloud-only user without any Microsoft Entra ID P1 licence cannot reset a forgotten password with SSPR. Why?",
     [("SSPR for forgotten passwords requires P1 (or an equivalent licence)", "Correct."), ("The user must be a Global Administrator", "Admins have SSPR, but users can too with the right licence."),
      ("SSPR only works for guests", "No."), ("Password writeback is not enabled", "Writeback is only for synchronised on-premises users.")],
     "a", "Self-service reset of a forgotten password requires Microsoft Entra ID P1 or an equivalent Microsoft 365 licence.", D + "entra/identity/authentication/concept-sspr-licensing"))

# ---------------------------------------------------------------- 1.2 RBAC
add(("AZ104-1.2.1", 2, "scenario", "An operator must start, stop and resize VMs in a subscription but must not manage networking or grant access. Which built-in role is the least-privileged fit?",
     [("Owner", "Can grant access."), ("Contributor", "Can manage everything, including networks."), ("Virtual Machine Contributor", "Correct."), ("Reader", "Cannot change VMs.")],
     "c", "Virtual Machine Contributor manages VMs but not the virtual network or access.", D + "azure/role-based-access-control/built-in-roles"))
add(("AZ104-1.2.1", 2, "single", "Which role lets a user grant others access to Azure resources but not create or manage the resources themselves?",
     [("Contributor", "Cannot assign roles."), ("User Access Administrator", "Correct."), ("Reader", "View only."), ("Security Admin", "A Defender role, not for RBAC assignments.")],
     "b", "User Access Administrator manages role assignments only.", D + "azure/role-based-access-control/built-in-roles"))
add(("AZ104-1.2.2", 2, "scenario", "A contractor needs to view all resources in the rg-web resource group only. Where should you assign the Reader role?",
     [("The tenant root management group", "Far too broad."), ("The subscription", "Gives read access to every resource group."),
      ("The rg-web resource group", "Correct: the smallest scope that does the job."), ("Each resource in rg-web", "Works, but harder to manage and misses new resources.")],
     "c", "Assign at the smallest scope that covers what is needed; access inherits to resources in the group.", D + "azure/role-based-access-control/scope-overview"))
add(("AZ104-1.2.2", 3, "multiple", "User1 has Reader on Subscription1 and Contributor on RG1 (in Subscription1). Which TWO actions can User1 perform?",
     [("Create a VM in RG1", "Correct: Contributor on RG1."), ("Create a VM in RG2", "Only Reader there."), ("View resources in RG2", "Correct: Reader on the subscription inherits."),
      ("Assign Reader to another user on RG1", "Contributor cannot assign roles.")],
     "ac", "RBAC is additive: Contributor on RG1 plus Reader everywhere in the subscription.", D + "azure/role-based-access-control/overview"))
add(("AZ104-1.2.3", 3, "troubleshooting", "User1 is in Group1, which has Contributor on RG1. User1 also has Reader directly on RG1. What can User1 do in RG1?",
     [("Only read, because the direct assignment wins", "Direct assignments do not override group ones."), ("Create and manage resources", "Correct: permissions add up."),
      ("Nothing, because the assignments conflict", "RBAC assignments never conflict this way."), ("Assign roles to others", "Neither role allows that.")],
     "b", "Effective permissions are the union of all role assignments, including those through groups.", D + "azure/role-based-access-control/overview"))
add(("AZ104-1.2.3", 2, "single", "A Global Administrator in Microsoft Entra ID cannot see any Azure subscriptions in the portal. Why?",
     [("Global Administrator has no Azure resource access by default", "Correct: Entra roles and Azure roles are separate."), ("Their licence expired", "Licences do not grant Azure RBAC."),
      ("MFA is disabled", "Unrelated."), ("The subscriptions are in another region", "Subscriptions are not regional.")],
     "a", "Entra roles manage the directory. To access Azure resources the user needs an Azure role, or must elevate access to User Access Administrator at root scope.", D + "azure/role-based-access-control/rbac-and-directory-admin-roles"))

# ---------------------------------------------------------------- 1.3 policy, locks, tags
add(("AZ104-1.3.1", 2, "scenario", "Resources must only be created in UAE North and UAE Central, in every subscription under the Corp management group. What do you do?",
     [("Create a resource lock on each subscription", "Locks prevent deletion or change; they do not restrict regions."),
      ("Assign the Allowed locations policy at the Corp management group", "Correct."), ("Assign Reader to all users", "Stops all creation."),
      ("Tag every resource with its region", "Tags do not enforce anything.")],
     "b", "A Deny policy at a management group applies to all subscriptions beneath it.", D + "azure/governance/policy/assign-policy-portal"))
add(("AZ104-1.3.1", 3, "troubleshooting", "You assign a policy with the Modify effect to add a tag. New resources get the tag, but 200 existing resources do not. What should you do?",
     [("Wait 24 hours for automatic evaluation to fix them", "Evaluation reports non-compliance but does not change existing resources."),
      ("Create a remediation task for the assignment", "Correct."), ("Change the effect to Audit", "Audit only reports."), ("Delete and recreate the resources", "Unnecessary.")],
     "b", "Modify and DeployIfNotExists policies fix existing resources only through a remediation task (which uses the assignment's managed identity).", D + "azure/governance/policy/how-to/remediate-resources"))
add(("AZ104-1.3.2", 2, "scenario", "Administrators must still be able to change the settings of a production SQL server, but nobody should be able to delete it by accident. Which lock?",
     [("ReadOnly", "Blocks changes too."), ("CanNotDelete (Delete)", "Correct."), ("No lock; use Reader", "Admins need write access."), ("An Azure Policy with Deny", "The Deny effect does not evaluate delete requests.")],
     "b", "CanNotDelete allows reads and updates but blocks deletion.", D + "azure/azure-resource-manager/management/lock-resources"))
add(("AZ104-1.3.2", 3, "troubleshooting", "After a ReadOnly lock is applied to a storage account's resource group, an app that lists the account keys starts failing. Why?",
     [("ReadOnly locks block the List Keys operation because it is a POST request", "Correct."), ("The keys were rotated by the lock", "Locks do not rotate keys."),
      ("ReadOnly locks disable the storage account", "The account still serves data."), ("The app's role was removed", "Locks do not change role assignments.")],
     "a", "ReadOnly blocks write operations; listing keys is a POST action, so it is blocked.", D + "azure/azure-resource-manager/management/lock-resources#considerations-before-applying-your-locks"))
add(("AZ104-1.3.3", 2, "single", "You add the tag CostCenter=42 to a resource group. What happens to the resources already in the group?",
     [("They inherit the tag immediately", "Tags are not inherited by default."), ("They do not get the tag unless you use a policy or add it yourself", "Correct."),
      ("They get the tag at the next billing cycle", "No."), ("The tag is removed from the group", "No.")],
     "b", "Resources do not inherit resource group tags automatically. Use 'Inherit a tag from the resource group' policies.", D + "azure/azure-resource-manager/management/tag-resources"))
add(("AZ104-1.3.3", 2, "scenario", "Finance wants cost reports split by department. Every resource must have a Department tag; resources created without it must be blocked. Which policy effect?",
     [("Audit", "Reports only."), ("Append", "Adds fields, but cannot invent the right department value."), ("Deny with 'Require a tag on resources'", "Correct."), ("AuditIfNotExists", "Reports only.")],
     "c", "The built-in 'Require a tag on resources' denies creation without the tag.", D + "azure/governance/policy/samples/built-in-policies"))
add(("AZ104-1.3.4", 2, "single", "You move a VM from RG1 (location West Europe) to RG2 (location UAE North). Where does the VM run after the move?",
     [("UAE North", "The resource group's location does not move resources."), ("West Europe, its original region", "Correct."),
      ("It is stopped until you choose", "Moves do not change the region."), ("In both regions", "No.")],
     "b", "Moving between resource groups changes only the resource ID; the region stays the same.", D + "azure/azure-resource-manager/management/move-resource-group-and-subscription"))
add(("AZ104-1.3.4", 2, "troubleshooting", "You try to delete RG1 but the deletion fails. Which is the most likely cause?",
     [("RG1 contains resources in another region", "That does not block deletion."), ("A CanNotDelete lock exists on RG1 or a resource in it", "Correct."),
      ("RG1 has tags", "Tags do not block deletion."), ("RG1 is not empty", "Deleting a group deletes its contents.")],
     "b", "Locks on the group or any resource inside block deletion until removed.", D + "azure/azure-resource-manager/management/delete-resource-group"))
add(("AZ104-1.3.5", 3, "single", "You transfer a subscription to a different Microsoft Entra tenant. What happens to existing Azure role assignments in it?",
     [("They are kept", "No: identities from the old tenant are not valid."), ("They are permanently deleted", "Correct."),
      ("They are converted to guest assignments", "No."), ("Only Owner assignments are kept", "No.")],
     "b", "Changing a subscription's directory removes all role assignments and custom roles; plan to recreate them.", D + "azure/role-based-access-control/transfer-subscription"))
add(("AZ104-1.3.5", 2, "troubleshooting", "A deployment of 30 VMs in a region fails with a quota error. What should you check or do?",
     [("Usage + quotas, then request an increase for the regional vCPU quota", "Correct."), ("Move the VMs to a new resource group", "Quotas are per subscription and region."),
      ("Delete the resource group's tags", "Unrelated."), ("Change the VM's OS", "Unrelated.")],
     "a", "vCPU quotas are per subscription, region and VM family; request an increase in Usage + quotas.", D + "azure/quotas/per-vm-quota-requests"))
add(("AZ104-1.3.6", 2, "scenario", "You need an email when spending is forecast to exceed the monthly limit, before it actually does. What do you configure?",
     [("A budget with a Forecasted alert condition", "Correct."), ("An Azure Policy assignment", "Policy does not track cost."),
      ("A resource lock", "Unrelated."), ("An Actual 100% budget alert only", "That fires after the money is spent.")],
     "a", "Budgets support alerts on forecast cost as well as actual cost.", D + "azure/cost-management-billing/costs/tutorial-acm-create-budgets"))
add(("AZ104-1.3.6", 2, "single", "A budget reaches 100%. What happens to the resources in its scope?",
     [("They are stopped", "Budgets do not stop resources."), ("They are deleted", "No."), ("Nothing, unless an action group you configured takes action", "Correct."), ("New deployments are blocked", "No.")],
     "c", "Budgets only notify; you can link action groups to automate responses.", D + "azure/cost-management-billing/costs/cost-mgt-alerts-monitor-usage-spending"))
add(("AZ104-1.3.7", 2, "single", "What is the maximum depth of a management group hierarchy, not counting the root level or subscriptions?",
     [("Three levels", "No."), ("Six levels", "Correct."), ("Ten levels", "No."), ("Unlimited", "No.")],
     "b", "Management group trees support up to six levels below the root.", D + "azure/governance/management-groups/overview"))
add(("AZ104-1.3.7", 2, "scenario", "The security team needs Reader on all current and future subscriptions in the company. What is the simplest solution?",
     [("Assign Reader on each subscription", "Misses future subscriptions."), ("Assign Reader at the tenant root management group", "Correct."),
      ("Create a policy that grants Reader", "Policy cannot grant access."), ("Make them Global Readers in Entra ID", "That covers the directory, not Azure resources.")],
     "b", "Role assignments at the root management group inherit to every subscription, including new ones.", D + "azure/governance/management-groups/overview"))

# ---------------------------------------------------------------- 2.1 storage security
add(("AZ104-2.1.1", 2, "scenario", "VMs in subnet snet-app must reach a storage account, and nothing else may. You do not want to pay for private endpoints. What do you configure?",
     [("Enable a Microsoft.Storage service endpoint on snet-app and add a VNet rule on the storage firewall", "Correct."),
      ("Set Public network access to Disabled", "Blocks the VMs too without a private endpoint."), ("Add the VMs' private IPs as firewall IP rules", "IP rules accept public addresses only."),
      ("Create a NAT gateway", "Unrelated to the storage firewall.")],
     "a", "Service endpoints plus VNet rules restrict access to chosen subnets at no extra cost.", D + "azure/storage/common/storage-network-security"))
add(("AZ104-2.1.1", 2, "troubleshooting", "After you set a storage account to 'Enabled from selected virtual networks and IP addresses', you can no longer browse containers in the portal from your office. Fix?",
     [("Add your office public IP to the firewall", "Correct."), ("Give yourself Owner", "RBAC does not bypass the network firewall."),
      ("Rotate the access keys", "Unrelated."), ("Enable soft delete", "Unrelated.")],
     "a", "Portal data access comes from your client IP, so the firewall must allow it.", D + "azure/storage/common/storage-network-security"))
add(("AZ104-2.1.2", 2, "single", "Which SAS type is signed with Microsoft Entra credentials instead of an account key?",
     [("Account SAS", "Signed with a key."), ("Service SAS", "Signed with a key."), ("User delegation SAS", "Correct."), ("Stored access policy", "A policy, not a SAS type.")],
     "c", "A user delegation SAS uses a user delegation key obtained with Entra credentials; it applies to Blob Storage.", D + "azure/storage/common/storage-sas-overview"))
add(("AZ104-2.1.2", 3, "multiple", "A partner must upload files to one container for the next 8 hours, only from their office IP 203.0.113.50, only over HTTPS. Which TWO settings belong in the SAS?",
     [("Allowed IP 203.0.113.50 and HTTPS only", "Correct."), ("Permissions Write and Create, expiry in 8 hours", "Correct."),
      ("Permissions Delete and List", "Not needed for uploading."), ("Allowed services: Queue and Table", "The task is about blobs.")],
     "ab", "A SAS can restrict permissions, expiry, IP range and protocol.", D + "azure/storage/common/storage-sas-overview"))
add(("AZ104-2.1.3", 3, "scenario", "You issued 50 service SAS tokens for a container, and one leaks. You want to revoke them without changing account keys. What should you have done?",
     [("Used an account SAS", "Account SAS cannot be revoked without key rotation."), ("Linked the SAS tokens to a stored access policy", "Correct: delete or change the policy to revoke."),
      ("Set a long expiry", "Makes it worse."), ("Enabled versioning", "Unrelated.")],
     "b", "Service SAS tokens tied to a stored access policy can be revoked by editing or deleting the policy.", D + "azure/storage/common/storage-stored-access-policy-define-dotnet"))
add(("AZ104-2.1.3", 2, "single", "How many stored access policies can a single blob container have at one time?",
     [("1", "No."), ("5", "Correct."), ("10", "No."), ("Unlimited", "No.")],
     "b", "A container, file share, queue or table can have up to five stored access policies.", D + "azure/storage/common/storage-stored-access-policy-define-dotnet"))
add(("AZ104-2.1.4", 2, "ordering", "Put the steps in order to rotate storage keys without downtime for an app that uses key1.",
     [("Update the app to use key2", "First move the app off key1."), ("Regenerate key1", "Now safe to change."), ("Update the app to use the new key1", "Optional: switch back."), ("Regenerate key2", "Completes the rotation.")],
     "abcd", "Two keys exist so apps can switch to one while the other is regenerated.", D + "azure/storage/common/storage-account-keys-manage"))
add(("AZ104-2.1.4", 2, "scenario", "Security wants all access to a storage account to use Microsoft Entra ID; keys and SAS signed with keys must stop working. What setting do you change?",
     [("Set 'Allow storage account key access' to Disabled", "Correct."), ("Rotate both keys", "New keys still work."),
      ("Enable infrastructure encryption", "Unrelated."), ("Disable secure transfer", "Wrong direction and unrelated.")],
     "a", "Disabling shared key access rejects key-based and key-signed SAS requests.", D + "azure/storage/common/shared-key-authorization-prevent"))
add(("AZ104-2.1.5", 2, "single", "Which RBAC role lets users read, write and delete files in an Azure file share over SMB with their identity, without changing NTFS permissions?",
     [("Storage File Data SMB Share Reader", "Read only."), ("Storage File Data SMB Share Contributor", "Correct."),
      ("Storage File Data SMB Share Elevated Contributor", "Also allows changing NTFS permissions."), ("Storage Account Contributor", "A management-plane role.")],
     "b", "SMB Share Contributor grants read, write and delete; Elevated Contributor also allows modifying ACLs.", D + "azure/storage/files/storage-files-identity-assign-share-level-permissions"))
add(("AZ104-2.1.5", 3, "troubleshooting", "Users mapped a file share with the storage account key. You removed their share-level role, but they can still access everything. Why?",
     [("Role changes take 24 hours", "No."), ("Key-based access bypasses identity-based share-level permissions", "Correct."),
      ("NTFS ACLs override RBAC", "With the key there is no identity check at all."), ("The share is Premium", "Unrelated.")],
     "b", "Mounting with the account key gives full access regardless of RBAC; use identity-based mounts instead.", D + "azure/storage/files/storage-files-active-directory-overview"))

# ---------------------------------------------------------------- 2.2 accounts, redundancy, replication, encryption, tools
add(("AZ104-2.2.1", 2, "scenario", "You need very low latency for millions of small block blob transactions. Which account type?",
     [("Standard general-purpose v2", "Good default, but HDD-backed."), ("Premium block blobs", "Correct."), ("Premium file shares", "For Azure Files."), ("Premium page blobs", "For VHD-style page blobs.")],
     "b", "Premium block blob accounts use SSDs for high transaction rates and low latency.", D + "azure/storage/common/storage-account-overview"))
add(("AZ104-2.2.1", 2, "single", "Which storage account setting can only be chosen when the account is created?",
     [("Minimum TLS version", "Can be changed later."), ("Default access tier", "Can be changed later."), ("Performance tier (Standard or Premium)", "Correct."), ("Secure transfer required", "Can be changed later.")],
     "c", "Performance cannot be changed after creation (infrastructure encryption is also creation-only).", D + "azure/storage/common/storage-account-create"))
add(("AZ104-2.2.2", 2, "scenario", "Data must survive the loss of a whole datacenter, must stay within one region, and the app must keep working without failover. Which redundancy?",
     [("LRS", "One datacenter only."), ("ZRS", "Correct."), ("GRS", "Copies to another region."), ("RA-GRS", "Copies to another region.")],
     "b", "ZRS replicates synchronously across three availability zones in one region.", D + "azure/storage/common/storage-redundancy"))
add(("AZ104-2.2.2", 2, "single", "With RA-GZRS, how do you read data from the secondary region while the primary is healthy?",
     [("You cannot until a failover", "That is GRS/GZRS without RA."), ("Use the account's -secondary endpoint", "Correct."),
      ("Create a private endpoint in the secondary", "Not needed."), ("Change the account to LRS", "No.")],
     "b", "Read-access options expose accountname-secondary endpoints.", D + "azure/storage/common/storage-redundancy"))
add(("AZ104-2.2.3", 2, "single", "Which features must be enabled for object replication?",
     [("Versioning on the source only", "Both need versioning."), ("Blob versioning on both accounts and change feed on the source", "Correct."),
      ("Soft delete on both accounts", "Not required."), ("Hierarchical namespace on both", "Not supported for object replication.")],
     "b", "Object replication requires versioning on source and destination and change feed on the source.", D + "azure/storage/blobs/object-replication-overview"))
add(("AZ104-2.2.3", 2, "troubleshooting", "After configuring object replication, an app fails to write to the destination container. Why?",
     [("The destination container is read-only while it is a replication destination", "Correct."), ("Object replication deletes the destination", "No."),
      ("Versioning blocks writes", "No."), ("The account keys changed", "No.")],
     "a", "Destination containers do not accept writes while the replication policy exists.", D + "azure/storage/blobs/object-replication-overview"))
add(("AZ104-2.2.4", 2, "scenario", "Compliance requires that your company controls and can revoke the keys that encrypt a storage account. What do you configure?",
     [("Microsoft-managed keys", "Microsoft controls them."), ("Customer-managed keys in Azure Key Vault", "Correct."),
      ("Secure transfer required", "Encrypts in transit only."), ("A SAS with HTTPS only", "Unrelated to encryption at rest.")],
     "b", "Customer-managed keys in Key Vault (or Managed HSM) give you control, rotation and revocation.", D + "azure/storage/common/customer-managed-keys-overview"))
add(("AZ104-2.2.4", 3, "multiple", "Which TWO Key Vault settings are required to use it for storage customer-managed keys?",
     [("Soft delete", "Correct."), ("Purge protection", "Correct."), ("Public network access disabled", "Optional."), ("RBAC permission model", "Either permission model can work.")],
     "ab", "Storage requires the key vault to have soft delete and purge protection enabled.", D + "azure/storage/common/customer-managed-keys-configure-existing-account"))
add(("AZ104-2.2.5", 2, "scenario", "Every night a server must copy only new and changed files from a local folder to a blob container. Which command?",
     [("azcopy sync", "Correct."), ("azcopy copy with no options", "Copies everything every time."), ("az storage account create", "Creates an account."), ("azcopy make", "Creates a container.")],
     "a", "azcopy sync compares source and destination and copies only differences.", D + "azure/storage/common/storage-use-azcopy-blobs-synchronize"))
add(("AZ104-2.2.5", 3, "troubleshooting", "You ran azcopy login and are Owner of the storage account, but azcopy copy to a container fails with an authorization error. Fix?",
     [("Assign yourself Storage Blob Data Contributor", "Correct: data access needs a data-plane role."), ("Use azcopy sync instead", "Same authorization."),
      ("Enable anonymous access", "Never needed for uploads."), ("Reinstall AzCopy", "Not the problem.")],
     "a", "Owner is a management role; Entra-authenticated data operations need a Storage Blob Data role.", D + "azure/storage/common/storage-use-azcopy-authorize-azure-active-directory"))

# ---------------------------------------------------------------- 2.3 files, containers, tiers, protection
add(("AZ104-2.3.1", 2, "single", "Linux servers need an NFS share in Azure Files. What do you need?",
     [("A Standard general-purpose v2 account", "NFS shares need Premium."), ("A Premium file shares (FileStorage) account", "Correct."), ("A Premium block blob account", "Wrong service."), ("Any account with SMB 3.1", "That is SMB, not NFS.")],
     "b", "NFS Azure file shares are supported only on Premium (FileStorage) accounts.", D + "azure/storage/files/files-nfs-protocol"))
add(("AZ104-2.3.1", 2, "troubleshooting", "A home user cannot mount an Azure file share over SMB; the connection times out. Most likely cause?",
     [("Their ISP blocks TCP port 445", "Correct."), ("The share is too large", "No."), ("Soft delete is on", "No."), ("The share has a quota", "No.")],
     "a", "SMB uses port 445 which many ISPs block; use a VPN, ExpressRoute or Azure File Sync.", D + "azure/storage/files/storage-troubleshoot-windows-file-connection-problems"))
add(("AZ104-2.3.2", 2, "scenario", "A container must let anyone read blobs by URL but not list the container's contents. Which access level (with anonymous access allowed on the account)?",
     [("Private", "No anonymous access."), ("Blob", "Correct."), ("Container", "Also allows listing."), ("Hot", "That is a tier.")],
     "b", "Blob level allows anonymous read of blobs only.", D + "azure/storage/blobs/anonymous-read-access-configure"))
add(("AZ104-2.3.2", 2, "troubleshooting", "You cannot set a container's access level to Blob; the option is greyed out. Why?",
     [("The account does not allow anonymous blob access", "Correct."), ("The container is empty", "No."), ("Versioning is on", "No."), ("You need a SAS", "No.")],
     "a", "Anonymous access must be allowed at the account level before containers can be public.", D + "azure/storage/blobs/anonymous-read-access-configure"))
add(("AZ104-2.3.3", 2, "scenario", "Logs must be kept for 7 years and are read at most once a year with several hours' notice. Cheapest tier?",
     [("Hot", "Most expensive storage."), ("Cool", "Not the cheapest."), ("Cold", "Cheaper, but still online."), ("Archive", "Correct.")],
     "d", "Archive has the lowest storage cost; reads need rehydration, which fits several hours' notice.", D + "azure/storage/blobs/access-tiers-overview"))
add(("AZ104-2.3.3", 3, "single", "You move a blob to Cool and delete it 10 days later. What happens to cost?",
     [("Nothing extra", "Cool has a 30-day minimum."), ("An early deletion charge for the remaining 20 days", "Correct."),
      ("It is billed as Archive", "No."), ("The deletion is refused", "No.")],
     "b", "Cool has a 30-day minimum, Cold 90, Archive 180; earlier removal is charged prorated.", D + "azure/storage/blobs/access-tiers-overview"))
add(("AZ104-2.3.4", 2, "scenario", "Users accidentally delete an entire Azure file share. You want to be able to recover it within 14 days. What do you enable?",
     [("Blob soft delete", "For blobs, not shares."), ("Share snapshots only", "Snapshots are deleted with the share."), ("Soft delete for file shares with 14-day retention", "Correct."), ("Versioning", "For blobs.")],
     "c", "File share soft delete keeps deleted shares for the retention period.", D + "azure/storage/files/storage-files-prevent-file-share-deletion"))
add(("AZ104-2.3.4", 2, "single", "What does an Azure Files share snapshot contain?",
     [("A writable copy of one file", "No."), ("A read-only point-in-time copy of the whole share", "Correct."), ("Only changed blocks in another region", "No."), ("The share's NTFS permissions only", "No.")],
     "b", "Share snapshots are read-only, incremental, point-in-time copies of the entire share.", D + "azure/storage/files/storage-snapshots-files"))
add(("AZ104-2.3.5", 2, "scenario", "Blobs in container 'logs' should move to Cool 30 days after last modification and be deleted after 365 days. What do you create?",
     [("A lifecycle management rule with a logs/ prefix filter", "Correct."), ("An Azure Policy assignment", "Policy does not move blobs."),
      ("An AzCopy job", "Manual and not automatic."), ("Object replication", "Copies, not tiering.")],
     "a", "Lifecycle management rules move and delete blobs on age conditions, filtered by prefix.", D + "azure/storage/blobs/lifecycle-management-policy-configure"))
add(("AZ104-2.3.5", 2, "troubleshooting", "You created a lifecycle rule an hour ago but no blobs have moved yet. What is the most likely explanation?",
     [("The rule is broken", "Not necessarily."), ("Rules run about once a day and a new policy can take up to 24 hours to take effect", "Correct."),
      ("Lifecycle needs Premium storage", "No."), ("Versioning must be off", "No.")],
     "b", "Lifecycle management runs periodically; new or changed policies can take up to 24 hours.", D + "azure/storage/blobs/lifecycle-management-overview"))
add(("AZ104-2.3.6", 2, "scenario", "Users overwrite important blobs by mistake and need to get the previous content back. What should you enable?",
     [("Blob versioning", "Correct."), ("Container soft delete", "Protects against container deletion."), ("Change feed alone", "Logs changes; does not keep content."), ("LRS", "Redundancy, not history.")],
     "a", "Versioning keeps previous versions on every write.", D + "azure/storage/blobs/versioning-overview"))
add(("AZ104-2.3.6", 2, "single", "Versioning is on and storage costs keep growing. What is the recommended fix?",
     [("Disable soft delete", "Not the cause."), ("Add a lifecycle rule that deletes previous versions after N days", "Correct."), ("Switch to LRS", "Small effect."), ("Delete the container", "Loses data.")],
     "b", "Lifecycle management can delete or tier previous versions automatically.", D + "azure/storage/blobs/versioning-overview"))
