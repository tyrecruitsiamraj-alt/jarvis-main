// @vitest-environment node
/**
 * หน้าติดตาม ส่งคนเริ่มงาน + ดูแลหลังเริ่มงาน (เจ้าของ 19 ต.ค. 2569)
 * 1 สรุปแผนโชว์ประกันต่อจากหน่วยงาน · 2 เพิ่มคนต้องเลือกประกัน · 3 การ์ดจบแล้ว (ตอบว่าไป) มีลูกค้า + ปุ่มโทร
 * 4.1 ตัวกรองเจ้าของงาน · 4.2 ป๊อปตั้งรอบแบบป๊อปย้าย แก้รอบเดิมได้ · 4.3 ลงผล 3 หัวข้อ (เก็บผลเดิม) · 4.4 ย้อนกลับไปติดตามครบ (เก็บสาย)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { followStepError } from '../../src/lib/followWizard';
import { insuranceOfRow } from '../../src/lib/followDayReport';
import { followCustomerOf } from '../../src/lib/followCustomer';
import { aftercareOwnerOptions, filterAftercareByOwner, pendingAftercareRounds, revertReopenIds } from '../../src/lib/aftercareSchedule';
import { buildScheduleReplaceRounds, draftsFromPending, validateMoveRounds } from '../../src/lib/followAftercareMove';
import { AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds';
import { AFTERCARE_SCORE_LABEL, aftercareResultNeedsScores } from '../../src/lib/aftercareContact';

const read = (p: string) => readFileSync(p, 'utf8');
const NOW = new Date('2026-10-19T03:00:00Z');

describe('1 · สรุปแผนติดตาม: ประกันต่อจากหน่วยงาน', () => {
  it('ของสายนั้นก่อน · ไม่มีใช้สายอื่นของชุด · หลายบรรทัดเป็นบรรทัดเดียว · ไม่มี = —', () => {
    expect(insuranceOfRow([{ insurance_type: 'ประกัน 7 วัน' }], { insurance_type: null })).toBe('ประกัน 7 วัน');
    expect(insuranceOfRow([], { insurance_type: 'ก\nข' })).toBe('ก / ข');
    expect(insuranceOfRow([], { insurance_type: null })).toBe('—');
    expect(read('src/components/follow/FollowDayReportDialog.tsx')).toContain('{r.insurance}</TableCell>');
  });
});

describe('2 · เพิ่มคนติดตาม: ต้องเลือกประกันถึงบันทึกได้', () => {
  const base = { firstName: 'ก', phone: '0812345678', topic: 'x', scheduleMode: false, scheduledAts: [], scheduleDays: [], roundTimes: [] };
  it('ติดตามคนเริ่มงาน = บังคับ · ส่งคนแทน = ไม่บังคับ', () => {
    expect(followStepError(4, { ...base, requireInsurance: true, insuranceType: '' })).toBe('เลือกประเภทประกันก่อนบันทึก');
    expect(followStepError(4, { ...base, requireInsurance: true, insuranceType: 'ประกัน 30 วัน' })).toBeNull();
    expect(followStepError(4, { ...base, requireInsurance: false, insuranceType: '' })).toBeNull();
    expect(read('src/pages/follow/FollowPage.tsx')).toContain('requireInsurance: !replaceView,');
  });
});

describe('3 · การ์ดจบแล้ว: ลูกค้า + ปุ่มโทร (แท็บตอบว่าไป)', () => {
  it('ค่าแรกที่มีของชุด · เบอร์ใช้โทรได้ = มีปุ่ม', () => {
    const c = followCustomerOf([{ customer_name: null }, { customer_name: 'บริษัท ก', customer_contact: 'คุณเอ', customer_phone: '081-234-5678' }]);
    // ผู้ติดต่อถอดแล้ว (20 ต.ค. 2569) — ค่าเดิมในฐานไม่โชว์
    expect(c).toEqual({ name: 'บริษัท ก', phone: '081-234-5678', tel: '0812345678' });
    expect(followCustomerOf([{ customer_name: ' ' }])).toBeNull();
    expect(followCustomerOf([{ customer_name: 'ก', customer_phone: 'ไม่มี' }])?.tel).toBeNull();
    const card = read('src/components/follow/FollowDayDoneCard.tsx');
    expect(card).toContain("const withCustomer = kind === 'agreed';");
    expect(card).toContain('href={`tel:${c.tel}`}');
    // มุมมอง "ต้องโทร" (ค่าเริ่ม) ช่องจบแล้ว — สายที่ตอบว่าไป
    const queue = read('src/components/follow/FollowCallQueue.tsx');
    expect(queue).toContain("it.group === 'done' && call.category === 'agreed' ? followCustomerOf(person.row.group.rounds) : null");
    expect(queue).toContain('โทรลูกค้า');
  });
});

describe('4.1 · ตัวกรองเจ้าของงาน', () => {
  it('ตัวเลือก ก-ฮ ไม่ซ้ำ · ว่าง = ทุกคน', () => {
    const people = [{ owner_name: 'แป๋ม' }, { owner_name: 'กุ้ง' }, { owner_name: 'แป๋ม' }, { owner_name: null }];
    expect(aftercareOwnerOptions(people)).toEqual(['กุ้ง', 'แป๋ม']);
    expect(filterAftercareByOwner(people, 'แป๋ม')).toHaveLength(2);
    expect(filterAftercareByOwner(people, '')).toHaveLength(4);
    expect(read('api/_handlers/aftercare.ts')).toContain('coalesce(u.name, f.created_by_name) as owner_name');
  });
});

describe('4.2 · ป๊อปตั้งรอบ: แก้รอบที่ตั้งไว้ได้', () => {
  const call = (id: string, at: string, o: Record<string, unknown> = {}) => ({
    id,
    recipient_phone: '0812345678',
    topic: AFTERCARE_TOPIC,
    cancelled: false,
    completed_at: null,
    call_outcome: null,
    scheduled_at: at,
    group_id: 'g1',
    call_mode: 'ai' as const,
    staff_phone: null,
    start_date: '2026-10-15',
    ...o,
  });
  it('สายที่ยังแก้ได้ = ชุดของสายที่ใกล้สุด · ตัดที่โทรแล้ว/เลยเวลา/ยกเลิก/คนละเบอร์', () => {
    const calls = [
      call('a', '2026-10-22T00:00:00Z'),
      call('b', '2026-10-18T00:00:00Z'),
      call('c', '2026-10-25T00:00:00Z', { call_outcome: 'acknowledged' }),
      call('d', '2026-10-29T00:00:00Z', { cancelled: true }),
      call('e', '2026-11-14T00:00:00Z'),
      call('f', '2026-10-21T00:00:00Z', { group_id: 'g2' }),
      call('g', '2026-10-30T00:00:00Z', { recipient_phone: '0899999999' }),
    ];
    expect(pendingAftercareRounds(calls, '+66812345678', NOW).map((c) => c.id)).toEqual(['f']);
    expect(pendingAftercareRounds(calls.filter((c) => c.id !== 'f'), '+66812345678', NOW).map((c) => c.id)).toEqual(['a', 'e']);
  });
  it('สายเดิม → รอบบนฟอร์ม (บวกต่อกันจากวันเริ่มงาน) → กลับเป็นเวลาเดิม + id เดิม', () => {
    const pending = [call('a', '2026-10-22T00:00:00Z'), call('e', '2026-11-14T00:00:00Z', { call_mode: 'manual' })];
    const drafts = draftsFromPending(pending, '2026-10-15');
    expect(drafts).toEqual([
      { id: 'a', days: '7', time: '07:00', mode: 'ai' },
      { id: 'e', days: '23', time: '07:00', mode: 'manual' },
    ]);
    expect(validateMoveRounds(drafts, '2026-10-15', NOW)).toBeNull();
    expect(buildScheduleReplaceRounds([...drafts, { days: '3', time: '09:00', mode: 'ai' }], '2026-10-15')).toEqual([
      { id: 'a', scheduled_at: '2026-10-22T00:00:00.000Z', call_mode: 'ai' },
      { id: 'e', scheduled_at: '2026-11-14T00:00:00.000Z', call_mode: 'manual' },
      { scheduled_at: '2026-11-17T02:00:00.000Z', call_mode: 'ai' },
    ]);
  });
  it('ป๊อปใช้ฟอร์มตัวเดียวกับป๊อปย้าย', () => {
    expect(read('src/components/aftercare/AftercareScheduleDialog.tsx')).toContain('<MoveRoundsEditor');
    expect(read('src/components/follow/FollowCompletedCard.tsx')).toContain('<MoveRoundsEditor');
  });
});

describe('4.3 · ลงผล 3 หัวข้อ (เก็บผลเดิม)', () => {
  it('คุยถึงตัวต้องให้คะแนน · ติดต่อไม่ได้/ลาออกไม่ต้อง · ป้าย Healthy/Warning/High Risk', () => {
    expect(aftercareResultNeedsScores('working')).toBe(true);
    expect(aftercareResultNeedsScores('issue')).toBe(true);
    expect(aftercareResultNeedsScores('unreachable')).toBe(false);
    expect(aftercareResultNeedsScores('resigned')).toBe(false);
    expect(Object.values(AFTERCARE_SCORE_LABEL)).toEqual(['Healthy', 'Warning', 'High Risk']);
    expect(read('migrations/155_aftercare_contact_scores.sql')).toContain("expectation in ('healthy', 'warning', 'high_risk')");
    expect(read('api/_handlers/aftercare.ts')).toContain("'เลือกผลให้ครบทั้ง 3 หัวข้อ'");
  });
});

describe('4.4 · ย้อนกลับไปติดตามครบ (เก็บสายไว้)', () => {
  const person = { from_follow_id: 'x1', follow_group_id: 'g', created_at: '2026-10-18T03:00:00Z' };
  const e = (id: string, o: Record<string, unknown> = {}) => ({
    id,
    group_id: 'g',
    topic: 'ติดตามเริ่มงาน',
    cancelled: false,
    completed_at: '2026-10-18T03:00:30Z',
    outcome_code: 'went',
    ...o,
  });
  it('เปิดคืนเฉพาะสายของชุดเดิมที่ปิด "ไปแล้ว" ตอนย้าย', () => {
    const ids = revertReopenIds(
      [
        e('a'),
        e('b', { completed_at: '2026-10-10T00:00:00Z' }), // ปิดก่อนย้ายนาน = ผลจริงของคน
        e('c', { outcome_code: 'not_going' }),
        e('d', { group_id: 'other' }),
        e('f', { topic: AFTERCARE_TOPIC }),
        e('g', { cancelled: true }),
      ],
      person,
    );
    expect(ids).toEqual(['a']);
    expect(revertReopenIds([e('a')], { ...person, from_follow_id: null })).toEqual([]);
  });
  it('หน้าเปิดสายคืนก่อนลบแถวดูแล · API ลบเฉพาะคนที่ย้ายมา · ไม่ยกเลิกสายถามความเป็นอยู่', () => {
    const page = read('src/pages/aftercare/AftercarePage.tsx');
    expect(page.indexOf('await reopenFollowEntry(id)')).toBeLessThan(page.indexOf('await revertAftercare(p.phone_e164)'));
    const api = read('api/_handlers/aftercare.ts');
    expect(api).toContain('delete from ${TABLE} where phone_e164 = $1 and from_follow_id is not null and closed_at is null');
    expect(page).not.toContain('cancelFollow');
  });
});
