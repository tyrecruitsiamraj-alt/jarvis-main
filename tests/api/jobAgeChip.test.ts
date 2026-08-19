import { describe, expect, it } from 'vitest';
import { getJobAgeChipInfo, JOB_AGE_CHIP_META } from '@/lib/jobUrgency';
import type { JobRequest } from '@/types';

/**
 * ชิป「ผ่านมา」บนหน้ารายการใบขอ
 *
 * 🔴 เจ้าของสั่ง 19 ส.ค. 2569: *"ล่วงหน้าสีอะไรก็สีนั้น เพราะถ้ายังไม่ถึงวันที่ต้องการ
 * ก็เป็นล่วงหน้า ก็สีนั้น ๆ ไปเลย มาทำล่วงหน้าหลาย ๆ สีให้งงทำไม"*
 * บั๊กเดิม: ข้อความมาจาก `getJobRequestAgeLabel` (= "ล่วงหน้า") แต่สีมาจาก
 * `getJobAgeUrgencyLevel` ที่นับวันจากวันที่กรอก → ใบล่วงหน้าที่กรอกไว้นานได้สี "ด่วน"
 */

const TODAY = new Date('2026-08-19T09:00:00+07:00');

function job(partial: Partial<JobRequest>): JobRequest {
  return {
    id: 'x',
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
    request_date: '2026-08-19',
    created_at: '2026-08-19T00:00:00.000Z',
    ...partial,
  };
}

describe('getJobAgeChipInfo — ใบล่วงหน้าต้องเป็นระดับเดียวเสมอ', () => {
  it('🔴 กรอกไว้นานแค่ไหนก็ยังเป็น advance ถ้ายังไม่ถึงวันที่ต้องการ', () => {
    // กรอก 3 วันก่อน vs 200 วันก่อน — วันที่ต้องการอยู่ข้างหน้าทั้งคู่
    const soon = job({ request_date: '2026-08-16', required_date: '2026-09-30' });
    const long = job({ request_date: '2026-01-31', required_date: '2026-09-30' });

    expect(getJobAgeChipInfo(soon, TODAY).level).toBe('advance');
    // เดิมใบนี้ได้ระดับ 'critical' (แดง) เพราะกรอกไว้ 200 วัน ทั้งที่ยังไม่ถึงวันที่ต้องการ
    expect(getJobAgeChipInfo(long, TODAY).level).toBe('advance');
  });

  it('ข้อความบนการ์ดไม่มีคำว่า "ผ่านมา" นำหน้าใบล่วงหน้า (เดิมอ่านว่า "ผ่านมา ล่วงหน้า")', () => {
    const info = getJobAgeChipInfo(job({ request_date: '2026-08-01', required_date: '2026-09-30' }), TODAY);
    expect(info.text).toBe('ล่วงหน้า');
    expect(info.cardText).toBe('ล่วงหน้า');
    expect(info.cardText.includes('ผ่านมา')).toBe(false);
  });

  it('🔴 tooltip ของใบล่วงหน้าต้องไม่ขึ้นคำว่า "ด่วน" (สีกับป้ายต้องพูดเรื่องเดียวกัน)', () => {
    const info = getJobAgeChipInfo(job({ request_date: '2026-05-01', required_date: '2026-09-30' }), TODAY);
    expect(info.title).toContain('ยังไม่ถึงวันที่ต้องการ');
    expect(info.title).not.toContain('ด่วน');
  });

  it('เลยวันที่ต้องการแล้ว = กลับไปใช้ระดับตามจำนวนวันเหมือนเดิม', () => {
    // ต้องการ 9 ส.ค. ผ่านมา 10 วัน → 8–30 วัน = warming
    const late = job({ request_date: '2026-07-01', required_date: '2026-08-09' });
    const info = getJobAgeChipInfo(late, TODAY);
    expect(info.level).toBe('warming');
    expect(info.text).toBe('10 วัน');
    expect(info.cardText).toBe('ผ่านมา 10 วัน');
    expect(info.title).toContain('ผ่านมา 10 วัน');
  });

  it('ย้อนหลัง (ต้องการก่อนวันที่กรอก) นับจากวันที่กรอกเหมือนเดิม', () => {
    const retro = job({ request_date: '2026-06-10', required_date: '2026-06-01' });
    const info = getJobAgeChipInfo(retro, TODAY);
    expect(info.level).toBe('critical'); // 70 วัน
    expect(info.text).toBe('70 วัน');
  });

  it('ทุกระดับของชิปมีสี/ป้ายครบ — advance ต้องมีคู่ dark ด้วย', () => {
    for (const lv of ['fresh', 'warming', 'urgent', 'critical', 'unknown', 'advance'] as const) {
      const meta = JOB_AGE_CHIP_META[lv];
      expect(meta.label, lv).toBeTruthy();
      expect(meta.chipCls, lv).toBeTruthy();
      expect(meta.barCls, lv).toBeTruthy();
      expect(meta.dotCls, lv).toBeTruthy();
      // กติกาข้อ 4 ของโปรเจกต์: ทุกสีธีมสว่างต้องมีคู่ dark (bg ด้วย ไม่ใช่แค่ text/border)
      expect(meta.chipCls, `${lv} ต้องมี dark:bg`).toMatch(/dark:bg-/);
    }
  });
});
