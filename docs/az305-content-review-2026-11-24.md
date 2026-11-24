# AZ-305 content review (24 November 2026)

Built against the official AZ-305 study guide, **skills measured as of 17 April 2026**: 49 objectives in four domains
(identity, governance and monitoring 25–30%; data storage 20–25%; business continuity 15–20%; infrastructure 30–35%).

## What exists

| Item | Count |
|---|---|
| Lessons (easy walkthrough + full lesson) | 20 |
| Design trainers ("which design fits?") | 20 groups, 34 choosers |
| Composite SLA calculator | 1 (in the high availability lesson) |
| Exam-style questions | 147 (3 per objective) |
| Real-Azure labs (free or near-free) | 8 |
| Study plan | 35 days: topics in weeks 1–4, mock exams and revision in week 5 |

The coverage validator reports 49/49 objectives complete (lesson, tested trainer, at least two applied questions, official docs).

## Facts checked against Microsoft's documentation source

Microsoft Learn rate-limited automated requests during the review, so facts were checked in Microsoft's public
documentation repositories (MicrosoftDocs/azure-docs, sql-docs, azure-monitor-docs, entra-docs), which publish the same pages.

| Claim | Result |
|---|---|
| Hyperscale: up to 128 TB, up to 30 named replicas | Confirmed |
| Serverless auto-pause | **Corrected**: available in General Purpose **and** Hyperscale (lesson said General Purpose only) |
| Geo-restore RPO 1 h / RTO 12 h; geo-replication RPO 5 s | **Corrected**: Microsoft now states geo-restore RTO/RPO "typically minutes or hours"; failover groups and geo-replication RTO typically under 60 seconds with RPO near zero (depends on unreplicated changes); zone redundancy RTO under 30 seconds, RPO 0 |
| Azure SQL "free offer" | **Corrected** name and link: now the Azure SQL Database **free tier** (100,000 vCore seconds and 32 GB of data per database per month) |
| Azure Blueprints | **Corrected**: being retired on **31 January 2027** (phased); use template specs, deployment stacks and policy |
| Storage queues vs Service Bus comparison link | **Corrected** link (page is `service-bus-azure-and-service-bus-queues-compared-contrasted`) |
| Azure Cache for Redis | Confirmed retiring 30 September 2028, new caches blocked in phases from 2026; Azure Managed Redis recommended. Date added to the lesson |
| Azure AD B2C closed to new customers from 1 May 2025; External ID is the customer identity solution | Confirmed |
| Log Analytics: Analytics retention up to 2 years, total retention up to 12 years; Analytics, Basic and Auxiliary plans | Confirmed |
| Managed HSM: single-tenant, FIPS 140-3 Level 3 | Confirmed |
| Management groups: up to six levels of depth | Confirmed |
| Storage queues when a queue must exceed 80 GB; Service Bus Premium messages up to 100 MB | Confirmed |
| Functions Flex Consumption: scale to zero, VNet integration | Confirmed |
| Virtual Network Manager security admin rules are evaluated before NSGs | Confirmed |
| Storage Mover migrates SMB/NFS shares to Azure Files and Blob | Confirmed |

Documentation links: every lesson, lab and question link is checked by `scripts/check_doc_links.py`, which also runs
weekly on GitHub (workflow "Check documentation links").

## Limits

This is an AI-written and AI-reviewed track, not reviewed by a certified Azure architect. AZ-305 tests judgement across
several requirements at once, including long case studies; use Microsoft's free AZ-305 practice assessment as the
independent readiness check.
