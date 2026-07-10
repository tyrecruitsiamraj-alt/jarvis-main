# Safe Implementation Rules

Do not rewrite the existing dashboard directly.

Use safe architecture:

1. Parallel calculation layer
2. Feature flag
3. Adapter
4. Read-only API
5. Backward-compatible types
6. Preview route
7. Unit tests
8. Reconciliation

Recommended future code folder:
src/lib/dashboard/request-control/

* types.ts
* adapters.ts
* requestLedger.ts
* fulfillmentLedger.ts
* calculations.ts
* sla.ts
* lifecycle.ts
* reconciliation.ts
* mock.ts
* index.ts

Do not delete or rename existing DashboardData fields.

If needed, extend safely:
type EnhancedDashboardData = DashboardData & {
requestControl?: RequestControlDashboardData;
};

Feature flag:
VITE_REQUEST_CONTROL_TOWER_ENABLED=true

When enabled:
show Request Control Tower UI.

When disabled:
show existing Analytics Dashboard exactly as before.

Data quality rule:
Monthly “หาได้แล้ว” should use fulfillment event date when available.
If only current inform_qty snapshot is available, mark as snapshot_fallback and show:
“ประมาณการจากสถานะล่าสุด”
