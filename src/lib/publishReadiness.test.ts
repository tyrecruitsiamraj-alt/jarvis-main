/**
 * "พร้อมประกาศไหม" — ตัวตัดสินที่เดียวของการ์ดกล่องงาน / ป๊อปประกาศ / หัวข้อกรอง (เจ้าของเลือก B 2 ต.ค. 2569)
 * 🔴 ด่าน: ดูจากสิ่งที่คนนอกจะเห็นจริง (ตัวคำนวณชุดเดียวกับหน้าสาธารณะ) · เลขดิบไม่รู้หน่วย = ขาดรายได้ (ห้ามเดา) ·
 *    ใบขอเขียน O/ว่าง = ขาดเพศ · ERP พาไปต่อแล้ว = มีคนเริ่มงานแล้ว · ประกาศแล้วไม่อยู่ในหัวข้อกรอง · ไม่มีคำว่า "ติดขั้น"
 */
import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import {
  publicIncomeOf,
  publishGapsOf,
  publishReadinessOf,
  readinessActionText,
  readinessChipText,
  readinessFacetValues,
  READINESS_FACET_ORDER,
} from '@/lib/publishReadiness';

const job = (over: Partial<JobRequest> = {}): JobRequest =>
  ({
    id: 'siamraj-sql:OPL6909999',
    request_no: 'OPL6909999',
    unit_name: 'หน่วยทดสอบ',
    status: 'open',
    ...over,
  }) as unknown as JobRequest;

const facts = (released = false, skipped = false) => ({ isReleased: () => released, isSkipped: () => skipped });

describe('publicIncomeOf — รายได้ที่คนนอกเห็น (ลำดับเดียวกับหน้าสาธารณะ)', () => {
  it('ทีม Online ตั้งแยกรายการ = รู้หน่วย · ตั้งเอง', () => {
    const j = job({ income_display: { period: 'daily', lines: [{ label: 'ค่าแรง', amount: 400 }], total: 400 } });
    expect(publicIncomeOf(j)).toEqual({ text: '฿400 ต่อวัน', unit: true, manual: true, hint: null });
  });

  it('ยอดเดี่ยวแบบเก่าที่ตั้งเอง = ต่อเดือน', () => {
    expect(publicIncomeOf(job({ field_overrides: { total_income: 12000 } }))).toEqual({
      text: '12,000 บาท/เดือน',
      unit: true,
      manual: true,
      hint: null,
    });
  });

  it('ERP คิดต่อเดือนให้ = รู้หน่วย ไม่ใช่ตั้งเอง · เลขดิบอย่างเดียว = ไม่รู้หน่วย · ไม่มีเลย = null', () => {
    expect(publicIncomeOf(job({ total_income: 400, monthly_income: 12400 }))).toMatchObject({ unit: true, manual: false });
    expect(publicIncomeOf(job({ total_income: 354 }))).toMatchObject({ text: '354 บาท', unit: false, manual: false });
    expect(publicIncomeOf(job({ total_income: 354 }))?.hint).toMatch(/ต่อวัน/);
    expect(publicIncomeOf(job({}))).toBeNull();
  });
});

describe('publishGapsOf — ขาดอะไร', () => {
  it('ครบ: อ่านจังหวัดจากที่อยู่ได้ · ERP บอกต่อเดือน · ใบขอบอกเพศ ⇒ ไม่ขาด', () => {
    expect(
      publishGapsOf(job({ location_address: 'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ', total_income: 400, monthly_income: 12400, gender_requirement: 'M' })),
    ).toEqual([]);
  });

  it('🔴 เลขดิบไม่รู้หน่วย = ขาดรายได้ · ใบขอเขียน O = ขาดเพศ · ที่อยู่อ่านจังหวัดไม่ออก = ขาดสถานที่ (ลำดับ สถานที่ รายได้ เพศ)', () => {
    expect(publishGapsOf(job({ location_address: 'อาคาร 5 ชั้น 3', total_income: 354, gender_requirement: 'O' }))).toEqual([
      'place',
      'income',
      'gender',
    ]);
  });

  it('ทีม Online ตั้งเองทับได้ทุกช่อง: จังหวัดที่ตั้งเอง · รายได้ที่ตั้งเอง · เพศที่เลือก', () => {
    expect(
      publishGapsOf(
        job({
          location_address: 'อาคาร 5 ชั้น 3',
          override_province: 'ระยอง',
          field_overrides: { total_income: 15000, gender: 'ชาย' },
          gender_requirement: 'O',
        }),
      ),
    ).toEqual([]);
  });
});

