// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(), isPgUniqueViolation: () => false }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (name: string) => name }));

import { dbQuery } from '../../api/_lib/postgres.js';
import { updateRecruitPosting } from '../../api/_lib/recruitPostings.js';

const POSTING_ID = '22222222-2222-4222-8222-222222222222';

function sqlOf(callIndex: number): string {
  return String(vi.mocked(dbQuery).mock.calls[callIndex]?.[0] ?? '');
}
function paramsOf(callIndex: number): unknown[] {
  return (vi.mocked(dbQuery).mock.calls[callIndex]?.[1] ?? []) as unknown[];
}

describe('แก้เนื้อหาประกาศรับสมัคร (mockup rev.3 ข้อ 04)', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('แก้เฉพาะฟิลด์ที่ส่งมา — ฟิลด์ที่ไม่ส่งต้องไม่ถูกแตะ', async () => {
    // call 0 = UPDATE · call 1+ = getRecruitPosting อ่านกลับ
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ id: POSTING_ID }] });

    await updateRecruitPosting(POSTING_ID, { salaryText: '15,000–18,000 บาท' });

    const sql = sqlOf(0);
    expect(sql).toContain('salary_text = $1');
    expect(sql).toContain('updated_at = now()');
    // ฟิลด์ที่ไม่ได้ส่งมาต้องไม่โผล่ใน SET
    expect(sql).not.toContain('title =');
    expect(sql).not.toContain('detail =');
    expect(sql).not.toContain('contact_name =');
    expect(paramsOf(0)).toEqual(['15,000–18,000 บาท', POSTING_ID]);
  });

  it('ค่าว่างของฟิลด์ที่ไม่บังคับ = ล้างเป็น null ได้', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ id: POSTING_ID }] });

    await updateRecruitPosting(POSTING_ID, { detail: '   ', contactPhone: '' });

    expect(paramsOf(0)).toEqual([null, null, POSTING_ID]);
  });

  it('หัวข้อว่างไม่ได้ — ต้องโยน error ก่อนแตะ DB', async () => {
    await expect(updateRecruitPosting(POSTING_ID, { title: '   ' })).rejects.toThrow(
      'ต้องระบุหัวข้อประกาศ',
    );
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('ไม่ส่งฟิลด์อะไรมาเลย = ไม่ยิง DB และคืน null', async () => {
    await expect(updateRecruitPosting(POSTING_ID, {})).resolves.toBeNull();
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('หา id ไม่เจอ = คืน null ไม่อ่านกลับต่อ', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });

    await expect(updateRecruitPosting(POSTING_ID, { title: 'ชื่อใหม่' })).resolves.toBeNull();
    expect(vi.mocked(dbQuery)).toHaveBeenCalledTimes(1);
  });

  it('ตัดข้อความยาวเกินเพดานเท่ากับตอนสร้าง (หัวข้อ 200 · รายละเอียด 4000)', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ id: POSTING_ID }] });

    await updateRecruitPosting(POSTING_ID, { title: 'ก'.repeat(250), detail: 'ข'.repeat(5000) });

    const [title, detail] = paramsOf(0) as [string, string];
    expect(title).toHaveLength(200);
    expect(detail).toHaveLength(4000);
  });

  /**
   * กติกาความปลอดภัย: สามฟิลด์นี้กำหนดสิทธิ์การมองเห็น (BU scope)
   * ถ้าเปิดให้ PATCH แก้ได้ จะย้ายประกาศข้าม BU ได้ทั้งที่ตอนสร้างกันไว้แล้วที่ handler
   */
  it('ห้ามแก้ BU / ประเภทกล่อง / ใบขอที่ผูกไว้ ผ่านการแก้เนื้อหา', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ id: POSTING_ID }] });

    await updateRecruitPosting(POSTING_ID, {
      title: 'ชื่อใหม่',
      // ยัดฟิลด์ที่ไม่อนุญาตเข้ามาแบบที่คนยิง API ตรงอาจลอง
      ...({ departmentCode: 'LBD', standaloneKind: 'central', jobId: 'JOB-9' } as object),
    });

    const sql = sqlOf(0);
    expect(sql).not.toContain('department_code');
    expect(sql).not.toContain('standalone_kind');
    expect(sql).not.toContain('job_id');
    expect(paramsOf(0)).toEqual(['ชื่อใหม่', POSTING_ID]);
  });
});
