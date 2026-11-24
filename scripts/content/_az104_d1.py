"""AZ-104 domain 1 (identities and governance): easy walkthroughs and hands-on labs."""
from _az104kit import BASE, DELETE_RG, ML, NEW_RG, REGION, RG, H
from _walkkit import N, S, walk

WALK: dict[str, dict] = {}
LAB: dict[str, dict] = {}
PATCH: dict[str, list[str]] = {}

ENTRA = "Signed in at portal.azure.com with the account that created your Azure subscription. That account is a Global Administrator of its own Microsoft Entra tenant."

# ---------------------------------------------------------------- 1.1 users and groups
WALK["az104-entra-users-groups"] = walk(
    "Give a new team accounts, then let groups do the work of keeping access up to date.",
    ["Users: members and guests", "Important user properties", "Security vs Microsoft 365 groups", "Assigned vs dynamic membership", "Bulk changes"],
    [N("admin", "You (admin)", 110, 220, "user"), N("entra", "Microsoft Entra ID", 330, 220, "identity", "your directory"),
     N("ana", "User: Ana", 560, 80, "user", "member"), N("guest", "Guest: Raj", 560, 170, "user", "partner company"),
     N("sec", "Security group", 560, 280, "security", "access to Azure"), N("m365", "Microsoft 365 group", 560, 380, "service", "mail + Teams"),
     N("rule", "Dynamic rule", 330, 380, "service", "department = IT")],
    [S("problem", "New team", "Five people join the IT team on Monday",
       "Each one needs an account. Each one needs access to the right Azure resources.\n\nGiving access person by person is slow, and it is easy to forget to remove it when someone leaves.",
       add=["admin", "entra"], edges=[("admin", "entra", "manage")]),
     S("concept", "Users", "A user is an identity in Microsoft Entra ID",
       "Microsoft Entra ID (the new name for Azure AD) is the directory that holds your users. A member user belongs to your organisation. A guest user is someone from outside, such as a partner, invited by email.\n\nUseful properties: name, job title, department and usage location. Usage location is needed before you can give someone a licence directly.",
       add=["ana", "guest"], edges=[("entra", "ana"), ("entra", "guest", "invited")], learn=[0, 1],
       tip="Fill in department and job title. Dynamic groups use these properties to decide who is in the group."),
     S("concept", "Groups", "Two kinds of group",
       "A security group is used to give access: assign an Azure role or an app to the group, not to each person.\n\nA Microsoft 365 group adds a shared mailbox, calendar and Teams space. It can also be used for access, but its main job is collaboration.",
       add=["sec", "m365"], edges=[("ana", "sec", "member"), ("ana", "m365")], learn=[2]),
     S("technique", "Dynamic", "Let a rule fill the group for you",
       "With assigned membership, you add and remove people by hand. With dynamic membership, Entra adds everyone whose properties match a rule, for example department equals IT, and removes them when the property changes.\n\nDynamic groups need a Microsoft Entra ID P1 licence.",
       add=["rule"], edges=[("rule", "sec", "adds matches")], focus=["rule"], learn=[3],
       warn="You cannot add members by hand to a dynamic group. Change the user's properties or the rule instead."),
     S("case", "Bulk", "Case: the whole team on Monday",
       "Upload a CSV file (Users > Bulk operations > Bulk create) to create all five accounts at once with department = IT.\n\nThe dynamic rule puts them in the IT security group within minutes, and that group already has the right Azure role.",
       focus=["entra", "sec"], learn=[4]),
     S("recap", "Recap", "Users and groups in one minute", "Give access to groups, and let rules keep the groups correct.",
       recap=["Member = your organisation; guest = invited outsider", "Usage location is needed for direct licence assignment", "Security groups for access; Microsoft 365 groups for collaboration",
              "Dynamic membership uses a rule on user properties (needs P1)", "Bulk create, invite and delete with a CSV file"])])

LAB["az104-entra-users-groups"] = H(
    "Create a user and a group, then add the user", 20, "free", "Free. Users and groups cost nothing.",
    [ENTRA],
    [("In the portal search bar type 'Microsoft Entra ID' and open it. Note the 'Primary domain' on the Overview page (it ends in onmicrosoft.com).", "The Overview page with your tenant name, tenant ID and primary domain."),
     ("Go to Users > New user > Create new user. User principal name: ana.lab, display name: Ana Lab. Tick 'Auto-generate password' and copy it somewhere safe.", "The Properties tab, where you can fill in job details."),
     ("On the Properties tab set Job title: Cloud Engineer, Department: IT, Usage location: United Arab Emirates (or your country). Select Review + create > Create.", "Ana Lab in the users list after a refresh."),
     ("Go to Groups > New group. Group type: Security, name: grp-it-lab, membership type: Assigned. Under Members, add Ana Lab. Select Create.", "grp-it-lab in the groups list.", "Dynamic membership needs a Microsoft Entra ID P1 licence or trial. If Dynamic User is not offered, or the group cannot be saved, start the free trial in the licences lab first."),
     ("Open grp-it-lab > Members.", "Ana Lab listed as a direct member."),
     ("Open Ana Lab > Groups.", "grp-it-lab listed. Membership works in both directions."),
     ("Optional, needs a P1 trial (see the licences lab): create a second group, membership type Dynamic User, and add the rule user.department -eq \"IT\".", "Ana appears in the dynamic group after a few minutes, without being added by hand.")],
    ["Ana Lab exists with department IT and a usage location.", "grp-it-lab contains Ana Lab."],
    ["Keep Ana and the group for the next labs (licences, SSPR, RBAC). Delete them when you finish the identity labs: Users > select > Delete; Groups > select > Delete."],
    [("Quickstart: create and assign a user", ML + "entra/fundamentals/how-to-create-delete-users"),
     ("Create a basic group and add members", ML + "entra/fundamentals/how-to-manage-groups"),
     ("Create or update a dynamic membership group", ML + "entra/identity/users/groups-create-rule")])

