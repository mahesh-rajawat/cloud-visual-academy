"""AZ-104 domain 2 (storage): easy walkthroughs and hands-on labs."""
from _az104kit import BASE, DELETE_RG, ML, NEW_RG, RG, H
from _walkkit import N, S, walk

WALK: dict[str, dict] = {}
LAB: dict[str, dict] = {}

SA = f"A storage account in {RG}: Standard performance, LRS redundancy, default settings. Name it st<yourinitials><number> (lowercase letters and numbers only, globally unique)."
STORAGE_COST = "Cents. A few small files in a Standard LRS account cost almost nothing; delete the account at the end."

# ---------------------------------------------------------------- 2.1 storage network access
WALK["az104-storage-network"] = walk(
    "By default anyone on the internet can reach your storage account's front door. Close it, and open it only for who needs it.",
    ["Public network access: all, selected, disabled", "Virtual network rules and IP rules", "Trusted Microsoft services exception", "Private endpoints"],
    [N("net", "Internet", 110, 90, "globe"), N("you", "Your office IP", 110, 220, "user"), N("vm", "VM in VNet", 110, 360, "compute"),
     N("fw", "Storage firewall", 400, 220, "security", "selected networks"), N("sa", "Storage account", 660, 220, "storage"), N("pe", "Private endpoint", 400, 380, "network", "private IP")],
    [S("problem", "Open door", "Your storage account answers the whole internet",
       "A new storage account accepts connections from every network. Keys and permissions still protect the data, but one leaked key exposes everything.",
       add=["net", "sa"], edges=[("net", "sa", "allowed")]),
     S("concept", "Firewall", "Turn on the storage firewall",
       "Networking > Public network access: Enabled from all networks, Enabled from selected virtual networks and IP addresses, or Disabled.\n\nWith 'selected', only the networks and IP ranges you list can connect.",
       add=["fw"], hide=[], edges=[("fw", "sa")], learn=[0]),
     S("technique", "Rules", "Add who is allowed",
       "IP rules allow public IP addresses or ranges, such as your office. Virtual network rules allow subnets in Azure; they rely on a service endpoint for Microsoft.Storage on that subnet.\n\nThe exception 'Allow Azure services on the trusted services list' lets services such as Azure Backup in.",
       add=["you", "vm"], edges=[("you", "fw", "IP rule"), ("vm", "fw", "VNet rule")], learn=[1, 2],
       warn="The portal's file and blob browser also connects from your IP. Lock the account down without adding your IP, and you cannot browse your own data in the portal."),
     S("technique", "Private", "Go fully private with a private endpoint",
       "A private endpoint gives the storage account a private IP inside your VNet. Combine it with Public network access: Disabled and nothing on the internet can reach it at all.",
       add=["pe"], edges=[("vm", "pe"), ("pe", "sa", "private link")], learn=[3]),
     S("recap", "Recap", "Storage network access", "Close the door, then open it for named networks.",
       recap=["All networks / selected networks / disabled", "IP rules for public addresses; VNet rules via service endpoints", "Trusted services exception for Azure services",
              "Private endpoint = private IP in your VNet", "Add your own IP to browse data in the portal"])])

LAB["az104-storage-network"] = H(
    "Lock a storage account to your IP address", 15, "free", STORAGE_COST,
    [BASE, NEW_RG, SA],
    [("Open the storage account > Data storage > Containers > + Container, name: docs. Upload any small text file.", "The file listed in the docs container."),
     ("Open Security + networking > Networking. Under Public network access choose 'Enabled from selected virtual networks and IP addresses'. Do not add anything yet. Save.", None),
     ("Wait a minute, then open Containers > docs again.", "An error such as 'This request is not authorized to perform this operation'. The firewall now blocks your browser too."),
     ("Back in Networking, under Firewall tick 'Add your client IP address'. Save, wait a minute, and open docs again.", "The file is visible again: your IP is allowed."),
     ("Under Exceptions, read 'Allow Azure services on the trusted services list to access this storage account'.", "The box is ticked by default."),
     ("Set Public network access back to 'Enabled from all networks'. Save.", None)],
    ["You saw your own access blocked and restored by an IP rule."],
    [DELETE_RG],
    [("Configure Azure Storage firewalls and virtual networks", ML + "azure/storage/common/storage-network-security"),
     ("Use private endpoints for Azure Storage", ML + "azure/storage/common/storage-private-endpoints")])

