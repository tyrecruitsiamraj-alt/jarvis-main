// @vitest-environment node
/**
 * รายละเอียดเงินของใบขอ — ตอนนี้แสดงในกล่อง "ข้อมูลใบขอ" ของหน้าใบขอ
 * (รอบสี่สิบเอ็ด 25 ส.ค. 2569 เจ้าของสั่งคืนหน้ารายการเป็นของเดิม)
 *
 * ด่านที่ห้ามหลุด:
 * 1. 🔴 **ไม่รู้ ≠ ศูนย์บาท** — เงินคนที่ออกหาเจอแค่ 76% ของใบขอ (วัดจริง)
 *    null ต้องขึ้น "ไม่มีข้อมูล" · แต่ 0 ที่มาจากฐานจริงต้องโชว์ 0 บาท
 * 2. เงินสองก้อน (draw = พนักงานได้ · fee = เก็บลูกค้า) ต้องมีป้ายแยกเสมอ
 * 3. กลุ่มที่ไม่มีของจริงสักช่อง ต้องไม่โชว์หัวข้อว่าง
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildUnitRequestDetail,
  detailValueText,
  formatMoney,
  moneyFieldText,
  paidPeriodText,
  resignedIncomeRows,
  hasDeductSide,
  visibleRateLines,
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

describe('moneyFieldText — ช่องเงินบนหน้าใบขอ', () => {
  it('ไม่รู้คืน undefined (จอขึ้น "—") ไม่ใช่ 0', () => {
    expect(moneyFieldText(null)).toBeUndefined();
    expect(moneyFieldText(undefined)).toBeUndefined();
    expect(moneyFieldText(Number.NaN)).toBeUndefined();
  });

  it('🔴 ศูนย์ที่มาจากฐานจริงต้องขึ้น "0 บาท" ไม่ใช่ "—"', () => {
    expect(moneyFieldText(0)).toBe('0 บาท');
  });

  it('เลขปกติใส่คั่นหลักพร้อมหน่วย', () => {
    expect(moneyFieldText(23861)).toBe('23,861 บาท');
  });
});

/**
 * 🔴 ช่วงวันของงวดจ่ายจริง — งวดสุดท้ายของคนที่ออกมักไม่เต็มเดือน
 * โชว์ยอดโดยไม่บอกช่วงวัน คนจะอ่านว่า "เงินเดือนเขาแค่นี้"
 */
describe('paidPeriodText — งวดจ่ายจริง', () => {
  it('รู้ทั้งสองวัน = บอกช่วง', () => {
    expect(paidPeriodText('2026-07-01', '2026-07-31')).toBe('2026-07-01 ถึง 2026-07-31');
  });

  it('ไม่รู้เลย = undefined (จอขึ้น "—") ไม่ใช่เดาว่าเต็มเดือน', () => {
    expect(paidPeriodText(null, null)).toBeUndefined();
    expect(paidPeriodText(undefined, '')).toBeUndefined();
  });

  it('รู้ข้างเดียว = บอกเท่าที่รู้', () => {
    expect(paidPeriodText('2026-07-01', null)).toBe('2026-07-01');
  });

  it('ตัดเวลาออกจาก timestamp', () => {
    expect(paidPeriodText('2026-07-01T00:00:00.000Z', '2026-07-31T00:00:00.000Z')).toBe(
      '2026-07-01 ถึง 2026-07-31',
    );
  });
});

/**
 * รายได้จริงของคนที่ออก **แยกรายงวด** (เจ้าของสั่ง 25 ส.ค. 2569:
 * "ไม่ได้เอาแบบเฉลี่ย ขอดูแบบย้อนหลัง 3 เดือนเลย")
 */
