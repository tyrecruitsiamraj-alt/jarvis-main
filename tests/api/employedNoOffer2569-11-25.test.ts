// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isAppointmentFailedReturn, rmShownViewOf, RM_LIST_VIEWS_SHOWN, RM_LIST_VIEW_LABEL } from '../../src/lib/recruitRm';
import { rmRowStatusOf } from '../../src/lib/applicantAiAnswerText';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

/**
 * เจ้าของ 25 พ.ย. 2569
 * 1. "คนที่ได้งานแล้วห้ามส่ง AI เสนองาน" — วรรณา เริ่มงาน 24/11 แล้วกด "หาคนเพิ่ม + ส่ง AI โทร" ใบอื่น 25/11 AI โทรเสนองาน
 * 2. "ไอที่ดึงนัดหมายไม่สำเร็จออกมา แยกไปไว้อีกกล่องว่า นัดหมายไม่สำเร็จ" (Choice กล่องในแท็บผู้สมัคร)
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('ได้งานแล้วห้ามส่ง AI เสนองาน', () => {
  it('ตัวตรวจ: สายติดตามงานไม่ยกเลิกใน 60 วัน · ผลล่าสุด "ไม่ไปเริ่มงาน" = ยังหางาน', () => {
    const src = read('api/_lib/lumosDispatch.ts');
    expect(src).toContain('export const EMPLOYED_FOLLOW_DAYS = 60;');
    expect(src).toContain("<> 'no_show_start'");
    expect(src).toContain('and f.cancelled_at is null');
  });
  it('ด่านอยู่ที่ insertQueueItems (ครอบทุกเส้นเสนองาน) · สายติดตามไม่ใช้ · อ่านไม่ได้ = กันไว้ก่อน', () => {
    const src = read('api/_lib/lumosDispatch.ts');
    expect(src).toContain("if (jobRef !== 'follow') {");
    expect(src).toContain('employedPhones = await phonesWithWork(');
    expect(src).toContain('if (employedPhones === null) {\n        guarded.push(item.personRef);');
    expect(src).toContain('if (employedPhones.has(phone)) {\n        employed.push(item.personRef);');
    // ทุกเส้นเสนองานรายงานเหตุบนจอ (ไม่ตกไปนับเป็น "เคยส่งแล้ว")
    // 5 เส้นรายงานทีละเหตุ + บททักทายรายงานเป็นรายการ
    expect((src.match(/reason: EMPLOYED_REASON/g) ?? []).length).toBe(5);
    expect(src).toContain('[employed, EMPLOYED_REASON],');
    // 25 พ.ย. 2569: เส้นจับคู่งานต่อท้าย ...matchBusy (1 คน 1 ใบ)
    expect((src.match(/\.\.\.guarded, \.\.\.employed(, \.\.\.matchBusy)?\]/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });
  it('คิวรีที่ส่งไปฐาน: ส่งเบอร์ชุดเดียว + 60 วัน · เบอร์ว่าง = ไม่ถามฐาน', async () => {
    const dbQuery = vi.fn().mockResolvedValue({ rows: [{ phone: '+66818795281' }] });
    vi.doMock('../../api/_lib/postgres.js', () => ({ dbQuery, dbTransaction: vi.fn(), isPgUndefinedTable: () => false, isPgUniqueViolation: () => false }));
    const { phonesWithWork } = await import('../../api/_lib/lumosDispatch.js');
    expect([...(await phonesWithWork(['+66818795281', '+66818795281', '+66812345678']))]).toEqual(['+66818795281']);
    expect(dbQuery.mock.calls[0][1]).toEqual([['+66818795281', '+66812345678'], 60]);
    dbQuery.mockClear();
    expect((await phonesWithWork([])).size).toBe(0);
    expect(dbQuery).not.toHaveBeenCalled();
    vi.doUnmock('../../api/_lib/postgres.js');
  });
});

describe('กล่อง "นัดหมายไม่สำเร็จ" ในแท็บผู้สมัคร', () => {
  const app = (o: Partial<PublicApplication>): PublicApplication =>
    ({
      id: 'f7264d3f-ffd6-419b-b5c4-b2679e2666ca',
      full_name: 'นายวิชญ์ วิโรจน์',
      phone: '0955709357',
      status: 'contacted',
      created_at: '2026-10-28T03:00:00Z',
      appointment_at: '2026-10-30T04:00:00Z',
      ai_answer: { micro: 'interested', at: '2026-10-28T05:00:00Z' },
      last_call_outcome: 'confirmed',
      ...o,
    }) as PublicApplication;
  it('ไม่มาตามนัด / ไม่ผ่าน ที่ถูกคืนแท็บผู้สมัคร = กล่องนี้ ก่อนผลโทร "สนใจ"', () => {
    expect(rmShownViewOf(app({ attendance_result: 'no_show' }))).toBe('appt_failed');
    expect(rmShownViewOf(app({ attendance_result: 'showed', screening_result: 'not_passed' }))).toBe('appt_failed');
    // ยังอยู่แท็บนัดหมาย (นัดใหม่) = ไม่ใช่กล่องนี้
    expect(isAppointmentFailedReturn(app({ status: 'converted', attendance_result: 'no_show' }))).toBe(false);
    expect(RM_LIST_VIEW_LABEL.appt_failed).toBe('นัดหมายไม่สำเร็จ');
    expect(RM_LIST_VIEWS_SHOWN.indexOf('appt_failed')).toBe(RM_LIST_VIEWS_SHOWN.indexOf('declined') + 1);
  });
  it('คอลัมน์คำตอบกับ AI บอกเหตุ', () => {
    expect(rmRowStatusOf(app({ attendance_result: 'no_show' }))).toMatchObject({ title: 'นัดหมายไม่สำเร็จ', tone: 'danger' });
    expect(rmRowStatusOf(app({ attendance_result: 'no_show' })).detail).toContain('ไม่มาตามนัด');
    expect(rmRowStatusOf(app({ screening_result: 'not_passed' })).detail).toContain('ไม่ผ่าน');
  });
});
