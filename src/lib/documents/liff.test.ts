/** รหัสลิงก์จากแถบที่อยู่ — ตรง ๆ หรือที่ LINE ห่อมาใน liff.state · หน้าตาไม่ใช่รหัส = ไม่มี */
import { describe, expect, it } from 'vitest';
import { inviteFromUrl } from './liff';

const T = 'ab'.repeat(32);

describe('รหัสลิงก์ส่งเอกสาร', () => {
  it('อ่านจาก ?invite= ตรง ๆ', () => {
    expect(inviteFromUrl(`?invite=${T}`)).toBe(T);
  });
  it('อ่านจาก liff.state ที่ LINE ห่อมาตอนเปิดผ่าน liff.line.me', () => {
    expect(inviteFromUrl(`?liff.state=${encodeURIComponent(`?invite=${T}`)}`)).toBe(T);
  });
  it('รหัสผิดรูป = ไม่มี (ไม่ส่งไปถามเซิร์ฟเวอร์)', () => {
    expect(inviteFromUrl('?invite=abc')).toBeNull();
    expect(inviteFromUrl(`?invite=${T}x`)).toBeNull();
    expect(inviteFromUrl('')).toBeNull();
  });
});