# ---------------------------------------------------------------- 1.1 licences and guests
WALK["az104-entra-licensing-guests"] = walk(
    "Give people the paid features they need, and let a partner in without creating a full account.",
    ["What a licence unlocks", "Assigning licences to users or groups", "Why usage location matters", "Inviting guests (B2B)", "Controlling who can invite"],
    [N("lic", "Entra ID P1 / P2", 120, 90, "cost", "licences"), N("grp", "Group: IT", 380, 90, "security"), N("ana", "Ana", 640, 90, "user", "usage location set"),
     N("tenant", "Your tenant", 380, 260, "identity"), N("raj", "Raj (guest)", 640, 260, "user", "partner email"), N("set", "External settings", 120, 260, "security", "who can invite"),
     N("app", "Shared app / site", 380, 390, "service")],
    [S("problem", "Paid features", "Some features need a licence",
       "Dynamic groups, Conditional Access and self-service password reset for users all need Microsoft Entra ID P1 (P2 adds features such as Identity Protection and Privileged Identity Management).\n\nYou also need to let a partner company see one project, without giving them a full account.",
       add=["tenant"], focus=["tenant"]),
     S("concept", "Licences", "A licence turns features on for one person",
       "You buy licences (or start a free trial) for the tenant, then assign them. Assign to users one by one, or to a group so everyone in the group gets it automatically (group-based licensing).\n\nGroup-based licensing is the easy way: join the group, get the licence; leave the group, lose it.",
       add=["lic", "grp", "ana"], edges=[("lic", "grp", "assign"), ("grp", "ana", "inherits")], learn=[0, 1]),
     S("concept", "Usage location", "Usage location: where the user works",
       "Microsoft services are not offered in every country, so licensing checks the user's usage location. A licence assigned directly to a user fails if the user has no usage location.\n\nWith group-based licensing, a user without one inherits the tenant's country. Set it anyway, because the tenant's country may be wrong for that person. Other common group licence errors: not enough licences left, and conflicting service plans.",
       focus=["ana"], learn=[2], warn="Exam favourite: a direct licence assignment fails, and the fix is to set the user's usage location. For group licence errors, check licence counts first."),
     S("technique", "Guests", "Invite a guest with Microsoft Entra B2B",
       "Invite an external user by email. They sign in with their own work or personal account, and appear in your directory as a guest. You can add guests to groups and give them access like anyone else.\n\nNo password to manage for them, and you can remove them at any time.",
       add=["raj", "app"], edges=[("tenant", "raj", "invite"), ("raj", "app", "access")], learn=[3]),
     S("technique", "Control", "Decide who may invite guests",
       "External collaboration settings control who can invite (everyone, members only, admins and Guest Inviters only, or nobody), what guests can see in the directory, and which domains are allowed or blocked.",
       add=["set"], edges=[("set", "tenant", "rules")], learn=[4]),
     S("recap", "Recap", "Licences and guests", "Licence groups, not people, and invite partners as guests.",
       recap=["P1 unlocks dynamic groups, Conditional Access and SSPR for users", "Group-based licensing is easiest", "Direct assignment needs a usage location; groups fall back to the tenant\'s",
              "B2B guests use their own accounts", "External collaboration settings control invitations"])])

LAB["az104-entra-licensing-guests"] = H(
    "Start a free P2 trial, licence a group and invite a guest", 20, "free", "Free. The Entra ID P2 trial lasts 30 days and does not charge you; it simply ends.",
    [ENTRA, "Ana Lab and grp-it-lab from the previous lab."],
    [("Open Microsoft Entra ID > Licenses > All products > + Try / Buy. Under Microsoft Entra ID P2, select Free trial > Activate.", "A message that the trial is activated. It can take a few minutes to appear under All products.", "If the trial option is missing (some account types), skip to step 5. You can still learn the steps from the 'See the real portal screens' links."),
     ("Select Licenses > All products > Microsoft Entra ID P2 > + Assign. Choose grp-it-lab as the assignee and select Assign.", "A notification that the assignment started."),
     ("Open grp-it-lab > Licenses.", "Microsoft Entra ID P2 listed with status Active."),
     ("Open Ana Lab > Licenses.", "P2 shown as 'Inherited' from grp-it-lab."),
     ("Go to Users > New user > Invite external user. Enter a second email address you own (for example a personal Outlook or Gmail address). Select Review + invite > Invite.", "The guest in the users list with User type: Guest."),
     ("Open that mailbox and accept the invitation.", "A consent screen, then the 'My Apps' page signed in as a guest of your tenant."),
     ("Back in the portal: Microsoft Entra ID > External Identities > External collaboration settings. Read the 'Guest invite settings' options. Do not change them.", "The four invite options, from 'Anyone in the organization can invite' to 'No one'.")],
    ["Ana shows an inherited P2 licence.", "The guest shows 'Accepted' under Invitation state on their profile."],
    ["Delete the guest user when you finish the identity labs. The trial ends by itself after 30 days."],
    [("Assign licences to a group", ML + "entra/identity/users/licensing-groups-assign"),
     ("Add B2B collaboration users in the portal", ML + "entra/external-id/add-users-administrator"),
     ("Configure external collaboration settings", ML + "entra/external-id/external-collaboration-settings-configure")])

