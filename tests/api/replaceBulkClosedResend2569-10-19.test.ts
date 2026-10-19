// @vitest-environment node
/**
 * 19 ต.ค. 2569 (เจ้าของ)
 * - แท็บส่งคนแทน: ปุ่ม "สลับเป็น AI" (เว้น WL) · "ยกเลิกสายเลยเวลา" (เว้น AI ที่โทรจริง)
 * - ใบขอปิดแล้ว = ลิงก์สมัครปิดรับ · ส่ง AI ให้เลือกใบขอใหม่/ทักทาย · เหตุผลไม่บอกผิดเป็น "ไม่มีรายได้"
 * - ส่ง AI ใหม่ ให้สายที่ส่งถึง Lumos แล้วเงียบ (คนกดเท่านั้น)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isReplaceAllAiCandidate, isReplacePastCancelable } from '../../src/lib/irecruitReplaceSync';
import { aiQueueStatusOf } from '../../src/lib/applicantAiQueueStatus';

const read = (p: string) => readFileSync(p, 'utf8');
const NOW = new Date('2026-10-19T07:00:00Z');
const row = (o: Record<string, unknown>) => ({
  follow_team: 'replacement',
  source_ref: 'irecruit-replace:J1:confirm:abc',
  cancelled: false,
  completed_at: null,
  staff_call_outcome: null,
  call_outcome: null,
  call_mode: 'manual',
  replace_type: 'EX',
  time_tbd: false,
  scheduled_at: '2026-10-19T09:00:00Z',
  ...o,
});

describe('ยกเลิกสายเลยเวลา', () => {
  it('คนโทรที่เลยเวลาและไม่มีผล = ยกเลิก · มีผล/ลงผลแล้ว/ยกเลิกแล้ว = ไม่แตะ', () => {
    expect(isReplacePastCancelable(row({ scheduled_at: '2026-10-19T06:00:00Z' }), NOW)).toBe(true);
    expect(isReplacePastCancelable(row({ scheduled_at: '2026-10-19T06:00:00Z', staff_call_outcome: 'going' }), NOW)).toBe(false);
    expect(isReplacePastCancelable(row({ scheduled_at: '2026-10-19T06:00:00Z', cancelled: true }), NOW)).toBe(false);
    expect(isReplacePastCancelable(row({}), NOW)).toBe(false);
  });
  it('สาย AI: ที่โทรจริง (มีผล) ไม่แตะ · ไม่มีผลเว้น 3 ชม. ล่าสุด (ผลกลับช้า)', () => {
    expect(isReplacePastCancelable(row({ call_mode: 'ai', scheduled_at: '2026-10-18T06:00:00Z', call_outcome: 'acknowledged' }), NOW)).toBe(false);
    expect(isReplacePastCancelable(row({ call_mode: 'ai', scheduled_at: '2026-10-19T05:00:00Z' }), NOW)).toBe(false);
    expect(isReplacePastCancelable(row({ call_mode: 'ai', scheduled_at: '2026-10-19T03:00:00Z' }), NOW)).toBe(true);
  });
  it('ฝั่งเซิร์ฟเวอร์: ไม่ยิง Lumos · เว้น AI ที่มีผล', () => {
    const src = read('api/_lib/irecruitReplaceSync.ts');
    const fn = src.slice(src.indexOf('export async function cancelPastReplaceCalls'));
    expect(fn).toContain("coalesce(q.last_outcome, q.result->>'outcome') is not null");
    expect(fn).toContain("interval '3 hours'");
    expect(fn).not.toContain('cancelPushedReminder');
  });
});

describe('สลับเป็น AI (เว้น WL)', () => {
  it('เฉพาะสายคนโทรที่ยังไม่ถึงเวลา ดึงจาก iRecruit ไม่ใช่ WL', () => {
    expect(isReplaceAllAiCandidate(row({}), NOW)).toBe(true);
    expect(isReplaceAllAiCandidate(row({ replace_type: 'WL' }), NOW)).toBe(true); // WL รวมด้วย (19 ต.ค. 2569)
    expect(isReplaceAllAiCandidate(row({ call_mode: 'ai' }), NOW)).toBe(false);
    expect(isReplaceAllAiCandidate(row({ scheduled_at: '2026-10-19T06:59:00Z' }), NOW)).toBe(false);
    expect(isReplaceAllAiCandidate(row({ source_ref: 'manual-replace:x' }), NOW)).toBe(false);
    expect(isReplaceAllAiCandidate(row({ time_tbd: true }), NOW)).toBe(false);
  });
  it('ปุ่มอยู่บนแท็บส่งคนแทน มีป๊อปยืนยัน · API ทำเบื้องหลังแล้วส่งแผนให้ Lumos', () => {
    expect(read('src/pages/follow/FollowPage.tsx')).toContain('<ReplaceBulkActions items={items}');
    const ui = read('src/components/follow/ReplaceBulkActions.tsx');
    expect(ui).toContain('<AlertDialog');
    const api = read('api/_handlers/irecruit-replace-sync.ts');
    expect(api).toContain("body.action === 'all_ai'");
    expect(api).toContain("body.action === 'cancel_past'");
    const lib = read('api/_lib/irecruitReplaceSync.ts');
    const fn = lib.slice(lib.indexOf('export async function convertReplaceManualToAi'));
    expect(fn).not.toContain("<> 'WL'");
    expect(fn).toContain('replanFollowSetWithLumos');
  });
});

describe('ใบขอปิดแล้ว', () => {
  it('ลิงก์สมัครขึ้นปิดรับ · ส่งใบไม่ได้', () => {
    expect(read('api/_handlers/public/apply-link.ts')).toContain('await isRequestClosedForApply(posting.jobId)');
    expect(read('api/_handlers/public/apply.ts')).toContain('if (await isRequestClosedForApply(v.jobId)) return sendError(res, 409');
    const helper = read('api/_lib/requestClosedForApply.ts');
    expect(helper).toContain("return item?.status === 'closed';");
    expect(helper).toContain('return false;');
  });
  it('ตัวส่ง AI บอกเหตุ "ใบขอปิดแล้ว" แทน "ไม่มีรายได้" · ส่ง AI ให้เลือกใบขอใหม่/ทักทาย', () => {
    const d = read('api/_lib/lumosDispatch.ts');
    expect(d.indexOf('if (requestClosed)')).toBeLessThan(d.indexOf('reason: NO_INCOME_REASON'));
    const cc = read('api/_handlers/application-call-choice.ts');
    expect(cc).toContain('closedJobIds.has(r.job_id.trim())');
    expect(read('src/components/recruit-rm/RmWorkspace.tsx')).toContain('openJobIds !== null && !openJobIds.has(r.job_id.trim())');
  });
});

describe('ส่ง AI ใหม่ (สายเงียบเกิน 24 ชม.)', () => {
  it('ป้ายไม่บอกให้คนโทรแล้ว · ปุ่มบนแถวมีคำ', () => {
    const s = aiQueueStatusOf({ last_call_status: 'pending', last_call_attempts: 1, last_call_followup: 'needs_human', last_call_push_state: 'push_gave_up' });
    expect(s?.kind).toBe('silent');
    expect(s?.sub).toBe('เกิน 24 ชม. กดส่ง AI ใหม่ได้');
    expect(read('src/components/recruit-rm/RmTable.tsx')).toContain("resend ? 'ส่ง AI ใหม่' : 'บันทึกผล'");
  });
  it('API ตั้งโทรซ้ำตอนนี้เฉพาะแถวเงียบ (ตัวส่งซ้ำยิงเป็นรอบใหม่) — ไม่มีรอบอัตโนมัติ', () => {
    const cc = read('api/_handlers/application-call-choice.ts');
    expect(cc).toContain("set followup_state = 'retry_scheduled', next_attempt_at = now()");
    expect(cc).toContain("and push_state = 'push_gave_up' and followup_state = 'needs_human'");
  });
});