# ---------------------------------------------------------------- 2.1 keys and SAS
WALK["az104-storage-keys-sas"] = walk(
    "Hand out limited, expiring access to your data instead of the master keys.",
    ["Access keys and rotation", "Three kinds of SAS", "SAS settings: permissions, expiry, IP, protocol", "Stored access policies for revoking", "Prefer Entra ID and user delegation SAS"],
    [N("keys", "Access keys", 130, 90, "security", "key1 + key2"), N("sa", "Storage account", 400, 90, "storage"), N("sas", "SAS token", 400, 240, "security", "read, 1 hour"),
     N("app", "Partner app", 660, 240, "user"), N("pol", "Stored access policy", 130, 240, "security", "on container"), N("entra", "Microsoft Entra ID", 400, 390, "identity", "user delegation")],
    [S("problem", "Master key", "Someone wants just one file",
       "A partner needs to read one report. Giving them the account key would give them full control of every file in the account, forever.",
       add=["keys", "sa"], edges=[("keys", "sa", "full control")]),
     S("concept", "Keys", "Two access keys, so you can rotate",
       "Every account has key1 and key2. Each gives full access. Rotate them regularly: move apps to key2, regenerate key1, and so on.\n\nYou can switch off key access completely (Allow storage account key access = Disabled) and use Microsoft Entra ID instead.",
       learn=[0], tip="Store keys in Azure Key Vault, never in code."),
     S("technique", "SAS", "A SAS is a signed, limited link",
       "A shared access signature (SAS) is a token added to a URL. It says what is allowed (read, write, list...), on what, until when, and optionally from which IP and over HTTPS only.\n\nAccount SAS and service SAS are signed with an account key. A user delegation SAS is signed with Microsoft Entra credentials and works for blobs only; it is the most secure.",
       add=["sas", "app"], edges=[("sa", "sas", "signed"), ("sas", "app", "read only")], learn=[1, 2]),
     S("technique", "Revoke", "Stored access policies let you take it back",
       "A SAS cannot be cancelled by itself; it works until it expires or the key that signed it is regenerated. A stored access policy on a container holds the permissions and expiry; a service SAS that refers to it can be revoked by changing or deleting the policy.\n\nUp to five stored access policies per container.",
       add=["pol"], edges=[("pol", "sas", "controls")], learn=[3], warn="Regenerating a key breaks every SAS signed with it."),
     S("technique", "Best", "The safest option",
       "Use Microsoft Entra ID and RBAC for your own apps. When you must share a link, use a user delegation SAS with a short expiry.",
       add=["entra"], edges=[("entra", "sas", "user delegation")], learn=[4]),
     S("recap", "Recap", "Keys and SAS", "Limited, expiring links beat master keys.",
       recap=["key1 + key2 allow rotation without downtime", "Account, service and user delegation SAS", "Set permissions, expiry, IP and HTTPS",
              "Revoke via stored access policy or key regeneration", "Prefer Entra ID and user delegation SAS"])])

LAB["az104-storage-keys-sas"] = H(
    "Share a file with a SAS link, then revoke it", 25, "free", STORAGE_COST,
    [BASE, NEW_RG, SA],
    [("Create a container named reports and upload a small text file.", "The file in the container. Its access level is Private."),
     ("Open the file > Overview and copy its URL into a new private browser tab.", "An error: the resource is not public."),
     ("Back on the file select Generate SAS. Permissions: Read, expiry: 1 hour from now. Generate SAS token and URL. Copy the Blob SAS URL into the private tab.", "The file's contents in the browser."),
     ("Open the reports container > Settings > Access policy > + Add policy. Identifier: read1h, permissions: Read, expiry: tomorrow. OK, then Save.", "read1h listed under Stored access policies."),
     ("Open the container > Settings > Shared access tokens. Choose Stored access policy: read1h, Generate SAS token and URL. Add /<your file name> after the container name in the URL, before the '?', and open it.", "The file's contents again."),
     ("Delete the read1h policy and Save. Wait 30 seconds and reload the policy-based link.", "An authentication error: the SAS was revoked. The first SAS still works until it expires."),
     ("Open Security + networking > Access keys > Rotate key for key1 and confirm. Reload the first SAS link.", "It fails too: it was signed with key1.", "Real apps using key1 would also break. Move them to key2 before rotating key1.")],
    ["A SAS link worked, and you revoked one by deleting the stored access policy."],
    [DELETE_RG],
    [("Grant limited access with shared access signatures", ML + "azure/storage/common/storage-sas-overview"),
     ("Create a stored access policy", ML + "azure/storage/common/storage-stored-access-policy-define-dotnet"),
     ("Manage storage account access keys", ML + "azure/storage/common/storage-account-keys-manage")])