# ---------------------------------------------------------------- 1.1 SSPR
WALK["az104-sspr"] = walk(
    "Let people reset their own forgotten password, safely, without calling the help desk.",
    ["What SSPR does", "Scope: none, selected or all", "Authentication methods and how many", "Registration and notifications", "Testing it as a user"],
    [N("user", "Ana forgot password", 120, 220, "user"), N("desk", "Help desk", 120, 380, "service", "slow, costly"),
     N("sspr", "SSPR", 380, 220, "security", "aka.ms/sspr"), N("scope", "Scope: group", 380, 80, "identity", "who can use it"),
     N("meth", "Methods", 640, 140, "security", "app, email, phone"), N("reg", "Registration", 640, 300, "identity", "at next sign-in"),
     N("ok", "New password", 380, 380, "user")],
    [S("problem", "Locked out", "Monday 8 a.m.: Ana forgot her password",
       "She calls the help desk, waits 20 minutes, and someone resets it by hand. Multiply that by a large company and it costs real money.",
       add=["user", "desk"], edges=[("user", "desk", "call")]),
     S("concept", "SSPR", "Self-service password reset",
       "With SSPR, Ana goes to aka.ms/sspr, proves who she is with a second method, and chooses a new password herself.\n\nResetting a forgotten password needs Microsoft Entra ID P1 (or a Microsoft 365 business licence). Changing a password you still know is free.",
       add=["sspr"], hide=["desk"], edges=[("user", "sspr", "reset")], learn=[0]),
     S("technique", "Scope", "Turn it on for nobody, some, or everyone",
       "Password reset > Properties: None, Selected (one security group) or All. Start with a pilot group, then move to All.\n\nAdministrators are always enabled with a stronger two-method policy, whatever you choose here.",
       add=["scope"], edges=[("scope", "sspr")], learn=[1]),
     S("technique", "Methods", "How users prove who they are",
       "Choose 1 or 2 methods required to reset. Methods include the Microsoft Authenticator app, email, mobile phone and security questions. Microsoft now manages which methods are allowed in the Authentication methods policy.\n\nRegistration: require users to register their methods at sign-in, and re-confirm them every N days. Notifications tell users and admins when a password is reset.",
       add=["meth", "reg"], edges=[("sspr", "meth"), ("sspr", "reg")], learn=[2, 3],
       tip="Two methods required is more secure than one. Security questions are the weakest method."),
     S("case", "Test", "Case: Ana resets her own password",
       "Ana signs in once, registers the Authenticator app and her phone. A week later she forgets her password, opens aka.ms/sspr, confirms both methods and sets a new one in two minutes.",
       add=["ok"], edges=[("sspr", "ok")], focus=["ok"], learn=[4]),
     S("recap", "Recap", "SSPR in one minute", "Users fix their own passwords; you choose who and how.",
       recap=["Reset of forgotten passwords needs Entra ID P1", "Scope: None, Selected (one group) or All", "1 or 2 methods required",
              "Users register methods, then reset at aka.ms/sspr", "Admins always have SSPR with two methods"])])

PATCH["az104-sspr"] = [
    "Since 30 September 2025 the authentication methods available for MFA and SSPR are managed in one place: the Authentication methods policy (Protection > Authentication methods > Policies). The legacy MFA and SSPR method settings no longer control which methods users can use."]

LAB["az104-sspr"] = H(
    "Turn on SSPR for a group and reset a password as Ana", 25, "free", "Free with the Entra ID P2 trial from the licences lab.",
    [ENTRA, "The P2 trial is active and grp-it-lab (with Ana Lab) has the licence.", "Ana's sign-in name and the temporary password you copied."],
    [("Open Microsoft Entra ID > Password reset > Properties. Set 'Self service password reset enabled' to Selected, choose grp-it-lab, and select Save.", "A success notification."),
     ("Select Authentication methods. Set 'Number of methods required to reset' to 1 and tick Email and Mobile phone. Save.", "Your choices saved.", "In some tenants the methods list is managed in Protection > Authentication methods > Policies. If the page sends you there, enable Email OTP there."),
     ("Select Registration. Set 'Require users to register when signing in' to Yes. Save.", None),
     ("Open a private (InPrivate/Incognito) browser window and sign in at myapps.microsoft.com as Ana with the temporary password. Set a new password when asked.", "A prompt asking Ana to register security information.", "Use My Apps rather than the Azure portal: Azure now requires multifactor authentication for portal sign-in, which adds extra set-up steps."),
     ("Register an email address you can read (or a phone number). Finish and close the browser.", "A confirmation that the method is registered."),
     ("Open another private window, go to aka.ms/sspr and enter Ana's sign-in name. Complete the check with the code sent to the email or phone.", "A page to choose a new password."),
     ("Set a new password and sign in with it.", "Ana signs in successfully. Admins can see the event in Password reset > Audit logs.")],
    ["Ana reset her own password without an admin.", "Password reset > Audit logs shows the reset."],
    ["Set Password reset > Properties back to None when you finish if you like. Nothing here costs money."],
    [("Tutorial: enable self-service password reset", ML + "entra/identity/authentication/tutorial-enable-sspr"),
     ("How SSPR works", ML + "entra/identity/authentication/concept-sspr-howitworks"),
     ("Manage authentication methods", ML + "entra/identity/authentication/concept-authentication-methods-manage")])

