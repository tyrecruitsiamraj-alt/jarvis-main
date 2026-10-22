// @vitest-environment node
/**
 * ล้างแผนติดตามรหัสเดิม (เจ้าของ 22 ต.ค. 2569 Choice "ล้างทีเดียว") — ทีม Lumos ยกเลิกให้ก่อน แล้วแอดมินกดส่งใหม่ด้วยรหัสใหม่
 * ด่านที่ห้ามหลุด: ทำเครื่องหมาย "จบแล้ว" ที่หัวขบวนเดิมก่อนส่งใหม่ (ไม่ยิง DELETE แผนที่ Lumos ยกเลิกไปแล้ว)
 */
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: Array<{ sql: string; params: unknown[] }> = [];
const order: string[] = [];
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (/array_agg\(f\.id::text/.test(sql)) {
      return { rows: [{ plan_ref: 'follow-a', member_ids: ['a', 'a2'] }, { plan_ref: 'follow-b', member_ids: ['b'] }] };
    }
    if (/having bool_and\(f\.cancelled_at is not null\)/.test(sql)) {
      return {
        rows: [
          { plan_ref: 'follow-p1', times: '23/10 07:30 · 23/10 08:30', live_on_phone: false },
          { plan_ref: 'follow-p2', times: '24/10 07:00', live_on_phone: true },
        ],
      };
    }
    if (/lumos_plan_closed_at = coalesce/.test(sql)) order.push(`close:${params[0]}`);
    return { rows: [] };
  }),
}));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({
  replanFollowSetWithLumos: vi.fn(async (input: { memberIds: string[] }) => {
    order.push(`replan:${input.memberIds.join(',')}`);
    return input.memberIds[0] === 'b'
      ? { rounds: 1, plans: 1, cancelledOld: true, pushedPlans: 0, states: {}, reason: 'ส่งไม่สำเร็จ' }
      : { rounds: 2, plans: 1, cancelledOld: true, pushedPlans: 1, states: {} };
  }),
}));

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('ส่งแผนรหัสเดิมกลับด้วยรหัสใหม่', () => {
  beforeEach(() => {
    calls.length = 0;
    order.length = 0;
  });
  it('เลือกเฉพาะหัวขบวน event :v ที่ยังไม่มีรหัส -g และยังมีสาย AI รอโทรในอนาคต', async () => {
    const { listOldIdFollowPlans } = await import('../../api/_lib/followOldIdRepush');
    const plans = await listOldIdFollowPlans();
    expect(plans).toEqual([{ planRef: 'follow-a', memberIds: ['a', 'a2'] }, { planRef: 'follow-b', memberIds: ['b'] }]);
    const sql = calls[0].sql;
    expect(sql).toContain("l.push_event_id like '%:v%'");
    expect(sql).toContain('l.lumos_client_id is null');
    expect(sql).toContain('f.scheduled_at > now()');
    expect(sql).toContain("q.status = 'pending'");
  });
  it('🔴 ทำเครื่องหมายจบแล้วก่อนส่งใหม่ทุกแผน · นับส่งได้/ไม่ได้', async () => {
    const { repushOldIdFollowPlans } = await import('../../api/_lib/followOldIdRepush');
    const out = await repushOldIdFollowPlans(async () => null);
    expect(order).toEqual(['close:follow-a', 'replan:a,a2', 'close:follow-b', 'replan:b']);
    expect(out).toMatchObject({ plans: 2, calls: 3, pushed: 1 });
    expect(out.failed).toEqual([{ planRef: 'follow-b', reason: 'ส่งไม่สำเร็จ' }]);
  });
  it('🔴 ยิงยกเลิกซ้ำ: ข้ามเบอร์ที่ยังมีสายรอโทร · ยิงตรงรหัสแผน · ถามสถานะ event ของคำสั่งยกเลิก', async () => {
    const { recancelOldIdFollowPlans } = await import('../../api/_lib/followOldIdRepush');
    const fired: string[] = [];
    const items = await recancelOldIdFollowPlans({
      cancel: async (id) => {
        fired.push(id);
        return { results: [{ event_id: `ev-${id}` }] };
      },
      eventStatus: async () => ({ status: 'imported', error: null }),
      wait: async () => undefined,
    });
    expect(fired).toEqual(['follow-p1']);
    expect(items).toEqual([
      { planRef: 'follow-p1', times: '23/10 07:30 · 23/10 08:30', outcome: 'sent', eventId: 'ev-follow-p1', eventStatus: 'imported', error: null },
      { planRef: 'follow-p2', times: '24/10 07:00', outcome: 'skipped_live_phone' },
    ]);
    expect(read('src/pages/settings/LumosOldIdRepushCard.tsx')).toContain('oldid-recancel-confirm');
  });
  it('API แอดมินเท่านั้น · จดบันทึก · ลงทะเบียนเส้นแล้ว · หน้าจอต้องยืนยันก่อนส่ง', () => {
    const h = read('api/_handlers/follow-oldid-repush.ts');
    expect(h).toContain("if (req.user.role !== 'admin') return sendError(res, 403");
    expect(h).toContain("action: 'follow.oldid_repush'");
    expect(read('api/_handlers/registry.ts')).toContain("'/api/follow-oldid-repush': followOldIdRepushHandler");
    const card = read('src/pages/settings/LumosOldIdRepushCard.tsx');
    expect(card).toContain('ทีม Lumos ยกเลิกแผนรหัสเดิมแล้วใช่ไหม?');
    expect(card).toContain('oldid-confirm');
    expect(read('src/pages/settings/IntegrationKeysTab.tsx')).toContain('<LumosOldIdRepushCard />');
  });
});