# ---------------------------------------------------------------- 2.1 Azure Files identity
WALK["az104-files-identity"] = walk(
    "Let employees open a cloud file share with their normal sign-in, and keep folder permissions like on a file server.",
    ["Why use identities instead of the account key", "Identity sources for Azure Files", "Share-level permissions with RBAC", "Folder and file permissions with Windows ACLs"],
    [N("user", "Employee PC", 110, 220, "user", "domain sign-in"), N("idp", "Identity source", 380, 80, "identity", "AD DS / Entra"), N("share", "File share", 640, 220, "storage", "SMB"),
     N("rbac", "Share-level role", 380, 220, "security", "SMB Share Contributor"), N("acl", "Windows ACLs", 640, 380, "security", "folders and files")],
    [S("problem", "Shared key", "Everyone mounts the share with the storage key",
       "The storage account key gives full control to anyone who has it, and you cannot tell users apart. You want per-person access, like an office file server.",
       add=["user", "share"], edges=[("user", "share", "account key")]),
     S("concept", "Identity", "Sign in with a domain identity",
       "Azure Files can check users' identities over SMB (Kerberos). Identity sources: on-premises Active Directory Domain Services, Microsoft Entra Domain Services, or Microsoft Entra Kerberos for hybrid identities. A storage account uses one source at a time.",
       add=["idp"], edges=[("user", "idp", "Kerberos ticket")], learn=[0, 1]),
     S("technique", "Share level", "Step 1: who can open the share",
       "Assign an RBAC role on the share or storage account: Storage File Data SMB Share Reader, Contributor or Elevated Contributor. Or set a default share-level permission for all authenticated users.",
       add=["rbac"], edges=[("idp", "rbac"), ("rbac", "share")], learn=[2]),
     S("technique", "File level", "Step 2: what they can do inside",
       "Windows ACLs (NTFS permissions) on folders and files decide the details, exactly as on a Windows file server. Both levels must allow an action.",
       add=["acl"], edges=[("share", "acl")], learn=[3], warn="Share-level RBAC roles do not apply when users connect with the storage account key."),
     S("recap", "Recap", "Azure Files identity", "Two gates: share-level role, then file ACLs.",
       recap=["Use identities instead of the shared key", "AD DS, Entra Domain Services or Entra Kerberos", "Share level: SMB Share Reader / Contributor / Elevated Contributor",
              "File level: Windows ACLs", "Both levels must allow the action"])])

LAB["az104-files-identity"] = H(
    "Set share-level permissions on an Azure file share", 15, "free", STORAGE_COST,
    [BASE, NEW_RG, SA, "grp-it-lab from the identity labs (or any group)."],
    [("Open the storage account > Data storage > File shares > + File share. Name: team, keep the default tier. Create.", "The team share in the list."),
     ("Open File shares and select the 'Identity-based access' setting (shown as 'Not configured').", "The identity sources: AD DS, Microsoft Entra Domain Services and Microsoft Entra Kerberos. Read them; do not enable one, they need a domain."),
     ("On the same page, find 'Default share-level permissions'. Read the options: no default, or a role for all authenticated identities.", None),
     ("Open the team share > Access control (IAM) > Add role assignment. Role: Storage File Data SMB Share Contributor. Members: grp-it-lab. Review + assign.", "The role listed under Role assignments for the share."),
     ("Open the team share > Connect. Choose Windows and read the script.", "A PowerShell script that mounts the share with the storage account key. This is the key-based method that ignores RBAC."),
     ("Optional, on a Windows PC: run the script to mount the share as a drive.", "A new drive letter. If it times out, your internet provider probably blocks port 445.")],
    ["grp-it-lab has the SMB Share Contributor role on the team share."],
    [DELETE_RG],
    [("Overview of identity-based authentication for Azure Files", ML + "azure/storage/files/storage-files-active-directory-overview"),
     ("Assign share-level permissions", ML + "azure/storage/files/storage-files-identity-assign-share-level-permissions"),
     ("Mount an SMB file share on Windows", ML + "azure/storage/files/storage-how-to-use-files-windows")])

# ---------------------------------------------------------------- 2.2 storage accounts and encryption
WALK["az104-storage-accounts"] = walk(
    "Create a storage account with the right type and safe settings, and choose who holds the encryption keys.",
    ["Account types and performance", "Safe default settings", "Encryption is always on", "Customer-managed keys and infrastructure encryption"],
    [N("sa", "Storage account", 400, 80, "storage", "one name, many services"), N("blob", "Blobs", 110, 220, "storage"), N("files", "Files", 300, 220, "storage"),
     N("q", "Queues", 490, 220, "storage"), N("t", "Tables", 680, 220, "storage"), N("mmk", "Microsoft-managed key", 220, 380, "security"), N("cmk", "Your key in Key Vault", 580, 380, "security")],
    [S("problem", "Where to keep data", "An app needs files, images and logs",
       "You need cheap, durable storage reachable from anywhere. In Azure that starts with a storage account.",
       add=["sa"]),
     S("concept", "Types", "One account, four services",
       "A Standard general-purpose v2 account holds blobs, file shares, queues and tables, and suits most needs. Premium accounts use SSDs for low latency and come in three kinds: block blobs, file shares, or page blobs.\n\nThe name must be globally unique, 3–24 lowercase letters and numbers.",
       add=["blob", "files", "q", "t"], edges=[("sa", "blob"), ("sa", "files"), ("sa", "q"), ("sa", "t")], learn=[0]),
     S("technique", "Settings", "Safe settings to check",
       "Require secure transfer (HTTPS only), minimum TLS version 1.2, and leave anonymous blob access off unless you really host public files. Choose redundancy and the default access tier (Hot or Cool) at creation.",
       learn=[1], tip="Some settings, such as infrastructure encryption and performance, can only be chosen when you create the account."),
     S("concept", "Encryption", "Data is always encrypted at rest",
       "Azure encrypts everything you store with 256-bit AES. You cannot turn it off. By default Microsoft manages the keys.",
       add=["mmk"], edges=[("mmk", "sa", "default")], learn=[2]),
     S("technique", "Your key", "Hold the key yourself if you must",
       "Customer-managed keys live in your Azure Key Vault (with soft delete and purge protection on). The account reads the key with a managed identity. Disable the key and the data becomes unreadable.\n\nInfrastructure encryption adds a second layer of encryption and must be enabled at creation. Encryption scopes let different containers use different keys.",
       add=["cmk"], edges=[("cmk", "sa", "managed identity")], learn=[3]),
     S("recap", "Recap", "Storage accounts", "Standard GPv2 for most things; encryption always on.",
       recap=["Standard GPv2: blobs, files, queues, tables", "Premium: block blob, file share or page blob", "HTTPS only, TLS 1.2, no anonymous access",
              "Always encrypted; Microsoft-managed keys by default", "Customer-managed keys in Key Vault; infrastructure encryption at creation"])])