# ---------------------------------------------------------------- 1.2 RBAC
WALK["az104-rbac"] = walk(
    "Answer three questions for every permission: who, what, and where.",
    ["Who: security principals", "What: role definitions", "Where: scopes and inheritance", "The four key built-in roles", "Reading effective access"],
    [N("ana", "Ana", 110, 90, "user", "security principal"), N("role", "Role: Reader", 400, 90, "security", "what she can do"),
     N("mg", "Management group", 110, 250, "identity"), N("sub", "Subscription", 300, 250, "identity"), N("rg", "Resource group", 490, 250, "identity"),
     N("vm", "VM", 680, 250, "compute"), N("assign", "Role assignment", 400, 390, "security", "who + what + where")],
    [S("problem", "Too much access", "Everyone is Owner",
       "In a small team, it is tempting to make everyone Owner of the subscription. Then an intern deletes the production database.\n\nYou need to give each person only what they need, only where they need it.",
       add=["ana"], focus=["ana"]),
     S("concept", "Who + what", "Who and what",
       "Who is a security principal: a user, a group, a service principal (an app) or a managed identity.\n\nWhat is a role definition: a list of allowed actions, such as read anything, or restart VMs.",
       add=["role"], edges=[("ana", "role")], learn=[0, 1]),
     S("concept", "Where", "Where: the scope",
       "A scope is a management group, a subscription, a resource group or one resource. Access given at a scope flows down to everything below it, never up.",
       add=["mg", "sub", "rg", "vm"], edges=[("mg", "sub", "inherits"), ("sub", "rg", "inherits"), ("rg", "vm", "inherits")], learn=[2],
       tip="Assign at the smallest scope that does the job, usually a resource group."),
     S("concept", "Key roles", "Four roles you must know",
       "Owner: full access, including giving access to others. Contributor: create and manage everything, but cannot give access. Reader: view only. User Access Administrator: manage access only.\n\nMany specific roles exist too, such as Virtual Machine Contributor.",
       focus=["role"], learn=[3], warn="Contributor cannot assign roles. That needs Owner, User Access Administrator or Role Based Access Control Administrator."),
     S("technique", "Assignment", "A role assignment ties it together",
       "A role assignment = principal + role + scope. Access adds up: Ana's effective access is all her assignments plus those of every group she is in, at this scope and above.\n\nUse Access control (IAM) > Check access to see exactly what someone has, and why.",
       add=["assign"], edges=[("assign", "rg", "at scope")], learn=[4]),
     S("recap", "Recap", "RBAC in one minute", "Who + what + where, with the smallest scope.",
       recap=["Principal: user, group, service principal, managed identity", "Role definition: list of allowed actions", "Scope inherits downward: MG > subscription > RG > resource",
              "Owner / Contributor / Reader / User Access Administrator", "Access is additive; use Check access"])])

LAB["az104-rbac"] = H(
    "Give Ana Reader on one resource group and prove it", 20, "free", "Free. Role assignments and empty resource groups cost nothing.",
    [BASE, NEW_RG, "Ana Lab from the users lab, and her password."],
    [(f"Open Resource groups > {RG} > Access control (IAM) > + Add > Add role assignment.", "A list of roles with a search box."),
     ("Search for Reader, select it, then Next. Select + Select members, choose Ana Lab, then Review + assign twice.", "A notification 'Added role assignment'."),
     ("Select the Role assignments tab.", "Ana Lab listed with role Reader and scope 'This resource'."),
     ("Select Check access, search for Ana Lab and open her.", "Her Reader assignment on this resource group, and any inherited from above (none yet)."),
     ("In a private browser window sign in to portal.azure.com as Ana. Open Resource groups.", f"Only {RG} is visible.", "Azure requires multifactor authentication for portal sign-in, so the first time Ana is asked to set up the Microsoft Authenticator app (or another method). New role assignments can take a few minutes; if nothing shows, sign out and in again."),
     (f"As Ana, open {RG} and try + Create > Storage account, and try to create it.", "The deployment fails with an authorization error: Reader cannot create resources."),
     ("As yourself, change Ana's role to Contributor (remove Reader, add Contributor) and repeat step 6 with a storage account name, then cancel before creating.", "Ana can now reach the Review page. Contributor can create, Reader cannot.")],
    [f"Check access shows Ana's role on {RG}.", "You saw a Reader blocked from creating a resource."],
    [f"Remove Ana's role assignment: {RG} > Access control (IAM) > Role assignments > select > Delete."],
    [("Assign Azure roles using the portal", ML + "azure/role-based-access-control/role-assignments-portal"),
     ("Check access for a user to Azure resources", ML + "azure/role-based-access-control/check-access"),
     ("Azure built-in roles", ML + "azure/role-based-access-control/built-in-roles")])

