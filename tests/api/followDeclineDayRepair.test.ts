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
  it('AI · เปิดอยู่ · คิวยกเลิกหมด · ชุดเดียวกันตอบ declined วันก่อนหน้า (วันเดียวกันไม่แตะ) · รวมส่งคนแทน', () => {
    const sql = mod.declineOrphanSql();
    expect(sql).toContain("coalesce(f.call_mode, 'ai') = 'ai'");
    expect(sql).toContain("y.status <> 'cancelled'");
    // 🔴 8 ต.ค. 2569: คิว pending แต่แผนถึง Lumos ก่อนคำตอบไม่ไป = แผนโดนยกเลิกที่ Lumos แล้ว ต้องส่งใหม่ด้วย
    expect(sql).toContain('l.push_accepted_at < d.declined_at');
    expect(sql).toContain('coalesce(q.plan_ref, q.person_ref) as plan');
    expect(sql).toContain("x.last_outcome = 'declined'");
    expect(sql).toContain("(g.scheduled_at at time zone 'Asia/Bangkok')::date < (f.scheduled_at at time zone 'Asia/Bangkok')::date");
    // 🔴 8 ต.ค. 2569: ส่งคนแทนตอบไม่ไป ก็หยุดแค่วันนั้นเหมือนกัน — ห้ามตัดทีมส่งคนแทนทิ้ง
    expect(sql).not.toContain("<> 'replacement'");
    // ตอบไม่ไปตอนคอนเฟิร์ม (วันก่อนเข้างาน) ⇒ สายก่อน 1 ชม./15 นาทีของใบเดียวกันไม่ถูกส่งคืน
    expect(sql).toContain("split_part(f.source_ref, ':', 2) = split_part(coalesce(g.source_ref, ''), ':', 2)");
    // 🔴 ข้อ 3 (7 ต.ค. 2569): เลยเวลาแล้วไม่แตะ — ไม่สลับเป็นคนโทรเอง
    expect(sql).toContain("f.scheduled_at > now() + interval '3 minutes'");
  });
});

describe('ซ่อม', () => {
  it('ยังไม่ถึงเวลา = คืนคิวแล้วส่งแผนใหม่ **ทีละแผน** (แผนละวัน) · 🔴 ไม่มีการสลับเป็นคนโทร', async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('select f.id::text')) {
        return {
          rows: [
            { id: 'past1', group_id: 'g1', plan: 'p0', future: false },
            { id: 'a1', group_id: 'g1', plan: 'p1', future: true },
            { id: 'a2', group_id: 'g1', plan: 'p1', future: true },
            // 🔴 ชุดเดียวกัน วันถัดไป = อีกแผน — 7 ต.ค. ส่งแค่แผนแรกของชุด วันนี้ Lumos เลยไม่โทร
            { id: 'a3', group_id: 'g1', plan: 'p2', future: true },
            { id: 'b1', group_id: 'g2', plan: 'p3', future: true },
          ],
        };
      }
      return { rows: [] };
    });
    resync.mockResolvedValue({ rounds: 2, cancelled: true, pushed: true });
    const r = await mod.repairDeclinedFollowDays();
    expect(resync.mock.calls.map((c) => c[0])).toEqual(['a1', 'a3', 'b1']);
    const repend = dbQuery.mock.calls.find((c) => String(c[0]).includes("set status = 'pending'"));
    expect(repend?.[1]).toEqual([['follow-a1', 'follow-a2']]);
    expect(r).toEqual({ resent: 6, plans: 3, errors: 0 });
    expect(dbQuery.mock.calls.some((c) => String(c[0]).includes("call_mode = 'manual'"))).toBe(false);
  });

  it('ผูกกับตัวส่งซ้ำงานติดตาม (เดินทุกรอบ บนเครื่องที่มีคีย์ push)', () => {
    const w = readFileSync(new URL('../../api/_lib/followPushRetryWorker.ts', import.meta.url), 'utf8');
    expect(w).toContain('await repairDeclinedFollowDays();');
  });
});
