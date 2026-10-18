// @vitest-environment node
/**
 * อัตราเบิก (เงินที่เก็บจากลูกค้า) เห็นเฉพาะ supervisor ขึ้นไป — เจ้าของเลือก "ซ่อนอัตราเบิกจาก staff" (QA 17 ต.ค. 2569)
 * ตัดที่เซิร์ฟเวอร์ · รายการใบขอมาจากสำเนาที่ใช้ร่วมกัน ⇒ ห้ามแก้ object เดิม
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canSeeDrawRate, hideDrawRateOnLines, hideDrawRateOnRequests } from '../../api/_lib/drawRateVisibility';

describe('ซ่อนอัตราเบิกจาก staff', () => {
  it('supervisor/admin เห็น · staff/opl ไม่เห็น', () => {
    expect(canSeeDrawRate('admin')).toBe(true);
    expect(canSeeDrawRate('supervisor')).toBe(true);
    expect(canSeeDrawRate('staff')).toBe(false);
    expect(canSeeDrawRate('opl')).toBe(false);
    expect(canSeeDrawRate(null)).toBe(false);
  });
  it('ล้างเป็น null โดยไม่แตะ object เดิม (สำเนาใช้ร่วมกันทุกคน)', () => {
    const cached = [{ id: 'a', resigned_wage_draw_rate: 23000, resigned_wage_fee_rate: 15000 }];
    const out = hideDrawRateOnRequests(cached);
    expect(out[0].resigned_wage_draw_rate).toBeNull();
    expect(out[0].resigned_wage_fee_rate).toBe(15000);
    expect(cached[0].resigned_wage_draw_rate).toBe(23000);
    const lines = [{ seq: 1, payment_rate: 15000, draw_rate: 23000 }];
    expect(hideDrawRateOnLines(lines)[0]).toEqual({ seq: 1, payment_rate: 15000, draw_rate: null });
    expect(lines[0].draw_rate).toBe(23000);
  });
  it('ทุกเส้นของใบขอผ่านตัวกรอง · จอไม่วาดคอลัมน์อัตราเบิกเมื่อไม่มีค่า', () => {
    const h = readFileSync('api/_handlers/siamraj-unit-requests.ts', 'utf8');
    expect(h).toContain('rate_lines: seeDraw ? rateLines : hideDrawRateOnLines(rateLines)');
    expect(h.match(/canSeeDrawRate\(req\.user\.role\) \? items : hideDrawRateOnRequests\(items\)/g)).toHaveLength(2);
    const ui = readFileSync('src/components/jobs/UnitRequestPayBlocks.tsx', 'utf8');
    expect(ui).toContain('const showDraw = lines.some((l) => l.draw_rate != null);');
    expect(ui).toContain('{job.resigned_wage_draw_rate != null ? (');
  });
});
