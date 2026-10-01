/**
 * "ผ่านมา" ของใบขอ = วันทำงานของหน่วยงาน (เจ้าของสั่ง 1 ต.ค. 2569)
 * 🔴 ด่าน: อ่านข้อความวันทำงานของ ERP ได้ทุกรูปที่พบบ่อย (วัดจริง 1 ต.ค. — 1,519 แบบ) · อ่านไม่ออก = นับทุกวัน (ห้ามเดา) ·
 *    ใบที่ทำทุกวัน/อ่านไม่ออก ได้เลขเดิมเป๊ะ · วันหยุดนักขัตฤกษ์ที่ตรงวันหยุดประจำสัปดาห์ไม่หักซ้ำ
 */
import { describe, expect, it } from 'vitest';
import {
  countWorkingDays,
  parseWorkWeekdays,
  setPublicHolidays,
  workWeekdaysShortLabel,
} from '@/lib/siteWorkdays';
import { getJobAgeChipInfo, getJobRequestAgeDays } from '@/lib/jobUrgency';
import type { JobRequest } from '@/types';

const days = (text: string) => {
  const s = parseWorkWeekdays(text);
  return s ? [...s].sort((a, b) => a - b) : null;
};
const MON_FRI = [1, 2, 3, 4, 5];
const MON_SAT = [1, 2, 3, 4, 5, 6];
const ALL = [0, 1, 2, 3, 4, 5, 6];

