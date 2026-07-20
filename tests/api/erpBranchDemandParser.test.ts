/**
 * Acceptance checklist — ERP multi-branch parser
 *
 * TC-01 จำนวน X คน ... และ ... จำนวน Y คน → แยกหลายสาขา + qty + เขต
 * TC-02 สาขาเดียวมีจำนวนคน → 1 สาขา
 * TC-03 และโดยไม่มีจำนวน → fallback qty=1, confidence ต่ำ
 * TC-04 กรุงเทพฯ และปริมณฑล → ห้ามแตกเป็นหลายสาขา
 * TC-05 Fashion Island + Promenade → fallback แยก landmark
 * TC-06 buildErpBranchDemandInput โฟกัส location_address
 * TC-07 ตรวจ org_name บุญรอด
 * TC-08 สิงห์คอมเพล็กซ์สาขาเดียว + เขต
 * TC-09 ข้อความว่าง → ไม่แตก
 * TC-10 confidence สูงเมื่อมีจำนวนคน+เขต vs fallback
 */
import { describe, it, expect } from 'vitest';
import { buildErpBranchDemandInput, parseErpBranchDemand } from '../../shared/erpBranchDemandParser';

const BOON_RAWD_MULTI =
  'บ.บุญรอดบริวเวอรี่ จก.- ปฏิบัติงาน ที่ ถ.สามเสน เขตดุสิต กรุงเทพฯ จำนวน 2 คน และ สิงห์คอมเพล็กซ์ ถ.เพชรบุรีตัดใหม่ เขตห้วยขวาง กรุงเทพฯ จำนวน 1 คน';

