/**
 * ใบขอใบเดียว ทำอะไรไปแล้ว ไล่ตามวัน (เจ้าของ 20 พ.ย. 2569 — ผู้บริหารถามย้อนกลับ)
 * 🔴 ด่าน: หลักของใบ (ขอมา · ประกาศ · หาได้แล้ว · ยกเลิก) กับงานของทีมเรียงวันเดียวกันตามลำดับที่เกิดจริง · เหตุผลยกเลิกอยู่ที่แถวยกเลิก
 */
import { describe, expect, it } from 'vitest';
import { buildRequestTimeline, emptyRequestWork, mergeRequestEvents, REQUEST_EVENT_KINDS, REQUEST_EVENT_LABEL, REQUEST_EVENT_UNIT, type RequestEvent } from './requestTimeline';

const request = {
  day: '2026-11-03',
  requested: 2,
  // ประกาศ 00:30 เวลาไทยของวันที่ 4 (เก็บเป็น UTC ของวันที่ 3)
  releasedAt: '2026-11-03T17:30:00.000Z',
  releasedBy: 'คิว',
  flow: { carryIn: 0, new: 2, filled: 1, cancelled: 1, remaining: 0, fillDays: [['2026-11-12', 1]] as Array<[string, number]>, cancelDays: [['2026-11-15', 1]] as Array<[string, number]> },
};
const events: RequestEvent[] = [
  { day: '2026-11-05', kind: 'names', who: null, detail: 'Facebook · Facebook Group', n: 12 },
  { day: '2026-11-04', kind: 'manualPosted', who: 'เจมส์', detail: 'Facebook · Facebook Group', n: 2 },
  { day: '2026-11-04', kind: 'links', who: 'เจมส์', detail: 'Facebook · Facebook Group', n: 3 },
  { day: '2026-11-05', kind: 'ai', who: 'AI', detail: 'สนใจ', n: 3 },
  { day: '2026-11-12', kind: 'attendance', who: 'แป๋ม', detail: 'มา', n: 1 },
  { day: '2026-11-07', kind: 'contacts', who: 'แป๋ม', detail: 'นัดได้', n: 1 },
];

describe('buildRequestTimeline', () => {
  it('เรียงเก่า → ใหม่ · วันเดียวกัน: ประกาศ → ออกไปหาคน → รายชื่อเข้า → โทร · หาได้แล้ว/ยกเลิกอยู่ท้ายวัน', () => {
    const rows = buildRequestTimeline(request, events, 'ลูกค้าหาคนเองได้');
    expect(rows.map((r) => [r.day, r.label, r.n, r.unit, r.who, r.detail, r.mark])).toEqual([
      ['2026-11-03', 'ขอมา', 2, 'อัตรา', null, null, true],
      ['2026-11-04', 'ประกาศ', null, '', 'คิว', null, true],
      ['2026-11-04', 'Gen link', 3, 'ลิงก์', 'เจมส์', 'Facebook · Facebook Group', false],
      ['2026-11-04', 'โพสต์แล้ว', 2, 'ครั้ง', 'เจมส์', 'Facebook · Facebook Group', false],
      ['2026-11-05', 'รายชื่อเข้า', 12, 'คน', null, 'Facebook · Facebook Group', false],
      ['2026-11-05', 'AI โทรแล้ว', 3, 'คน', 'AI', 'สนใจ', false],
      ['2026-11-07', 'ลงผลติดต่อ', 1, 'ครั้ง', 'แป๋ม', 'นัดได้', false],
      ['2026-11-12', 'ลงผลนัด', 1, 'ครั้ง', 'แป๋ม', 'มา', false],
      ['2026-11-12', 'หาได้แล้ว', 1, 'อัตรา', null, null, true],
      ['2026-11-15', 'ยกเลิก', 1, 'อัตรา', null, 'ลูกค้าหาคนเองได้', true],
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('ใบที่ยังไม่ประกาศ ไม่มีงาน = เหลือแค่แถวขอมา · ไม่มีวันที่ขอ = ไม่มีแถวหลัก', () => {
    expect(buildRequestTimeline({ ...request, releasedAt: null, releasedBy: null, flow: undefined }, [], null).map((r) => r.label)).toEqual(['ขอมา']);
    expect(buildRequestTimeline({ day: undefined, requested: 1, releasedAt: null, releasedBy: null, flow: undefined }, [], null)).toEqual([]);
  });

  it('ทุกชนิดเหตุการณ์มีคำบนจอและหน่วย', () => {
    for (const k of REQUEST_EVENT_KINDS) expect([k, Boolean(REQUEST_EVENT_LABEL[k]), Boolean(REQUEST_EVENT_UNIT[k])]).toEqual([k, true, true]);
    expect(emptyRequestWork()).toEqual({ links: 0, manualPosted: 0, autopost: 0, scrap: 0, contacts: 0, appts: 0 });
  });
});

describe('mergeRequestEvents', () => {
  it('วัน · ชนิด · คนทำ · รายละเอียด ตรงกัน = รวมจำนวน (หลายสถานะที่แปลงเป็นคำเดียวกัน)', () => {
    const merged = mergeRequestEvents([
      { day: '2026-11-20', kind: 'scrap', who: 'เจมส์', detail: 'ไม่สำเร็จ', n: 74 },
      { day: '2026-11-20', kind: 'scrap', who: 'เจมส์', detail: 'สำเร็จ', n: 5 },
      { day: '2026-11-20', kind: 'scrap', who: 'เจมส์', detail: 'สำเร็จ', n: 1 },
      { day: '2026-11-20', kind: 'scrap', who: 'ใหม่', detail: 'สำเร็จ', n: 2 },
    ]);
    expect(merged.map((e) => [e.who, e.detail, e.n])).toEqual([['เจมส์', 'ไม่สำเร็จ', 74], ['เจมส์', 'สำเร็จ', 6], ['ใหม่', 'สำเร็จ', 2]]);
  });
});
