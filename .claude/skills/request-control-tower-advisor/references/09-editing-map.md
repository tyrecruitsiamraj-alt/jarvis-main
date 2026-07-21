# Editing Map

Use this file to know where to change the inside logic later.

## Business wording / dashboard labels

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/02-dashboard-metric-definitions.md
* .cursor/rules/request-control-tower.mdc

Future code:

* src/components/dashboard/request-control/
* KPI card components
* work queue table labels

## Request date / effective date logic

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/requestLedger.ts
* src/lib/dashboard/request-control/calculations.ts
* src/lib/jobUrgency.ts

## SLA days and SLA status

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/04-sla-rules.md

Future code:

* src/lib/dashboard/request-control/sla.ts

## Lifecycle mapping

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/lifecycle.ts

## Backlog equation / calculation

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

Future code:

* src/lib/dashboard/request-control/calculations.ts
* src/lib/dashboard/request-control/reconciliation.ts

## UI style / layout

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/05-ui-design-rules.md

Future code:

* src/components/dashboard/request-control/

## Safe implementation / feature flag

Edit documentation:

* .claude/skills/request-control-tower-advisor/references/06-safe-implementation-rules.md
* .cursor/rules/request-control-tower.mdc

Future code:

* feature flag config
* dashboard routing/render logic

## Cursor prompt patterns

Edit:

* .claude/skills/request-control-tower-advisor/references/07-cursor-prompt-patterns.md

## Redteam / SWOT / pre-mortem checklist

Edit:

* .claude/skills/request-control-tower-advisor/references/08-redteam-premortem-checklist.md

## SQL mapping changes

Edit documentation first:

* .claude/skills/request-control-tower-advisor/references/03-request-ledger-logic.md

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
* `src/pages/matching/MatchingPage.tsx`
* `api/_lib/candidateProposals.ts`
* `migrations/047_candidate_proposals_branch.sql`
* `tests/api/unitBranchOverride.test.ts`

## Scrap & Content work requests from Matching

* `migrations/045_job_posting_requests.sql` — original request table
* `migrations/050_job_posting_request_type.sql` — backward-compatible Content/Scraping discriminator
* `api/_lib/jobPostingRequests.ts` — request adapter and validation
* `api/_handlers/matching-job-postings.ts` — read/write API
* `src/lib/jobPostingRequestsApi.ts` — frontend API adapter
* `src/pages/matching/MatchingPage.tsx` — request-type selection at source
* `src/pages/matching/JobPostingsPage.tsx` — request tracking UI
* `tests/api/jobPostingRequests.test.ts` — request type/status contract tests

## Public applications from /apply

* `migrations/048_public_job_applications.sql` — application table
* `migrations/049_public_job_applications_structured.sql` — structured fields (prefix/name/age/gender/address)
* `api/_lib/publicApplications.ts` — validation + Thai phone/age normalization
* `api/_handlers/public/apply.ts` — public POST endpoint (rate-limited)
* `src/components/jobs/PublicApplyDialog.tsx` — application form dialog
* `src/components/jobs/JobBoardView.tsx` — apply buttons on /apply board
* `tests/api/publicApply.test.ts` — validation contract tests