LAB["az104-storage-accounts"] = H(
    "Create a storage account with safe settings and review encryption", 15, "free", STORAGE_COST,
    [BASE, NEW_RG],
    [(f"Search 'Storage accounts' > + Create. Resource group: {RG}, name: st<yourinitials><number>, region: your region, primary service: Azure Blob Storage or Azure Data Lake Storage Gen2, performance: Standard, redundancy: LRS.", "The Basics tab filled in. Read the other options in the Redundancy list."),
     ("Advanced tab: check 'Require secure transfer' is on, 'Allow enabling anonymous access on individual containers' is off, and minimum TLS is 1.2. Note the default access tier: Hot.", None),
     ("Encryption tab: read the options. Keep Microsoft-managed keys. Note 'Enable infrastructure encryption' (only available now, at creation).", None),
     ("Review + create > Create. Open the resource when deployed.", "The Overview page with the blob, file, queue and table endpoints listed."),
     ("Open Security + networking > Encryption.", "Encryption type: Microsoft-managed keys, with the option to switch to customer-managed keys."),
     ("Open Settings > Configuration.", "Secure transfer, TLS version, anonymous access and default access tier, which you can change here later.")],
    ["The account exists with HTTPS only, TLS 1.2 and anonymous access off."],
    ["Keep the account for the next storage labs, or: " + DELETE_RG],
    [("Create a storage account", ML + "azure/storage/common/storage-account-create"),
     ("Azure Storage encryption for data at rest", ML + "azure/storage/common/storage-service-encryption"),
     ("Customer-managed keys for Azure Storage encryption", ML + "azure/storage/common/customer-managed-keys-overview")])

# ---------------------------------------------------------------- 2.2 redundancy
WALK["az104-storage-redundancy"] = walk(
    "Choose how many copies of your data Azure keeps, and how far apart.",
    ["LRS: three copies in one datacenter", "ZRS: three availability zones", "GRS and GZRS: a copy in another region", "RA-: reading the secondary", "Changing redundancy later"],
    [N("dc", "Datacenter", 160, 100, "storage", "LRS: 3 copies"), N("z1", "Zone 1", 160, 240, "storage"), N("z2", "Zone 2", 160, 330, "storage"), N("z3", "Zone 3", 160, 410, "storage"),
     N("prim", "Primary region", 420, 240, "globe"), N("sec", "Secondary region", 660, 240, "globe", "paired, LRS there"), N("read", "Read from secondary", 660, 390, "user", "RA- only")],
    [S("problem", "Disasters", "Disks fail, buildings flood, regions go down",
       "How much loss can your data survive? The answer decides your redundancy option and its price.",
       add=["prim"]),
     S("concept", "LRS", "LRS: cheapest, one building",
       "Locally redundant storage keeps three copies in one datacenter. It survives a disk or server failure, but not a fire or flood in that building.",
       add=["dc"], edges=[("prim", "dc")], learn=[0]),
     S("concept", "ZRS", "ZRS: three zones in one region",
       "Zone-redundant storage spreads three copies across three availability zones (separate buildings with their own power). It survives a whole datacenter going down.",
       add=["z1", "z2", "z3"], edges=[("prim", "z1"), ("prim", "z2"), ("prim", "z3")], learn=[1]),
     S("concept", "GRS", "GRS and GZRS: another region too",
       "Geo-redundant storage (GRS) = LRS in the primary region plus an asynchronous copy to the paired region. GZRS = ZRS in the primary plus the copy in the secondary region.\n\nThe secondary copy is not readable until you fail over, unless you choose the RA- version.",
       add=["sec"], edges=[("prim", "sec", "async copy")], learn=[2]),
     S("technique", "RA-", "RA-GRS and RA-GZRS: read the copy any time",
       "Read-access versions give you a second endpoint (accountname-secondary) to read data from the secondary region at any time, even when the primary is healthy.",
       add=["read"], edges=[("sec", "read", "-secondary endpoint")], learn=[3]),
     S("technique", "Change", "Changing redundancy later",
       "Switching between LRS, GRS and RA-GRS is a simple setting change. Moving to or from zone redundancy (ZRS, GZRS) is a conversion that Azure performs in the background, or a data copy for some cases.",
       learn=[4], warn="Premium accounts and some features (for example Premium file shares) do not support geo-redundancy."),
     S("recap", "Recap", "Redundancy", "More distance, more safety, more cost.",
       recap=["LRS: 3 copies, 1 datacenter", "ZRS: 3 zones, 1 region", "GRS / GZRS: plus an async copy in the paired region", "RA-: readable secondary endpoint",
              "LRS↔GRS is a setting; zone changes are conversions"])])

