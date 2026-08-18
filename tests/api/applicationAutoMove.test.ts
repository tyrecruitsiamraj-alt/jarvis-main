// @vitest-environment node
/**
 * ย้ายใบสมัครอัตโนมัติเมื่อใบขอถูกปิด (098 · เจ้าของเคาะเกณฑ์ 17 ส.ค. 2569)
 *
 * ทำไมต้องคุมแน่น: ตัวนี้ **เดินเอง** ไม่มีคนกดยืนยันทีละคน ย้ายผิด = คนไปโผล่ในงาน
 * ที่เขาไม่ได้สมัคร แล้วมีคนโทรไปคุยเรื่องงานที่เขาไม่รู้จัก — เสียเครดิตทันที
 * ทุกเทสต์ในไฟล์นี้คือด่านกัน "ย้ายเกินสิทธิ์" ไม่ใช่แค่เช็คว่าฟังก์ชันทำงาน
 */
import { describe, expect, it } from 'vitest';
import {
  applicationPositionOf,
  isAutoMovable,
  pickAutoMoveTarget,
  sameText,
  type AutoMoveApplication,
  type AutoMoveTargetJob,
} from '../../src/lib/applicationAutoMove';

const app = (over: Partial<AutoMoveApplication> = {}): AutoMoveApplication => ({
  id: 'a1',
  job_id: 'siamraj-sql:OPL6907001',
  province: 'กรุงเทพมหานคร',
  district: 'คลองเตย',
  position_interest: 'ขับรถ',
  status: 'new',
  ...over,
});

const job = (over: Partial<AutoMoveTargetJob> = {}): AutoMoveTargetJob => ({
  id: 'siamraj-sql:OPL6908001',
  province: 'กรุงเทพมหานคร',
  district: 'คลองเตย',
  position: 'ขับรถ',
  ...over,
});

describe('เทียบข้อความ', () => {
  it('ไม่สนช่องว่าง/ตัวพิมพ์ — ชื่อใน ERP เว้นวรรคไม่เท่ากัน', () => {
    expect(sameText('ขับรถ', ' ขับรถ ')).toBe(true);
    expect(sameText('Call Center', 'call center')).toBe(true);
  });

  it('🔴 ทั้งคู่ว่าง = ไม่เหมือนกัน (ไม่รู้ ≠ ตรงกัน)', () => {
    // ถ้าปล่อยให้ว่างแมทว่าง ใบที่ไม่มีข้อมูลจะแมทกับทุกใบแล้วย้ายมั่ว
    expect(sameText('', '')).toBe(false);
    expect(sameText(null, undefined)).toBe(false);
  });
});

describe('ด่านกันย้าย (isAutoMovable)', () => {
  it('ใบปกติที่ยังไม่มีใครแตะ = ย้ายได้', () => {
    expect(isAutoMovable(app()).ok).toBe(true);
  });

  it('🔴 ไม่ย้ายคนที่ชื่อขึ้นบอร์ดแล้ว (เป็นงานคัดสรรต่อ)', () => {
    expect(isAutoMovable(app({ on_board: true })).ok).toBe(false);
  });

  it('🔴 ไม่ย้ายคนที่มีนัดสัมภาษณ์แล้ว', () => {
    expect(isAutoMovable(app({ appointment_at: '2026-08-20T02:00:00.000Z' })).ok).toBe(false);
  });

  it('🔴 ไม่ย้ายใบที่มีคนแตะแล้ว (สถานะไม่ใช่ new)', () => {
    for (const st of ['contacted', 'converted', 'rejected']) {
      expect(isAutoMovable(app({ status: st })).ok).toBe(false);
    }
  });

  it('🔴 ไม่ย้ายซ้ำรอบสอง (กันเด้งไปเรื่อย ๆ)', () => {
    expect(isAutoMovable(app({ moved_at: '2026-08-17T10:00:00.000Z' })).ok).toBe(false);
  });

  it('ไม่ผูกใบขอ (สมัครทั่วไป) = ไม่ต้องย้าย', () => {
    expect(isAutoMovable(app({ job_id: null })).ok).toBe(false);
  });

  it('🔴 ข้อมูลไม่พอ (ไม่รู้ตำแหน่ง/จังหวัด) = ไม่ย้าย ห้ามเดา', () => {
    expect(isAutoMovable(app({ position_interest: '', job_title: '' })).ok).toBe(false);
    expect(isAutoMovable(app({ province: '' })).ok).toBe(false);
  });
});

