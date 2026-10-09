// @vitest-environment node
/**
 * ═══ ห้ามยกเลิกแผนที่จบไปแล้วซ้ำ (เจ้าของ 9 ต.ค. 2569 "ถ้ามันผิดที่เราก็ต้องแก้ที่เรา ไม่แก้ชุ่ยๆ") ═══
 *
 * เคสจริง 9 ต.ค. 2569: Lumos ขึ้น "ยกเลิก" ทั้ง 3 เคส (อิทธิชัย · ณัฐพล · สมชัย) แต่ฐานเรายัง "รอโทร"
 * จังหวะเดียวกันหมด: ส่ง DELETE รหัสแผนที่จบไปแล้ว ⇒ แผนใหม่ของเบอร์เดียวกันโดนยกเลิกตาม
 *
 * 🔴 ด่าน:
 * 1. แผนที่ทำเครื่องหมายว่าจบแล้ว (141) / ทุกสายได้ผลครบ ⇒ ไม่ส่ง DELETE
 * 2. แผนที่ยังวิ่งอยู่ ⇒ ส่ง DELETE แล้วทำเครื่องหมายว่าจบ · 404 = ไม่มีของค้าง (ทำเครื่องหมายด้วย)
 * 3. error อื่นโยนต่อ ไม่ทำเครื่องหมาย (ผู้เรียกต้องไม่ส่งแผนใหม่ทับ)
 * 4. ยังไม่ migrate 141 ⇒ ส่งตามเดิม
 * 5. เล่นซ้ำเคสสมชัย: แก้สาย 07:45 ที่ยังถือรหัสแผนเก่า (ยกเลิกไปแล้ว) ⇒ ไม่ส่ง DELETE รหัสนั้นซ้ำ
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const pushReminders = vi.fn();
const cancelPushedReminder = vi.fn();

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: () => false,
}));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  pushReminders: (...a: unknown[]) => pushReminders(...a),
  cancelPushedReminder: (...a: unknown[]) => cancelPushedReminder(...a),
  getLumosPushConfig: () => ({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' }),
  pushInterviews: vi.fn(),
  cancelPushedInterview: vi.fn(),
  getEventStatus: vi.fn(),
}));

const { cancelFollowPlanAtLumos } = await import('../../api/_lib/followLumosCancel.js');
const { replanFollowSetWithLumos } = await import('../../api/_lib/lumosDispatch.js');

const sqls = () => dbQuery.mock.calls.map((c) => String(c[0]));
const marked = () => sqls().filter((q) => /set lumos_plan_closed_at = now\(\)/.test(q));

beforeEach(() => {
  dbQuery.mockReset();
  pushReminders.mockReset().mockResolvedValue({ results: [{ event_id: 'evt' }] });
  cancelPushedReminder.mockReset().mockResolvedValue({ accepted: 1 });
});

function closedIs(closed: boolean | 'no-column') {
  dbQuery.mockImplementation((sql: string) => {
    if (/as closed/.test(sql)) {
      if (closed === 'no-column') return Promise.reject(Object.assign(new Error('column does not exist'), { code: '42703' }));
      return Promise.resolve({ rows: [{ closed }] });
    }
    return Promise.resolve({ rows: [] });
  });
}

describe('cancelFollowPlanAtLumos', () => {
  it('🔴 แผนจบแล้ว ⇒ ไม่ส่ง DELETE', async () => {
    closedIs(true);
    expect(await cancelFollowPlanAtLumos('follow-old')).toBe('skipped_closed');
    expect(cancelPushedReminder).not.toHaveBeenCalled();
  });

  it('ตัวตัดสิน "จบแล้ว" = มีเครื่องหมาย (141) หรือทุกสายในแผนได้ผลครบ (completed/failed)', async () => {
    closedIs(true);
    await cancelFollowPlanAtLumos('follow-old');
    const q = sqls().find((s) => /as closed/.test(s)) ?? '';
    expect(q).toMatch(/lumos_plan_closed_at is not null/);
    expect(q).toMatch(/status not in \('completed', 'failed'\)/);
  });

  it('แผนยังวิ่งอยู่ ⇒ ส่ง DELETE แล้วทำเครื่องหมายว่าจบ', async () => {
    closedIs(false);
    expect(await cancelFollowPlanAtLumos('follow-live')).toBe('cancelled');
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-live');
    expect(marked()).toHaveLength(1);
  });

  it('404 = Lumos ไม่มีแผนนี้แล้ว ⇒ ถือว่าสำเร็จ + ทำเครื่องหมาย', async () => {
    closedIs(false);
    cancelPushedReminder.mockRejectedValue(new Error('ยกเลิก Lumos reminder ล้มเหลว: 404 Not Found'));
    expect(await cancelFollowPlanAtLumos('follow-gone')).toBe('missing');
    expect(marked()).toHaveLength(1);
  });

  it('🔴 error อื่น ⇒ โยนต่อ · ไม่ทำเครื่องหมาย', async () => {
    closedIs(false);
    cancelPushedReminder.mockRejectedValue(new Error('502 upstream'));
    await expect(cancelFollowPlanAtLumos('follow-live')).rejects.toThrow(/502/);
    expect(marked()).toHaveLength(0);
  });

  it('ยังไม่ migrate 141 ⇒ ส่งตามเดิม', async () => {
    closedIs('no-column');
    expect(await cancelFollowPlanAtLumos('follow-x')).toBe('cancelled');
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-x');
  });
});

describe('🔴 เล่นซ้ำเคสสมชัย 8 ต.ค. 18:46:28', () => {
  it('แก้สาย 07:45 ที่ยังถือรหัสแผนเก่า (ยกเลิกไปแล้ว) ⇒ ไม่ส่ง DELETE รหัสนั้นซ้ำ · แผน 07:00 ไม่ถูกแตะ', async () => {
    const tomorrow = (hh: number, mm: number) => {
      const ymd = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      return new Date(`${ymd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`);
    };
    const row = (id: string, at: Date) => ({
      id,
      recipient_name: 'สมชัย',
      recipient_phone: '+66860000000',
      topic: 'ติดตามส่งคนแทน',
      note: 'เข้างาน 08:00 น.',
      staff_phone: null,
      unit_name: 'PDPC',
      scheduled_at: at.toISOString(),
      call_times: null,
      call_round: 1,
    });
    const s0700 = row('s0700', tomorrow(7, 0));
    const s0745 = row('s0745', tomorrow(7, 45));
    dbQuery.mockImplementation((sql: string, params?: unknown[]) => {
      // รหัสแผนเก่าที่ค้างอยู่ที่แถว 07:45 = แผนที่ยกเลิกไปแล้ว
      if (/as closed/.test(sql)) return Promise.resolve({ rows: [{ closed: (params?.[0] as string) === 'follow-oldset' }] });
      // หลังแก้ 9 ต.ค.: เพื่อนเบอร์เดียวกันวันเดียวกัน (07:00) ถูกดึงมารวมแผน
      if (/select distinct m\.id::text as id/i.test(sql)) return Promise.resolve({ rows: [{ id: 's0700' }, { id: 's0745' }] });
      if (/select distinct coalesce\(plan_ref, person_ref\) as ref/i.test(sql)) {
        return Promise.resolve({ rows: [{ ref: 'follow-oldset' }, { ref: 'follow-s0700' }] });
      }
      if (/from .*follow_entries f/i.test(sql) && /select f\.id/i.test(sql)) return Promise.resolve({ rows: [s0700, s0745] });
      if (/select person_ref from .*lumos_dispatch_queue/i.test(sql)) {
        return Promise.resolve({ rows: ((params?.[0] as string[]) ?? []).map((person_ref) => ({ person_ref })) });
      }
      return Promise.resolve({ rows: [] });
    });
    const out = await replanFollowSetWithLumos({ memberIds: ['s0745'], cancelledIds: [], resolveStaffName: async () => null });
    const cancelled = cancelPushedReminder.mock.calls.map((c) => c[0]);
    expect(cancelled).not.toContain('follow-oldset');
    // แผน 07:00 ที่วิ่งอยู่ยกเลิกแล้วส่งใหม่รวมเป็นแผนเดียว 2 สาย (ไม่หายเงียบ)
    expect(cancelled).toContain('follow-s0700');
    expect(out).toMatchObject({ plans: 1, pushedPlans: 1, rounds: 2 });
    const rec = pushReminders.mock.calls[0][0] as { steps?: unknown[]; reminders?: Array<{ steps: unknown[] }> };
    expect((rec.reminders?.[0] ?? rec).steps).toHaveLength(2);
  });
});
