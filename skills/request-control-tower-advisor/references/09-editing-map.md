# Editing Map

Use this file to know where to change the inside logic later.

## Business wording / dashboard labels

Edit documentation:

* skills/request-control-tower-advisor/references/02-dashboard-metric-definitions.md
* .cursor/rules/request-control-tower.mdc

Future code:

* src/components/dashboard/request-control/
* KPI card components
* work queue table labels

## Request date / effective date logic

Edit documentation:

* skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/requestLedger.ts
* src/lib/dashboard/request-control/calculations.ts
* src/lib/jobUrgency.ts

## SLA days and SLA status

Edit documentation:

* skills/request-control-tower-advisor/references/04-sla-rules.md

Future code:

* src/lib/dashboard/request-control/sla.ts

## Lifecycle mapping

Edit documentation:

* skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/lifecycle.ts

## Backlog equation / calculation

Edit documentation:

* skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/calculations.ts
* src/lib/dashboard/request-control/reconciliation.ts

## UI style / layout

Edit documentation:

* skills/request-control-tower-advisor/references/05-ui-design-rules.md

Future code:

* src/components/dashboard/request-control/

## Safe implementation / feature flag

Edit documentation:

* skills/request-control-tower-advisor/references/06-safe-implementation-rules.md
* .cursor/rules/request-control-tower.mdc

Future code:

* feature flag config
* dashboard routing/render logic

## Cursor prompt patterns

Edit:

* skills/request-control-tower-advisor/references/07-cursor-prompt-patterns.md

## Redteam / SWOT / pre-mortem checklist

Edit:

* skills/request-control-tower-advisor/references/08-redteam-premortem-checklist.md

## SQL mapping changes

Edit documentation first:

* skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* api/_lib/siamrajRequestControlAdapter.ts
* api/_handlers/request-control-dashboard.ts

Rule:
If new internal files are added later, update this editing map.

## Current related code (already in repo — do not rewrite blindly)

Existing Control Tower / analytics paths (read before parallel-layer work):

* `src/lib/dashboard/requestControlLedger.ts`
* `src/lib/dashboard/requestControlBridge.ts`
* `src/lib/dashboard/buildDashboardData.ts`
* `src/lib/dashboard/buildRequestControlSummaries.ts`
* `src/pages/dashboard/SupervisorDashboard.tsx`
* `src/components/dashboard/analytics/`
* `src/lib/requestControl.ts`
* `tests/api/requestControlLedger.test.ts`
* `tests/api/buildDashboardData.test.ts`
* `tests/api/demandFulfillmentBacklog.test.ts`