describe('เลือกใบปลายทาง', () => {
  it('ตำแหน่ง+จังหวัดตรง = ย้ายได้', () => {
    const r = pickAutoMoveTarget(app(), [job()]);
    expect(r.move).toBe(true);
    if (r.move) expect(r.job.id).toBe('siamraj-sql:OPL6908001');
  });

  it('🔴 อำเภอตรงกันต้องขึ้นก่อน (เจ้าของสั่ง)', () => {
    const far = job({ id: 'ไกล', district: 'บางรัก' });
    const near = job({ id: 'ใกล้', district: 'คลองเตย' });
    const r = pickAutoMoveTarget(app(), [far, near]);
    expect(r.move).toBe(true);
    if (r.move) {
      expect(r.job.id).toBe('ใกล้');
      expect(r.reason).toBe('closed_request:same_district');
    }
  });

  it('อำเภอไม่ตรงแต่จังหวัดตรง = ย้ายได้ (บอกเหตุผลต่างกัน)', () => {
    const r = pickAutoMoveTarget(app(), [job({ district: 'บางรัก' })]);
    expect(r.move).toBe(true);
    if (r.move) expect(r.reason).toBe('closed_request:same_province');
  });

  it('🔴 คนละจังหวัด = ไม่ย้าย', () => {
    const r = pickAutoMoveTarget(app(), [job({ province: 'ชลบุรี', district: 'ศรีราชา' })]);
    expect(r.move).toBe(false);
  });

  it('🔴 คนละตำแหน่ง = ไม่ย้าย', () => {
    const r = pickAutoMoveTarget(app(), [job({ position: 'แม่บ้าน' })]);
    expect(r.move).toBe(false);
  });

  it('🔴 ใบที่เคยปฏิเสธ ห้ามเสนอซ้ำ', () => {
    const target = job({ id: 'เคยปฏิเสธ' });
    const r = pickAutoMoveTarget(app(), [target], new Set(['เคยปฏิเสธ']));
    expect(r.move).toBe(false);
  });

  it('🔴 ไม่ย้ายกลับใบเดิม', () => {
    const same = job({ id: 'siamraj-sql:OPL6907001' });
    expect(pickAutoMoveTarget(app(), [same]).move).toBe(false);
  });

  it('ไม่มีใบเข้าเกณฑ์ = ไม่ย้าย พร้อมบอกเหตุผล', () => {
    const r = pickAutoMoveTarget(app(), []);
    expect(r.move).toBe(false);
    if (!r.move) expect(r.reason).toContain('ไม่มีใบ');
  });

  it('ลำดับใบที่อำเภอไม่ตรงคงเดิม (sort ต้อง stable)', () => {
    const a = job({ id: 'A', district: 'บางรัก' });
    const b = job({ id: 'B', district: 'ดินแดง' });
    const r = pickAutoMoveTarget(app(), [a, b]);
    if (r.move) expect(r.job.id).toBe('A');
  });
});

describe('ตำแหน่งที่ใช้เทียบ', () => {
  it('ใช้ช่องที่ผู้สมัครเลือกก่อน แล้วค่อยถอยไปชื่องานของใบเดิม', () => {
    expect(applicationPositionOf(app({ position_interest: 'ขับรถ', job_title: 'ธุรการ' }))).toBe('ขับรถ');
    expect(applicationPositionOf(app({ position_interest: '', job_title: 'ธุรการ' }))).toBe('ธุรการ');
  });
});
