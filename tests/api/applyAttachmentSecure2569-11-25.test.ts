import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { documentBytesMatchMime, normalizeDocument } from '../../api/_lib/publicApplications';
import { decryptAttachment, encryptAttachment, isEncryptedAttachment } from '../../api/_lib/piiCipher';

/**
 * ไฟล์แนบหน้าสมัคร (เจ้าของ 25 พ.ย. 2569 ตรวจความปลอดภัยลิงก์ · Choice "แบบทดสอบ + ไฟล์แนบหน้าสมัคร")
 * เดิมเชื่อชนิดไฟล์ที่เครื่องผู้ส่งบอก + เก็บไฟล์ดิบ ⇒ ตรวจหัวไฟล์จริง + เก็บแบบเข้ารหัส (ไฟล์เก่ายังเปิดได้)
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');
const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');
const PDF = b64([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPG = b64([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]);
const EXE = b64([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);

beforeAll(() => {
  process.env.AUTH_JWT_SECRET ||= 'test-secret-for-attachments-only';
});

describe('ตรวจหัวไฟล์จริง', () => {
  it('ชนิดตรงกับเนื้อไฟล์ = ผ่าน · ไฟล์โปรแกรมแอบตั้งชื่อเป็น PDF = ไม่ผ่าน', () => {
    expect(documentBytesMatchMime(PDF, 'application/pdf')).toBe(true);
    expect(documentBytesMatchMime(PNG, 'image/png')).toBe(true);
    expect(documentBytesMatchMime(JPG, 'image/jpeg')).toBe(true);
    expect(documentBytesMatchMime(EXE, 'application/pdf')).toBe(false);
    expect(documentBytesMatchMime(PNG, 'application/pdf')).toBe(false);
    expect(normalizeDocument({ base64: EXE, filename: 'cv.pdf', mime: 'application/pdf' })).toEqual({ ok: false, message: 'รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG' });
    expect(normalizeDocument({ base64: PDF, filename: 'cv.pdf', mime: 'application/pdf' }).ok).toBe(true);
  });
});

describe('เก็บแบบเข้ารหัส', () => {
  it('เข้ารหัสแล้วถอดคืนได้ตรง · ไฟล์เก่า (ไม่เข้ารหัส) คืนตามเดิม · เนื้อถูกแก้ = ถอดไม่ได้', () => {
    const plain = Buffer.from(PDF, 'base64');
    const stored = encryptAttachment(plain);
    expect(isEncryptedAttachment(stored)).toBe(true);
    expect(stored.includes(plain)).toBe(false);
    expect(decryptAttachment(stored)?.equals(plain)).toBe(true);
    expect(decryptAttachment(plain)?.equals(plain)).toBe(true);
    const tampered = Buffer.from(stored);
    tampered[tampered.length - 1] ^= 0xff;
    expect(decryptAttachment(tampered)).toBeNull();
  });
  it('หน้าสมัคร + เจ้าหน้าที่แนบ เก็บแบบเข้ารหัส · เปิดดูถอดก่อนส่ง', () => {
    expect(read('api/_handlers/public/apply.ts')).toContain("encryptAttachment(Buffer.from(v.document.base64, 'base64'))");
    const h = read('api/_handlers/job-application-document.ts');
    expect(h).toContain("encryptAttachment(Buffer.from(doc.value.base64, 'base64'))");
    expect(h).toContain('const plain = decryptAttachment(Buffer.from(row.document_bytes));');
  });
});