describe('resignedIncomeRows', () => {
  const m = (over: Partial<import('../../src/types/index.js').ResignedIncomeMonth>) => ({
    from: '2026-07-01',
    to: '2026-07-31',
    pay: 20345.32,
    deduct: 1672,
    net: 18673.32,
    ...over,
  });

  it('คืนรายงวดตรง ๆ ไม่ยุบเป็นค่าเฉลี่ย', () => {
    const rows = resignedIncomeRows(
      job({
        resigned_income_3m: [
          m({}),
          m({ from: '2026-06-01', to: '2026-06-30', pay: 21220.84 }),
        ],
      }),
    )!;
    expect(rows).toHaveLength(2);
    expect(rows[0].period).toBe('2026-07-01 ถึง 2026-07-31');
    expect(rows[0].pay).toBe(20345.32);
  });

  it('🔴 ไม่มีของ = null (จอบอกว่าไม่พบ) ไม่ใช่ลิสต์ว่างเงียบ ๆ', () => {
    expect(resignedIncomeRows(job())).toBeNull();
    expect(resignedIncomeRows(job({ resigned_income_3m: [] }))).toBeNull();
    expect(resignedIncomeRows(job({ resigned_income_3m: null }))).toBeNull();
  });

  it('งวดที่ไม่มีฝั่งจ่าย คง null ไว้ ห้ามแปลงเป็น 0 บาท', () => {
    const rows = resignedIncomeRows(job({ resigned_income_3m: [m({ pay: null })] }))!;
    expect(rows[0].pay).toBeNull();
  });

  it('ไม่รู้ช่วงงวดก็ยังต้องมีคำอ่านออก', () => {
    const rows = resignedIncomeRows(job({ resigned_income_3m: [m({ from: null, to: null })] }))!;
    expect(rows[0].period).toBe('ไม่ทราบช่วงงวด');
  });

  it('hasDeductSide: หักเป็น 0/null ทุกงวด = ไม่ต้องวาดคอลัมน์หัก', () => {
    const zero = resignedIncomeRows(job({ resigned_income_3m: [m({ deduct: 0 })] }))!;
    expect(hasDeductSide(zero)).toBe(false);
    const some = resignedIncomeRows(job({ resigned_income_3m: [m({ deduct: 100 })] }))!;
    expect(hasDeductSide(some)).toBe(true);
  });

  /**
   * 🔴 สุทธิคือตัวที่เจ้าของถามหา ("ยอดที่เขารับจริง") — ต้องเดินทางถึงจอครบ
   * และ null ต้องคงเป็น null (จอเขียน "—" ห้ามอ่านเป็น 0 บาท)
   */
  it('พาเงินได้ / หัก / สุทธิ ไปถึงจอครบทั้งสามช่อง', () => {
    const rows = resignedIncomeRows(
      job({ resigned_income_3m: [m({ pay: 12917, deduct: 1672, net: 11245 })] }),
    )!;
    expect(rows[0]).toMatchObject({ pay: 12917, deduct: 1672, net: 11245 });
  });

  it('สุทธิที่อ่านไม่ได้คงเป็น null ห้ามแปลงเป็น 0', () => {
    const rows = resignedIncomeRows(
      job({ resigned_income_3m: [m({ net: null, deduct: null })] }),
    )!;
    expect(rows[0].net).toBeNull();
    expect(rows[0].deduct).toBeNull();
  });
});

/** บรรทัดอัตราของใบขอ — ใบละ ~15 บรรทัด ส่วนใหญ่เป็น 0 */
describe('visibleRateLines', () => {
  const line = (over: Partial<import('../../src/types/index.js').UnitRequestRateLine>) => ({
    seq: 1,
    fee_name: 'x',
    is_wage: false,
    payment_rate: 0,
    draw_rate: 0,
    remark: null,
    ...over,
  });

  it('ตัดแถวที่ทั้งจ่ายและเบิกเป็น 0 ทิ้ง', () => {
    const out = visibleRateLines(
      job({ rate_lines: [line({ seq: 1 }), line({ seq: 2, payment_rate: 500 })] }),
    );
    expect(out.map((l) => l.seq)).toEqual([2]);
  });

  it('🔴 บรรทัดค่าจ้างหลักโชว์เสมอ แม้เป็น 0 (เป็นตัวที่ประกาศเป็นรายได้)', () => {
    const out = visibleRateLines(job({ rate_lines: [line({ seq: 1, is_wage: true })] }));
    expect(out).toHaveLength(1);
  });

  it('มีแต่ฝั่งเบิกก็ยังโชว์', () => {
    const out = visibleRateLines(job({ rate_lines: [line({ seq: 1, draw_rate: 44.13 })] }));
    expect(out).toHaveLength(1);
  });

  it('ยังไม่ได้โหลด (undefined) = ลิสต์ว่าง ไม่ระเบิด', () => {
    expect(visibleRateLines(job())).toEqual([]);
  });
});