LAB["az104-storage-redundancy"] = H(
    "Change a storage account from LRS to RA-GRS", 10, "free", "Cents. Geo-redundancy costs a little more per GB; with no data it is close to zero.",
    [BASE, NEW_RG, SA],
    [("Open the storage account > Data management > Redundancy.", "Current redundancy LRS and a map with one location."),
     ("Change the redundancy setting to Read-access geo-redundant storage (RA-GRS). Save.", "The map now shows a primary and a secondary region, with status Available for both after a short while."),
     ("Open Settings > Endpoints.", "Secondary endpoints such as https://<name>-secondary.blob.core.windows.net, because it is RA-GRS."),
     ("Back on Redundancy, open the redundancy list again.", "Zone-redundant options may require a conversion. Read the message, but do not convert."),
     ("Change back to LRS and Save.", "A single location on the map again.")],
    ["You saw the secondary region and the -secondary endpoint."],
    [DELETE_RG],
    [("Azure Storage redundancy", ML + "azure/storage/common/storage-redundancy"),
     ("Change how a storage account is replicated", ML + "azure/storage/common/redundancy-migration")])

# ---------------------------------------------------------------- 2.2 object replication
WALK["az104-object-replication"] = walk(
    "Keep a copy of selected blob containers in another storage account, automatically.",
    ["What object replication does", "Prerequisites: versioning and change feed", "Replication policies and rules", "Asynchronous copy and limits"],
    [N("src", "Source account", 160, 220, "storage", "container: images"), N("dst", "Destination account", 640, 220, "storage", "container: images-copy"),
     N("ver", "Versioning", 160, 380, "service", "both accounts"), N("cf", "Change feed", 160, 80, "service", "source"), N("pol", "Replication policy", 400, 380, "security", "rules per container")],
    [S("problem", "Copy needed", "Customers in another region read the same images",
       "You want a copy of one container in another account, close to those customers, without writing a copy job.",
       add=["src", "dst"]),
     S("concept", "Replication", "Object replication copies block blobs for you",
       "Object replication asynchronously copies block blobs from a source container to a destination container in another account, which can be in another region or subscription.",
       edges=[("src", "dst", "async copy")], learn=[0]),
     S("technique", "Prereqs", "Turn on versioning and change feed",
       "Blob versioning must be on in both accounts, and the change feed on the source account. The portal turns them on for you when you create the rules.",
       add=["ver", "cf"], edges=[("cf", "src"), ("ver", "src"), ("ver", "dst")], learn=[1]),
     S("technique", "Policy", "A policy holds the rules",
       "A replication policy connects a source and a destination account. Each rule maps one source container to one destination container, optionally with a prefix filter and whether to copy existing blobs.\n\nThe destination container becomes read-only for writes while replication is set up.",
       add=["pol"], edges=[("pol", "src"), ("pol", "dst")], learn=[2, 3], warn="Object replication is not a backup. Deleting a blob in the source is replicated too (as a deletion of the current version)."),
     S("recap", "Recap", "Object replication", "Automatic, asynchronous copies of chosen containers.",
       recap=["Copies block blobs between accounts", "Needs versioning on both and change feed on the source", "Policy with container-to-container rules",
              "Asynchronous; destination is read-only", "Not a substitute for backup"])])

LAB["az104-object-replication"] = H(
    "Replicate a container to a second account", 20, "free", STORAGE_COST,
    [BASE, NEW_RG, SA + " This is the source.", "A second storage account in the same group (the destination)."],
    [("In the source account create a container named images. In the destination account create a container named images-copy.", None),
     ("Open the source account > Data management > Object replication > Create replication rules.", "A form asking for the destination account and container pairs."),
     ("Choose the destination account. Source container: images, destination container: images-copy. Copy over: everything. Create.", "A notice that versioning and change feed will be enabled. Accept it."),
     ("Upload a small image or text file to images in the source account.", None),
     ("After 2–5 minutes open images-copy in the destination account.", "The same file, copied automatically.", "Replication is asynchronous. If it is not there yet, wait a few more minutes."),
     ("Try uploading a file directly into images-copy.", "The upload fails: the destination container is read-only while the policy exists.")],
    ["A file uploaded to the source appeared in the destination."],
    [DELETE_RG],
    [("Configure object replication for block blobs", ML + "azure/storage/blobs/object-replication-configure"),
     ("Object replication overview", ML + "azure/storage/blobs/object-replication-overview")])

