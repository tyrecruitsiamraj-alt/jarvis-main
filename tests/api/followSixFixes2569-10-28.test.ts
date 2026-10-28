/**
 * ไล่ผังโทรติดตามทุกทางแยกจากโค้ด แล้วเจอ 6 ข้อ — เจ้าของ Choice 28 ต.ค. 2569 "แก้ครบ 6 ข้อ"
 * 1. คนแทนหลายใบ: ตอบสายเช้าแล้วสายคอนเฟิร์มของใบพรุ่งนี้หายไปด้วย
 * 2. ถอนแผนที่ Lumos ไม่สำเร็จ = จดแค่ log
 * 3. ไม่มีผลกลับ = ค้างฝั่ง AI ไม่ขึ้นให้คนตาม
 * 4. ขอเลื่อน = ไม่ขึ้นคิวคนต้องโทร
 * 5. คนลง ไป/ไม่ไป เอง = สายที่เหลือของวันยังโทร
 * 6. ใบคนแทนไม่มีเบอร์/ไม่มีวันเข้างาน = ข้ามเงียบ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import type { FollowDayCall, FollowDayPerson, FollowPlanningRound } from '@/lib/followPlanning';
import { followQueueGroupOf } from '@/lib/followCallQueue';
import { canRecordStaffCall, FOLLOW_STAFF_ANSWER_STOP_OUTCOMES, isAiFinalOutcome } from '@/lib/followStaffCall';
import { followSameStopUnitSql } from '../../api/_lib/followDayScope';
import { failedCancelRetrySql } from '../../api/_lib/followCancelResend';

const read = (p: string) => readFileSync(p, 'utf8');
const NOW = new Date('2026-10-28T02:00:00Z'); // 09:00 ไทย

function entry(over: Partial<FollowEntry>): FollowEntry {
  return {
    id: over.id ?? 'e',
    recipient_name: 'สมชาย ใจดี',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    scheduled_at: '2026-10-28T01:00:00Z',
    cancelled: false,
    call_mode: 'ai',
    call_status: 'pending',
    call_outcome: null,
    ...over,
  } as FollowEntry;
}
function call(e: FollowEntry, state: FollowPlanningRound['state'], category: FollowDayCall['category']): FollowDayCall {
  return { row: {} as FollowDayCall['row'], round: { entry: e, state, ymd: '2026-10-28', time: null } as FollowPlanningRound, slot: 1, category };
}
function person(calls: FollowDayCall[]): FollowDayPerson {
  const row = { group: { key: 'k', name: 'สมชาย ใจดี', phone: '0812345678', unitName: 'หน่วย' } } as unknown as FollowDayPerson['row'];
  return { row, calls: calls.map((c) => ({ ...c, row })), headline: 'waiting' };
}

describe('1. "วันนั้น" ของคนแทน = ใบงานเดียวกันเท่านั้น', () => {
  it('คนแทน (iRecruit/คีย์เอง) เทียบหัว+เลขใบ · คนเริ่มงานเทียบวันไทย', () => {
    const sql = followSameStopUnitSql('f', 'me.source_ref', 'me.scheduled_at');
    expect(sql).toContain("coalesce(me.source_ref, '') ~ '^(irecruit|manual)-replace:'");
    expect(sql).toContain("split_part(coalesce(f.source_ref, ''), ':', 2) = split_part(me.source_ref, ':', 2)");
    expect(sql).toContain("(f.scheduled_at at time zone 'Asia/Bangkok')::date = (me.scheduled_at at time zone 'Asia/Bangkok')::date");
    // คนแทนไม่มีทาง "วันเดียวกัน" แล้ว (เดิม OR วันเดียวกัน ⇒ สายคอนเฟิร์มใบพรุ่งนี้หาย)
    expect(sql).toMatch(/case when[\s\S]*then[\s\S]*else[\s\S]*end/);
  });
  it('ทั้ง AI ตอบ · คนลงผล · ปิดงาน ใช้ตัวเดียวกัน', () => {
    expect(read('api/_lib/callFollowup.ts')).toContain("${followSameStopUnitSql('f', 'me.source_ref', 'me.scheduled_at')}");
    expect(read('api/_handlers/follow.ts')).toContain("${followSameStopUnitSql('f', '$6::text', '$5::timestamptz')}");
  });
  it('แผนที่ Lumos ยังเหลือสายอื่น = ส่งแผนใหม่จากสายที่เหลือ ไม่ยกเลิกทั้งแผน', () => {
    const src = read('api/_lib/callFollowup.ts');
    const fn = src.slice(src.indexOf('export async function withdrawFollowPlanAtLumos'));
    expect(fn).toContain('const rest = await pendingFollowInPlan(ref);');
    expect(fn).toContain('await resyncFollowPlanWithLumos(rest, staffNameOfPhone)');
    expect(fn.indexOf('await cancelFollowPlanAtLumos(ref);')).toBeLessThan(fn.indexOf('resyncFollowPlanWithLumos'));
  });
});

describe('2. ถอนแผนไม่สำเร็จ = ลองใหม่', () => {
  it('จด cancel_failed แล้วตัวส่งซ้ำลองทุกนาทีจนกว่าจะเลยเวลาสาย', () => {
    expect(read('api/_lib/callFollowup.ts')).toContain('if (!ok) await markFollowCancelFailed(ref);');
    const sql = failedCancelRetrySql();
    expect(sql).toContain("x.push_state = 'cancel_failed'");
    expect(sql).toContain('e.scheduled_at > now()');
    expect(read('api/_lib/followPushRetryWorker.ts')).toContain('await retryFailedFollowCancels();');
  });
});

describe('3–4. คิวคนต้องโทร', () => {
  it('ส่ง AI แล้วเลย 15 นาทีไม่มีผล = ขึ้นให้คนตาม · ยังไม่ถึง 15 นาที = ยังเป็นของ AI', () => {
    const late = call(entry({ id: 'a', scheduled_at: '2026-10-28T01:40:00Z' }), 'overdue', 'overdue'); // เลย 20 นาที
    const p1 = person([late]);
    expect(followQueueGroupOf(p1.calls[0], p1, NOW)).toEqual({ group: 'staff', reason: 'AI ยังไม่มีผลกลับ · ให้คนตาม' });
    const fresh = call(entry({ id: 'b', scheduled_at: '2026-10-28T01:50:00Z' }), 'overdue', 'overdue'); // เลย 10 นาที
    const p2 = person([fresh]);
    expect(followQueueGroupOf(p2.calls[0], p2, NOW).group).toBe('ai');
  });
  it('ไม่มีผลกลับ แต่ AI ยังมีสายรอของคนนั้นในวันเดียวกัน = ยังไม่ให้คนโทรชน', () => {
    const late = call(entry({ id: 'a', scheduled_at: '2026-10-28T01:00:00Z' }), 'overdue', 'overdue');
    const later = call(entry({ id: 'c', scheduled_at: '2026-10-28T05:00:00Z' }), 'sent', 'waiting');
    const p3 = person([late, later]);
    expect(followQueueGroupOf(p3.calls[0], p3, NOW).group).toBe('ai');
  });
  it('ขอเลื่อน = คนต้องโทร (ให้คนโทรนัด) และลงผลบนสายนั้นได้', () => {
    const e = entry({ id: 'r', call_status: 'completed', call_outcome: 'reschedule_requested' });
    const c = call(e, 'result', 'pending');
    const p4 = person([c]);
    expect(followQueueGroupOf(p4.calls[0], p4, NOW)).toEqual({ group: 'staff', reason: 'ขอเลื่อน · ให้คนโทรนัด' });
    expect(canRecordStaffCall(e)).toBe(true);
    expect(isAiFinalOutcome('reschedule_requested')).toBe(false);
    for (const code of ['confirmed', 'declined', 'cancelled']) expect(isAiFinalOutcome(code)).toBe(true);
  });
});

describe('5. คนลง ไป/ไม่ไป = หยุดสายที่เหลือของวันนั้น', () => {
  it('ไป · ไม่ไป อยู่ในชุดหยุดวัน · server เรียกตัวหยุดเดียวกับวันหยุด/ลางาน', () => {
    expect(FOLLOW_STAFF_ANSWER_STOP_OUTCOMES).toEqual(['confirmed', 'declined']);
    const h = read('api/_handlers/follow.ts');
    expect(h).toContain('(FOLLOW_STAFF_ANSWER_STOP_OUTCOMES as readonly string[]).includes(v.value.outcome)');
    expect(h).toContain("stoppedIds = await stopRemainingFollowRounds(done, 'day');");
  });
});

describe('6. ใบคนแทนที่โทรไม่ได้ = กระดิ่ง', () => {
  it('ไม่มีเบอร์ (มีชื่อคนไปแทนแล้ว) · ไม่มีวันเข้างาน ⇒ แจ้งแอดมิน+หัวหน้า ครั้งเดียวต่อใบ', () => {
    const s = read('api/_lib/irecruitReplaceSync.ts');
    expect(s).toContain("dedupeKey: `irecruit_replace_${kind}:${String(r.job_id).trim()}`");
    expect(s).toContain("if ((r.fname ?? '').trim() || (r.lname ?? '').trim()) await notifyReplaceSheetProblem('no_phone', r);");
    expect(s).toContain("if ((r.fname ?? '').trim() || (r.lname ?? '').trim()) await notifyReplaceSheetProblem('no_date', r);");
    expect(s).toContain('AND h.want_date IS NULL AND h.date_add >= @addedSince');
  });
});
