import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APPLY_FORM_FIELDS,
  applyExtraLines,
  applyFormsForBu,
  cleanApplyFormFields,
  cleanDepartmentCodes,
  sanitizeApplyExtra,
  type ApplyForm,
} from '@/lib/applyForms';

/** แบบฟอร์มใบสมัครหลายแบบ (เจ้าของ 27 พ.ย. 2569) — ช่องเสริมไม่บังคับ · ผูก BU · หน้าสาธารณะไม่เชื่อช่องที่ส่งมา */
const booth: ApplyForm = { id: 3, name: 'ฟอร์มออกบูธ', departmentCodes: ['DS', 'LBA'], fields: ['university', 'faculty', 'major', 'salary', 'position'], active: true, linkCount: 0 };
const allBu: ApplyForm = { id: 4, name: 'ฟอร์มทุก BU', departmentCodes: [], fields: ['position'], active: true, linkCount: 2 };
const retired: ApplyForm = { id: 5, name: 'ฟอร์มเก่า', departmentCodes: ['DS'], fields: ['major'], active: false, linkCount: 7 };

describe('แบบฟอร์มใบสมัคร (27 พ.ย. 2569)', () => {
  it('ช่องเสริมมี 5 ช่องตามที่ตกลง · ค่าแปลก/ซ้ำทิ้ง เรียงตามลำดับกลาง', () => {
    expect(APPLY_FORM_FIELDS.map((f) => f.key)).toEqual(['university', 'faculty', 'major', 'salary', 'position']);
    expect(cleanApplyFormFields(['position', 'hack', 'university', 'position'])).toEqual(['university', 'position']);
    expect(cleanApplyFormFields('university')).toEqual([]);
    expect(cleanDepartmentCodes([' lba', 'DS', 'ds', '', 'x y'])).toEqual(['DS', 'LBA']);
  });

  it('Gen link เห็นเฉพาะฟอร์มที่เปิดใช้ + BU ตรง (ไม่ติ๊ก BU = ทุก BU)', () => {
    const forms = [booth, allBu, retired];
    expect(applyFormsForBu(forms, 'DS').map((f) => f.id)).toEqual([3, 4]);
    expect(applyFormsForBu(forms, 'lbd').map((f) => f.id)).toEqual([4]);
    expect(applyFormsForBu(forms, null).map((f) => f.id)).toEqual([4]);
  });

  it('คำตอบ: เก็บเฉพาะช่องที่ฟอร์มมี · ตัดช่องว่าง · เงินเดือนเป็นตัวเลข สลับเมื่อต่ำสุดมากกว่า', () => {
    expect(
      sanitizeApplyExtra(
        { university: '  มหาวิทยาลัย   เกษตรศาสตร์ ', major: 'คอมพิวเตอร์', salaryMin: '20,000', salaryMax: '15000', position: '', hack: 'x' },
        booth.fields,
      ),
    ).toEqual({ university: 'มหาวิทยาลัย เกษตรศาสตร์', major: 'คอมพิวเตอร์', salaryMin: 15000, salaryMax: 20000 });
    // ฟอร์มมีแค่ตำแหน่ง → ช่องอื่นที่ยิงตรงมาไม่ถูกเก็บ
    expect(sanitizeApplyExtra({ university: 'จุฬา', position: 'ไอที' }, allBu.fields)).toEqual({ position: 'ไอที' });
    expect(sanitizeApplyExtra({ university: '' }, booth.fields)).toBeNull();
    expect(sanitizeApplyExtra('x', booth.fields)).toBeNull();
    expect(sanitizeApplyExtra({ salaryMin: '-5', salaryMax: 'abc' }, booth.fields)).toBeNull();
  });

  it('ป๊อปผู้สมัคร: บรรทัดเฉพาะช่องที่กรอก · เงินเดือนเป็นช่วง', () => {
    expect(applyExtraLines({ university: 'มก.', salaryMin: 15000, salaryMax: 20000 })).toEqual([
      { label: 'มหาวิทยาลัย', value: 'มก.' },
      { label: 'เงินเดือนที่ต้องการ', value: '15,000–20,000 บาท' },
    ]);
    expect(applyExtraLines({ salaryMin: 15000 })[0].value).toBe('ตั้งแต่ 15,000 บาท');
    expect(applyExtraLines({ salaryMax: 18000 })[0].value).toBe('ไม่เกิน 18,000 บาท');
    expect(applyExtraLines(null)).toEqual([]);
  });

  it('สายไฟครบ: Gen link ส่ง applyFormId · server ตรวจ BU · หน้าสมัครส่ง extra · ตัวรับกรองด้วยช่องของลิงก์', () => {
    expect(readFileSync('src/components/jobs/GenApplyLinkDialog.tsx', 'utf8')).toContain('applyFormId:');
    expect(readFileSync('api/_handlers/recruit-postings.ts', 'utf8')).toContain('resolveApplyFormForBu(body.applyFormId');
    expect(readFileSync('api/_handlers/public/apply-link.ts', 'utf8')).toContain('applyFields: await applyFieldsOfPosting(posting.id)');
    expect(readFileSync('src/components/jobs/PublicApplyDialog.tsx', 'utf8')).toContain('{ extra }');
    expect(readFileSync('api/_handlers/public/apply.ts', 'utf8')).toContain('sanitizeApplyExtra(rawBody.extra, await applyFieldsOfPosting(v.postingId))');
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/apply-forms': applyFormsHandler");
  });
});
