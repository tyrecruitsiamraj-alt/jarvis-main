import { describe, it, expect } from 'vitest';
import { unitRequestPath, unitRequestTabPath } from '../../src/lib/jobNavigation';
import type { JobRequest } from '../../src/types';

/**
 * 🔴 เคสจริง 18 ส.ค. 2569 — แถวหน้าหน่วยงานขึ้น "อีซูซุ" แต่กดเข้าไปได้ "ชับบ์ ไลฟ์"
 *
 * `LBM6908001` มีอยู่ **ทั้งสองตาราง**: ใบขอล่วงหน้า = อีซูซุมอเตอร์ · ใบขอปกติ = ชับบ์ ไลฟ์
 * (ไซต์ 69LBDL0232) · URL เดิมพา `externalId` (เลขเปล่า) ไป ตัวอ่านจึงมองไม่ออกว่าเป็นใบ
 * ล่วงหน้า แล้วไปอ่านตารางใบขอปกติ — เทสต์นี้ล็อกไว้ว่า URL ของใบล่วงหน้าต้องพก prefix
 */

function job(over: Partial<JobRequest>): JobRequest {
  return { id: 'x', source: 'siamraj', request_no: 'LBM6908001', ...over } as JobRequest;
}

describe('unitRequestPath', () => {
  it('ใบขอล่วงหน้าต้องพก prefix siamraj-pre: ไปใน URL (กันเปิดผิดบริษัท)', () => {
    const p = unitRequestPath(job({ id: 'siamraj-pre:LBM6908001', externalId: 'LBM6908001' }));
    expect(p).toBe('/jobs/siamraj/siamraj-pre%3ALBM6908001');
    // ถอดกลับต้องได้ id เต็ม — ตัวอ่านฝั่ง API ดู prefix เพื่อแยกตาราง
    expect(decodeURIComponent(p.split('/').pop()!)).toBe('siamraj-pre:LBM6908001');
  });

  it('ใบขอปกติยังใช้เลขที่ใบเปล่าเหมือนเดิม — ลิงก์เก่าที่คนบันทึกไว้ต้องไม่พัง', () => {
    expect(unitRequestPath(job({ id: 'siamraj-sql:LBM6908001', externalId: 'LBM6908001' }))).toBe(
      '/jobs/siamraj/LBM6908001',
    );
  });

  it('ใบล่วงหน้าที่ไม่มี externalId ก็ยังได้ URL ที่ถูก (ไม่ตกไป /jobs/<id> ซึ่งไม่มีหน้า)', () => {
    expect(unitRequestPath(job({ id: 'siamraj-pre:LBM6908001' }))).toBe(
      '/jobs/siamraj/siamraj-pre%3ALBM6908001',
    );
  });

  it('ใบที่ไม่ใช่ของ Siamraj ยังไปเส้น /jobs/<id> เดิม', () => {
    expect(unitRequestPath(job({ id: 'local-1', source: 'jarvis' as never, externalId: undefined }))).toBe(
      '/jobs/local-1',
    );
  });
});

/**
 * 🔴 แท็บของใบขอต้องต่อท้าย `unitRequestPath()` เท่านั้น (27 ส.ค. 2569)
 *
 * หน้ากล่องงานเลิกเด้งป๊อปแล้ว — กดการ์ด/ปุ่มบนการ์ดคือ "เปลี่ยนหน้า" ไปแท็บของใบขอ
 * ถ้าใครประกอบ `/jobs/siamraj/${id}/...` เองจะหลุด prefix ของใบล่วงหน้า
 * แล้วเปิดผิดบริษัทเหมือนบั๊ก 18 ส.ค. 2569 เป๊ะ ๆ แต่คราวนี้เป็นทุกแท็บ
 */
describe('unitRequestTabPath', () => {
  it('detail = หน้าหลัก ไม่มีส่วนต่อท้าย', () => {
    const j = job({ id: 'siamraj-sql:LBM6908001', externalId: 'LBM6908001' });
    expect(unitRequestTabPath(j, 'detail')).toBe('/jobs/siamraj/LBM6908001');
  });

  it('ทุกแท็บต่อท้าย path ของใบขอ', () => {
    const j = job({ id: 'siamraj-sql:LBM6908001', externalId: 'LBM6908001' });
    expect(unitRequestTabPath(j, 'posting')).toBe('/jobs/siamraj/LBM6908001/posting');
    expect(unitRequestTabPath(j, 'applicants')).toBe('/jobs/siamraj/LBM6908001/applicants');
    expect(unitRequestTabPath(j, 'ai-match')).toBe('/jobs/siamraj/LBM6908001/ai-match');
    expect(unitRequestTabPath(j, 'contact')).toBe('/jobs/siamraj/LBM6908001/contact');
  });

  it('ใบขอล่วงหน้าต้องพก prefix ไปในทุกแท็บ (กันเปิดผิดบริษัท)', () => {
    const j = job({ id: 'siamraj-pre:LBM6908001', externalId: 'LBM6908001' });
    expect(unitRequestTabPath(j, 'posting')).toBe('/jobs/siamraj/siamraj-pre%3ALBM6908001/posting');
    expect(unitRequestTabPath(j, 'applicants')).toBe(
      '/jobs/siamraj/siamraj-pre%3ALBM6908001/applicants',
    );
  });

  it('ใบที่ไม่ใช่ของ Siamraj ไม่มีแท็บ — คืน path เดิม ไม่ต่อท้ายให้เป็น 404', () => {
    const j = job({ id: 'local-1', source: 'jarvis' as never, externalId: undefined });
    expect(unitRequestTabPath(j, 'applicants')).toBe('/jobs/local-1');
  });
});
