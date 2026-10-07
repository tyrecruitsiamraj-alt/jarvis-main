/**
 * การ์ดโพสต์ประกาศกับหน้า /apply ใช้ข้อมูลงานตัวเดียว (เจ้าของ 5 ต.ค. 2569:
 * "หน้า Apply ติ๊กอะไรแล้วเห็นอะไร หน้า โพสต์ประกาศ ก็เห็นเหมือนกันสิ่ ไม่งั้นจะเช็คยังไงหล่ะว่าถูกต้องหรือเปล่า")
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { JobRequest } from '@/types';
import JobPublicFacts from './JobPublicFacts';
import { benefitWithAmount, jobAverageIncome, jobBaseIncome } from '@/lib/jobPublicFacts';

afterEach(cleanup);

const JOB = {
  id: 'j1',
  unit_name: 'KYE',
  location_address: 'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ',
  override_province: 'สมุทรปราการ',
  override_district: 'บางพลี',
  work_schedule: 'จันทร์ - เสาร์ • 08.00 - 17.00 น.',
  monthly_income: 18300,
  monthly_income_base: 12000,
  total_income: 12000,
  monthly_income_items: [
    { label: 'ค่าโทรศัพท์', monthly: 300 },
    { label: 'ค่าเดินทาง', monthly: 6000 },
  ],
  benefits: ['โอที ~75 บาท/ชม.', 'เบี้ยขยัน', 'ค่าเดินทาง', 'ค่าโทรศัพท์'],
  gender_requirement: 'M',
  age_range_min: 20,
  age_range_max: 55,
  resigned_income_3m: [
    { from: '2025-02-01', to: '2025-02-28', pay: 16000, deduct: 500, net: 15500 },
    { from: '2025-01-01', to: '2025-01-31', pay: 16000, deduct: 500, net: 15500 },
  ],
  lastWorkingDay: '2025-03-31',
} as unknown as JobRequest;

describe('ตัวกลางของข้อมูลงาน', () => {
  it('🔴 ฐานเงินเดือน = ฐานจริงจาก ERP ไม่ใช่ยอดรวม (สวัสดิการโชว์ยอดตัวเองแล้ว) · ทีม Online ตั้งเองชนะ', () => {
    expect(jobBaseIncome(JOB)?.text).toBe('12,000 บาท/เดือน');
    const manual = { ...JOB, field_overrides: { total_income: 14000 } } as unknown as JobRequest;
    expect(jobBaseIncome(manual)?.text).toBe('14,000 บาท/เดือน');
  });

  it('รายได้เฉลี่ย = สูตรเดียวกับปุ่ม "ใช้รายได้คนเก่า" · server ส่งมาแล้วใช้ตัวนั้น', () => {
    expect(jobAverageIncome(JOB)).toBe(15500);
    expect(jobAverageIncome({ average_income: 17000 } as JobRequest)).toBe(17000);
    expect(jobAverageIncome({} as JobRequest)).toBeNull();
  });

  it('สวัสดิการบอกยอดถ้ารู้ · ชิปที่มีตัวเลขอยู่แล้วไม่แตะ', () => {
    expect(benefitWithAmount('ค่าเดินทาง', JOB.monthly_income_items)).toBe('ค่าเดินทาง 6,000 บาท/เดือน');
    expect(benefitWithAmount('เบี้ยขยัน', JOB.monthly_income_items)).toBe('เบี้ยขยัน');
    expect(benefitWithAmount('โอที ~75 บาท/ชม.', JOB.monthly_income_items)).toBe('โอที ~75 บาท/ชม.');
  });
});

describe('JobPublicFacts', () => {
  it('เห็นครบตามที่เจ้าของเรียง: สถานที่ · วันเวลาทำงาน · ฐาน · รายได้เฉลี่ย · สวัสดิการ+ยอด · เพศ · อายุ', () => {
    render(<JobPublicFacts job={JOB} />);
    const text = screen.getByTestId('job-public-facts').textContent ?? '';
    for (const part of [
      'สมุทรปราการ · บางพลี',
      'จันทร์ - เสาร์ • 08.00 - 17.00 น.',
      'ฐานเงินเดือน 12,000 บาท/เดือน',
      'รายได้เฉลี่ย 15,500 บาท/เดือน',
      'ค่าเดินทาง 6,000 บาท/เดือน',
      'ค่าโทรศัพท์ 300 บาท/เดือน',
      'เบี้ยขยัน',
      'ชาย',
      'อายุ 20–55 ปี',
    ]) {
      expect(text, part).toContain(part);
    }
    expect(text).not.toContain('คนเก่า');
  });

  it('🔴 ติ๊กซ่อนในขั้น 3 = หายทั้งสองฝั่ง (การ์ดเจ้าหน้าที่ใช้ตัวเดียวกัน)', () => {
    const hidden = {
      ...JOB,
      field_overrides: { public_visibility: { income: false, average_income: false, benefits: false } },
    } as unknown as JobRequest;
    for (const staff of [false, true]) {
      cleanup();
      render(<JobPublicFacts job={hidden} staff={staff} />);
      const text = screen.getByTestId('job-public-facts').textContent ?? '';
      expect(text).not.toContain('ฐานเงินเดือน');
      expect(text).not.toContain('รายได้เฉลี่ย');
      expect(screen.queryByTestId('job-public-benefits')).toBeNull();
      expect(text).toContain('อายุ 20–55 ปี');
    }
  });

  it('🔴 โอทีไม่ขึ้น · รายการที่ถอดแล้วไม่ขึ้นแม้ใบเก่าติ๊กไว้ · เรียงลงทีละบรรทัด (เจ้าของ 5 ต.ค. 2569)', () => {
    const old = {
      ...JOB,
      extra_benefits: ['ประกันสังคม', 'รถรับส่ง', 'shuttle', 'โบนัสประจำปี', 'อาหารกลางวัน', 'ที่พัก/หอพัก', 'ปรับเงินเดือนประจำปี'],
    } as unknown as JobRequest;
    render(<JobPublicFacts job={old} />);
    const items = [...screen.getByTestId('job-public-benefits').querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual(['เบี้ยขยัน', 'ค่าเดินทาง 6,000 บาท/เดือน', 'ค่าโทรศัพท์ 300 บาท/เดือน', 'ประกันสังคม']);
  });

  it('รอบรับเงินหลายแบบ = บอกว่าเลือกได้ · แบบเดียว = รับเงินแบบนั้น', async () => {
    const { payCycleCardText } = await import('@/lib/payCycle');
    expect(payCycleCardText(['monthly', 'weekly', 'daily'])).toBe('เลือกรับเงินได้ รายเดือน · รายสัปดาห์ · รายวัน');
    expect(payCycleCardText(['monthly'])).toBe('รับเงินรายเดือน');
    expect(payCycleCardText([])).toBe('');
  });
});

/** เจ้าของ 7 ต.ค. 2569: "รายได้รวมยังไม่มีบนกล่องเลย มีแค่ฐานเอง" — ฐาน · รายได้รวม แยกช่องบนการ์ด */
describe('jobIncomeLine — ฐาน · รายได้รวม (ขึ้นทั้งคู่เสมอ)', async () => {
  const { jobIncomeLine } = await import('@/lib/jobPublicFacts');
  it('ERP: ฐาน + รายได้รวม (รวมมากกว่าฐาน) · รวมเท่าฐาน = ไม่ขึ้นซ้ำ', () => {
    expect(jobIncomeLine({ monthly_income_base: 13000, monthly_income: 17500 } as never)).toEqual({
      base: '13,000 บาท/เดือน',
      total: '17,500 บาท/เดือน',
      hint: null,
    });
    // 7 ต.ค. รอบ 2: "ต้องโชว์ทั้ง ฐานเงินเดือน และ รายได้รวม" — เท่ากันก็ขึ้นทั้งคู่
    expect(jobIncomeLine({ monthly_income_base: 13000, monthly_income: 13000 } as never)?.total).toBe('13,000 บาท/เดือน');
    expect(jobIncomeLine({ monthly_income_base: 13000 } as never)).toEqual({ base: '13,000 บาท/เดือน', total: '13,000 บาท/เดือน', hint: null });
    // ยอดเดี่ยวที่ทีมตั้งต่ำกว่าฐาน (ค่าแรงรายวันใส่ผิดช่อง · LMO6801013) = ไม่โชว์ "รายได้รวม 400 บาท/เดือน"
    const wrong = jobIncomeLine({ field_overrides: { total_income: 400 }, monthly_income_base: 11700, monthly_income: 11700 } as never);
    expect(wrong?.total).toBe('11,700 บาท/เดือน');
    expect(wrong?.hint).toContain('400');
  });
  it('ทีมแยกรายการ: มีบรรทัดฐาน = ฐาน + รวม · ไม่มีบรรทัดฐาน = รายได้รวมอย่างเดียว (ไม่เรียกยอดรวมว่าฐาน)', () => {
    const withBase = { income_display: { period: 'monthly', lines: [{ label: 'ฐานเงินเดือน', amount: 13000 }, { label: 'ค่าตำแหน่ง', amount: 3000 }], total: 22000 } };
    expect(jobIncomeLine(withBase as never)).toEqual({ base: '13,000 บาท/เดือน', total: '22,000 บาท/เดือน', hint: null });
    const noBase = { income_display: { period: 'monthly', lines: [{ label: 'รายได้โดยประมาณ', amount: 22969 }], total: 22969 } };
    expect(jobIncomeLine(noBase as never)).toEqual({ base: null, total: '22,969 บาท/เดือน', hint: null });
    // ไม่มีบรรทัดฐาน = ใช้ฐานจาก ERP (ต่อเดือนเท่านั้น)
    expect(jobIncomeLine({ ...noBase, monthly_income_base: 15000 } as never)?.base).toBe('15,000 บาท/เดือน');
    const daily = { income_display: { period: 'daily', lines: [{ label: 'ค่าแรง', amount: 400 }], total: 400 }, monthly_income_base: 12000 };
    expect(jobIncomeLine(daily as never)?.base).toBeNull();
  });
  it('การ์ดขึ้นทั้งสองช่อง', () => {
    render(<JobPublicFacts job={{ ...JOB, monthly_income_base: 13000, monthly_income: 17500 } as never} />);
    const t = screen.getByTestId('job-public-facts').textContent ?? '';
    expect(t).toContain('ฐานเงินเดือน 13,000 บาท/เดือน');
    expect(t).toContain('รายได้รวม 17,500 บาท/เดือน');
  });
});

describe('หมายเหตุใบขอบนการ์ดโพสต์ประกาศ (7 ต.ค. 2569)', () => {
  it('การ์ดเจ้าหน้าที่มีหมายเหตุ · การ์ดผู้สมัคร (JobPublicFacts) ไม่มี', async () => {
    const { readFileSync } = await import('node:fs');
    const card = readFileSync(`${process.cwd()}/src/components/jobs/BoardJobCard.tsx`, 'utf8');
    expect(card).toContain('data-testid="board-card-note"');
    expect(card).toContain('job.list_note');
    expect(readFileSync(`${process.cwd()}/src/components/jobs/JobPublicFacts.tsx`, 'utf8')).not.toContain('list_note');
  });
});