/**
 * 🔴 คิวรี "รายได้จริง 3 งวด" ต้องกรองด้วยไซต์ของใบขอนี้
 * เจ้าของเคาะ 27 ส.ค. 2569 หลังทักว่า "เหมือนมันไม่ตรง" — วัดฐานพบว่า
 * 22,946 จาก 39,041 คน (59%) มีงวดจ่ายข้ามไซต์ ⇒ ไม่กรอง = เอาเงินจากงานอื่นมาโชว์
 */
describe('แหล่งของรายได้จริง 3 งวด (สแกน SQL)', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../api/_lib/siamrajSqlServerRequests.ts'),
    'utf8',
  );

  it('กรองด้วย site_code ของใบขอ ไม่ใช่เอาทุกไซต์ของคนคนนั้น', () => {
    expect(sql).toContain('p.site_code = A.site_code');
  });

  /**
   * 🔴 ต้องดึงจากตาราง **จ่ายจริง** (wg2_payment_*) ไม่ใช่ตารางเตรียมจ่าย (wg2_ppayment_*)
   * ของเตรียมจ่าย = ยอดรวมก่อนหัก · ของจ่ายจริง = เงินได้/เงินหัก/สุทธิ แบบ eSlip
   */
  it('ดึงจากตารางจ่ายจริง + ตารางภาษี ไม่ใช่ตารางเตรียมจ่าย', () => {
    expect(sql).toContain('FROM wg2_payment_head p');
    expect(sql).toContain('JOIN wg2_payment_tax x ON x.payment_no = p.payment_no');
    expect(sql).not.toContain('FROM wg2_ppayment_head');
  });

  it('คืนสุทธิ = เงินได้ − เงินหัก และเรียงงวดล่าสุดก่อน', () => {
    expect(sql).toContain('(x.seq_paid - x.seq_deduct)');
    expect(sql).toContain('ORDER BY p.begin_date DESC');
  });
});

/**
 * จอต้องบอกที่มาของตัวเลข — เจ้าของถามตรง ๆ ว่า "ดึงมาจากไหน"
 * และ "งวด" ที่นี่ส่วนใหญ่เป็นครึ่งเดือน (71,542 งวด เทียบเต็มเดือน 31,876)
 * ⇒ ถ้าไม่เขียนไว้ คนจะอ่าน 3 งวดเป็น 3 เดือนแล้วสรุปว่าเลขผิด
 */
describe('จอบอกที่มาของรายได้จริง', () => {
  const page = readFileSync(
    resolve(__dirname, '../../src/pages/jobs/SiamrajUnitRequestDetailPage.tsx'),
    'utf8',
  );

  it('บอกว่าเป็นยอดเดียวกับ eSlip และชี้เมนู ERP ที่เอาไปทานได้', () => {
    expect(page).toContain('ใบแจ้งเงินเดือน (eSlip)');
    expect(page).toContain('PR-4813');
  });

  it('เตือนว่าหนึ่งงวดมักเป็นครึ่งเดือน — กันอ่าน 3 งวดเป็น 3 เดือน', () => {
    expect(page).toContain('หนึ่งงวดมักเป็นครึ่งเดือน');
  });

  it('ไม่มีงวดในไซต์นี้ ต้องบอกเหตุผล ไม่ใช่ "ไม่พบ" เฉย ๆ', () => {
    expect(page).toContain('อาจยังไม่ถึงรอบจ่าย');
  });
});
