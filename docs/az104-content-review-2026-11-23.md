# AZ-104 content review (23 November 2026)

What was checked: all 47 AZ-104 lessons (simple and engineer explanations, examples, portal/CLI/PowerShell/Bicep,
troubleshooting, misconceptions, comparisons), all 47 easy walkthroughs, all 47 real-Azure labs, the
simulator rules, and all 369 questions. Facts I was not sure of were checked against Microsoft Learn.

This is an AI review, not a review by a certified Azure expert. Use Microsoft's free official practice
assessment as an independent check before booking the exam.

## Factual corrections

| Topic | Was | Now |
|---|---|---|
| App Service backups (lesson, question az104-q-aso-05, simulator) | Custom backups need Standard | Custom backups work from **Basic** (production slot only on Basic); automatic backups hourly, 30 days, 30 GB, no databases; custom backups 10 GB, every 2 h at most; linked-database backups end 31 Mar 2028 |
| Licence usage location (walkthroughs, labs, 2 questions, cheat sheet) | Group licences fail without usage location | Only **direct** assignment needs it; group-based licensing falls back to the tenant's country |
| App Service tiers walkthrough | "Standard: daily backups" | Backups start at Basic |
| Custom domains walkthrough | Contradictory tier note | Custom domains from Shared; TLS and free managed certificates from Basic |
| Storage account creation | Hierarchical namespace fixed at creation | An existing account can be upgraded one way to Data Lake Storage Gen2 |
| Backup restore tip | "Replace existing needs the VM stopped" (unverified) | Replace existing needs the original VM to still exist |
| Alert processing rule CLI | One-off start/end time for a weekly window | Weekly recurrence start/end times |
| Policy question explanation | "does not block deletes of compliant resources" | Deny does not evaluate delete requests |

## Lab corrections (real Azure)

- New virtual networks now use **private subnets** (no internet by default). VNet and VM set-up steps now say how to allow outbound access for labs, because monitoring agents, Backup and Site Recovery need it.
- Load balancer lab: no longer installs nginx from the internet; it starts a small Python web server that Ubuntu already includes.
- Labs that sign in as the test user: the SSPR lab uses My Apps; the RBAC lab warns that Azure requires MFA for portal sign-in.
- Blob versioning lab: restore a deleted blob by promoting a version (Undelete is for accounts without versioning).
- Scale set lab: watch the scale-in rule act, instead of changing the default count (which has no effect when metrics exist).
- Bicep lab: creates the file with a paste-in command instead of the Cloud Shell editor.
- Peering and VNet labs: address ranges no longer clash between labs.

## Question bank

- 63 of the 162 added questions repeated an existing question (same idea, same answer). Each was replaced with a question on a concept that was not covered yet (content in `scripts/content/_az104_qfix.py`).
- Two duplicate AZ-900 questions were also replaced.
- A new test fails if near-duplicate questions appear in the same objective again.
- Answer order is shuffled on screen, so the right answer is not usually the first option.

# Second verification (24 November 2026)

Checked against the official AZ-104 study guide (**skills measured as of 17 April 2026**) and Microsoft Learn.

## The exam outline had changed

The portal was still built on the October 2023 outline. An earlier sync wrongly recorded "no newer outline".
Bullet-by-bullet comparison with the April 2026 outline:

| Change | What was done |
|---|---|
| **New skill:** Configure soft delete for blobs and containers (AZ104-2.3.7) | Linked to the data-protection lesson (which already taught blob and container soft delete, 1–365 days), added to the storage simulator's coverage, 2 new questions |
| **Replaced skill:** "Configure Azure Disk Encryption" → **"Configure encryption at host for Azure virtual machines"** (AZ104-3.2.2) | Lesson, walkthrough, real-Azure lab, simulator and questions rewritten for encryption at host. Azure Disk Encryption retires 15 Sep 2028 and is now taught only as the legacy option and migration case |
| Reworded only: file share "in Azure Files", container "in Azure Blob Storage", "user-defined routes", "Azure Container Registry", "Connection monitor" | Wording updated, IDs kept so progress and questions stay linked |

All 82 objectives now have a lesson, a tested activity and questions (coverage validator passes).

## Encryption at host facts used (Microsoft Learn)

- Encrypts the temporary disk and ephemeral OS disk (platform-managed keys) and OS/data disk caches (platform- or customer-managed keys); data flows encrypted to Azure Storage.
- Register `EncryptionAtHost` on the subscription first; use a supported VM size; an existing VM must be deallocated to turn it on or off.
- Cannot be enabled on a VM that has, or ever had, Azure Disk Encryption — migration means a new VM with new disks.
- Portal: Disks tab when creating a VM; existing VM: Disks > Additional settings > Encryption at host.

## Facts re-verified on Microsoft Learn (all correct in the portal)

Bastion SKUs (Developer: free, no AzureBastionSubnet, one VM at a time, no peering; native client and shareable links need Standard+; session recording and private-only need Premium; /26 subnet), archive tier only on LRS/GRS/RA-GRS, early deletion Cool 30 / Cold 90 / Archive 180 days, ACR anonymous pull on Standard and Premium, blob and container soft delete 1–365 days, file share soft delete on by default (7 days), App Service scale-out limits (Basic 3, Standard 10, Premium v2–v4 30) and slots (Standard 5, Premium 20), 5 reserved IPs per subnet and /29 minimum, ReadOnly lock blocks listing storage keys, activity log 90 days, Container Apps defaults (max 10 replicas, HTTP rule 10 concurrent requests, Consumption up to 4 vCPU / 8 GiB). Retirements already reflected: Basic public IP (30 Sep 2025), Log Analytics agent, NSG flow logs (no new ones after 30 Jun 2025), Backup center → Business Continuity Center, private subnets by default.

## Corrected

- Enhanced backup policy: frequencies are every 4, 6, 8, 12 **or 24** hours (24 was missing). Trusted Launch VMs need Enhanced in the portal; newer CLI/PowerShell/API versions also allow Standard.

## Study plan

The 7-week plan was over-packed: at 1.75 h/day, unfinished topics rolled forward every day and new topics only finished on day 49, leaving no real revision week. The plan is now **8 weeks (56 days)**, generated by `scripts/build_sprint_plan.py`: every day fits its time budget for any start weekday, all 82 objectives are taught by day 45, days 46–48 are catch-up, day 49 is the week 7 check, and week 8 is three mock exams, weak-area revision and exam-day preparation. A test now fails if any topic would roll to a later day.

## Limits of this check

This is still an AI review, not a review by a certified Azure trainer. Microsoft changes the portal and services often. Use Microsoft's free official AZ-104 Practice Assessment as the independent readiness check.
