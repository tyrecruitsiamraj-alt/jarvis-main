/**
 * Journey โพสต์ประกาศ (เจ้าของ 5 ต.ค. 2569)
 * - หน้า 4 "ตำแหน่ง" ต้องบอกว่าขับรถอะไร (ส่วนกลาง · นายไทย · นายต่างชาติ · Valet …) ไม่ใช่แค่ "ขับรถ"
 * - หน้า 1 เพศต้องเป็นคำ ไม่ใช่รหัส ERP "0"
 * - auto-save หน้า 2/3 ต้องไม่โดน render ถี่รีเซ็ตนาฬิกา (jobWithPatch memo)
 * - ดึงประกาศลงไม่สำเร็จต้องบอก (เดิมกลืนเงียบ)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { postingPositionText } from '../../src/lib/publicJobTitle';
import { genderLabel } from '../../src/lib/genderRequirement';
import type { JobRequest } from '../../src/types';

const drive = (over: Partial<JobRequest>) =>
  ({ job_type: 'driver', job_description_code_1: 'ขับรถ', ...over }) as unknown as JobRequest;

describe('ตำแหน่งหน้า 4', () => {
  it('งานไม่ใช่ขับรถ = ชื่อเดิม', () => {
    expect(postingPositionText({ job_type: 'other', job_description_code_1: 'คนสวน' } as unknown as JobRequest)).toBe('คนสวน');
  });
  it('ขับรถ ชนิดอ่านไม่ออก = ต่อรายละเอียดจากใบขอ · ไม่มีรายละเอียด = บอกว่าใบขอไม่ระบุ (ห้ามเดา)', () => {
    const t1 = postingPositionText(drive({ job_description_code_2: 'ชนิดที่ 2' }));
    expect(t1.startsWith('พนักงานขับรถ')).toBe(true);
    if (!/ส่วนกลาง|นาย|Valet/.test(t1)) expect(t1).toContain('ชนิดที่ 2');
    const t2 = postingPositionText(drive({ job_description_code_2: 'ไม่ระบุ' }));
    if (!/ส่วนกลาง|นาย|Valet/.test(t2)) expect(t2).toContain('ใบขอไม่ระบุชนิด');
  });
});

describe('เพศหน้า 1', () => {
  it('รหัส ERP แปลงเป็นคำ', () => {
    expect(genderLabel('0')).toBe('ไม่ระบุ');
    expect(genderLabel('M')).toBe('ชาย');
    expect(genderLabel('F')).toBe('หญิง');
    const src = readFileSync(join(process.cwd(), 'src/components/jobs/UnitRequestInfoFields.tsx'), 'utf8');
    expect(src).toContain('<Field label="เพศ" value={genderLabel(data.gender_requirement)} />');
  });
});

describe('ป๊อปโพสต์ประกาศ — ของที่ไล่กดแล้วเจอ', () => {
  const src = readFileSync(join(process.cwd(), 'src/pages/jobs/BoardPostingPage.tsx'), 'utf8');
  it('jobWithPatch ต้อง memo (auto-save ไม่โดนรีเซ็ตทุก render)', () => {
    expect(src).toMatch(/const jobWithPatch = React\.useMemo\(/);
  });
  it('ดึงประกาศลง/ประกาศ ไม่สำเร็จ = บอกบนจอ ไม่กลืนเงียบ', () => {
    const block = src.slice(src.indexOf('const toggleRelease'), src.indexOf('const sendPost'));
    expect(block).toContain('setSendError(');
    expect(block).not.toMatch(/catch \{\s*\/\*/);
  });
  it('แถวตำแหน่งใช้ postingPositionText · Gen link เป็นปุ่มกางลง ไม่ใช่ช่องติ๊ก', () => {
    expect(src).toContain('<SummaryRow label="ตำแหน่ง">{postingPositionText(jobWithPatch)}</SummaryRow>');
    expect(src).toContain('data-testid="gen-link-toggle"');
    expect(src).not.toContain('id="posting-want-link"');
  });
});
