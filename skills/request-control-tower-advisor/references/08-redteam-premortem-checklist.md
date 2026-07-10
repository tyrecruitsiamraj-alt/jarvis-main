# Redteam and Pre-mortem Checklist

Before shipping, check:

1. Are หาได้แล้ว and ปิดครบใบขอ clearly separated?
2. Are cancelled positions excluded from fulfilled positions?
3. Does monthly หาได้แล้ว use event dates?
4. If event dates are missing, is snapshot_fallback shown?
5. Does backlog equation reconcile?
6. Can every KPI drill down to real requests?
7. Does SLA use correct start date by request kind?
8. Does lifecycle mapping preserve raw request action name?
9. Is the old dashboard still available behind feature flag?
10. Are unit tests included for core cases?
11. Does UI avoid overcrowding?
12. Does the first screen show what needs action today?
13. Can the dashboard be rolled back instantly?

Failure scenarios:

* Dashboard numbers do not match old Excel/report.
* Users confuse หาได้แล้ว with ปิดครบใบขอ.
* Snapshot inform_qty is treated as exact monthly fulfillment.
* Cancellation is counted as successful fulfillment.
* UI is too busy and users stop using it.
* Cursor rewrites existing dashboard and breaks production.
