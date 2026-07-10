# Cursor Prompt Patterns

Use this prompt pattern for implementation:

Read CLAUDE.md and all files in skills/request-control-tower-advisor before making changes.

Implement Request Control Tower using:

* parallel calculation layer
* feature flag
* adapter
* read-only API
* backward-compatible types
* unit tests
* reconciliation

Do not delete old dashboard code.
Do not rename existing DashboardData fields.
Do not change SQL write behavior.
Do not silently use snapshot inform_qty as exact monthly fulfillment.
If event date is unavailable, use snapshot_fallback and show a data quality warning.

Always keep these concepts separate:

* หาได้แล้ว
* ปิดครบใบขอ
* ยกเลิก
* จบงานแล้ว
* เหลือหา
