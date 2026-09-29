/**
 * "ไม่ปล่อย + เหตุผล" — ตัวตรวจ/คำอ่าน/ตัวจับคู่ (pure · ใช้ทั้งฟอร์มและ server)
 * 🔴 ด่าน: "อื่น ๆ" ต้องพิมพ์เหตุผล · เหตุผลนอกรายการไม่รับ · จับคู่สองคีย์แบบทะเบียนปล่อย (เลขชนกัน = ไม่จับ)
 */
import { describe, expect, it } from 'vitest';
import {
  RELEASE_SKIP_NOTE_MAX,
  RELEASE_SKIP_REASONS,
  buildSkipIndex,
  releaseSkipText,
  validateReleaseSkip,
  type JobReleaseSkip,
} from './jobReleaseSkips';

const skip = (job_id: string, over: Partial<JobReleaseSkip> = {}): JobReleaseSkip => ({
  job_id,
  request_no: null,
  reason: 'unit_hold',
  note: null,
  skipped_at: '2026-09-29T09:00:00Z',
  skipped_by_name: null,
  ...over,
});

describe('ไม่ปล่อย + เหตุผล', () => {
  it('รายการเหตุผลตามที่เคาะ (ห้ามเปลี่ยนคีย์เดิม)', () => {
    expect(RELEASE_SKIP_REASONS.map((r) => r.key)).toEqual(['incomplete', 'unit_hold', 'filled', 'other']);
  });

  it('ตรวจค่า: ต้องเลือกเหตุผล · อื่น ๆ ต้องพิมพ์ · ยาวเกินไม่รับ · หมายเหตุว่าง = null', () => {
    expect(validateReleaseSkip({ reason: '', note: '' })).toMatchObject({ ok: false });
    expect(validateReleaseSkip({ reason: 'nope', note: '' })).toMatchObject({ ok: false });
    expect(validateReleaseSkip({ reason: 'other', note: '   ' })).toMatchObject({ ok: false });
    expect(validateReleaseSkip({ reason: 'filled', note: 'x'.repeat(RELEASE_SKIP_NOTE_MAX + 1) })).toMatchObject({ ok: false });
    expect(validateReleaseSkip({ reason: 'filled', note: '  ' })).toEqual({ ok: true, reason: 'filled', note: null });
    expect(validateReleaseSkip({ reason: 'other', note: ' ลูกค้าเลื่อน ' })).toEqual({ ok: true, reason: 'other', note: 'ลูกค้าเลื่อน' });
  });

  it('คำอ่าน: อื่น ๆ ใช้ข้อความที่พิมพ์ · เหตุผลอื่นต่อหมายเหตุท้าย', () => {
    expect(releaseSkipText({ reason: 'unit_hold', note: null })).toBe('หน่วยงานให้รอ');
    expect(releaseSkipText({ reason: 'unit_hold', note: 'รอ 15 ต.ค.' })).toBe('หน่วยงานให้รอ · รอ 15 ต.ค.');
    expect(releaseSkipText({ reason: 'other', note: 'ลูกค้าเลื่อนโครงการ' })).toBe('ลูกค้าเลื่อนโครงการ');
  });

  it('🔴 จับคู่สองคีย์: id เต็มก่อน · ใบล่วงหน้าหาเจอจาก sql: ด้วยเลขที่ใบ · เลขที่ชนกันสองใบ = ไม่ถอยไปเลขที่ใบ', () => {
    const idx = buildSkipIndex([skip('siamraj-pre:LBM6908001'), skip('siamraj-sql:OPL1'), skip('siamraj-pre:OPL1', { reason: 'filled' })]);
    expect(idx.get('siamraj-pre:LBM6908001')?.reason).toBe('unit_hold');
    expect(idx.get('siamraj-sql:LBM6908001')?.job_id).toBe('siamraj-pre:LBM6908001');
    // OPL1 มีสองใบในทะเบียน — id เต็มยังตรงตัว แต่ห้ามเดาจากเลขที่ใบ
    expect(idx.get('siamraj-sql:OPL1')?.reason).toBe('unit_hold');
    expect(idx.get('siamraj-pre:OPL1')?.reason).toBe('filled');
    expect(idx.get('siamraj:OPL1')).toBeUndefined();
  });
});
