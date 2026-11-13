/**
 * ข้อเคาะเจ้าของ 13 พ.ย. 2569 (Choice): ชื่อเล่นแทนอีเมล · ไม่โชว์ "Worker run completed" · หัวตารางป๊อปทำอะไรไปแล้วไม่ขยับ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { soRunMessageShown } from '@/lib/jobPostingRequestsApi';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ข้อเคาะ 13 พ.ย. 2569', () => {
  it('"Worker run completed" ไม่ขึ้นจอ · ข้อความอื่นขึ้นตามเดิม', () => {
    expect(soRunMessageShown('Worker run completed')).toBeNull();
    expect(soRunMessageShown(' worker run completed. ')).toBeNull();
    expect(soRunMessageShown('ข้าม 3 กลุ่มที่เพิ่งลง')).toBe('ข้าม 3 กลุ่มที่เพิ่งลง');
    expect(soRunMessageShown('')).toBeNull();
  });
  it('บันทึกโดย / คนสั่ง Scrap = ชื่อเล่นจากหน้าผู้ใช้งาน (STAFF_NAME_SQL) ไม่ใช่อีเมลเต็ม', () => {
    expect(read('api/_lib/staffNameSql.ts')).toContain("split_part(btrim(${raw}), '@', 1)");
    expect(read('api/_lib/applicationContacts.ts')).toContain("STAFF_NAME_SQL('u', 'c.created_by_name')");
    expect(read('api/_lib/applicationAttendance.ts')).toContain("STAFF_NAME_SQL('u', 'a.recorded_by_name')");
    expect(read('api/_lib/jobPostActions.ts')).toContain("STAFF_NAME_SQL('u', 'o.requested_by_name')");
  });
  it('ป๊อปทำอะไรไปแล้ว: ทุกตาราง table-fixed + ความกว้างคอลัมน์ตายตัว (สลับแท็บ/กรองแล้วหัวไม่ขยับ)', () => {
    const src = read('src/components/jobs/JobPostActionsDialog.tsx');
    expect(src.match(/table-fixed/g)?.length).toBeGreaterThanOrEqual(3);
    expect(src).toContain('<TableHead className="w-36 whitespace-nowrap text-xs">วันที่สร้าง</TableHead>');
  });
});
