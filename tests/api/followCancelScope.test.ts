// @vitest-environment node
/** 🔴 ยกเลิก 3 แบบ (เจ้าของ 7 ต.ค. 2569 Journey ข้อ 2) — สายนี้ / ทั้งวัน / เลิกตามคนนี้ */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const resync = vi.fn();
const cancelPlan = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({ getLumosPushConfig: () => ({ url: 'x' }) }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({
  resyncFollowPlanWithLumos: (...a: unknown[]) => resync(...a),
  cancelPushedReminderIgnoringMissing: (...a: unknown[]) => cancelPlan(...a),
}));
vi.mock('../../api/_lib/followStaffName.js', () => ({ staffNameOfPhone: vi.fn() }));

const mod = await import('../../api/_lib/followCancelScope');

beforeEach(() => {
  dbQuery.mockReset();
  resync.mockReset();
  cancelPlan.mockReset();
});

describe('หาสายที่จะยกเลิก', () => {
  it('คนเดียวกัน = เบอร์ 9 หลักท้าย + ทีมเดียวกัน (ไม่ใช่ group_id) · ยกเลิกเฉพาะสายที่ยังไม่มีผล · ทั้งวัน = วันเดียวกันเวลาไทย', () => {
    const sql = mod.cancelScopeTargetsSql();
    expect(sql).toContain("right(regexp_replace(coalesce(f.recipient_phone, ''), '\\D', '', 'g'), 9)");
    expect(sql).toContain("coalesce(f.follow_team, '') = coalesce(a.follow_team, '')");
    expect(sql).toContain('f.staff_called_at is null');
    expect(sql).toContain('q.first_result_at is not null');
    expect(sql).toContain("(f.scheduled_at at time zone 'Asia/Bangkok')::date = (a.scheduled_at at time zone 'Asia/Bangkok')::date");
    expect(sql).not.toContain('group_id');
  });
  it('รับแค่ day / person', () => {
    expect(mod.parseCancelScope('day')).toBe('day');
    expect(mod.parseCancelScope('person')).toBe('person');
    expect(mod.parseCancelScope('set')).toBeNull();
  });
});

describe('แจ้ง Lumos ทีละแผน', () => {
  it('แผนไม่เหลือสายรอโทร = ยกเลิกแผน · ยังเหลือ = ส่งแผนใหม่จากสายที่เหลือ', async () => {
    dbQuery.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('with a as')) return { rows: [{ id: 'a1' }, { id: 'a2' }] };
      if (sql.includes('select distinct coalesce(plan_ref')) return { rows: [{ plan: 'follow-a1' }, { plan: 'follow-x9' }] };
      if (sql.includes('order by next_attempt_at limit 1')) return { rows: params[0] === 'follow-x9' ? [{ id: 'x9' }] : [] };
      return { rows: [] };
    });
    resync.mockResolvedValue({ rounds: 1, pushed: true, cancelled: true });
    const out = await mod.cancelFollowScope('a1', 'day', { sub: 'u', email: null });
    expect(out).toEqual({ ids: ['a1', 'a2'], lumosFailed: 0 });
    expect(cancelPlan).toHaveBeenCalledWith('follow-a1');
    expect(resync).toHaveBeenCalledWith('x9', expect.anything());
  });
  it('ผูกกับเส้นยกเลิก (DELETE ?scope=)', () => {
    const h = readFileSync(new URL('../../api/_handlers/follow.ts', import.meta.url), 'utf8');
    expect(h).toContain('parseCancelScope(getString(req.query?.scope))');
  });
});
