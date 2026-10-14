// @vitest-environment node
/**
 * ตั้งค่าบอร์ด › ประเภทกล่อง (เจ้าของสั่ง 14 ต.ค. 2569 "ทำหน้าจัดการประเภทกล่องในตั้งค่าบอร์ด")
 * เพิ่ม · แก้ชื่อ · ปิด/เปิด · ไม่มีลบ · ยังไม่ migrate = ชุดเดิม 5 ประเภท
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: (e: unknown) => (e as { code?: string })?.code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const mod = await import('../../api/_lib/recruitPostingKinds.js');
const { isStandalonePostingKind, validatePostingInput } = await import('../../src/lib/recruitPostings.js');

const ROWS = [
  { code: 'thai_executive', label: 'ผู้บริหารคนไทย', sort_order: 10, is_active: true },
  { code: 'k_1a2b3c4d', label: 'คลังสินค้า', sort_order: 60, is_active: false },
];

beforeEach(() => {
  dbQuery.mockReset().mockImplementation(async (sql: string, params?: unknown[]) => {
    if (/^\s*select/i.test(sql)) return { rows: /is_active = true/.test(sql) ? ROWS.filter((r) => r.is_active) : ROWS };
    if (/^\s*insert/i.test(sql)) return { rows: [{ code: params?.[0], label: params?.[1], sort_order: params?.[2], is_active: true }] };
    if (/^\s*update/i.test(sql)) return { rows: [{ ...ROWS[0], label: 'ใหม่' }] };
    return { rows: [] };
  });
});

describe('ประเภทกล่อง', () => {
  it('ยังไม่ migrate (42P01) ⇒ ชุดเดิม 5 ประเภท', async () => {
    dbQuery.mockRejectedValueOnce(Object.assign(new Error('no table'), { code: '42P01' }));
    const list = await mod.listRecruitPostingKinds();
    expect(list.map((k) => k.code)).toEqual(['thai_executive', 'foreign_executive', 'central', 'valet', 'government']);
  });

  it('เพิ่ม ⇒ รหัสสร้างเอง k_xxxxxxxx · ต่อท้ายลำดับ · ชื่อซ้ำ/ว่าง ไม่รับ', async () => {
    const k = await mod.createRecruitPostingKind({ label: '  โรงพยาบาล ' }, 'u@x');
    expect(k.code).toMatch(/^k_[0-9a-f]{8}$/);
    expect(k.label).toBe('โรงพยาบาล');
    expect(k.sortOrder).toBe(70);
    await expect(mod.createRecruitPostingKind({ label: 'คลังสินค้า' }, null)).rejects.toThrow(/มีประเภทกล่องชื่อ/);
    await expect(mod.createRecruitPostingKind({ label: '   ' }, null)).rejects.toThrow(/ต้องระบุชื่อประเภทกล่อง/);
  });

  it('ปิด/เปิด + แก้ชื่อ เป็น update · ไม่มีคำสั่งลบ', async () => {
    await mod.updateRecruitPostingKind('k_1a2b3c4d', { isActive: true }, 'u@x');
    const sql = dbQuery.mock.calls.map((c) => String(c[0]));
    expect(sql.some((s) => /update recruit_posting_kinds set is_active/.test(s))).toBe(true);
    expect(sql.some((s) => /delete/i.test(s))).toBe(false);
  });

  it('สร้างประกาศลอยได้เฉพาะประเภทที่เปิดอยู่', async () => {
    expect(await mod.isActivePostingKind('thai_executive')).toBe(true);
    expect(await mod.isActivePostingKind('k_1a2b3c4d')).toBe(false); // ปิดแล้ว
    expect(await mod.isActivePostingKind('ไม่มีจริง')).toBe(false);
  });

  it('ตัวตรวจฟอร์มรับรหัสใหม่จากหน้าเว็บ (ไม่ผูกกับ 5 ตัวเดิมแล้ว)', () => {
    expect(isStandalonePostingKind('k_1a2b3c4d')).toBe(true);
    expect(isStandalonePostingKind('')).toBe(false);
    expect(validatePostingInput({ title: 'x', standaloneKind: 'k_1a2b3c4d', departmentCode: 'LBD' })).toBeNull();
  });
});