# ---------------------------------------------------------------- 1.3 policy and tags
WALK["az104-policy-tags"] = walk(
    "Make rules that Azure enforces for you, and label resources so you can find and charge them.",
    ["Policy vs RBAC", "Definitions, initiatives and assignments", "Effects: deny, audit, modify", "Tags and their limits", "Inheriting tags with policy"],
    [N("dev", "Developer", 110, 220, "user"), N("arm", "Azure Resource Manager", 370, 220, "service"), N("rbac", "RBAC", 370, 80, "security", "may you?"),
     N("pol", "Azure Policy", 370, 370, "security", "is it allowed?"), N("res", "New resource", 640, 220, "compute"), N("tag", "Tags", 640, 370, "cost", "env=prod, cost=IT"),
     N("comp", "Compliance view", 640, 80, "service")],
    [S("problem", "Wild west", "Resources appear everywhere, unlabelled",
       "People create VMs in random regions, with no labels. Nobody knows who owns what, and the bill is a mystery.",
       add=["dev", "arm", "res"], edges=[("dev", "arm", "create"), ("arm", "res")]),
     S("concept", "Policy vs RBAC", "Two different questions",
       "RBAC asks: is this person allowed to act? Azure Policy asks: is this resource, as configured, allowed to exist?\n\nA Contributor may create a VM (RBAC), but policy can still block it because it is in the wrong region.",
       add=["rbac", "pol"], edges=[("arm", "rbac"), ("arm", "pol")], learn=[0]),
     S("concept", "Building blocks", "Definition, initiative, assignment",
       "A policy definition is one rule, such as 'Allowed locations'. An initiative groups several definitions. An assignment applies a definition or initiative at a scope (management group, subscription or resource group), with parameters such as the list of regions.\n\nYou can exclude child scopes from an assignment.",
       focus=["pol"], learn=[1]),
     S("technique", "Effects", "What happens when a rule is broken",
       "Deny blocks the request. Audit allows it but marks it non-compliant. Modify and Append change the request, for example adding a tag. DeployIfNotExists deploys something missing, such as a diagnostic setting.\n\nExisting resources are evaluated too and shown in the compliance view; fixing them needs a remediation task.",
       add=["comp"], edges=[("pol", "comp", "results")], learn=[2], warn="Deny stops new requests; it does not delete resources that already exist."),
     S("technique", "Tags", "Tags: labels for finding and charging",
       "A tag is a name-value pair such as env = prod. Use tags to filter cost reports and find owners. Resources do not inherit tags from their resource group automatically.\n\nUse the built-in policy 'Inherit a tag from the resource group if missing' (Modify effect) to copy them down.",
       add=["tag"], edges=[("res", "tag")], learn=[3, 4], tip="Up to 50 tags per resource. Not every resource type supports tags."),
     S("recap", "Recap", "Policy and tags", "RBAC controls people; policy controls resources; tags label them.",
       recap=["RBAC = may you act? Policy = is the resource allowed?", "Definition > initiative > assignment at a scope", "Deny, Audit, Modify/Append, DeployIfNotExists",
              "Tags are not inherited by default", "Use a Modify policy to inherit tags"])])

LAB["az104-policy-tags"] = H(
    "Block a region with policy and copy tags from the resource group", 30, "free", "Free. Azure Policy and tags cost nothing; the storage account you try to create is blocked.",
    [BASE, NEW_RG],
    [(f"Open {RG} > Tags. Add env = lab and owner = your name. Apply.", "The two tags on the resource group's Overview."),
     ("Search 'Policy' > Assignments > Assign policy. Scope: your subscription and resource group " + RG + ". Policy definition: search 'Allowed locations' and select it.", "The Basics tab with your scope and the policy name."),
     (f"Parameters tab: Allowed locations = {REGION.split(' (')[0]} only. Review + create > Create.", "A new assignment listed. Wait about 5–10 minutes for it to take effect."),
     (f"Try to create a storage account in {RG} with region East US.", "Validation fails: 'Resource was disallowed by policy', naming the Allowed locations assignment."),
     ("Policy > Assignments > Assign policy again, same scope. Definition: 'Inherit a tag from the resource group if missing'. Parameter tag name: env. On the Remediation tab tick 'Create a remediation task'. Create.", "A second assignment. Policies that change resources need a managed identity, which the wizard creates."),
     (f"Create a small storage account in {RG} in your allowed region (Standard, LRS). Do not add tags yourself.", "Once deployed, its Tags page shows env = lab, copied from the resource group."),
     ("Open Policy > Compliance.", "Your assignments with a compliance state. New results can take up to 30 minutes.")],
    ["Creating in East US was denied.", "The new storage account has the env tag without you adding it."],
    ["Policy > Assignments: delete both lab assignments.", DELETE_RG],
    [("Quickstart: create a policy assignment in the portal", ML + "azure/governance/policy/assign-policy-portal"),
     ("Tutorial: manage tag governance with Azure Policy", ML + "azure/governance/policy/tutorials/govern-tags"),
     ("Use tags to organise your Azure resources", ML + "azure/azure-resource-manager/management/tag-resources")])

