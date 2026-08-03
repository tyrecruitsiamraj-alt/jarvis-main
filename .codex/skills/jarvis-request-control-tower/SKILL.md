---
name: jarvis-request-control-tower
description: Work safely in the Jarvis Workforce Management project, especially Request Control Tower, staffing request dashboards, SLA/backlog/fulfillment/cancellation metrics, matching, public apply, Siamraj/Lumos API adapters, Vercel API handlers, React dashboard UI, tests, and implementation planning. Use when Codex needs to inspect, explain, modify, test, or review this repo.
---

# Jarvis Request Control Tower

## Overview

Use this skill as the project onboarding and safety rail for Jarvis. It combines the repo architecture map with the non-negotiable Request Control Tower business rules so implementation stays aligned with the dashboard semantics, tests, rollback expectations, and Thai UI vocabulary.

The source of truth for Request Control Tower domain rules remains `.claude/skills/request-control-tower-advisor/`. This `.codex` skill is a Codex-facing project adapter: read it first, then load the linked `.claude` references when work touches those rules.

## First Reads

Always start by reading:

- `AGENTS.md`
- `references/01-project-overview.md`
- `references/02-code-map.md`
- `references/03-workflow-and-validation.md`

For Request Control Tower metric, dashboard, SLA, backlog, lifecycle, fulfillment, cancellation, or forecast work, also read the `.claude` source-of-truth bundle listed in `AGENTS.md` before changing code.

## Non-Negotiables

- Do not mix `หาได้แล้ว` with `ปิดครบใบขอ`.
- Do not count cancelled positions as fulfilled.
- Do not silently treat snapshot `inform_qty` as exact monthly fulfillment.
- If a fulfillment/cancellation event date is missing, mark affected metrics as `snapshot_fallback`.
- Preserve the existing dashboard and types as rollback. Use parallel layer, adapter, read-only API, feature flag, tests, and reconciliation.
- Update tests whenever calculation logic changes.
- Update `.claude/skills/request-control-tower-advisor/references/09-editing-map.md` when adding new internal project files.

Core equation:

```text
ยอดค้างต้นงวด + ขอใหม่ - หาได้แล้ว - ยกเลิก = เหลือหา
```

## Standard Workflow

1. Classify the request: dashboard metric, API, matching, public apply, auth/RBAC, UI, data import, documentation, or test-only.
2. Read the relevant code paths from `references/02-code-map.md`; use `rg` to confirm current symbols and callers.
3. For Request Control Tower work, restate the metric unit: positions or requests. Name data source fields and event dates before coding.
4. Add or update acceptance tests before or alongside calculation changes.
5. Keep changes narrow and backward-compatible. Do not rename/delete existing `DashboardData` fields or SQL write behavior unless explicitly asked.
6. Run targeted tests first, then broader tests or build when risk justifies it.
7. Summarize changed files, business impact, validation run, and remaining risk.

## Response Style

For the project owner, start with an executive summary, give one recommendation, explain business impact, then list implementation or verification steps. Include Cursor-ready prompts only when useful.

## References

- `references/01-project-overview.md` - stack, runtime, routes, data sources, commands.
- `references/02-code-map.md` - code paths and tests by feature area.
- `references/03-workflow-and-validation.md` - safe implementation workflow, metric rules, validation commands.
