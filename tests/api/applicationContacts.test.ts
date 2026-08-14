// @vitest-environment node
/**
 * บันทึกผลการติดต่อผู้สมัคร (ลิสต์ข้อ 7 · 14 ส.ค. 2569)
 *
 * เกณฑ์ที่ล็อก: ฝั่ง "ไม่สำเร็จ" ห้ามมีวันนัด/ใบขอติดไป · ฝั่ง "สำเร็จ" ห้ามมีเหตุผลติดไป
 * · สถานะใบขยับตามขั้นที่คนทำ (นัดได้=converted · ที่เหลือ=contacted) — เจ้าของเคาะ
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(async () => ({ rows: [{ id: 'log-1' }] })),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { createContactLog, loadContactAppointments } = await import(
  '../../api/_lib/applicationContacts.js'
);

const insertParams = () => {
  const call = vi
    .mocked(dbQuery)
    .mock.calls.find((c) => /insert into\s+application_contact_logs/i.test(String(c[0])));
  return (call?.[1] ?? []) as unknown[];
};
const statusParams = () => {
  const call = vi
    .mocked(dbQuery)
    .mock.calls.find((c) => /update\s+public_job_applications/i.test(String(c[0])));
  return (call?.[1] ?? []) as unknown[];
};

beforeEach(() => {
  vi.mocked(dbQuery).mockClear();
  vi.mocked(dbQuery).mockResolvedValue({ rows: [{ id: 'log-1' }] } as never);
});

describe('createContactLog — เคลียร์ฟิลด์ข้ามฝั่ง + ขยับสถานะ', () => {
  it('สำเร็จ+นัดได้ → เก็บนัด/ใบขอ · เหตุผลถูกล้าง · สถานะ = converted', async () => {
    await createContactLog({
      applicationId: 'app-1',
      ok: true,
      reasonId: 'r-ปนมา',
      reasonLabel: 'เหตุผลที่ไม่ควรติดไป',
      appointmentAt: '2026-08-20T05:00:00.000Z',
      appointmentPlace: 'สำนักงานใหญ่',
      jobId: 'siamraj-sql:OPL1',
      jobLabel: 'พนักงานขับรถ — หน่วยงาน ก',
    });
    const p = insertParams();
    expect(p[2]).toBeNull(); // reason_id ถูกล้าง
    expect(p[3]).toBeNull(); // reason_label ถูกล้าง
    expect(p[4]).toBe('2026-08-20T05:00:00.000Z');
    expect(p[6]).toBe('siamraj-sql:OPL1');
    expect(statusParams()[1]).toBe('converted');
  });

  it('สำเร็จ+ยังนัดไม่ได้ → ไม่มีนัด/ใบขอ · สถานะ = contacted', async () => {
    await createContactLog({ applicationId: 'app-1', ok: true, appointmentAt: null });
    const p = insertParams();
    expect(p[4]).toBeNull();
    expect(p[6]).toBeNull();
    expect(statusParams()[1]).toBe('contacted');
  });

  it('⚠️ ไม่สำเร็จ → วันนัด/ใบขอที่ปนมาถูกล้าง · เหตุผลถูกเก็บ · สถานะ = contacted', async () => {
    await createContactLog({
      applicationId: 'app-1',
      ok: false,
      reasonId: 'r-1',
      reasonLabel: 'โทรไม่ติด',
      appointmentAt: '2026-08-20T05:00:00.000Z', // ฟอร์มค้าง — ห้ามลงฐาน
      jobId: 'siamraj-sql:OPL1',
    });
    const p = insertParams();
    expect(p[2]).toBe('r-1');
    expect(p[3]).toBe('โทรไม่ติด');
    expect(p[4]).toBeNull(); // นัดถูกล้าง
    expect(p[6]).toBeNull(); // ใบขอถูกล้าง
    expect(statusParams()[1]).toBe('contacted');
  });

  it('ใบขอ (job_id) เก็บเฉพาะเมื่อมีนัดจริง — "หาล่วงหน้า" = null', async () => {
    await createContactLog({
      applicationId: 'app-1',
      ok: true,
      appointmentAt: '2026-08-20T05:00:00.000Z',
      jobId: '', // ฟอร์มส่งค่าว่าง = หาล่วงหน้า
      jobLabel: 'หาล่วงหน้า',
    });
    const p = insertParams();
    expect(p[6]).toBeNull(); // trimTo('') = null
    expect(p[7]).toBe('หาล่วงหน้า'); // label ยังบอกว่าหาล่วงหน้า
  });
});

describe('loadContactAppointments — นัดล่าสุดต่อใบ', () => {
  it('ใช้ DISTINCT ON เอานัดล่าสุด (เลื่อนนัด = รอบใหม่ทับ) · เฉพาะแถวที่มีนัด', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] } as never);
    await loadContactAppointments(['a1', 'a2']);
    const sql = String(vi.mocked(dbQuery).mock.calls[0]?.[0] ?? '');
    expect(sql).toMatch(/distinct on \(application_id\)/i);
    expect(sql).toMatch(/appointment_at is not null/);
    expect(sql).toMatch(/order by application_id, created_at desc/i);
  });

  it('ตารางยังไม่ migrate (42P01) → คืน map ว่าง ไม่พัง', async () => {
    const undefinedTable = Object.assign(new Error('no table'), { code: '42P01' });
    vi.mocked(dbQuery).mockRejectedValue(undefinedTable);
    const out = await loadContactAppointments(['a1']);
    expect(out.size).toBe(0);
  });

  it('ไม่มี id = ไม่ยิงคิวรีเลย', async () => {
    await loadContactAppointments([]);
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });
});
