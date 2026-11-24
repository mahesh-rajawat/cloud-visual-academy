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