# ---------------------------------------------------------------- 2.2 AzCopy and Storage Explorer
WALK["az104-azcopy-explorer"] = walk(
    "Move lots of files in and out of Azure Storage, with a command line or a desktop app.",
    ["AzCopy: copy and sync from the command line", "How AzCopy signs in: Entra ID or SAS", "Storage Explorer and the portal's Storage browser", "Choosing the right tool"],
    [N("pc", "Your PC / server", 120, 220, "compute"), N("az", "AzCopy", 380, 120, "service", "command line"), N("se", "Storage Explorer", 380, 330, "service", "desktop app"),
     N("sa", "Storage account", 660, 220, "storage"), N("auth", "Entra ID or SAS", 660, 390, "security")],
    [S("problem", "Many files", "Upload 50,000 files tonight",
       "Clicking upload in the portal does not scale. You need a tool that copies in parallel and can resume.",
       add=["pc", "sa"]),
     S("technique", "AzCopy", "AzCopy for scripts and big jobs",
       "AzCopy is a free command-line tool. azcopy copy uploads, downloads or copies between accounts (server to server). azcopy sync makes a destination match a source. It runs on Windows, Linux and macOS, and is built into Azure Cloud Shell.",
       add=["az"], edges=[("pc", "az"), ("az", "sa", "copy / sync")], learn=[0]),
     S("technique", "Auth", "How AzCopy proves who you are",
       "Sign in with azcopy login (Microsoft Entra ID; you need a data role such as Storage Blob Data Contributor), or append a SAS token to the URL. Azure Files supports SAS and, in newer versions, Entra ID.",
       add=["auth"], edges=[("auth", "sa")], learn=[1], warn="Owner or Contributor on the account is not enough for azcopy login uploads. You need a data role like Storage Blob Data Contributor."),
     S("technique", "Explorer", "Storage Explorer for point and click",
       "Azure Storage Explorer is a free desktop app to browse, upload, download and manage blobs, files, queues and tables. It uses AzCopy under the hood for transfers. In the portal, Storage browser does lighter jobs.",
       add=["se"], edges=[("pc", "se"), ("se", "sa", "browse")], learn=[2, 3]),
     S("recap", "Recap", "Moving data", "Scripts: AzCopy. Clicking: Storage Explorer.",
       recap=["azcopy copy and azcopy sync", "Sign in with Entra ID (data role) or a SAS", "Storage Explorer is a desktop app using AzCopy",
              "Storage browser in the portal for small jobs"])])

LAB["az104-azcopy-explorer"] = H(
    "Upload files with AzCopy in Cloud Shell", 20, "free", STORAGE_COST,
    [BASE, NEW_RG, SA],
    [("Create a container named upload in the storage account.", None),
     ("Open the container > Settings > Shared access tokens. Permissions: Read, Add, Create, Write, List. Expiry: 2 hours. Generate and copy the Blob SAS URL.", None),
     ("Open Cloud Shell (the >_ icon at the top of the portal). Choose Bash. If asked about storage, choose 'No storage account required'.", "A Bash prompt in the browser."),
     ("Type: mkdir files && for i in 1 2 3; do echo hello $i > files/f$i.txt; done", "Three small files created in the files folder."),
     ("Type: azcopy copy 'files/*' '<paste the SAS URL here>'  (keep the single quotes).", "A job summary with 3 transfers completed.", "Wrap the SAS URL in single quotes, because it contains & characters."),
     ("Type: azcopy list '<the SAS URL>'", "The three files listed. You can also see them in the portal's container view."),
     ("Optional: install Azure Storage Explorer on your PC, sign in, and browse the same container.", "The container and files in the desktop app.")],
    ["Three files uploaded by AzCopy are visible in the container."],
    [DELETE_RG],
    [("Get started with AzCopy", ML + "azure/storage/common/storage-use-azcopy-v10"),
     ("Upload files with AzCopy", ML + "azure/storage/common/storage-use-azcopy-blobs-upload"),
     ("Get started with Storage Explorer", ML + "azure/storage/storage-explorer/vs-azure-tools-storage-manage-with-storage-explorer")])

# ---------------------------------------------------------------- 2.3 containers and file shares
WALK["az104-containers-shares"] = walk(
    "Two ways to store files: blob containers for apps and the web, file shares for drives that people and servers mount.",
    ["Blob containers and access levels", "Anonymous access is off by default", "Azure file shares: SMB and NFS", "Share tiers and quotas"],
    [N("sa", "Storage account", 400, 60, "storage"), N("cont", "Blob container", 200, 200, "storage", "images"), N("web", "Web browser", 200, 370, "user", "via URL"),
     N("share", "File share", 600, 200, "storage", "team-drive"), N("pc", "PC or server", 600, 370, "compute", "mapped drive")],
    [S("problem", "Two needs", "Images for a website, and a shared drive for staff",
       "The website needs files reachable by URL. Staff want a drive letter like the old file server.",
       add=["sa"]),
     S("concept", "Containers", "Blob containers hold objects",
       "A container groups blobs, like a folder. Its access level is Private (default), Blob (anyone can read blobs if they know the URL) or Container (anyone can also list the blobs).",
       add=["cont"], edges=[("sa", "cont")], learn=[0]),
     S("technique", "Anonymous", "Public access needs two switches",
       "Anonymous read works only if the account allows anonymous access (off by default) and the container's level is Blob or Container.",
       add=["web"], edges=[("web", "cont", "URL")], learn=[1], warn="Most data should stay Private. Use SAS links or a CDN for sharing."),
     S("concept", "File shares", "File shares behave like a network drive",
       "Azure Files offers shares over SMB (Windows, Linux, macOS) or NFS (Linux, Premium only). Mount them as a drive, or cache them on-premises with Azure File Sync.",
       add=["share", "pc"], edges=[("sa", "share"), ("pc", "share", "SMB 445")], learn=[2]),
     S("technique", "Tiers", "Choose a tier and a size",
       "Standard shares offer transaction optimized, hot and cool tiers. Premium shares run on SSDs in a FileStorage account. A quota caps the share's size.",
       learn=[3], tip="SMB uses TCP port 445, which many home internet providers block."),
     S("recap", "Recap", "Containers and shares", "Blobs for URLs; shares for drives.",
       recap=["Container access: Private, Blob, Container", "Anonymous needs the account setting AND the container level", "File shares: SMB or NFS (Premium)",
              "Standard tiers: transaction optimized, hot, cool; Premium on SSD", "SMB uses port 445"])])

