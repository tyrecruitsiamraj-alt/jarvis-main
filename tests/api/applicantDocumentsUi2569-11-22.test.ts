/**
 * ส่งเอกสารผ่าน LINE — หน้าจอเชื่อมกับระบบเดิม (22 พ.ย. 2569)
 * DOC-005 หน้าผู้สมัครไม่ต้องล็อกอิน · DOC-063 กระดิ่งถามถี่เฉพาะคนที่รอเอกสาร · DOC-053 toast เฉพาะของใหม่
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_NOTIFICATION_TYPE,
  NOTIFICATION_FAST_POLL_MS,
  NOTIFICATION_POLL_MS,
  freshDocumentNotifications,
  nextNotificationPoll,
} from '@/lib/notificationTabs';
import { DOCUMENT_PACKET_NOTIFICATION_TYPE } from '@/lib/documents/documentNotification';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ส่งเอกสารผ่าน LINE — หน้าจอ', () => {
  it('DOC-005 หน้า /apply/documents อยู่นอกส่วนที่ต้องล็อกอิน', () => {
    const app = read('src/App.tsx');
    const route = app.indexOf('path="/apply/documents"');
    expect(route).toBeGreaterThan(0);
    expect(route).toBeLessThan(app.indexOf('<Route path="/*" element={<ProtectedRoutes />} />'));
  });

  it('DOC-063 มีคนเปิดลิงก์ค้างอยู่ = ถามกระดิ่งทุก 10 วินาที · หมดเวลา/ไม่มี = นาทีละครั้ง', () => {
    const now = Date.parse('2026-11-22T04:00:00.000Z');
    expect(nextNotificationPoll('2026-11-22T05:00:00.000Z', now)).toBe(NOTIFICATION_FAST_POLL_MS);
    expect(nextNotificationPoll('2026-11-22T03:59:59.000Z', now)).toBe(NOTIFICATION_POLL_MS);
    expect(nextNotificationPoll(null, now)).toBe(NOTIFICATION_POLL_MS);
    expect(nextNotificationPoll('ไม่ใช่วันที่', now)).toBe(NOTIFICATION_POLL_MS);
    expect(NOTIFICATION_FAST_POLL_MS).toBeLessThanOrEqual(15_000);
  });

  it('DOC-053 toast เฉพาะแจ้งเตือนเอกสารที่ยังไม่อ่านและไม่เคยเห็น', () => {
    const list = [
      { id: 'srv-1', type: DOCUMENT_NOTIFICATION_TYPE, read: false },
      { id: 'srv-2', type: DOCUMENT_NOTIFICATION_TYPE, read: true },
      { id: 'srv-3', type: 'needs_human', read: false },
      { id: 'srv-4', type: DOCUMENT_NOTIFICATION_TYPE, read: false },
    ];
    expect(freshDocumentNotifications(list, new Set(['srv-4'])).map((n) => n.id)).toEqual(['srv-1']);
  });

  it('ชื่อชนิดแจ้งเตือนของกระดิ่งตรงกับที่เซิร์ฟเวอร์เขียน', () => {
    expect(DOCUMENT_NOTIFICATION_TYPE).toBe(DOCUMENT_PACKET_NOTIFICATION_TYPE);
  });

  it('หน้าเจ้าหน้าที่ไม่ลากข้อมูลที่อยู่ทั้งประเทศ (ใช้เฉพาะหน้าผู้สมัคร)', () => {
    for (const f of [
      'src/components/documents/SendDocumentsSection.tsx',
      'src/components/documents/DocumentsWorkspace.tsx',
      'src/components/documents/DocumentPacketSheet.tsx',
      'src/lib/documents/documentsStaffApi.ts',
      'src/pages/settings/DocumentsSettingsTab.tsx',
    ]) {
      expect(read(f), f).not.toMatch(/thaiAddress|packetValidation|applicantForm/);
    }
  });

  it('ลบข้อมูลตามคำขอ PDPA ล้างงานส่งเอกสารในธุรกรรมเดียวกัน', () => {
    const pdpa = read('api/_lib/pdpaRequests.ts');
    expect(pdpa).toContain('eraseDocumentsForApplications(client,');
    expect(pdpa.indexOf("select id from ${APPS} where ${key9('phone')} = $1")).toBeLessThan(pdpa.indexOf("phone = '', line_id = null"));
  });
});
