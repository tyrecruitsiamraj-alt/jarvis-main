// @vitest-environment node
/**
 * Journey งานสรรหา (เจ้าของ 4 ต.ค. 2569):
 * 1 เก็บคนสนใจจากแท็บผู้สมัคร → 2 ย้ายไปการติดต่อ "ของใครของมัน" → 3 ติดต่อสำเร็จ/ไม่สำเร็จ →
 * 4 สำเร็จ = นัดได้ไหม (ไม่ได้ = เหตุผล) → 5 นัดที่ไหนแบบ iRecruit → 6 ไม่สำเร็จ = เหตุผล
 *
 * ล็อก: Lead ของคนอื่นไม่เข้าแท็บการติดต่อเรา · นัดหมายไม่สำเร็จเก็บเหตุผล+ไม่มีวันนัด+สถานะ contacted ·
 * ขั้นตอนบนแถวเป็น "นัดหมาย · ไม่สำเร็จ" · สถานที่ "อื่นๆ" ใช้คำที่พิมพ์
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(async () => ({ rows: [{ id: 'log-1' }] })),
  isPgUndefinedTable: () => false,
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { createContactLog, isAppointmentFailedLog, loadLatestContactResults } = await import(
  '../../api/_lib/applicationContacts.js'
);
const { isInRmTab } = await import('../../src/lib/recruitRm');
const { applicantProcessOf } = await import('../../src/lib/applicantProcess');
const { APPOINTMENT_PLACES, appointmentPlaceValue, appointmentLogs, isAppointmentFailedContact } = await import(
  '../../src/lib/applicantDetail'
);
type App = import('../../src/lib/publicApplicationsApi').PublicApplication;

const insertParams = () =>
  (vi.mocked(dbQuery).mock.calls.find((c) => /insert into\s+application_contact_logs/i.test(String(c[0])))?.[1] ??
    []) as unknown[];
const statusParams = () =>
  (vi.mocked(dbQuery).mock.calls.find((c) => /update\s+public_job_applications/i.test(String(c[0])))?.[1] ??
    []) as unknown[];

beforeEach(() => {
  vi.mocked(dbQuery).mockClear();
  vi.mocked(dbQuery).mockResolvedValue({ rows: [{ id: 'log-1' }] } as never);
});

describe('ข้อ 2 — แท็บการติดต่อ = ของใครของมัน', () => {
  const row = (over: Partial<App>) => ({ id: 'a', status: 'new', ...over }) as App;
  it('Lead ที่ฉันเก็บ → การติดต่อ · Lead ของคนอื่น (หลุดมา) → ไม่เข้าการติดต่อของฉัน', () => {
    expect(isInRmTab(row({ is_lead: true, lead_by_me: true }), 'contact')).toBe(true);
    expect(isInRmTab(row({ is_lead: true, lead_by_me: false }), 'contact')).toBe(false);
    expect(isInRmTab(row({ claimed_by_me: true }), 'contact')).toBe(true);
  });
  it('server เก่าไม่ส่ง lead_by_me → ถือตาม is_lead เหมือนเดิม (ไม่ทำใบหาย)', () => {
    expect(isInRmTab(row({ is_lead: true }), 'contact')).toBe(true);
  });
});

describe('ข้อ 4 — ติดต่อสำเร็จ แต่นัดหมายไม่สำเร็จ', () => {
  it('เก็บเหตุผล · ไม่มีวันนัด/สถานที่/ใบขอ แม้ payload ส่งปนมา · สถานะ contacted', async () => {
    await createContactLog({
      applicationId: 'app-1',
      ok: true,
      appointmentFailed: true,
      reasonId: 'r-appt',
      reasonLabel: 'ไม่สะดวกสมัคร',
      appointmentAt: '2026-10-10T05:00:00.000Z',
      appointmentPlace: 'บูธคู้บอน',
      jobId: 'siamraj-sql:OPL1',
    });
    const p = insertParams();
    expect(p[1]).toBe(true);
    expect(p[2]).toBe('r-appt');
    expect(p[3]).toBe('ไม่สะดวกสมัคร');
    expect(p[4]).toBeNull();
    expect(p[5]).toBeNull();
    expect(p[6]).toBeNull();
    expect(statusParams()[1]).toBe('contacted');
  });
  it('ติดต่อสำเร็จเฉย ๆ (ไม่ได้บอกว่านัดไม่สำเร็จ) ยังล้างเหตุผลเหมือนเดิม', async () => {
    await createContactLog({ applicationId: 'app-1', ok: true, reasonLabel: 'ปนมา' });
    expect(insertParams()[3]).toBeNull();
  });
  it('อ่านกลับ: ผลล่าสุดบอกว่านัดหมายไม่สำเร็จ', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({
      rows: [
        { application_id: 'a', ok: true, created_at: 't', reason_label: 'ไม่สะดวกสมัคร', appointment_at: null },
        { application_id: 'b', ok: true, created_at: 't', reason_label: null, appointment_at: null },
      ],
    } as never);
    const m = await loadLatestContactResults(['a', 'b']);
    expect(m.get('a')?.appointmentFailed).toBe(true);
    expect(m.get('b')?.appointmentFailed).toBe(false);
    expect(isAppointmentFailedLog({ ok: false, reasonLabel: 'x', appointmentAt: null })).toBe(false);
  });
  it('ขั้นตอนบนแถว = นัดหมาย · ไม่สำเร็จ', () => {
    expect(applicantProcessOf({ last_contact_ok: true, last_appointment_failed: true } as App)).toEqual({
      step: 'appointment',
      state: 'fail',
    });
    expect(applicantProcessOf({ last_contact_ok: true } as App)).toEqual({ step: 'appointment', state: 'pending' });
  });
  it('ประวัติแท็บการนัดหมายมีแถวนัดไม่สำเร็จด้วย', () => {
    const base = { id: '1', applicationId: 'a', jobId: null, jobLabel: null, note: null, createdByName: null, createdAt: 't', reasonId: null };
    const logs = [
      { ...base, id: '1', ok: true, reasonLabel: 'ไม่สะดวกสมัคร', appointmentAt: null, appointmentPlace: null },
      { ...base, id: '2', ok: true, reasonLabel: null, appointmentAt: '2026-10-10', appointmentPlace: 'Online' },
      { ...base, id: '3', ok: true, reasonLabel: null, appointmentAt: null, appointmentPlace: null },
    ];
    expect(appointmentLogs(logs).map((l) => l.id)).toEqual(['1', '2']);
    expect(isAppointmentFailedContact(logs[0])).toBe(true);
  });
});

describe('ข้อ 5 — นัดที่ไหนแบบ iRecruit', () => {
  it('รายการสถานที่ชุดเดียวกับ iRecruit', () => {
    expect([...APPOINTMENT_PLACES]).toEqual([
      'บูธคู้บอน',
      'บูธศรีราชา',
      'บูธโลตัส ลาดพร้าว',
      'บูธโลตัส พระราม 3',
      'สำนักงานใหญ่',
      'BigC สุวินทวงศ์',
      'Online',
      'อื่นๆ',
    ]);
  });
  it('อื่นๆ = ใช้คำที่พิมพ์ · ว่าง = null (ฟอร์มบังคับ)', () => {
    expect(appointmentPlaceValue('บูธศรีราชา', 'ไม่ใช้')).toBe('บูธศรีราชา');
    expect(appointmentPlaceValue('อื่นๆ', '  ตลาดไท ')).toBe('ตลาดไท');
    expect(appointmentPlaceValue('อื่นๆ', ' ')).toBeNull();
    expect(appointmentPlaceValue('', '')).toBeNull();
  });
});