# ---------------------------------------------------------------- 1.3 locks
WALK["az104-resource-locks"] = walk(
    "Stop important resources being deleted or changed by accident, even by Owners.",
    ["CanNotDelete vs ReadOnly", "Locks override permissions", "Inheritance of locks", "ReadOnly side effects"],
    [N("own", "Owner", 110, 220, "user", "full access"), N("lock", "Lock", 360, 220, "security", "on resource group"), N("db", "Production DB", 620, 120, "database"),
     N("st", "Storage account", 620, 320, "storage"), N("keys", "List keys", 360, 380, "security", "POST action")],
    [S("problem", "Oops", "An Owner deletes production by mistake",
       "Owners can do anything, including deleting the wrong resource group. RBAC alone cannot stop someone who has the rights.",
       add=["own", "db"], edges=[("own", "db", "delete?")]),
     S("concept", "Two locks", "Two kinds of lock",
       "CanNotDelete (shown as Delete in the portal): people can read and change the resource, but not delete it. ReadOnly: people can read it but not change or delete it.\n\nLocks apply to everyone, including Owners. To delete, someone must first remove the lock, which needs Owner or User Access Administrator.",
       add=["lock"], edges=[("own", "lock", "blocked"), ("lock", "db")], learn=[0, 1]),
     S("technique", "Inheritance", "Lock a resource group, protect everything in it",
       "A lock on a subscription or resource group applies to every resource inside, including ones created later. The most restrictive lock wins.",
       add=["st"], edges=[("lock", "st")], learn=[2]),
     S("case", "Side effects", "Case: ReadOnly breaks more than you expect",
       "Some 'read' actions are really POST requests. A ReadOnly lock on a storage account blocks listing its access keys, so apps and the portal cannot get the keys. It also stops a VM from being started or resized.",
       add=["keys"], edges=[("st", "keys", "blocked")], learn=[3], warn="ReadOnly can break normal operations. CanNotDelete is the usual choice for production."),
     S("recap", "Recap", "Locks", "A safety catch, not a permission.",
       recap=["CanNotDelete = change OK, delete blocked", "ReadOnly = no changes, no deletes", "Locks apply to Owners too", "Locks inherit down to child resources",
              "ReadOnly can block list keys and VM start"])])

LAB["az104-resource-locks"] = H(
    "Lock a resource group and watch a delete fail", 15, "free", "Free. The storage account costs cents per month if left empty; you delete it at the end.",
    [BASE, NEW_RG],
    [(f"Create a storage account in {RG} (Standard, LRS) if you do not have one. Name it st<yourinitials><number>.", "The storage account Overview page."),
     (f"Open {RG} > Settings > Locks > + Add. Name: no-delete, lock type: Delete. OK.", "The lock listed with type Delete."),
     ("Open the storage account and select Delete.", "An error that the resource is locked and cannot be deleted."),
     (f"Back on {RG} > Locks, edit the lock and change its type to Read-only. Save.", None),
     ("Open the storage account > Security + networking > Access keys and select Show.", "An error, or the keys do not load. Listing keys is blocked by the ReadOnly lock."),
     ("Try to add a tag to the storage account.", "Saving fails: the lock prevents changes."),
     (f"Delete the lock on {RG}.", "The Locks page is empty again.")],
    ["You saw a delete blocked and a key listing blocked."],
    ["Make sure the lock is deleted first.", DELETE_RG],
    [("Lock your resources to protect your infrastructure", ML + "azure/azure-resource-manager/management/lock-resources")])

# ---------------------------------------------------------------- 1.3 resource groups and subscriptions
WALK["az104-resource-groups-subscriptions"] = walk(
    "Organise resources into folders, move them when plans change, and know your limits.",
    ["What a resource group is", "Moving resources between groups and subscriptions", "Subscriptions as billing and limit boundaries", "Quotas and resource providers"],
    [N("sub", "Subscription", 400, 60, "cost", "billing + limits"), N("rg1", "rg-web", 200, 200, "identity"), N("rg2", "rg-data", 600, 200, "identity"),
     N("app", "Web app", 200, 340, "compute"), N("sa", "Storage account", 600, 340, "storage"), N("quota", "Quotas", 400, 340, "cost", "e.g. vCPU per region")],
    [S("problem", "Messy", "Hundreds of resources, no structure",
       "Without structure you cannot delete a whole project, give one team access, or see what one app costs.",
       add=["sub"]),
     S("concept", "Resource groups", "A resource group is a folder with rules",
       "Every resource lives in exactly one resource group. Put things with the same lifecycle together, so you can manage access, tags, locks and deletion as one unit.\n\nThe group has a region (for its metadata), but the resources inside can be in any region.",
       add=["rg1", "rg2", "app", "sa"], edges=[("sub", "rg1"), ("sub", "rg2"), ("rg1", "app"), ("rg2", "sa")], learn=[0],
       warn="Deleting a resource group deletes everything in it."),
     S("technique", "Move", "Moving resources",
       "You can move most resources to another resource group or subscription. The resource keeps its region; the move only changes its resource ID. Azure validates the move first, and both groups are locked for writes during it.\n\nSome resources cannot move, or must move together with related ones (for example a VM with its disks and NIC).",
       edges=[("rg1", "rg2", "move")], learn=[1], tip="Moving to another region is different: use Azure Resource Mover or redeploy."),
     S("concept", "Subscriptions", "Subscriptions: billing, access and limits",
       "A subscription is a billing unit and a boundary for access and limits. It trusts exactly one Microsoft Entra tenant. Moving a subscription to another tenant removes all its role assignments.\n\nQuotas limit things like vCPUs per region. View them in Usage + quotas and request an increase if needed. Resource providers (such as Microsoft.Compute) must be registered before you use a service, which usually happens automatically.",
       add=["quota"], edges=[("sub", "quota")], learn=[2, 3]),
     S("recap", "Recap", "Resource groups and subscriptions", "Group by lifecycle; know your limits.",
       recap=["One resource, one resource group", "Resources can be in other regions than their group", "Moves keep the region and change the ID",
              "Subscriptions trust one tenant; moving tenants drops role assignments", "Check Usage + quotas before big deployments"])])

