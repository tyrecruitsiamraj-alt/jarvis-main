// @vitest-environment node
/**
 * ใบขอชั่วคราวที่ ERP ยกเลิก/ทำเป็นใบจริงแล้ว = ปิด (เจ้าของ 10 พ.ย. 2569 Choice "ป้ายถูก + ปิดลิงก์สมัคร")
 * เจอจริง: อีซูซุ LBM6909003 · พรีโม LAM6910008 สถานะ C ใน ERP แต่ระบบตั้ง 'open' ตายตัว
 * ⇒ ป้ายผู้สมัครขึ้น "ใบขอยังไม่ตั้งรายได้" ทั้งที่ตั้ง 20,000 / 18,000 แล้ว · ลิงก์สมัครยังรับคน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prequestIsOpen } from '../../api/_lib/siamrajSqlServerPrequests';

describe('สถานะใบขอชั่วคราว', () => {
  it('เปิด = status A และยังไม่ทำเป็นใบจริง (เงื่อนไขเดียวกับรายการ)', () => {
    expect(prequestIsOpen('A', 'N')).toBe(true);
    expect(prequestIsOpen('A', null)).toBe(true);
    expect(prequestIsOpen('C', 'N')).toBe(false);
    expect(prequestIsOpen('A', 'Y')).toBe(false);
    expect(prequestIsOpen(' c ', '')).toBe(false);
  });
  it('แถวที่ไม่มีค่าสถานะ = ถือว่าเปิดเหมือนเดิม (ไม่เดาว่าปิด)', () => {
    expect(prequestIsOpen(null, null)).toBe(true);
    expect(prequestIsOpen(undefined, undefined)).toBe(true);
  });
  it('อ่านสถานะจาก ERP จริง ไม่ตั้ง open ตายตัว', () => {
    const src = readFileSync('api/_lib/siamrajSqlServerPrequests.ts', 'utf8');
    expect(src).toContain('RTRIM(h.status) AS head_status, RTRIM(h.is_request) AS is_request');
    expect(src).toContain("status: prequestIsOpen(r.head_status, r.is_request) ? ('open' as const) : ('closed' as const)");
    expect(src).not.toMatch(/^\s*status: 'open' as const,$/m);
  });
  it('ใบชั่วคราวที่ปิด: เส้นทั่วไปได้ null (AI ไม่โทร) · includeClosed เห็น (หน้ารายละเอียด · เช็กปิดรับสมัคร)', () => {
    const src = readFileSync('api/_lib/siamrajUnitRequests.ts', 'utf8');
    expect(src).toContain("(item as { status?: string }).status === 'closed' && isPrequestId(String((item as { id?: string }).id ?? '')) && !options?.includeClosed");
    const closed = readFileSync('api/_lib/requestClosedForApply.ts', 'utf8');
    expect(closed).toContain('{ includeClosed: true }');
    expect(closed).toContain("item?.status === 'closed'");
  });
});