describe('erpBranchDemandParser acceptance', () => {
  it('TC-01: แยกหลายสาขาเมื่อมี จำนวน X คน ... และ ... จำนวน Y คน', () => {
    const result = parseErpBranchDemand(
      buildErpBranchDemandInput({
        unit_name: 'บริษัท บุญรอดบริวเวอรี่ จำกัด',
        location_address: BOON_RAWD_MULTI,
      }),
    );

    expect(result.parser_status).toBe('high_confidence');
    expect(result.items).toHaveLength(2);
    expect(result.unparsed_segments).toHaveLength(0);

    expect(result.items[0]).toMatchObject({
      branch_name_clean: 'ถ.สามเสน เขตดุสิต',
      requested_qty: 2,
      district_hint: 'ดุสิต',
      province_hint: 'กรุงเทพมหานคร',
    });
    expect(result.items[0].confidence).toBeGreaterThanOrEqual(85);

    expect(result.items[1]).toMatchObject({
      branch_name_clean: 'สิงห์คอมเพล็กซ์ เขตห้วยขวาง',
      requested_qty: 1,
      district_hint: 'ห้วยขวาง',
      province_hint: 'กรุงเทพมหานคร',
    });
    expect(result.items[1].confidence).toBeGreaterThanOrEqual(85);
  });

  it('TC-02b: สาขาเดียวสิงห์คอมเพล็กซ์ (ไม่มีชื่อหน่วยงานนำหน้า) → 1 รายการ', () => {
    const result = parseErpBranchDemand(
      'สิงห์คอมเพล็กซ์ ถ.เพชรบุรีตัดใหม่ เขตห้วยขวาง กรุงเทพฯ จำนวน 1 คน',
    );

    expect(result.items).toHaveLength(1);
    expect(result.org_name).toBeNull();
    expect(result.items[0]).toMatchObject({
      branch_name_clean: 'สิงห์คอมเพล็กซ์ เขตห้วยขวาง',
      requested_qty: 1,
      district_hint: 'ห้วยขวาง',
    });
  });

  it('TC-02: สาขาเดียวที่มีจำนวนคน (มีชื่อหน่วยงานนำหน้า) → 1 รายการ', () => {
    const result = parseErpBranchDemand(
      buildErpBranchDemandInput({
        unit_name: 'บริษัท บุญรอดบริวเวอรี่ จำกัด',
        location_address: 'บ.บุญรอดบริวเวอรี่ จก.- ปฏิบัติงาน ที่ ถ.สามเสน เขตดุสิต กรุงเทพฯ จำนวน 2 คน',
      }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      branch_name_clean: 'ถ.สามเสน เขตดุสิต',
      requested_qty: 2,
      district_hint: 'ดุสิต',
    });
  });

  it('TC-03: และโดยไม่มีจำนวนคน → fallback แยกได้แต่ confidence ต่ำ', () => {
    const result = parseErpBranchDemand(
      'บริษัท บุญรอดบริวเวอรี่ จำกัด- ปฏิบัติงาน ที่สิงห์คอมเพล็กซ์ และ สนง.บุญรอดสามเสน',
    );

    expect(result.parser_status).toBe('fallback');
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.items.every((i) => i.requested_qty === 1)).toBe(true);
    expect(result.items.every((i) => i.confidence <= 70)).toBe(true);
    expect(result.items.some((i) => /สิงห์คอมเพล็กซ์/.test(i.branch_name_clean))).toBe(true);
    expect(result.items.some((i) => /สนง\.บุญรอดสามเสน/.test(i.branch_name_clean))).toBe(true);
  });

  it('TC-04: กรุงเทพฯ และปริมณฑล → ห้ามแตกเป็นหลายสาขาที่มี qty', () => {
    const result = parseErpBranchDemand(
      'ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน), พระราม 3 และกรุงเทพฯ และปริมณฑล',
    );

    expect(result.parser_status).toBe('none');
    expect(result.items.filter((i) => i.requested_qty > 0).length).toBeLessThan(2);
    expect(result.unparsed_segments.length).toBeGreaterThan(0);
  });

  it('TC-05: Fashion Island และ Promenade → fallback landmark', () => {
    const result = parseErpBranchDemand('Fashion Island และ Promenade มีนบุรี');

    expect(result.items).toHaveLength(2);
    expect(result.items[0].branch_name_clean).toMatch(/Fashion Island/i);
    expect(result.items[1].branch_name_clean).toMatch(/Promenade/i);
    expect(result.items.every((i) => i.requested_qty === 1)).toBe(true);
  });

  it('TC-06: buildErpBranchDemandInput ใช้ location_address เมื่อมี และ/จำนวนคน', () => {
    const input = buildErpBranchDemandInput({
      unit_name: 'บริษัท บุญรอดบริวเวอรี่ จำกัด',
      location_address: BOON_RAWD_MULTI,
      request_no: 'LBM6301012',
      job_description_code_1: 'ไม่ควรมาปน',
    });

    expect(input).toContain('จำนวน 2 คน');
    expect(input).toContain('สิงห์คอมเพล็กซ์');
    expect(input).not.toContain('LBM6301012');
    expect(input).not.toContain('ไม่ควรมาปน');
  });

  it('TC-07: ตรวจจับ org_name บุญรอด', () => {
    const result = parseErpBranchDemand(
      buildErpBranchDemandInput({
        unit_name: 'บริษัท บุญรอดบริวเวอรี่ จำกัด',
        location_address: BOON_RAWD_MULTI,
      }),
    );

    expect(result.org_name).toBe('บริษัท บุญรอดบริวเวอรี่ จำกัด');
  });

  it('TC-08: clean ชื่อสาขาไม่ให้มีคำว่า ปฏิบัติงานที่ / จก.', () => {
    const result = parseErpBranchDemand(
      buildErpBranchDemandInput({
        unit_name: 'บริษัท บุญรอดบริวเวอรี่ จำกัด',
        location_address: BOON_RAWD_MULTI,
      }),
    );

    for (const item of result.items) {
      expect(item.branch_name_clean).not.toMatch(/ปฏิบัติงาน/i);
      expect(item.branch_name_clean).not.toMatch(/จก\./i);
      expect(item.branch_name_clean).not.toMatch(/^บ\./i);
    }
    expect(result.items[1].branch_name_clean).toContain('สิงห์คอมเพล็กซ์');
  });

  it('TC-09: ข้อความว่าง → ไม่มีสาขา', () => {
    const result = parseErpBranchDemand('   ');
    expect(result.parser_status).toBe('none');
    expect(result.items).toHaveLength(0);
  });

  it('TC-10: confidence สูงกว่าเมื่อมีจำนวนคน+เขต กว่า fallback ไม่มีจำนวน', () => {
    const strong = parseErpBranchDemand(BOON_RAWD_MULTI);
    const weak = parseErpBranchDemand('สิงห์คอมเพล็กซ์ และ สนง.บุญรอดสามเสน');

    const strongMin = Math.min(...strong.items.map((i) => i.confidence));
    const weakMax = Math.max(...weak.items.map((i) => i.confidence));
    expect(strongMin).toBeGreaterThan(weakMax);
  });
});