LAB["az104-resource-groups-subscriptions"] = H(
    "Move a storage account between resource groups and read your quotas", 20, "free", "Free, apart from cents for an empty storage account.",
    [BASE, NEW_RG],
    [(f"Create a second resource group: {RG}-2 in the same region.", "Two lab resource groups."),
     (f"Create a storage account in {RG} (Standard, LRS).", None),
     (f"Open the storage account > Overview > Move (next to 'Resource group') > Move to another resource group. Choose {RG}-2.", "Azure validates the move first. Wait for 'Validation succeeded'."),
     ("Tick the box that says tools and scripts must be updated, then Move.", f"After a minute the storage account appears in {RG}-2. Its resource ID now contains {RG}-2."),
     ("Search 'Subscriptions' > your subscription > Settings > Usage + quotas. Filter Provider: Compute and region: your region.", "Your 'Total Regional vCPUs' limit and current usage."),
     ("In the same subscription open Settings > Resource providers and search for Microsoft.Compute.", "Status Registered."),
     ("Open the subscription Overview and note the Directory (tenant) it belongs to.", "Your subscription ID and parent tenant.")],
    ["The storage account moved and kept its region.", "You found your regional vCPU quota."],
    [f"Delete {RG}-2.", DELETE_RG],
    [("Move resources to a new resource group or subscription", ML + "azure/azure-resource-manager/management/move-resource-group-and-subscription"),
     ("View quotas", ML + "azure/quotas/view-quotas"),
     ("Manage resource groups in the portal", ML + "azure/azure-resource-manager/management/manage-resource-groups-portal")])

# ---------------------------------------------------------------- 1.3 cost management
WALK["az104-cost-management"] = walk(
    "See where the money goes, get warned before it runs out, and take Azure's own savings advice.",
    ["Cost analysis", "Budgets and alert thresholds", "Budgets do not stop spending", "Azure Advisor cost recommendations"],
    [N("bill", "Azure bill", 400, 60, "cost"), N("ca", "Cost analysis", 160, 200, "cost", "by group, tag, service"), N("bud", "Budget", 400, 200, "cost", "$50 per month"),
     N("mail", "Email alert", 400, 350, "user", "at 80% and 100%"), N("adv", "Azure Advisor", 640, 200, "service", "cost tips"), N("ag", "Action group", 640, 350, "service", "optional automation")],
    [S("problem", "Surprise bill", "The bill doubled and nobody noticed",
       "A test VM was left running for a month. By the time anyone saw the invoice, the money was spent.",
       add=["bill"]),
     S("technique", "Analyse", "Cost analysis shows where money goes",
       "Cost Management > Cost analysis breaks spending down by resource group, service, location or tag, and shows a forecast for the month.",
       add=["ca"], edges=[("bill", "ca")], learn=[0], tip="Good tags (owner, project, env) make cost analysis far more useful."),
     S("technique", "Budget", "A budget warns you before it is too late",
       "Create a budget for a subscription or resource group with an amount and a period. Add alert conditions on actual or forecast cost, for example 80% and 100%, and send email.",
       add=["bud", "mail"], edges=[("bill", "bud"), ("bud", "mail", "alert")], learn=[1],
       warn="A budget only alerts. It does not stop resources or spending. To act automatically, connect an action group (for example to run an automation)."),
     S("technique", "Advisor", "Take Azure's own advice",
       "Azure Advisor's Cost tab lists savings such as shutting down or resizing under-used VMs, deleting unattached disks, and buying reservations.",
       add=["adv", "ag"], edges=[("bill", "adv"), ("bud", "ag")], learn=[2, 3]),
     S("recap", "Recap", "Cost control", "See it, get warned, act on advice.",
       recap=["Cost analysis: break down and forecast spend", "Budgets alert on actual or forecast cost", "Budgets never stop resources",
              "Action groups can automate a response", "Advisor Cost: resize, shut down, reserve"])])

