/**
 * ปุ่มบนแถว (เจ้าของ 23 พ.ย. 2569):
 * "แท็บการติดต่อมีปุ่มส่งเอกสาร แท็บติดตามนัดหมายมีปุ่ม เพิ่มผู้สมัครที่จะยิง Api ไป irecruit" · "ทำปุ่มไว้รอ ฉันรอ Api อยู่"
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { IRECRUIT_ADD_PENDING_REASON, RM_ROW_ACTIONS, RM_ROW_ACTION_LABEL, rmRowActionLabel } from '@/lib/recruitRm';

describe('ปุ่มบนแถว ส่งเอกสาร / เพิ่มผู้สมัคร', () => {
  it('แท็บการติดต่อมี "ส่งเอกสาร" · แท็บติดตามนัดหมายมี "เพิ่มผู้สมัคร" · แท็บอื่นไม่เปลี่ยน', () => {
    expect(RM_ROW_ACTIONS.contact).toEqual(['dial', 'view', 'docs', 'release']);
    expect(RM_ROW_ACTIONS.appointments).toEqual(['rule', 'irecruit']);
    // 26 พ.ย. 2569 + "ไม่โทร" ข้างส่ง AI โทร
    expect(RM_ROW_ACTIONS.candidates).toEqual(['bookmark', 'call', 'nocall', 'ai', 'view']);
    expect(rmRowActionLabel('contact', 'docs')).toBe('ส่งเอกสาร');
    expect(RM_ROW_ACTION_LABEL.irecruit).toBe('เพิ่มผู้สมัคร');
  });

  it('ปุ่มมีคำ · ส่งเอกสารกดไม่ได้ตอนระบบปิด · เพิ่มผู้สมัครกดไม่ได้จนกว่า iRecruit มีเส้นรับข้อมูล (บอกเหตุ)', () => {
    const table = readFileSync('src/components/recruit-rm/RmTable.tsx', 'utf8');
    expect(table).toContain("|| a === 'docs' || a === 'irecruit'");
    expect(table).toContain("if (a === 'docs' && !docsEnabled) {");
    expect(table).toContain('label = IRECRUIT_ADD_PENDING_REASON;');
    expect(IRECRUIT_ADD_PENDING_REASON).toContain('iRecruit');
  });

  it('กดส่งเอกสารบนแถว = ป๊อปเล็กที่มีแค่กล่องส่งเอกสาร (สร้างลิงก์ให้ทันที) ไม่ต้องเปิดดูรายละเอียด', () => {
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).toContain("if (action === 'docs') {");
    expect(ws).toContain('<SendDocumentsSection applicationId={docsApp.id} autoCreate />');
    expect(ws).toContain('docsEnabled={docsEnabled}');
  });
});
