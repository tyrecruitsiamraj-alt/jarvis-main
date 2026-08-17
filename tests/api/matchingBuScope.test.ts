// @vitest-environment node
/**
 * ขอบเขต BU ของหน้า Matching (เจ้าของสั่ง 10 ส.ค. 2569: "ทุกคนจะเห็นแต่งานตัวเอง")
 *
 * เกณฑ์ "ผิดแล้วข้อมูลรั่ว" — ถ้าตัวนี้พัง admin จะเห็นใบขอของ BU อื่นกลับมาเงียบ ๆ
 * โดยหน้าเว็บไม่มีอะไรบอก และไม่มีใครรู้จนกว่าจะมีคนทักว่า "ทำไมเห็นงานที่ไม่ใช่ของเรา"
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn() }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { loadMatchingBuScope, loadUserDepartmentScope } = await import(
  '../../api/_lib/departmentScope.js'
);

const user = (role: 'admin' | 'supervisor' | 'staff') => ({ sub: 'u1', role } as const);

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
});

describe('loadMatchingBuScope — ล็อก BU ของตัวเองทุก role', () => {
  it('admin ที่มี BU ถูกล็อกไว้ที่ BU ตัวเอง (ต่างจากของเดิมที่เห็นทุก BU)', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ department_code: 'LBD' }] } as never);
    await expect(loadMatchingBuScope(user('admin'))).resolves.toEqual({ mode: 'code', code: 'LBD' });

    // เทียบกับตัวเดิมให้เห็นชัดว่านี่คือจุดที่ต่างกัน — ถ้าวันไหนสองตัวนี้ให้ผลเท่ากัน
    // แปลว่ามีคนเผลอเปลี่ยน loadMatchingBuScope กลับไปใช้ตรรกะเดิม
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ department_code: 'LBD' }] } as never);
    await expect(loadUserDepartmentScope(user('admin'))).resolves.toEqual({ mode: 'all' });
  });

  it('staff/supervisor ถูกล็อกที่ BU ตัวเองเหมือนเดิม', async () => {
    for (const role of ['staff', 'supervisor'] as const) {
      vi.mocked(dbQuery).mockResolvedValue({ rows: [{ department_code: 'LBA' }] } as never);
      await expect(loadMatchingBuScope(user(role))).resolves.toEqual({ mode: 'code', code: 'LBA' });
    }
  });

  it('BU ที่ไม่อยู่ในรายการที่อนุญาต → ไม่ยอมรับ (กันค่าขยะเปิดสิทธิ์)', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ department_code: 'ไม่มีจริง' }] } as never);
    const scope = await loadMatchingBuScope(user('staff'));
    expect(scope).not.toEqual({ mode: 'code', code: 'ไม่มีจริง' });
    expect(scope.mode === 'none' || scope.mode === 'all').toBe(true);
  });

  it('staff ที่ยังไม่ถูกกำหนด BU → ไม่เห็นอะไรเลย ไม่ใช่เห็นทั้งหมด', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ department_code: null }] } as never);
    await expect(loadMatchingBuScope(user('staff'))).resolves.toEqual({ mode: 'none' });
  });

  it('อ่านฐานไม่ได้ → staff ไม่เห็นอะไรเลย (fail-closed ไม่ใช่ fail-open)', async () => {
    vi.mocked(dbQuery).mockRejectedValue(new Error('db down'));
    await expect(loadMatchingBuScope(user('staff'))).resolves.toEqual({ mode: 'none' });
  });
});

describe('ทุก endpoint ของเส้น Matching ต้องใช้ขอบเขตเดียวกัน', () => {
  /**
   * ⚠️ กรองแค่ตัวลิสต์ไม่พอ — ถ้าหน้ารายละเอียดยังใช้ของเดิม admin ยังเปิดใบขอนอก BU ได้
   * ด้วยการยิง `?jobId=` ตรง ๆ (ลิสต์กรองแล้วแต่ประตูหลังยังเปิด)
   */
  const FILES = [
    'api/_handlers/matching-list.ts',
    'api/_handlers/matching-board-candidates.ts',
    'api/_handlers/matching-irecruit-candidates.ts',
    'api/_handlers/matching-candidate-spec.ts',
    'api/_handlers/matching-parse-branch-demand-job.ts',
    'api/_handlers/matching-flow-summary.ts',
  ];

  it('ใช้ loadMatchingBuScope และไม่มีตัวไหนหลงเหลือ loadUserDepartmentScope', () => {
    for (const f of FILES) {
      const src = readFileSync(path.resolve(process.cwd(), f), 'utf8');
      expect(src, `${f} ต้องใช้ loadMatchingBuScope`).toMatch(/loadMatchingBuScope/);
      expect(src, `${f} ยังใช้ของเดิมอยู่ — admin จะเห็นข้าม BU`).not.toMatch(
        /loadUserDepartmentScope/,
      );
    }
  });
});
