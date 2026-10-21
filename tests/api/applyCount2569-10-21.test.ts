// @vitest-environment node
/**
 * ═══ บอกว่าคนนี้เคยสมัครมากี่ครั้ง (เจ้าของ 21 ต.ค. 2569 "ก็เพิ่ม บอกเลยคนนี้เคยสมัครมากี่ครั้งดีกว่า") ═══
 * เคสจริง: เพิ่มชื่อซ้ำหลัง 14 วัน ระบบรับตามกติกาแต่ไม่บอก · ยังรับใบเหมือนเดิม แค่บอกจำนวน
 */
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
const { loadApplyCounts } = await import('../../api/_lib/applicationApplyCount.js');
const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

const ID = '865af463-5a2b-4304-addb-467f97012e6c';
beforeEach(() => dbQuery.mockReset());

describe('loadApplyCounts', () => {
  it('นับใบทั้งหมดของเบอร์เดียวกัน (รวมใบนี้) ด้วย phone_e164', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ id: ID, n: 2 }] });
    const out = await loadApplyCounts([ID, 'ไม่ใช่ uuid']);
    expect(out.get(ID)).toBe(2);
    expect(String(dbQuery.mock.calls[0][0])).toContain('phone_e164');
    expect(dbQuery.mock.calls[0][1]).toEqual([[ID]]);
  });

  it('อ่านไม่ได้ = ไม่ติดป้าย ไม่โยน (ลิสต์ห้ามล้ม)', async () => {
    dbQuery.mockRejectedValueOnce(new Error('db down'));
    expect((await loadApplyCounts([ID])).size).toBe(0);
  });

  it('ไม่มี id = ไม่ยิงฐาน', async () => {
    expect((await loadApplyCounts([])).size).toBe(0);
    expect(dbQuery).not.toHaveBeenCalled();
  });
});

describe('ที่บอกบนจอ', () => {
  it('แถวผู้สมัครมีป้าย "สมัคร N ครั้ง" เมื่อ 2 ครั้งขึ้นไป (ทั้งสองแบบตาราง)', () => {
    const t = read('src/components/recruit-rm/RmTable.tsx');
    expect(t.match(/\(r\.apply_count \?\? 0\) > 1/g)?.length).toBe(2);
    expect(t).toContain('สมัคร {r.apply_count} ครั้ง');
  });

  it('เพิ่มแล้วข้อความบอกจำนวน · API ส่ง apply_count กลับตอนเพิ่ม + ตอนลิสต์', () => {
    expect(read('src/components/recruit-rm/RmWorkspace.tsx')).toContain('`บันทึกผู้สมัครแล้ว · เบอร์นี้สมัครมาแล้ว ${n} ครั้ง`');
    const api = read('api/_handlers/job-applications.ts');
    expect(api).toContain('apply_count: applyCount');
    expect(api).toContain('(item as Record<string, unknown>).apply_count = n;');
  });
});
