// @vitest-environment node
/**
 * คำขอใช้สิทธิ์ข้อมูลส่วนบุคคล (PDPA) — เจ้าของเลือกทำ 18 ต.ค. 2569 · Choice 17 ต.ค. 2569
 * ยื่นทางฟอร์ม + เจ้าหน้าที่ลงแทน · โทรกลับยืนยันตัวตน · ขอลบ = หยุดโทรทันที + ลบจริงหลังยืนยัน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  pdpaActions,
  pdpaDaysLeft,
  pdpaDueText,
  pdpaStopsCalls,
  validatePdpaRequest,
} from '../../src/lib/pdpaRequests';

const read = (p: string) => readFileSync(p, 'utf8');

describe('validatePdpaRequest — ตัวเดียวทั้งหน้าเว็บและเซิร์ฟเวอร์', () => {
  it('ครบ = ผ่าน · ตัดขีด/เว้นวรรคในเบอร์', () => {
    expect(validatePdpaRequest({ kind: 'delete', fullName: '  ทดสอบ   หนึ่ง ', phone: '081-234-5678' })).toEqual({
      ok: true,
      value: { kind: 'delete', fullName: 'ทดสอบ หนึ่ง', phone: '0812345678', detail: null },
    });
  });
  it('ไม่เลือกเรื่อง / ไม่มีชื่อ / เบอร์ไม่ใช่มือถือ 10 หลัก = ไม่ผ่าน', () => {
    expect(validatePdpaRequest({ fullName: 'ทดสอบ', phone: '0812345678' })).toMatchObject({ ok: false, message: 'เลือกเรื่องที่ต้องการ' });
    expect(validatePdpaRequest({ kind: 'access', fullName: ' ', phone: '0812345678' })).toMatchObject({ ok: false });
    expect(validatePdpaRequest({ kind: 'access', fullName: 'ทดสอบ', phone: '021234567' })).toMatchObject({ ok: false });
    expect(validatePdpaRequest({ kind: 'nope', fullName: 'ทดสอบ', phone: '0812345678' })).toMatchObject({ ok: false });
  });
  it('ขอแก้ต้องบอกว่าแก้อะไร', () => {
    expect(validatePdpaRequest({ kind: 'correct', fullName: 'ทดสอบ', phone: '0812345678' })).toMatchObject({ ok: false });
    expect(validatePdpaRequest({ kind: 'correct', fullName: 'ทดสอบ', phone: '0812345678', detail: 'นามสกุลสะกดผิด' })).toMatchObject({ ok: true });
  });
});

describe('ขั้นตอนตามสถานะ', () => {
  it('ขอลบ/คัดค้าน หยุดโทรทันที · ขอดู/ขอแก้ ไม่หยุด', () => {
    expect(pdpaStopsCalls('delete')).toBe(true);
    expect(pdpaStopsCalls('object')).toBe(true);
    expect(pdpaStopsCalls('access')).toBe(false);
    expect(pdpaStopsCalls('correct')).toBe(false);
  });
  it('ยังไม่ยืนยันตัวตน = ทำได้แค่ยืนยัน/ไม่ดำเนินการ (ห้ามดูหรือลบก่อน)', () => {
    for (const k of ['access', 'correct', 'delete', 'object'] as const) {
      expect(pdpaActions(k, 'received')).toEqual(['verify', 'reject']);
      expect(pdpaActions(k, 'done')).toEqual([]);
      expect(pdpaActions(k, 'rejected')).toEqual([]);
    }
    expect(pdpaActions('delete', 'verified')).toEqual(['erase', 'reject']);
    expect(pdpaActions('access', 'verified')).toEqual(['view', 'close']);
  });
  it('กำหนด 30 วัน', () => {
    const now = new Date('2026-10-18T05:00:00Z');
    expect(pdpaDaysLeft('2026-11-17T05:00:00Z', now)).toBe(30);
    expect(pdpaDueText('2026-10-17T05:00:00Z', now)).toBe('เลยกำหนด 1 วัน');
    expect(pdpaDueText('2026-10-18T05:00:00Z', now)).toBe('ครบกำหนดวันนี้');
  });
});

describe('เซิร์ฟเวอร์', () => {
  const lib = read('api/_lib/pdpaRequests.ts');
  it('ลบได้เฉพาะคำขอลบที่ยืนยันตัวตนแล้ว (ตรวจซ้ำในธุรกรรม)', () => {
    expect(lib).toContain("where id = $1 and kind = 'delete' and status = 'verified' for update");
  });
  it('หยุดโทร = บัญชีห้ามโทรเหตุผล pdpa + ยกเลิกคิว AI + ยกเลิกสายติดตามผ่าน cancelFollowScope', () => {
    expect(lib).toContain("reason: 'pdpa'");
    expect(lib).toContain("cancelFollowScope(a.id, 'person'");
    expect(lib).toContain('cancelPushedInterview(');
  });
  it('ไม่แตะคอลัมน์ที่ฐานคำนวณเอง (phone_e164 ของใบสมัคร)', () => {
    expect(lib).not.toMatch(/phone_e164 = null/);
  });
  it('หน้าสาธารณะไม่บอกว่าเบอร์นี้มีข้อมูลในระบบไหม · จำกัด 3 ครั้ง/10 นาที', () => {
    const pub = read('api/_handlers/public/privacy-request.ts');
    expect(pub).toContain("res.status(201).json({ ok: true, dueAt: row.due_at })");
    expect(pub).toContain("rateLimitOrReject(req, res, 'public-privacy-request', 3, 10 * 60 * 1000)");
  });
  it('ฝั่งเจ้าหน้าที่ admin เท่านั้น · เปิดดูข้อมูลได้หลังยืนยันตัวตน', () => {
    expect(read('api/_lib/rbac.ts')).toMatch(/case 'ai-settings':\s*case 'pdpa-requests':\s*return 'admin';/);
    expect(read('api/_handlers/pdpa-requests.ts')).toContain("if (row.status !== 'verified') return sendError(res, 409");
  });
  it('บัญชีห้ามโทร: เบอร์ PDPA ปลดไม่ได้ · CHECK เดิมถอดแล้ว', () => {
    expect(read('api/_handlers/call-suppression.ts')).toContain("reason = 'pdpa'");
    expect(read('migrations/153_call_suppression_reason_pdpa.sql')).toContain('drop constraint if exists candidate_call_suppression_reason_check');
  });
});

describe('หน้าจอ', () => {
  it('ข้อตกลง PDPA มีทางไปหน้าคำขอ · route สาธารณะ · แท็บในตั้งค่า', () => {
    expect(read('src/components/shared/PdpaConsentCheck.tsx')).toContain('href="/privacy-request"');
    expect(read('src/App.tsx')).toContain('path="/privacy-request"');
    expect(read('src/lib/settingsNav.ts')).toContain("pdpaRequests: 'คำขอข้อมูลส่วนบุคคล'");
  });
});
