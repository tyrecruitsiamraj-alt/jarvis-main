import { describe, it, expect } from 'vitest';
import { mergeBoardUnitOptions, type BoardUnitOption } from '../../src/lib/boardUnitPicker';

/**
 * รวมสองชุดหน่วยงาน (เจ้าของแจ้ง 18 ส.ค. 2569: *"เลือกหน่วยงานได้ แต่ขึ้นไม่ครบ"*)
 * — ชุดละเอียดจากใบขอเปิด (152 หน่วยงาน) + ชุดครบตั้งแต่ปี 2567 (~1,054)
 */

function opt(over: Partial<BoardUnitOption>): BoardUnitOption {
  return {
    siteCode: '69LBDL0001',
    unitName: 'หน่วยงานหนึ่ง',
    openRequests: 0,
    remainingPositions: 0,
    sampleRequestNo: null,
    roles: [],
    ...over,
  };
}

describe('mergeBoardUnitOptions', () => {
  it('หน่วยงานที่มีทั้งสองชุด — ใช้ตัวละเอียดเป็นหลัก แล้วเติมวันที่/ยอดรวมจากชุดครบ', () => {
    const merged = mergeBoardUnitOptions(
      [opt({ siteCode: 'A', openRequests: 2, remainingPositions: 5, roles: ['ขับรถ'], sampleRequestNo: 'OPL1' })],
      [opt({ siteCode: 'A', openRequests: 99, totalRequests: 40, lastRequestDate: '2026-08-01' })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      siteCode: 'A',
      openRequests: 2, // ของชุดละเอียดชนะ ไม่ใช่ 99
      remainingPositions: 5,
      roles: ['ขับรถ'],
      totalRequests: 40,
      lastRequestDate: '2026-08-01',
    });
  });

  it('หน่วยงานที่มีแต่ในชุดครบ (ใบขอปิดไปแล้ว) ต้องยังอยู่ในลิสต์ — นี่คือของที่หายไปเดิม', () => {
    const merged = mergeBoardUnitOptions(
      [opt({ siteCode: 'A', openRequests: 1 })],
      [
        opt({ siteCode: 'A', openRequests: 1 }),
        opt({ siteCode: 'B', unitName: 'ปิดใบไปแล้ว', lastRequestDate: '2025-03-02' }),
      ],
    );
    expect(merged.map((u) => u.siteCode)).toEqual(['A', 'B']);
  });

  it('🔴 จับคู่ด้วย siteCode ไม่ใช่ชื่อ — ชื่อลูกค้าเดียวกันมีหลายไซต์ได้ (คนละสาขา)', () => {
    const merged = mergeBoardUnitOptions(
      [opt({ siteCode: 'A', unitName: 'บริษัทเดียวกัน', openRequests: 1 })],
      [
        opt({ siteCode: 'A', unitName: 'บริษัทเดียวกัน' }),
        opt({ siteCode: 'B', unitName: 'บริษัทเดียวกัน' }),
      ],
    );
    expect(merged).toHaveLength(2);
  });

  it('เรียง: มีใบขอเปิดขึ้นก่อน (อัตราที่ยังต้องหามากสุดก่อน) แล้วค่อยใบขอล่าสุดใหม่→เก่า', () => {
    const merged = mergeBoardUnitOptions(
      [
        opt({ siteCode: 'open-1', openRequests: 1, remainingPositions: 3 }),
        opt({ siteCode: 'open-9', openRequests: 1, remainingPositions: 9 }),
      ],
      [
        opt({ siteCode: 'old', lastRequestDate: '2024-01-05' }),
        opt({ siteCode: 'new', lastRequestDate: '2026-07-30' }),
        opt({ siteCode: 'nodate', lastRequestDate: null }),
      ],
    );
    expect(merged.map((u) => u.siteCode)).toEqual(['open-9', 'open-1', 'new', 'old', 'nodate']);
  });

  it('ชุดครบโหลดไม่ได้ ([]) = ได้ชุดใบขอเปิดเหมือนเดิม ไม่พัง', () => {
    const merged = mergeBoardUnitOptions([opt({ siteCode: 'A', openRequests: 1 })], []);
    expect(merged.map((u) => u.siteCode)).toEqual(['A']);
  });

  it('แถวที่ไม่มีรหัสไซต์ถูกตัดทิ้งทั้งสองชุด (คีย์ของกล่องคือ site_code)', () => {
    const merged = mergeBoardUnitOptions([opt({ siteCode: '' })], [opt({ siteCode: '' })]);
    expect(merged).toHaveLength(0);
  });
});
