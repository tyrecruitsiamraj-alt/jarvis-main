/**
 * Destructive / hard-delete endpoints — production blockers or converted to soft archive.
 *
 * CONVERTED (soft archive + server audit):
 * - DELETE /api/candidates?id=  → status='drop'
 * - DELETE /api/jobs?id=        → status='cancelled'
 * - DELETE /api/employees?id=   → status='inactive'
 *
 * STILL HARD DELETE (TODO — add deleted_at / is_active):
 * - DELETE /api/candidate-interviews?id=
 *
 * ROSTER MAINTENANCE (intentional row deletes on config tables):
 * - POST /api/job-staff (add/remove/rename) — audited; not user entity deletes
 */

export const HARD_DELETE_BLOCKERS = [
  'DELETE /api/candidate-interviews',
] as const;