LAB["az104-containers-shares"] = H(
    "Create a private container and a file share", 15, "free", STORAGE_COST,
    [BASE, NEW_RG, SA],
    [("Open the storage account > Containers > + Container. Name: site, anonymous access level: Private. Create.", "The site container with access level Private."),
     ("Upload a small image to site. Open it and copy its URL into a private browser window.", "An error: the resource is not found or not public."),
     ("Open the container's 'Change access level'.", "Blob and Container are greyed out, because the account does not allow anonymous access."),
     ("Open the account > File shares > + File share. Name: team-drive. Keep the default tier and create.", "team-drive in the list."),
     ("Open team-drive > Browse > + Add directory: reports. Upload a file into reports.", "The folder and file in the share."),
     ("Open team-drive > Edit quota (or Properties) and read the quota setting.", "The maximum size of the share.")],
    ["The container is private; the share has a folder and a file."],
    [DELETE_RG],
    [("Quickstart: upload, download and list blobs in the portal", ML + "azure/storage/blobs/storage-quickstart-blobs-portal"),
     ("Create an SMB Azure file share", ML + "azure/storage/files/storage-how-to-create-file-share"),
     ("Configure anonymous read access for containers and blobs", ML + "azure/storage/blobs/anonymous-read-access-configure")])

# ---------------------------------------------------------------- 2.3 tiers and lifecycle
WALK["az104-tiers-lifecycle"] = walk(
    "Pay less for data you rarely read by moving it to cheaper tiers, automatically.",
    ["Hot, Cool, Cold and Archive", "Minimum days and early deletion", "Archive is offline: rehydration", "Lifecycle management rules"],
    [N("hot", "Hot", 120, 160, "storage", "read often"), N("cool", "Cool", 300, 160, "storage", "30+ days"), N("cold", "Cold", 480, 160, "storage", "90+ days"),
     N("arch", "Archive", 660, 160, "storage", "180+ days, offline"), N("rule", "Lifecycle rule", 390, 340, "service", "runs daily"), N("rehyd", "Rehydrate", 660, 340, "service", "hours")],
    [S("problem", "Old data", "Five years of invoices nobody reads",
       "They must be kept, but storing them on the fastest tier wastes money every month.",
       add=["hot"]),
     S("concept", "Tiers", "Four access tiers",
       "Hot: cheapest to read, most expensive to store. Cool: cheaper storage, keep at least 30 days. Cold: cheaper still, at least 90 days. Archive: cheapest storage, at least 180 days, and offline.\n\nMoving or deleting earlier than the minimum costs an early deletion fee.",
       add=["cool", "cold", "arch"], edges=[("hot", "cool"), ("cool", "cold"), ("cold", "arch")], learn=[0, 1]),
     S("technique", "Archive", "Archive blobs must be rehydrated",
       "You cannot read an archived blob. Change its tier to Hot or Cool (or copy it) to rehydrate it. Standard priority can take up to 15 hours; high priority is faster but costs more.",
       add=["rehyd"], edges=[("arch", "rehyd"), ("rehyd", "hot", "back online")], learn=[2], warn="Archive tier is set per blob, not as an account default."),
     S("technique", "Lifecycle", "Let rules move data for you",
       "Lifecycle management rules move blobs to cooler tiers or delete them, based on days since creation, last modification or last access (needs access tracking). Filters choose containers or name prefixes. Rules run about once a day.",
       add=["rule"], edges=[("rule", "cool", "after 30 days"), ("rule", "arch", "after 180 days")], learn=[3]),
     S("recap", "Recap", "Tiers and lifecycle", "Cooler is cheaper to keep, dearer to read.",
       recap=["Hot / Cool (30) / Cold (90) / Archive (180)", "Early deletion fees apply", "Archive is offline; rehydrate up to 15 hours",
              "Lifecycle rules move or delete blobs daily", "Rules can use last access time"])])

