// @vitest-environment node
/**
 * คนนำเข้าของรายชื่อ Scrap = คนสั่ง Scrap · กดดูรายละเอียดได้แม้ยังไม่มีใบสมัคร (เจ้าของ 26 พ.ย. 2569)
 * เคสจริง: คนจาก Scrap ขึ้นคนนำเข้าเป็นเจ้าหน้าที่สรรหาของใบ ทั้งที่คนนั้นไม่ได้สั่ง Scrap
 * (รูปคำสั่งจำลองจากใบจริง: สั่ง 3 ครั้ง สองคน · สองครั้งแรกไม่สำเร็จ · อีเมลสมมติ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scrapBringerOf, type ScrapOrderLite } from '../../src/lib/scrapCandidates';

const A = 'staff.a@example.test';
const B = 'staff.b@example.test';
const ORDERS: ScrapOrderLite[] = [
  { requested_by_name: A, status: 'rejected', created_at: '2026-11-20T03:15:00.000Z' },
  { requested_by_name: B, status: 'rejected', created_at: '2026-11-20T06:20:00.000Z' },
  { requested_by_name: B, status: 'completed', created_at: '2026-11-24T01:46:00.000Z' },
];

describe('ใครพารายชื่อ Scrap เข้ามา', () => {
  it('สั่งสำเร็จล่าสุดก่อนเจอคน', () => {
    expect(scrapBringerOf(ORDERS, '2026-11-26T02:24:00.000Z')).toBe(B);
  });
  it('เจอคนก่อนคำสั่งที่สำเร็จ = คำสั่งล่าสุดก่อนเจอ แม้ไม่สำเร็จ (ไม่ใช้คำสั่งหลังเจอ)', () => {
    expect(scrapBringerOf(ORDERS, '2026-11-21T00:00:00.000Z')).toBe(B);
    expect(scrapBringerOf(ORDERS, '2026-11-20T04:00:00.000Z')).toBe(A);
  });
  it('ยกเลิกไม่นับ · ไม่รู้วันเจอ = คำสั่งล่าสุด · ไม่มีคำสั่ง = null ไม่เดาคนอื่น', () => {
    expect(scrapBringerOf([{ requested_by_name: A, status: 'cancelled', created_at: '2026-11-20T00:00:00.000Z' }], null)).toBeNull();
    expect(scrapBringerOf(ORDERS, null)).toBe(B);
    expect(scrapBringerOf([], '2026-11-26T00:00:00.000Z')).toBeNull();
  });
});

describe('ใช้ทุกทาง', () => {
  it('ตอนสร้างใบจาก Scrap · แถวที่ยังไม่มีใบ · ไม่ใช้เจ้าหน้าที่สรรหาของใบขอแล้ว', () => {
    const lib = readFileSync('api/_lib/scrapCandidates.ts', 'utf8');
    expect(lib).not.toContain('responsible_name: job.recruiterName');
    expect(lib).toContain('row.ordered_by = nameOf(scrapBringerOf(');
    expect(readFileSync('src/lib/scrapApplicants.ts', 'utf8')).toContain('responsible_name: s.ordered_by ?? undefined');
  });
  it('กดดูคนที่ยังไม่มีใบ = ป๊อปอ่านอย่างเดียว (ไม่สร้างใบ) มีคำสั่ง Scrap ทุกครั้ง', () => {
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).not.toContain('ยังไม่มีประวัติ กดส่ง AI โทรหรือเก็บไปโทรเองก่อน');
    expect(ws).toContain('setScrapDetailId(row.id);');
    const dlg = readFileSync('src/components/recruit-rm/ScrapCandidateDialog.tsx', 'utf8');
    expect(dlg).toContain('data-testid="scrap-candidate-orders"');
    expect(dlg).not.toMatch(/apiFetch|resolveScrapApplicationIds/);
  });
});