LAB["az104-cost-management"] = H(
    "Create a budget with alerts and read Advisor", 15, "free", "Free. Budgets, cost analysis and Advisor cost nothing.",
    [BASE],
    [("Search 'Cost Management' > Cost analysis. Set the scope to your subscription.", "A chart of this month's cost and a forecast (it may be near zero on a new account)."),
     ("Change 'Group by' to Resource group, then to Service name.", "Costs split by group, then by service."),
     ("Cost Management > Budgets > + Add. Name: budget-lab, reset period: Monthly, amount: 10 (in your billing currency).", "A chart showing the budget against your spending."),
     ("Next: add alert conditions: Actual 80%, Actual 100%, and Forecasted 100%. Add your email address. Create.", "budget-lab in the budgets list."),
     ("Search 'Advisor' > Recommendations > Cost.", "Cost recommendations, or a message that none were found for your resources.")],
    ["budget-lab exists with three alert conditions."],
    ["Keep the budget: it protects you during the whole course. Delete it later if you like."],
    [("Tutorial: create and manage budgets", ML + "azure/cost-management-billing/costs/tutorial-acm-create-budgets"),
     ("Quickstart: explore and analyse costs", ML + "azure/cost-management-billing/costs/quick-acm-cost-analysis"),
     ("Reduce service costs with Azure Advisor", ML + "azure/advisor/advisor-reference-cost-recommendations")])

# ---------------------------------------------------------------- 1.3 management groups
WALK["az104-management-groups"] = walk(
    "Govern many subscriptions at once by placing them in a tree.",
    ["What management groups are", "The tenant root group", "Inheritance of policy and RBAC", "Limits and moving subscriptions"],
    [N("root", "Tenant root group", 400, 50, "identity"), N("corp", "MG: Corp", 220, 170, "identity"), N("lab", "MG: Sandbox", 580, 170, "identity"),
     N("prod", "Sub: Prod", 120, 300, "cost"), N("dev", "Sub: Dev", 320, 300, "cost"), N("test", "Sub: Lab", 580, 300, "cost"),
     N("pol", "Policy: allowed regions", 220, 410, "security")],
    [S("problem", "Many subscriptions", "Twenty subscriptions, twenty copies of every rule",
       "Each team has its own subscription. Assigning the same policy and the same roles twenty times is slow and error-prone.",
       add=["prod", "dev", "test"]),
     S("concept", "The tree", "Management groups form a tree above subscriptions",
       "A management group holds subscriptions and other management groups, up to six levels deep (not counting the root). The top is the tenant root group, created automatically.",
       add=["root", "corp", "lab"], edges=[("root", "corp"), ("root", "lab"), ("corp", "prod"), ("corp", "dev"), ("lab", "test")], learn=[0, 1]),
     S("technique", "Inherit", "Assign once, apply everywhere below",
       "Policies and role assignments at a management group flow down to every subscription, resource group and resource under it.",
       add=["pol"], edges=[("pol", "corp", "assigned")], focus=["corp", "prod", "dev"], learn=[2]),
     S("technique", "Limits", "Rules of the tree",
       "Up to 10,000 management groups per tenant. Each subscription or management group has exactly one parent. Moving a subscription needs rights on the subscription and on the target group.\n\nTo manage the root, a Global Administrator can elevate access (Entra ID > Properties > Access management for Azure resources).",
       edges=[("lab", "dev", "move")], learn=[3]),
     S("recap", "Recap", "Management groups", "Organise subscriptions, govern once.",
       recap=["Management groups sit above subscriptions", "Tenant root group at the top", "Policy and RBAC inherit downward",
              "Six levels deep, one parent each", "Elevate access to manage the root"])])

LAB["az104-management-groups"] = H(
    "Create a management group and place your subscription in it", 20, "free", "Free.",
    [BASE, "Your account must be able to manage management groups. In a personal tenant you are Global Administrator; if you get an authorization error, see the tip in step 1."],
    [("Search 'Management groups'. If asked, select 'Start using management groups'.", "The Tenant Root Group with your subscription under it.",
      "Authorization error? Open Microsoft Entra ID > Properties, set 'Access management for Azure resources' to Yes, Save, sign out and in. Turn it back to No at the end."),
     ("Select + Create. ID: mg-lab, display name: Lab. Submit.", "mg-lab under the Tenant Root Group (refresh after a minute)."),
     ("Open mg-lab > + Add subscription, choose your subscription. Save.", "Your subscription now listed under mg-lab."),
     ("Open mg-lab > Access control (IAM) > Add role assignment: Reader for Ana Lab (from the identity labs).", "A role assignment at the management group scope."),
     (f"Open your subscription > Access control (IAM) > Role assignments.", "Ana's Reader assignment shown as inherited from mg-lab (scope: management group).")],
    ["Ana's role on the subscription shows as inherited from mg-lab."],
    ["Remove Ana's role on mg-lab.", "Move the subscription back to the Tenant Root Group, then delete mg-lab.", "If you elevated access, set it back to No."],
    [("Quickstart: create a management group", ML + "azure/governance/management-groups/create-management-group-portal"),
     ("Manage your Azure subscriptions at scale with management groups", ML + "azure/governance/management-groups/manage"),
     ("Elevate access to manage all Azure subscriptions", ML + "azure/role-based-access-control/elevate-access-global-admin")])
