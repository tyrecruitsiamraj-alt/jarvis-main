/**
 * Gen link เลือกได้ว่าหน้าสมัครมีช่องแนบเอกสารไหม (เจ้าของ 23 พ.ย. 2569
 * "Genlink แบบแนบเอกสารไม่ได้ หน้าสมัครงานไม่มีช่องให้แปะไฟล์ ต้องมีให้เลือกตอน Gen ว่าแนบเอกสารไหมด้วย")
 * เดิมช่องเลือกอยู่ในส่วนที่ซ่อนตอน Gen จากใบขอ และหน้าสมัครไม่อ่านค่านี้ (28 ต.ค. ปิดช่องแนบทุกทาง)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RM_FORM_TYPES, rmFormTypeLabel } from '@/lib/recruitRmMasters';

const dialog = readFileSync('src/components/jobs/GenApplyLinkDialog.tsx', 'utf8');

describe('Gen link — เลือกแนบเอกสาร', () => {
  it('ช่อง "แนบเอกสาร" อยู่ใต้เจ้าหน้าที่สรรหา นอกส่วนที่ซ่อนตอน Gen จากใบขอ (ใบขอ + กล่องลอยเห็นเหมือนกัน)', () => {
    const responsible = dialog.indexOf('<LinkResponsibleField value={responsible.value}');
    const attach = dialog.indexOf('data-testid="link-attach-docs"');
    const hiddenPart = dialog.indexOf('{channelOnly ? null : (');
    expect(responsible).toBeGreaterThan(0);
    expect(attach).toBeGreaterThan(responsible);
    expect(attach).toBeLessThan(hiddenPart);
    expect(dialog.match(/RM_FORM_TYPES\.map/g)).toHaveLength(1);
  });

  it('ใช้ ToggleGroup ของ shadcn · ค่าเริ่ม = ไม่ต้องแนบ · ส่งค่าไปกับประกาศ (form_type เดิม)', () => {
    expect(dialog).toContain("import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';");
    expect(dialog).toContain("useState<string>('rm')");
    // 27 พ.ย. 2569 มีช่องฟอร์มสมัครตามหลัง (applyFormId) — ยังส่ง formType ไปกับประกาศเหมือนเดิม
    expect(dialog).toMatch(/\n\s+formType,\n/);
    expect(RM_FORM_TYPES.map((f) => f.label)).toEqual(['ไม่ต้องแนบ', 'ให้แนบเอกสาร']);
    expect(rmFormTypeLabel(undefined)).toBe('ไม่ต้องแนบ');
  });

  it('ลิงก์ที่เลือกแนบเอกสาร = หน้าสมัครมีช่องแนบ · ลิงก์เก่า/ไม่เลือก = ไม่มีช่อง', () => {
    const api = readFileSync('api/_handlers/public/apply-link.ts', 'utf8');
    expect(api).toContain("attachDocuments: posting.formType === 'global',");
    const page = readFileSync('src/pages/public/PublicPostingApplyPage.tsx', 'utf8');
    expect(page).toContain('attachDocuments: info.attachDocuments === true,');
    const form = readFileSync('src/components/jobs/PublicApplyDialog.tsx', 'utf8');
    expect(form).toContain('applyLinkShowsDocument(searchParams) || posting?.attachDocuments === true');
  });
});
