/**
 * ตอบ AI ว่า "ไม่ไป" → หยุดแค่สายที่เหลือของวันนั้น ไม่แตะแผนวันอื่นที่ Lumos (เจ้าของ 16 ต.ค. 2569 Choice)
 * เจ้าของถาม "ทำไมถึงไม่โทรหาพนักงาน" — พนักงาน A (ตอบไม่ไป 13 ต.ค.) ไม่ถูกโทร 14–16 ต.ค. · พนักงาน B (14 ต.ค.) ไม่ถูกโทร 15–16 ต.ค.
 * ต้นเหตุ: ยกเลิกแผนทุกวันที่ Lumos (DELETE) แล้วตัวซ่อมส่งกลับ 1 นาทีหลัง ⇒ Lumos รับแต่ไม่โทร
 * (ปัญหาเดียวกับ docs/lumos/lumos-issues-2569-10-12.md "รับแล้วไม่โทร — ส่งไม่กี่วิหลัง DELETE แผนเก่าของเบอร์เดียวกัน")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const follow = readFileSync('api/_lib/callFollowup.ts', 'utf8');
const cancel = readFileSync('api/_lib/followLumosCancel.ts', 'utf8');

describe('🔴 ตอบไม่ไป = ยกเลิกเฉพาะวันนั้น', () => {
  it('ยกเลิกเฉพาะแถววันเดียวกับสายที่ตอบ (เวลาไทย) · ส่งคนแทน = ใบงานเดียวกัน (SQT)', () => {
    const fn = follow.slice(follow.indexOf('export async function cancelFollowSetAfterDecline'));
    const sql = fn.slice(0, fn.indexOf('returning q.person_ref, q.plan_ref'));
    // 28 ต.ค. 2569: ตัวตัดสินเดียว (`followDayScope.ts`) — คนเริ่มงาน = วันเดียวกัน · คนแทน = ใบงานเดียวกันเท่านั้น
    expect(sql).toContain("${followSameStopUnitSql('f', 'me.source_ref', 'me.scheduled_at')}");
    const scope = readFileSync('api/_lib/followDayScope.ts', 'utf8');
    expect(scope).toContain("else (${f}.scheduled_at at time zone 'Asia/Bangkok')::date = (${meAt} at time zone 'Asia/Bangkok')::date");
    expect(scope).toContain("and split_part(coalesce(${f}.source_ref, ''), ':', 2) = split_part(${meRef}, ':', 2)");
    // ยกเลิกที่ Lumos เฉพาะแผนของแถวที่ยกเลิก — แผนยังเหลือสายอื่น = ส่งแผนใหม่ · ไม่เหลือ = ผ่านตัวกันข้อ 9 ต.ค. ตัวเดียว
    expect(follow).toContain('await cancelFollowPlanAtLumos(ref);');
    expect(fn).toContain('await withdrawFollowPlanAtLumos(ref)');
  });
});

describe('🔴 แผน "ตายตั้งแต่ส่ง" ไม่ DELETE ซ้ำ', () => {
  it('หัวขบวนส่งภายใน 10 นาทีหลังคำตอบไม่ไปของชุดเดียวกัน + ยังไม่มีผล = ถือว่าจบแล้ว (ส่งแผนใหม่ได้เลยไม่ต้อง DELETE)', () => {
    expect(cancel).toContain('export const DEAD_AFTER_DECLINE_MINUTES = 10;');
    expect(cancel).toContain("x.last_outcome = 'declined'");
    expect(cancel).toMatch(/between h\.push_accepted_at - interval '\$\{DEAD_AFTER_DECLINE_MINUTES\} minutes'\s+and h\.push_accepted_at/);
    expect(cancel).toContain('coalesce(y.plan_ref, y.person_ref) = $1 and y.result is not null');
  });
});