describe('parseWorkWeekdays — รูปที่พบจริงใน ERP', () => {
  it.each([
    ['วันจันทร์ - วันศุกร์', MON_FRI],
    ['จันทร์ - ศุกร์', MON_FRI],
    ['จันทร์-ศุกร์', MON_FRI],
    ['วันจันทร์  - วันศุกร์', MON_FRI],
    ['วันจันทร์ -วันศุกร์', MON_FRI],
    ['วันจันทร์ ถึง วันศุกร์', MON_FRI],
    ['วันจันทร์ - วันศุกร์  ( หรือปฏิบัติงานตามตารางนาย โดย OPL จะเป็นผู้สรุป )', MON_FRI],
    ['วันจันทร์ - วันศุกร์ หรือ 5 วัน/สัปดาห์ ตามธนาคารฯกำหนด', MON_FRI],
    ['ตามรอบการอ่านมาตร และประจำสนง.หลังจบการอ่านมาตร จ-ศ', MON_FRI],
    ['วันจันทร์ - วันเสาร์', MON_SAT],
    ['วันจันทร - วันเสาร์', MON_SAT],
    ['จันทร์-เสาร์', MON_SAT],
    ['วันจันทร์ – วันศุกร์ และวันเสาร์ ตามปฏิทินของผู้ว่าจ้าง', MON_SAT],
    ['วันจันทร์ - วันศุกร์  และวันเสาร์ตามตารางปฏิทิน TDEM  และ TPCAP และ TMT', MON_SAT],
    ['วันจันทร์ - วันศุกร์ ,  วันเสาร์ (ครึ่งวันเช้า)', MON_SAT],
    ['วันอาทิตย์ - ศุกร์', [0, 1, 2, 3, 4, 5]],
    ['วันอังคาร - วันอาทิตย์', [0, 2, 3, 4, 5, 6]],
    ['จันทร์ - อาทิตย์ (ให้ทำ 6 วัน/คน/สัปดาห์)', ALL],
    ['วันจันทร์ - วันอาทิตย์  (  ปฏิบัติงานตามตารางกะ )', ALL],
    ['ทุกวัน', ALL],
    ['ส่งพนักงานให้ลูกค้าทุกวัน (ส่วนพนักงานทำงานตามตารางกะ 6 วัน/สัปดาห์)', ALL],
    ['วันจันทร์ - วันศุกร์ • 08:00 - 17:00', MON_FRI],
    // สะกดผิด/เครื่องหมายหลุดที่พบจริง (เดิมอ่านได้แค่วันเดียว)
    ['วันจันทร์ - วันศกุร์ ตามปฏิทินลูกค้า', MON_FRI],
    ['จัทร์ - ศุกร์', MON_FRI],
    ['จันทร์-`เสาร์', MON_SAT],
    // วันหยุดที่เขียนกำกับไว้ไม่ใช่วันทำงาน
    ['จันทร์ - อาทิตย์ (สลับกันหยุด จันทร์ หรือ อาทิตย์ )', ALL],
    ['ทำงาน 6 วัน / สัปดาห์  ( จัดส่งพนักงานทุกวัน ) (หยุดวันจันทร์ - วันเสาร์  )', ALL],
    ['ตามรอบการจดหน่วยที่กฟภ.กำหนด และวันจันทร์-วันศุกร์ เว้นวันหยุดที่บริษัทฯกำหนด', MON_FRI],
    ['ปฏิบัติงานเฉพาะวันเสาร์ - อาทิตย์และวันหยุดนักขัตฤกษ์', [0, 6]],
    ['วันพฤหัสบดี - วันศุกร์', [4, 5]],
    ['ทุกวันเสาร์', [6]],
    ['วันอังคาร์ - วันอาทิตย์', [0, 2, 3, 4, 5, 6]],
    ['วันจันทร์ -  วัเสาร์', MON_SAT],
    ['วันจันทรื - วันเสาร์', MON_SAT],
    ['สัปดาห์ละ 5 วัน (อังคาร , พุธ,ศุกร์,เสาร์,อาทิตย์)', [0, 2, 3, 5, 6]],
  ])('%s', (text, want) => {
    expect(days(text)).toEqual(want);
  });

  it.each([
    'ตามตารางฮอนด้า',
    'ตามตารางปฏิทิน บริษัท ฮอนด้า อาร์แอนด์ดี เอเชีย แปซิฟิค จำกัด',
    '6 วัน/สัปดาห์ สำหรับ Site กรุงเทพฯ ขึ้นอยู่กับคำสั่งของนาย',
    '6วัน/สัปดาห์ ตามตารางกะ',
    'ตามตารางลูกค้ากำหนด',
    // 🔴 วันที่ตามหลัง "หยุด" เป็นวันหยุด — เดิมอ่านกลับข้างเป็น "ทำงานแค่เสาร์–อาทิตย์"
    '6 วัน (เลือกหยุดเสาร์ หรือ อาทิตย์)',
    // งานวันเดียว (ใบเก่า) — ไม่ใช่ "ทำทุกวันเสาร์"
    'วันเสาร์ ที่ 28 พฤศจิกายน 2563',
    'วันอังคารที่ 20 /6/2561',
    '',
  ])('🔴 อ่านไม่ออก = null (นับทุกวันเหมือนเดิม ห้ามเดา): %s', (text) => {
    expect(parseWorkWeekdays(text)).toBeNull();
  });

  it('ไม่ได้กรอก', () => {
    expect(parseWorkWeekdays(undefined)).toBeNull();
    expect(parseWorkWeekdays(null)).toBeNull();
  });
});