LAB["az104-tiers-lifecycle"] = H(
    "Move a blob through tiers and create a lifecycle rule", 20, "free", "Cents. Archive has a 180-day minimum, but a tiny file's early deletion fee is a fraction of a cent.",
    [BASE, NEW_RG, SA],
    [("Create a container named invoices and upload a small text file.", "The file with Access tier: Hot (inferred)."),
     ("Select the file > Change tier > Cool. Save.", "Access tier: Cool."),
     ("Change tier again to Archive. Save, then try to download the file.", "Download is not possible: the blob is archived (offline)."),
     ("Change tier to Hot with rehydrate priority Standard. Save.", "Status 'Rehydrate pending to hot'. It can take hours; you do not need to wait."),
     ("Open the account > Data management > Lifecycle management > Add a rule. Name: move-old, scope: limit with filters, blob type: Block blobs.", None),
     ("Base blobs: if last modified more than 30 days ago, move to cool storage. Add condition: more than 180 days ago, move to archive. Filter set: prefix invoices/. Add.", "move-old listed and enabled."),
     ("Open the Code view tab of Lifecycle management.", "The same rule as JSON, the format used in templates and the CLI.")],
    ["You saw an archived blob become unreadable.", "The lifecycle rule exists."],
    [DELETE_RG],
    [("Access tiers for blob data", ML + "azure/storage/blobs/access-tiers-overview"),
     ("Configure a lifecycle management policy", ML + "azure/storage/blobs/lifecycle-management-policy-configure"),
     ("Rehydrate an archived blob", ML + "azure/storage/blobs/archive-rehydrate-to-online-tier")])

# ---------------------------------------------------------------- 2.3 data protection
WALK["az104-data-protection"] = walk(
    "Undo mistakes: get back deleted or overwritten files.",
    ["Blob soft delete and container soft delete", "Blob versioning", "File share soft delete and snapshots", "Choosing retention periods"],
    [N("blob", "report.xlsx", 160, 220, "storage"), N("v1", "Version 1", 400, 100, "storage"), N("v2", "Version 2", 400, 220, "storage", "current"),
     N("bin", "Soft-deleted", 400, 360, "storage", "kept 7–365 days"), N("share", "File share", 660, 220, "storage"), N("snap", "Share snapshot", 660, 380, "storage", "read-only copy")],
    [S("problem", "Mistakes", "Someone overwrote the budget file, then deleted the folder",
       "Without protection, that data is gone. Storage has several undo features, each for a different mistake.",
       add=["blob"]),
     S("technique", "Soft delete", "Soft delete: a recycle bin",
       "With blob soft delete, deleted blobs are kept for a retention period (1–365 days) and can be undeleted. Container soft delete does the same for whole containers.",
       add=["bin"], edges=[("blob", "bin", "deleted")], learn=[0]),
     S("technique", "Versioning", "Versioning: every overwrite keeps the old copy",
       "With blob versioning on, each write creates a new version and keeps the previous one. Promote an older version to restore it. Versions cost storage, so pair versioning with a lifecycle rule that deletes old versions.",
       add=["v1", "v2"], edges=[("blob", "v2"), ("v2", "v1", "previous")], learn=[1]),
     S("technique", "Files", "Azure Files: share soft delete and snapshots",
       "Share soft delete keeps a deleted file share for a retention period. Share snapshots are read-only, point-in-time copies of a whole share; restore single files from them. Azure Backup can schedule snapshots for you.",
       add=["share", "snap"], edges=[("share", "snap", "snapshot")], learn=[2, 3], tip="Soft delete protects against deletion; versioning and snapshots protect against overwrites."),
     S("recap", "Recap", "Data protection", "Recycle bin for deletes, versions for overwrites.",
       recap=["Blob soft delete and container soft delete: 1–365 days", "Versioning keeps every previous write", "File share soft delete keeps deleted shares",
              "Share snapshots: read-only point-in-time copies", "Use lifecycle rules to clean up old versions"])])

LAB["az104-data-protection"] = H(
    "Recover an overwritten blob and a deleted file", 20, "free", STORAGE_COST,
    [BASE, NEW_RG, SA],
    [("Open the account > Data management > Data protection. Tick 'Enable versioning for blobs' and 'Enable soft delete for blobs' (7 days) and 'Enable soft delete for containers'. Save.", "The settings saved."),
     ("Create a container named budget. Upload a text file named plan.txt containing 'version one'.", None),
     ("Edit plan.txt on your PC to say 'version two' and upload it again with 'Overwrite if files already exist' ticked.", None),
     ("Open plan.txt > Versions.", "Two versions. The older one is marked as a previous version."),
     ("Select the older version > Make current version. Download plan.txt.", "The file says 'version one' again."),
     ("Delete plan.txt. Then turn on 'Show deleted blobs' in the container.", "plan.txt shown as deleted. Because versioning is on, open plan.txt > Versions, select the latest previous version and choose Make current version.", "Without versioning you would use Undelete instead; with versioning on, you restore by promoting a version."),
     ("Create a file share named team, upload a file, then open team > Snapshots > + Add snapshot.", "A snapshot with today's date."),
     ("Delete the file from the share. Open the snapshot, find the file and select Restore.", "The file is back in the share.")],
    ["You restored an older version of a blob and a file from a share snapshot."],
    [DELETE_RG],
    [("Blob versioning", ML + "azure/storage/blobs/versioning-enable"),
     ("Soft delete for blobs", ML + "azure/storage/blobs/soft-delete-blob-enable"),
     ("Share snapshots for Azure Files", ML + "azure/storage/files/storage-snapshots-files")])
