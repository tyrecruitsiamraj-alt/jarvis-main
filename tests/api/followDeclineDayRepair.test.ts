// @vitest-environment node
/**
 * 🔴 ตอบ AI ว่า "วันนี้ไม่ไป" → หยุดแค่วันนั้น วันถัดไปโทรต่อ (เจ้าของ 7 ต.ค. 2569 · Choice "ส่ง AI โทรต่อตามตาราง")
 * ของจริงที่เจอ: 3 คนตอบไม่ไปวันแรก (ลาป่วย/วันหยุด) → แผนทุกวันที่ Lumos ถูกยกเลิก แต่จอขึ้น "ส่งให้ AI แล้ว" 14 สาย
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const resync = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({ getLumosPushConfig: () => ({ url: 'x' }) }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({ resyncFollowPlanWithLumos: (...a: unknown[]) => resync(...a) }));
vi.mock('../../api/_lib/followStaffName.js', () => ({ staffNameOfPhone: vi.fn() }));

const mod = await import('../../api/_lib/followDeclineDayRepair');

describe('หาแถวที่ค้าง', () => {
  it('AI · เปิดอยู่ · คิวยกเลิกหมด · ชุดเดียวกันตอบ declined วันก่อนหน้า (วันเดียวกันไม่แตะ) · ไม่ใช่ส่งคนแทน', () => {
    const sql = mod.declineOrphanSql();
    expect(sql).toContain("coalesce(f.call_mode, 'ai') = 'ai'");
    expect(sql).toContain("q.status <> 'cancelled'");
    expect(sql).toContain("x.last_outcome = 'declined'");
    expect(sql).toContain("(g.scheduled_at at time zone 'Asia/Bangkok')::date < (f.scheduled_at at time zone 'Asia/Bangkok')::date");
    expect(sql).toContain("<> 'replacement'");
    // 🔴 ข้อ 3 (7 ต.ค. 2569): เลยเวลาแล้วไม่แตะ — ไม่สลับเป็นคนโทรเอง
    expect(sql).toContain("f.scheduled_at > now() + interval '3 minutes'");
  });
});

describe('ซ่อม', () => {
  it('ยังไม่ถึงเวลา = คืนคิวแล้วส่งแผนใหม่ทีละชุด · 🔴 ไม่มีการสลับเป็นคนโทร', async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('select f.id::text')) {
        return {
          rows: [
            { id: 'past1', group_id: 'g1', future: false },
            { id: 'a1', group_id: 'g1', future: true },
            { id: 'a2', group_id: 'g1', future: true },
            { id: 'b1', group_id: 'g2', future: true },
          ],
        };
      }
      return { rows: [] };
    });
    resync.mockResolvedValue({ rounds: 2, cancelled: true, pushed: true });
    const r = await mod.repairDeclinedFollowDays();
    expect(resync).toHaveBeenCalledTimes(2);
    expect(resync.mock.calls[0][0]).toBe('a1');
    expect(resync.mock.calls[1][0]).toBe('b1');
    const repend = dbQuery.mock.calls.find((c) => String(c[0]).includes("set status = 'pending'"));
    expect(repend?.[1]).toEqual([['follow-a1', 'follow-a2']]);
    expect(r).toEqual({ resent: 4, groups: 2, errors: 0 });
    expect(dbQuery.mock.calls.some((c) => String(c[0]).includes("call_mode = 'manual'"))).toBe(false);
  });

  it('ผูกกับตัวส่งซ้ำงานติดตาม (เดินทุกรอบ บนเครื่องที่มีคีย์ push)', () => {
    const w = readFileSync(new URL('../../api/_lib/followPushRetryWorker.ts', import.meta.url), 'utf8');
    expect(w).toContain('await repairDeclinedFollowDays();');
  });
});
