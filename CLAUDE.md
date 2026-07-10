# Project Skill Router: Request Control Tower

When working on the Request Control Tower, staffing request dashboard, SLA dashboard, backlog dashboard, fulfillment logic, cancellation logic, lifecycle trend, root cause ranking, or any related Cursor/Claude implementation task, always read the following files first:

1. skills/request-control-tower-advisor/SKILL.md
2. skills/request-control-tower-advisor/references/01-business-context.md
3. skills/request-control-tower-advisor/references/02-dashboard-metric-definitions.md
4. skills/request-control-tower-advisor/references/03-request-ledger-logic.md
5. skills/request-control-tower-advisor/references/04-sla-rules.md
6. skills/request-control-tower-advisor/references/06-safe-implementation-rules.md
7. skills/request-control-tower-advisor/references/09-editing-map.md

Core non-negotiable rules:

* Do not mix “หาได้แล้ว” with “ปิดครบใบขอ”.
* Do not count cancelled positions as fulfilled.
* Do not silently treat snapshot inform_qty as exact monthly fulfillment.
* If fulfillment event date is missing, mark affected metrics as snapshot_fallback.
* Do not rewrite the existing dashboard directly.
* Use parallel layer + feature flag + adapter + read-only API.
* Existing dashboard must remain usable as rollback.
* Always update tests when changing calculation logic.
* Always update 09-editing-map.md if new internal files are added.

Primary equation:
ยอดค้างต้นงวด + ขอใหม่ - หาได้แล้ว - ยกเลิก = เหลือหา

Preferred UI vocabulary:

* ขอมา = requested positions
* หาได้แล้ว = fulfilled/informed positions
* ปิดครบใบขอ = fully fulfilled requests
* ยกเลิก = cancelled positions
* จบงานแล้ว = resolved requests
* เหลือหา = remaining positions
* งานค้าง / ยอดยกมา = backlog
* หาได้บางส่วน = partial fulfillment

## Project handbook

Human-readable project guide:

* docs/request-control-tower/HANDBOOK.md