describe('countWorkingDays', () => {
  // 2026-09-25 = ศุกร์ · 2026-10-01 = พฤหัส
  it('ไม่นับวันต้น นับวันปลาย · จ.–ศ. ข้ามเสาร์อาทิตย์', () => {
    expect(countWorkingDays('2026-09-25', '2026-10-01', new Set(MON_FRI))).toBe(4); // จ อ พ พฤ
    expect(countWorkingDays('2026-09-25', '2026-10-01', new Set(MON_SAT))).toBe(5);
    expect(countWorkingDays('2026-09-25', '2026-10-01', null)).toBe(6); // ทุกวัน = ค่าเดิม
    expect(countWorkingDays('2026-10-01', '2026-10-01', new Set(MON_FRI))).toBe(0);
  });

  it('ยาวหลายสัปดาห์ = เท่ากับนับทีละวัน', () => {
    const wk = new Set(MON_FRI);
    let brute = 0;
    for (let t = Date.parse('2026-01-01T00:00:00Z') + 86_400_000; t <= Date.parse('2026-09-30T00:00:00Z'); t += 86_400_000) {
      if (wk.has(new Date(t).getUTCDay())) brute += 1;
    }
    expect(countWorkingDays('2026-01-01', '2026-09-30', wk)).toBe(brute);
  });

  it('วันหยุดนักขัตฤกษ์หักเฉพาะที่ตรงวันทำงาน · ตรงเสาร์อาทิตย์ไม่หักซ้ำ · นอกช่วงไม่หัก', () => {
    const h = new Set(['2026-09-28', '2026-09-27', '2026-09-25', '2026-10-05']);
    // 28 = จันทร์ (หัก) · 27 = อาทิตย์ (ไม่ใช่วันทำงานอยู่แล้ว) · 25 = วันต้น (ไม่นับอยู่แล้ว) · 5 ต.ค. นอกช่วง
    expect(countWorkingDays('2026-09-25', '2026-10-01', new Set(MON_FRI), h)).toBe(3);
  });

  it('ปลายอยู่ก่อนต้น = ติดลบ (ให้ผู้เรียกตัดสินเหมือนเดิม)', () => {
    expect(countWorkingDays('2026-10-01', '2026-09-25', new Set(MON_FRI))).toBe(-4);
  });
});

describe('ป้ายวันทำงาน', () => {
  it('ช่วงต่อเนื่อง = ต้น–ปลาย · ทุกวัน/อ่านไม่ออก = null', () => {
    expect(workWeekdaysShortLabel(new Set(MON_FRI))).toBe('จ.–ศ.');
    expect(workWeekdaysShortLabel(new Set([0, 1, 2, 3, 4, 5]))).toBe('อา.–ศ.');
    expect(workWeekdaysShortLabel(new Set([0, 2, 3, 4, 5, 6]))).toBe('อ.–อา.');
    expect(workWeekdaysShortLabel(new Set(ALL))).toBeNull();
    expect(workWeekdaysShortLabel(null)).toBeNull();
  });
});

describe('🔴 คอลัมน์ "ผ่านมา" ของใบขอ', () => {
  const job = (over: Partial<JobRequest>): JobRequest =>
    ({
      id: 'j1',
      created_at: '2026-09-15T03:00:00Z',
      required_date: '2026-09-15',
      ...over,
    }) as JobRequest;
  const TODAY = new Date('2026-10-01T05:00:00Z'); // พฤหัส 1 ต.ค. 2569 (เที่ยงไทย)

  it('ใบ จ.–ศ. นับเฉพาะวันทำงาน · ใบที่อ่านวันทำงานไม่ออกได้เลขเดิม (วันตามปฏิทิน)', () => {
    expect(getJobRequestAgeDays(job({ work_schedule: 'วันจันทร์ - วันศุกร์ • 08:00 - 17:00' }), TODAY)).toBe(12);
    expect(getJobRequestAgeDays(job({ work_schedule: 'ตามตารางฮอนด้า' }), TODAY)).toBe(16);
    expect(getJobRequestAgeDays(job({}), TODAY)).toBe(16);
  });

  it('วันหยุดนักขัตฤกษ์ที่ตั้งไว้ถูกหักด้วย · tooltip บอกฐานวันทำงาน', () => {
    setPublicHolidays(['2026-09-28']);
    try {
      const j = job({ work_schedule: 'จันทร์-ศุกร์' });
      expect(getJobRequestAgeDays(j, TODAY)).toBe(11);
      expect(getJobAgeChipInfo(j, TODAY).title).toMatch(/นับวันทำงาน จ\.–ศ\./);
    } finally {
      setPublicHolidays([]);
    }
  });
});
