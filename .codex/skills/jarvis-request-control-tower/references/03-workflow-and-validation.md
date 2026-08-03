# Workflow And Validation

## Before Editing

1. Run `git status --short` and do not overwrite user changes.
2. Read nearby code and tests before changing behavior.
3. For Request Control Tower work, read the `.claude/skills/request-control-tower-advisor/` references required by `AGENTS.md`.
4. Identify whether the change affects a position metric, request metric, UI label, event-date rule, API contract, or database schema.
5. Choose the smallest compatible surface: pure helper, adapter, read-only API, UI component, or test.

## Request Control Tower Metric Rules

Use these labels and meanings consistently:

- `ขอมา` = requested positions.
- `หาได้แล้ว` = fulfilled/informed positions.
- `ปิดครบใบขอ` = requests where fulfilled positions cover the full request.
- `ยกเลิก` = cancelled positions.
- `จบงานแล้ว` = requests with no remaining positions, whether by fulfillment or cancellation.
- `เหลือหา` = remaining positions.
- `งานค้าง / ยอดยกมา` = backlog.
- `หาได้บางส่วน` = partial fulfillment.

Minimum acceptance cases:

| ขอมา | หาได้แล้ว | ยกเลิก | เหลือหา | Status |
| ---: | ---: | ---: | ---: | --- |
| 5 | 3 | 0 | 2 | `partial` |
| 5 | 5 | 0 | 0 | `fully_fulfilled` |
| 5 | 2 | 3 | 0 | `partially_fulfilled_cancelled_remaining` |
| 5 | 0 | 5 | 0 | `cancelled_full` |

Monthly `หาได้แล้ว` must use fulfillment event dates when available. If only a current snapshot such as `inform_qty` exists, mark the result as `snapshot_fallback` and avoid claiming exact monthly fulfillment.

## Safe Implementation

- Preserve `DashboardData` fields and existing dashboard consumers.
- Add new data through backward-compatible extension fields.
- Prefer pure functions for calculation logic; tests should not need a live DB unless the change is explicitly integration-level.
- Keep dashboard API read-only.
- Use existing component patterns in `src/components/dashboard/analytics/` and shared UI primitives.
- When adding a route, register it in `api/_handlers/registry.ts` and ensure local and Vercel runtimes both see it.
- When adding migrations, keep numbering monotonic and update tests/adapters that assume schema shape.
- When adding internal project files for Request Control Tower, update `.claude/skills/request-control-tower-advisor/references/09-editing-map.md`.

## Validation Commands

Use targeted validation first:

```bash
npx vitest run tests/api/requestControlLedger.test.ts
npx vitest run tests/api/buildDashboardData.test.ts
npx vitest run tests/api/demandFulfillmentBacklog.test.ts
npx vitest run tests/api/demandForecast.test.ts
```

Use broader checks when touching shared APIs, routing, auth, types, or UI:

```bash
npm test
npm run build
npm run lint
```

Database and integration commands may require environment variables:

```bash
npm run db:ping
npm run db:ping:mssql
npm run db:migrate:status
```

If a validation command cannot run because environment variables, network, or external databases are unavailable, report that plainly and describe the targeted tests that did run.

## Review Checklist

- Metric unit is explicit: positions vs requests.
- Cancelled positions are not counted as fulfilled.
- `หาได้แล้ว`, `ปิดครบใบขอ`, `จบงานแล้ว`, and `ยกเลิก` remain separate.
- Backlog equation reconciles or exposes `diff` and reason.
- Missing event dates surface `snapshot_fallback`.
- SLA status uses request kind and correct due date.
- Drill-down can trace KPI values back to request records.
- Rollback path remains usable.
- Tests cover the changed business rule.
