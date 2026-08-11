// @vitest-environment node
/**
 * master "เหตุผล" ของงานสรรหา (RM) — ปุ่ม "เหตุผล"
 *
 * ยกมาจาก `recruit_master_reason` ของ iRecruit (owner='RM' 67 เหตุผล)
 * รหัสขั้นตอน/ผล เก็บตามระบบเดิมเป๊ะ ('1'/'2'/'3' · 'A'/'C') — เทสต์คุมไม่ให้ใครแปลงให้ "สวย"
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(), isPgUniqueViolation: () => false }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (name: string) => name }));

import { dbQuery } from '../../api/_lib/postgres.js';
import {
  createRecruitReason,
  deactivateRecruitReason,
  listRecruitReasons,
} from '../../api/_lib/recruitReasons.js';
import { groupRecruitReasons, type RecruitReason } from '../../src/lib/recruitReasons';
import {
  RM_REASON_OUTCOMES,
  RM_REASON_PROCESSES,
  isRmReasonOutcome,
  isRmReasonProcess,
} from '../../src/lib/recruitRmMasters';

const ID = '33333333-3333-4333-8333-333333333333';

function sqlOf(i: number): string {
  return String(vi.mocked(dbQuery).mock.calls[i]?.[0] ?? '');
}
function paramsOf(i: number): unknown[] {
  return (vi.mocked(dbQuery).mock.calls[i]?.[1] ?? []) as unknown[];
}

beforeEach(() => vi.mocked(dbQuery).mockReset());

describe('รหัสตามระบบเดิม (ห้ามแปลงให้สวย)', () => {
  it('ขั้นตอนคือ 1/2/3 และผลคือ A/C เท่านั้น', () => {
    expect(RM_REASON_PROCESSES.map((p) => p.code)).toEqual(['1', '2', '3']);
    expect(RM_REASON_OUTCOMES.map((o) => o.code)).toEqual(['A', 'C']);
    expect(RM_REASON_PROCESSES.map((p) => p.label)).toEqual([
      'การติดต่อ',
      'นัดหมาย',
      'ติดตามการนัดหมาย',
    ]);
  });

  it('ตัวตรวจปฏิเสธค่านอกชุด — รวมถึงคำอังกฤษที่คนชอบเดา', () => {
    expect(isRmReasonProcess('1')).toBe(true);
    expect(isRmReasonProcess('contact')).toBe(false);
    expect(isRmReasonProcess(1)).toBe(false);
    expect(isRmReasonOutcome('A')).toBe(true);
    expect(isRmReasonOutcome('a')).toBe(false);
    expect(isRmReasonOutcome('success')).toBe(false);
  });
});

describe('อ่าน master', () => {
  it('ไม่รวมตัวที่ปิดอยู่ตามค่าเริ่มต้น · all=1 ถึงจะรวม', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await listRecruitReasons();
    expect(sqlOf(0)).toContain('is_active = true');

    vi.mocked(dbQuery).mockReset();
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await listRecruitReasons({ includeInactive: true });
    expect(sqlOf(0)).not.toContain('is_active = true');
  });

  it('กรองตามขั้นตอน/ผลได้ · ค่าที่ไม่รู้จักถูกเมิน ไม่ใช่ยัดลง SQL', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await listRecruitReasons({ processCode: '2', outcomeCode: 'C' });
    expect(paramsOf(0)).toEqual(['2', 'C']);

    vi.mocked(dbQuery).mockReset();
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await listRecruitReasons({ processCode: 'contact', outcomeCode: 'ok' });
    expect(paramsOf(0)).toEqual([]);
  });
});

describe('เพิ่มเหตุผล', () => {
  it('ขั้นตอน/ผลนอกชุด = ไม่ยิงฐาน', async () => {
    await expect(
      createRecruitReason({ processCode: '9', outcomeCode: 'A', name: 'x' }),
    ).rejects.toThrow('ขั้นตอนไม่ถูกต้อง');
    await expect(
      createRecruitReason({ processCode: '1', outcomeCode: 'Z', name: 'x' }),
    ).rejects.toThrow('ผลของขั้นตอนไม่ถูกต้อง');
    await expect(
      createRecruitReason({ processCode: '1', outcomeCode: 'A', name: '   ' }),
    ).rejects.toThrow('ต้องระบุชื่อเหตุผล');
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('ชื่อถูกตัดช่องว่างหัวท้ายก่อนบันทึก', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{ id: ID, process_code: '1', outcome_code: 'C', name: 'ปิดเครื่อง', sort_order: 100, is_active: true }],
    });
    await createRecruitReason({ processCode: '1', outcomeCode: 'C', name: '  ปิดเครื่อง  ' });
    expect(paramsOf(0)[2]).toBe('ปิดเครื่อง');
  });
});

describe('ปิดการใช้งาน ไม่ใช่ลบ', () => {
  it('ต้องเป็น UPDATE is_active = false — ห้ามเป็น DELETE', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{ id: ID, process_code: '1', outcome_code: 'C', name: 'ปิดเครื่อง', sort_order: 100, is_active: false }],
    });
    const out = await deactivateRecruitReason(ID);
    expect(sqlOf(0)).toContain('UPDATE');
    expect(sqlOf(0)).not.toContain('DELETE');
    expect(sqlOf(0)).toContain('is_active = $1');
    expect(paramsOf(0)[0]).toBe(false);
    expect(out?.isActive).toBe(false);
  });
});

describe('จัดกลุ่มให้หน้าจอ', () => {
  const reason = (over: Partial<RecruitReason>): RecruitReason => ({
    id: over.id ?? 'r1',
    processCode: over.processCode ?? '1',
    outcomeCode: over.outcomeCode ?? 'A',
    name: over.name ?? 'ติดต่อสำเร็จ',
    sortOrder: 100,
    isActive: true,
  });

  it('ได้ครบ 6 กลุ่มเสมอ (3 ขั้นตอน × 2 ผล) แม้บางกลุ่มไม่มีเหตุผลเลย', () => {
    const groups = groupRecruitReasons([reason({ id: 'a' })]);
    expect(groups).toHaveLength(6);
    expect(groups.filter((g) => g.reasons.length === 0)).toHaveLength(5);
  });

  it('เหตุผลเข้ากลุ่มถูกคู่ — ไม่ปนข้ามขั้นตอน', () => {
    const groups = groupRecruitReasons([
      reason({ id: 'a', processCode: '1', outcomeCode: 'C', name: 'ติดต่อไม่ได้' }),
      reason({ id: 'b', processCode: '2', outcomeCode: 'C', name: 'ไม่รับสาย' }),
      reason({ id: 'c', processCode: '3', outcomeCode: 'A', name: 'ติดตามสำเร็จ' }),
    ]);
    const find = (p: string, o: string) =>
      groups.find((g) => g.processCode === p && g.outcomeCode === o)!;
    expect(find('1', 'C').reasons.map((r) => r.name)).toEqual(['ติดต่อไม่ได้']);
    expect(find('2', 'C').reasons.map((r) => r.name)).toEqual(['ไม่รับสาย']);
    expect(find('3', 'A').reasons.map((r) => r.name)).toEqual(['ติดตามสำเร็จ']);
    expect(find('1', 'A').reasons).toEqual([]);
  });

  it('ลำดับกลุ่มมาจาก master ไม่ใช่ลำดับที่ฐานคืนมา', () => {
    const groups = groupRecruitReasons([]);
    expect(groups.map((g) => `${g.processCode}${g.outcomeCode}`)).toEqual([
      '1A',
      '1C',
      '2A',
      '2C',
      '3A',
      '3C',
    ]);
  });
});
