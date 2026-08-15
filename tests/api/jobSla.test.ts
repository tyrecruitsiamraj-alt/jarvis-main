import { describe, expect, it } from 'vitest';
import { computeJobSla } from '../../src/lib/jobSla.js';
import type { JobRequest } from '../../src/types/index.js';

/**
 * SLA เคยพลาด 1 วันทุกใบบน browser ไทย เพราะ addCalendarDays/todayYmd ตัดวันแบบ UTC
 * (parseISO เที่ยงคืน local → toISOString UTC+7 ถอยไปวันก่อน) — ค่าที่ถูกต้องต้องตรงกับ
 * requestControlLedger.test.ts ที่ล็อก slaDueDate ไว้แล้ว
 */
function job(fields: Partial<JobRequest>): JobRequest {
  return fields as JobRequest;
}

describe('computeJobSla — วันครบกำหนดต้องไม่พลาดจาก timezone', () => {
  it('ย้อนหลัง (retroactive): start = วันที่กรอก · +7 วัน = ครบกำหนด (ไม่ใช่ +6)', () => {
    // submitted 10 ก.ค. · required 1 ก.ค. → leadDays < 0 = retroactive
    const sla = computeJobSla(
      job({ submittedAt: '2026-07-10', required_date: '2026-07-01' }),
      'open',
      new Date('2026-07-12T05:00:00Z'),
    );
    expect(sla.requestKind).toBe('retroactive');
    expect(sla.slaStartDate).toBe('2026-07-10');
    expect(sla.slaDueDate).toBe('2026-07-17'); // เคยได้ 2026-07-16 (บั๊ก UTC)
    expect(sla.slaDays).toBe(7);
  });

  it('ล่วงหน้า (advance): start = วันที่ต้องการ · +15 วัน', () => {
    const sla = computeJobSla(
      job({ submittedAt: '2026-07-01', required_date: '2026-07-20' }),
      'open',
      new Date('2026-07-02T05:00:00Z'),
    );
    expect(sla.requestKind).toBe('advance');
    expect(sla.slaStartDate).toBe('2026-07-20');
    expect(sla.slaDueDate).toBe('2026-08-04'); // +15 ข้ามเดือน ต้องไม่พลาด
  });

  it('todayYmd คิดตามปฏิทินกรุงเทพ — ช่วงเที่ยงคืน–07:00 น. ไทยต้องเป็นวันไทย', () => {
    // instant นี้ = 2026-07-17 01:00 น. เวลาไทย (แต่ยังเป็น 07-16 ใน UTC)
    const sla = computeJobSla(
      job({ submittedAt: '2026-07-10', required_date: '2026-07-01' }),
      'open',
      new Date('2026-07-16T18:00:00Z'),
    );
    // daysUsed = วันนี้(ไทย 07-17) − start(07-10) = 7 · ถ้าใช้ UTC จะได้ 6
    expect(sla.daysUsed).toBe(7);
  });
});