describe('publishReadinessOf — ตอบได้อย่างเดียวเสมอ', () => {
  const ready = job({ location_address: 'จ.ระยอง', total_income: 400, monthly_income: 12400, gender_requirement: 'F' });

  it('ประกาศแล้วชนะทุกอย่าง · ตั้งไม่ประกาศมาก่อนสภาพอื่น', () => {
    expect(publishReadinessOf(ready, facts(true, true))).toEqual({ kind: 'released' });
    expect(publishReadinessOf(ready, facts(false, true))).toEqual({ kind: 'skipped' });
  });

  it('ERP พาไปคัดเลือก/รอเริ่มงาน/เริ่มงานแล้ว = มีคนเริ่มงานแล้ว (นิยามเดียวกับก้อนย่อยบนหัว)', () => {
    expect(publishReadinessOf(job({ ...ready, work_status: 'waiting_inform' }), facts())).toEqual({ kind: 'moved', box: 'waiting' });
    expect(publishReadinessOf(job({ ...ready, work_status: 'evaluating' }), facts())).toEqual({ kind: 'moved', box: 'selecting' });
    expect(publishReadinessOf(job({ ...ready, work_status: 'daily_work' }), facts())).toEqual({ kind: 'moved', box: 'started' });
  });

  it('ยังหาคนอยู่: ครบ = พร้อมประกาศ · ไม่ครบ = ขาด (บอกครบทุกช่อง)', () => {
    expect(publishReadinessOf(ready, facts())).toEqual({ kind: 'ready' });
    expect(publishReadinessOf(job({ location_address: 'จ.ระยอง', total_income: 354 }), facts())).toEqual({
      kind: 'gaps',
      gaps: ['income', 'gender'],
    });
  });
});

describe('คำบนจอ', () => {
  it('ชิป: ประกาศแล้ว · ไม่ประกาศ · ชื่อกล่อง ERP · พร้อมประกาศ · ขาด: … (ไม่มีคำว่าติดขั้น)', () => {
    expect(readinessChipText({ kind: 'released' })).toBe('ประกาศแล้ว');
    expect(readinessChipText({ kind: 'skipped' })).toBe('ไม่ประกาศ');
    expect(readinessChipText({ kind: 'moved', box: 'waiting' })).toBe('รอแจ้งเข้า / รอเริ่มงาน');
    expect(readinessChipText({ kind: 'ready' })).toBe('พร้อมประกาศ');
    expect(readinessChipText({ kind: 'gaps', gaps: ['place', 'gender'] })).toBe('ขาด: สถานที่ · เพศ');
  });

  it('ปุ่ม: พร้อม = ตรวจแล้วประกาศ · ขาด N = เติม N ช่อง · อื่น ๆ/ยังโหลดไม่ครบ = เปิดดู', () => {
    expect(readinessActionText({ kind: 'ready' })).toBe('ตรวจแล้วประกาศ');
    expect(readinessActionText({ kind: 'gaps', gaps: ['income', 'gender'] })).toBe('เติม 2 ช่อง');
    expect(readinessActionText({ kind: 'released' })).toBe('เปิดดู');
    expect(readinessActionText({ kind: 'moved', box: 'started' })).toBe('เปิดดู');
    expect(readinessActionText(null)).toBe('เปิดดู');
  });
});

describe('หัวข้อกรอง "พร้อมประกาศไหม"', () => {
  it('ลำดับตายตัว · ใบที่ขาดหลายช่องอยู่หลายค่า · ประกาศแล้วไม่อยู่ในหัวข้อ', () => {
    expect([...READINESS_FACET_ORDER]).toEqual(['ready', 'gap_place', 'gap_income', 'gap_gender', 'moved', 'skipped']);
    expect(readinessFacetValues({ kind: 'gaps', gaps: ['place', 'gender'] })).toEqual(['gap_place', 'gap_gender']);
    expect(readinessFacetValues({ kind: 'released' })).toEqual([]);
    expect(readinessFacetValues({ kind: 'moved', box: 'selecting' })).toEqual(['moved']);
    expect(readinessFacetValues({ kind: 'skipped' })).toEqual(['skipped']);
    expect(readinessFacetValues({ kind: 'ready' })).toEqual(['ready']);
  });
});
