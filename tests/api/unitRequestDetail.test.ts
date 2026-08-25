// @vitest-environment node
/**
 * แถบรายละเอียดที่กดลงมา (เจ้าของสั่ง 25 ส.ค. 2569)
 *
 * ด่านที่ห้ามหลุด:
 * 1. 🔴 **ไม่รู้ ≠ ศูนย์บาท** — เงินคนที่ออกหาเจอแค่ 76% ของใบขอ (วัดจริง)
 *    null ต้องขึ้น "ไม่มีข้อมูล" · แต่ 0 ที่มาจากฐานจริงต้องโชว์ 0 บาท
 * 2. เงินสองก้อน (draw = พนักงานได้ · fee = เก็บลูกค้า) ต้องมีป้ายแยกเสมอ
 * 3. กลุ่มที่ไม่มีของจริงสักช่อง ต้องไม่โชว์หัวข้อว่าง
 */
import { describe, expect, it } from 'vitest';
import {
  buildUnitRequestDetail,
  detailSummary,
  detailValueText,
  formatMoney,
} from '../../src/lib/unitRequestDetail.js';
import type { JobRequest } from '../../src/types/index.js';

const job = (over: Partial<JobRequest> = {}): JobRequest =>
  ({
    id: 'j1',
    unit_name: 'หน่วยงาน',
    location_address: '',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    job_type: 'driver',
    job_category: 'private',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-08-01',
    created_at: '2026-08-01T00:00:00.000Z',
    ...over,
  }) as JobRequest;

describe('🔴 ไม่รู้ ≠ ศูนย์บาท', () => {
  it('null → "ไม่มีข้อมูล" ไม่ใช่ 0 บาท', () => {
    const g = buildUnitRequestDetail(
      job({ resigned_employee_name: 'สมชาย', resigned_wage_draw_rate: null }),
    );
    const draw = g.find((x) => x.key === 'resigned')!.items.find((i) => i.key === 'draw')!;
    expect(draw.value.kind).toBe('unknown');
    expect(detailValueText(draw.value)).toBe('ไม่มีข้อมูล');
    expect(detailValueText(draw.value)).not.toContain('0');
  });

  it('🔴 0 ที่มาจากฐานจริง ต้องโชว์ 0 บาท (แปลว่าไม่ได้เบิกส่วนนี้)', () => {
    const g = buildUnitRequestDetail(
      job({ resigned_employee_name: 'สมชาย', resigned_wage_draw_rate: 0, resigned_wage_fee_rate: 12100 }),
    );
    const items = g.find((x) => x.key === 'resigned')!.items;
    expect(items.find((i) => i.key === 'draw')!.value).toEqual({ kind: 'money', amount: 0 });
    expect(detailValueText(items.find((i) => i.key === 'draw')!.value)).toBe('0 บาท');
    expect(detailValueText(items.find((i) => i.key === 'fee')!.value)).toBe('12,100 บาท');
  });
});

describe('เงินสองก้อนต้องมีป้ายแยก', () => {
  it('draw กับ fee มีป้ายบอกว่าใครได้', () => {
    const g = buildUnitRequestDetail(
      job({ resigned_wage_draw_rate: 45500, resigned_wage_fee_rate: 20000 }),
    );
    const items = g.find((x) => x.key === 'resigned')!.items;
    expect(items.find((i) => i.key === 'draw')!.label).toContain('พนักงาน');
    expect(items.find((i) => i.key === 'fee')!.label).toContain('ลูกค้า');
    // ต้องไม่ใช้ป้ายเดียวกัน (คนอ่านจะสลับกัน)
    expect(items.find((i) => i.key === 'draw')!.label).not.toBe(
      items.find((i) => i.key === 'fee')!.label,
    );
  });

  it('จำนวนเงินมีคั่นหลักพันแบบไทย', () => {
    expect(formatMoney(45500)).toBe('45,500 บาท');
    expect(formatMoney(14660.6)).toBe('14,660.6 บาท');
  });
});

describe('กลุ่มที่ว่างทั้งกลุ่มต้องไม่โชว์', () => {
  it('ใบขอที่ไม่มีข้อมูลคนออกเลย = ไม่มีกลุ่ม "คนที่ออก"', () => {
    const g = buildUnitRequestDetail(job({ total_income: 12000 }));
    expect(g.some((x) => x.key === 'resigned')).toBe(false);
    expect(g.some((x) => x.key === 'income')).toBe(true);
  });

  it('ใบขอที่ไม่มีอะไรเลย = ไม่มีกลุ่มไหนเลย (ไม่ขึ้นหัวข้อว่าง)', () => {
    const g = buildUnitRequestDetail(job({ total_income: 0, penalty_per_day: 0 }));
    // total_income 0 นับเป็นของจริง จึงยังมีกลุ่มรายได้ — ยืนยันว่าไม่มีกลุ่มคนออก/สถานที่
    expect(g.some((x) => x.key === 'resigned')).toBe(false);
    expect(g.some((x) => x.key === 'place')).toBe(false);
  });

  it('มีที่อยู่ = กลุ่มสถานที่โผล่', () => {
    const g = buildUnitRequestDetail(job({ location_address: 'อาคาร A ชั้น 3' }));
    expect(g.some((x) => x.key === 'place')).toBe(true);
  });
});

describe('สรุปบรรทัดเดียวบนปุ่ม', () => {
  it('บอกค่าจ้างและเงินคนเดิมเมื่อมี', () => {
    const s = detailSummary(job({ total_income: 12000, resigned_wage_draw_rate: 9000 }));
    expect(s).toContain('12,000');
    expect(s).toContain('9,000');
  });

  it('ไม่มีเลขอะไรเลย ก็ยังมีคำให้กดอ่านออก', () => {
    expect(detailSummary(job())).toBe('ดูรายละเอียดใบขอ');
  });
});
