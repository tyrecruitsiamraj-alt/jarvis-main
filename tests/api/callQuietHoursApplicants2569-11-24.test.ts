import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_CALL_FOLLOWUP_POLICY, isFollowQueueRef, policyForQueueRef, shiftOutOfQuietHours } from '../../src/lib/callFollowupPolicy';
import { decideLumosPushRetry, isQuietAt, LUMOS_PUSH_RETRY_DEFAULTS } from '../../src/lib/lumosPushRetryPolicy';

/**
 * ช่วงห้ามโทร 20:00–08:00 เฉพาะสายผู้สมัคร (เจ้าของ 24 พ.ย. 2569)
 * เห็นจริง: ผู้สมัครกรอกตี 4 (23 พ.ย. 04:14 · 04:19 · 04:34) แล้ว AI โทรภายใน 2 นาที · สายติดตามเริ่มงานครึ่งหนึ่งนัด 04:00–07:59 / 20:00
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');
const policy = { ...DEFAULT_CALL_FOLLOWUP_POLICY, quietFromHour: 20, quietToHour: 8 };
const bkk = (s: string) => new Date(`${s}+07:00`);

describe('สายไหนใช้ช่วงห้ามโทร', () => {
  it('สายติดตามเริ่มงาน (follow-<id> / คิว follow) ไม่มีช่วงห้าม · สายผู้สมัครมี', () => {
    expect(isFollowQueueRef('follow-8f2c1a')).toBe(true);
    expect(isFollowQueueRef('follow')).toBe(true);
    expect(isFollowQueueRef('app-2f44b07b-b1d3-4c34')).toBe(false);
    expect(isFollowQueueRef('greet')).toBe(false);
    const at = bkk('2026-11-23T04:14:00');
    expect(isQuietAt(at, policyForQueueRef(policy, 'follow-8f2c1a'))).toBe(false);
    expect(isQuietAt(at, policyForQueueRef(policy, 'app-2f44b07b'))).toBe(true);
    expect(shiftOutOfQuietHours(at, policyForQueueRef(policy, 'app-2f44b07b')).toISOString()).toBe(bkk('2026-11-23T08:00:00').toISOString());
  });
  it('สองทุ่มตรงเริ่มห้าม · แปดโมงตรงโทรได้', () => {
    expect(isQuietAt(bkk('2026-11-24T19:59:00'), policy)).toBe(false);
    expect(isQuietAt(bkk('2026-11-24T20:00:00'), policy)).toBe(true);
    expect(isQuietAt(bkk('2026-11-25T08:00:00'), policy)).toBe(false);
  });
  it('แถวที่รอพ้นช่วง: ตี 4 รอ · 07:05 ยังรอ · 08:00 ยิงพร้อมเวลานัด 08:00 ขึ้นไป', () => {
    const due = bkk('2026-11-23T08:00:00');
    expect(decideLumosPushRetry(due, LUMOS_PUSH_RETRY_DEFAULTS, policy, bkk('2026-11-23T04:15:00'))).toEqual({ action: 'wait', reason: 'quiet_hours' });
    expect(decideLumosPushRetry(due, LUMOS_PUSH_RETRY_DEFAULTS, policy, bkk('2026-11-23T07:05:00'))).toEqual({ action: 'wait', reason: 'quiet_hours' });
    const d = decideLumosPushRetry(due, LUMOS_PUSH_RETRY_DEFAULTS, policy, bkk('2026-11-23T08:00:30'));
    expect(d.action).toBe('push');
    if (d.action === 'push') expect(d.scheduledAt.getTime()).toBeGreaterThanOrEqual(due.getTime());
  });
});

describe('ต่อสายครบทุกทาง', () => {
  it('รอบแรกหลังเข้าคิว: ช่วงห้ามโทร = ไม่ยิง จด quiet_wait', () => {
    const t = read('api/_lib/lumosPushTracking.ts');
    expect(t).toContain("export const QUIET_WAIT_PUSH_STATE = 'quiet_wait';");
    expect(t).toContain('if (isQuietAt(new Date(), policy)) {');
  });
  it('ตัวส่งซ้ำหยิบแถว quiet_wait · โทรซ้ำของสายติดตามไม่รอช่วงห้าม', () => {
    const w = read('api/_lib/lumosPushRetryWorker.ts');
    expect(w).toContain("q.push_state in ('push_failed', '${QUIET_WAIT_PUSH_STATE}')");
    expect(w).toContain("const callPolicy = isFollow ? policyForQueueRef(policy, 'follow') : policy;");
  });
  it('เข้าคิว + รับผลโทร ใช้นโยบายตามชนิดสาย', () => {
    expect(read('api/_lib/lumosDispatch.ts')).toContain('const policy = policyForQueueRef(await getCallFollowupPolicy()');
    expect(read('api/_lib/callFollowup.ts')).toContain('policy: policyForQueueRef(await getCallFollowupPolicy(), row.person_ref),');
  });
  it('migration ตั้ง 20 → 8 แก้เฉพาะสองช่อง', () => {
    const sql = read('migrations/198_call_quiet_hours_applicants.sql');
    expect(sql).toContain(`'{"quietFromHour": 20, "quietToHour": 8}'::jsonb`);
    expect(sql).toContain("where id = 'default'");
  });
});
