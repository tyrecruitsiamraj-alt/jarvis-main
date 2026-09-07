// @vitest-environment node
/**
 * ═══ ไฟล์แนบของผู้สมัคร — "มีไฟล์แนบมาแต่ดูไม่ได้" (เจ้าของแจ้ง 7 ก.ย. 2569) ═══
 *
 * ต้นเหตุที่พิสูจน์แล้ว: ป๊อป "ดูรายละเอียด" (`ApplicantContactDialog`) **ไม่เคยวาด
 * ส่วนไฟล์แนบเลย** ทั้งที่ตาราง (`RmTable`) ขึ้นไอคอน 📄 "มีเอกสารแนบ" อยู่ และเส้น
 * `/api/job-application-document` ทำงานปกติมาตลอด (JobApplicantsDialog ใช้ดาวน์โหลดอยู่)
 * ⇒ ด่านชุดนี้กันไม่ให้ส่วนนั้นหายไปอีก + คุมกติกา blob/dialog ซ้อน
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  attachmentFilename,
  attachmentKind,
  attachmentKindLabel,
} from '../../src/lib/applicantDocument';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('attachmentKind — ดู mime ก่อน แล้วค่อยถอยไปดูนามสกุล', () => {
  it('รูปภาพจาก mime', () => {
    expect(attachmentKind('image/jpeg', 'x.bin')).toBe('image');
    expect(attachmentKind('image/png', null)).toBe('image');
  });

  it('PDF จาก mime', () => {
    expect(attachmentKind('application/pdf', null)).toBe('pdf');
  });

  it('🔴 ใบเก่าเก็บ mime เป็น octet-stream ⇒ ต้องอ่านนามสกุลแทน ไม่ใช่ยอมแพ้', () => {
    expect(attachmentKind('application/octet-stream', 'resume.PDF')).toBe('pdf');
    expect(attachmentKind('application/octet-stream', 'บัตรประชาชน.JPG')).toBe('image');
  });

  it('ชนิดอื่น (docx) = other — จอต้องบอกให้ดาวน์โหลด ไม่ใช่โชว์กรอบว่าง', () => {
    expect(
      attachmentKind(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'cv.docx',
      ),
    ).toBe('other');
    expect(attachmentKind(null, null)).toBe('other');
  });

  it('ป้ายไทยครบทุกชนิด', () => {
    expect(attachmentKindLabel('image')).toBe('รูปภาพ');
    expect(attachmentKindLabel('pdf')).toBe('ไฟล์ PDF');
    expect(attachmentKindLabel('other')).toBe('ไฟล์เอกสาร');
  });
});

describe('attachmentFilename — ชื่อว่างต้องมีชื่อสำรอง ไม่ใช่ช่องว่าง', () => {
  it('มีชื่อ ⇒ ใช้ชื่อนั้น', () => {
    expect(attachmentFilename('resume.pdf')).toBe('resume.pdf');
  });
  it('ว่าง/ช่องว่าง/null ⇒ "เอกสารแนบ"', () => {
    expect(attachmentFilename('')).toBe('เอกสารแนบ');
    expect(attachmentFilename('   ')).toBe('เอกสารแนบ');
    expect(attachmentFilename(null)).toBe('เอกสารแนบ');
  });
});

describe('ป๊อป "ดูรายละเอียด" ต้องมีทางเปิดไฟล์แนบเสมอ', () => {
  const dialog = read('src/components/recruit-rm/ApplicantContactDialog.tsx');
  const panel = read('src/components/recruit-rm/ApplicantAttachmentPanel.tsx');

  it('🔴 ป๊อปรายละเอียดวาดแผงไฟล์แนบ (บั๊กเดิมคือไม่มีเลย)', () => {
    expect(dialog).toContain('ApplicantAttachmentPanel');
    expect(dialog).toContain('hasDocument={a.has_document}');
  });

  it('🔴 ห้ามซ้อน Dialog ใน Dialog — แผงไฟล์แนบต้องไม่เปิด Dialog ของตัวเอง', () => {
    expect(panel).not.toMatch(/<Dialog[\s>]/);
    expect(panel).not.toContain("from '@/components/ui/dialog'");
  });

  it('🔴 ใช้ blob: ไม่ใช่ data: (เบราว์เซอร์บล็อก data: URL ในแท็บใหม่/iframe)', () => {
    expect(panel).toContain('createObjectURL');
    expect(panel).not.toMatch(/href=\{`data:/);
  });

  it('คืนหน่วยความจำเสมอ — สร้าง object URL แล้วต้อง revoke', () => {
    expect(panel).toContain('revokeObjectURL');
  });

  it('เปิดดูได้จริงทั้งพรีวิวในหน้าและแท็บใหม่ (ไม่ใช่มีแต่ปุ่มดาวน์โหลด)', () => {
    expect(panel).toContain('<iframe');
    expect(panel).toContain('<img');
    expect(panel).toContain('target="_blank"');
    expect(panel).toContain('download={doc.filename}');
  });

  it('🔴 ใช้เส้น read-only เดิม ไม่ปั้นเส้นใหม่/ไม่เปิด public', () => {
    expect(panel).toContain('fetchApplicationDocument');
    expect(panel).not.toContain('method:');
  });

  it('ไม่มีไฟล์แนบ ⇒ ไม่วาดอะไรเลย (ไม่มีกรอบเปล่า)', () => {
    expect(panel).toContain('if (hasDocument !== true) return null;');
  });
});

describe('เส้นเสิร์ฟไฟล์แนบยังเป็น GET + ตรวจสิทธิ์ + จำกัด BU', () => {
  const api = read('api/_handlers/job-application-document.ts');

  it('รับเฉพาะ GET', () => {
    expect(api).toContain("if (method !== 'GET')");
  });

  it('ผ่าน RBAC และเช็คขอบเขตแผนกก่อนส่งไฟล์', () => {
    expect(api).toContain("withRbac(handler, 'job-applications')");
    expect(api).toContain('isApplicationInWriteScope');
  });
});
