---
name: request-control-tower-advisor
description: use when working on request control tower, staffing request dashboards, demand, fulfillment, full closure, cancellation, resolution, backlog, sla, lifecycle trend, root cause ranking, cursor implementation prompts, safe architecture, redteam, swot, or pre-mortem for this project.
---

# Request Control Tower Advisor

Use this skill for all work related to the Request Control Tower project.

The goal is to build a production-ready executive and operational dashboard for staffing/workforce requests.

The dashboard must explain:

1. Demand: how many positions/requests came in.
2. Fulfillment: how many positions were found/informed.
3. Full Closure: how many requests were fully fulfilled.
4. Cancellation: how many positions/requests were cancelled.
5. Resolution: which requests no longer have remaining positions.
6. Backlog: how many positions remain to be filled.
7. SLA: which requests are on track, at risk, or breached.
8. Lifecycle: whether demand comes from resignation, replacement, increase headcount, new site, or other.
9. Root Cause: which site/unit/customer/owner causes recurring demand, resignation, backlog, or SLA breach.

## Non-negotiable logic

Never mix these concepts:

* หาได้แล้ว is not the same as ปิดครบใบขอ.
* ยกเลิก is not the same as หาได้แล้ว.
* จบงานแล้ว is not always the same as ปิดครบใบขอ.

Core equation:
ยอดค้างต้นงวด + ขอใหม่ - หาได้แล้ว - ยกเลิก = เหลือหา

## Before changing code

Always read:

* references/02-dashboard-metric-definitions.md
* references/03-request-ledger-logic.md
* references/04-sla-rules.md
* references/06-safe-implementation-rules.md
* references/09-editing-map.md

## Safe implementation rule

Do not rewrite the existing dashboard directly.

Use:

1. Parallel calculation layer
2. Feature flag
3. Adapter
4. Read-only API
5. Backward-compatible types
6. Preview route
7. Unit tests
8. Reconciliation

## Output style

When responding to the project owner:

1. Start with executive summary.
2. Give one clear recommendation.
3. Explain business impact.
4. Provide implementation steps.
5. Include Cursor-ready prompts when useful.
