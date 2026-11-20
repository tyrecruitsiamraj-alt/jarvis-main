/**
 * หน้าใบขอ: ตัวกรองตำแหน่ง (เจ้าของ 20 พ.ย. 2569 "เพิ่มตัวกรอง ตำแหน่งให้หน่อย")
 * ป้ายเดียวกับคอลัมน์ตำแหน่งในตาราง (`publicJobPositionLabel`) · เก็บใน URL `pos=` · เปลี่ยนแล้วกลับหน้า 1
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JOB_LIST_DEFAULTS, buildJobListSearchParams, mergeJobListState, parseJobListSearchParams } from '@/lib/jobListPageState';

describe('ตัวกรองตำแหน่ง', () => {
  it('อ่าน/เขียน URL pos= ได้หลายค่า · ไม่เลือก = ไม่มีใน URL', () => {
    const s = parseJobListSearchParams(new URLSearchParams('pos=พนักงานขับรถ,แม่บ้าน'));
    expect(s.positionFilter).toEqual(['พนักงานขับรถ', 'แม่บ้าน']);
    expect(buildJobListSearchParams(s).get('pos')).toBe('พนักงานขับรถ,แม่บ้าน');
    expect(buildJobListSearchParams(JOB_LIST_DEFAULTS).has('pos')).toBe(false);
  });
  it('เปลี่ยนตำแหน่ง = กลับหน้า 1', () => {
    expect(mergeJobListState({ ...JOB_LIST_DEFAULTS, page: 4 }, { positionFilter: ['แม่บ้าน'] }).page).toBe(1);
  });
  it('หน้าใบขอกรองด้วยป้ายเดียวกับคอลัมน์ตำแหน่ง และนับเป็นตัวกรองที่เลือกอยู่', () => {
    const src = readFileSync('src/pages/jobs/JobListPage.tsx', 'utf8');
    expect(src).toContain('positionFilter.includes(publicJobPositionLabel(j))');
    expect(src).toContain('id="job-list-position"');
    expect(src).toMatch(/jobSubtypeFilter,\n\s+positionFilter,\n\s+recruiterFilter,/);
    expect(readFileSync('src/lib/jobListTableSort.ts', 'utf8')).toContain('publicJobPositionLabel(job)');
  });
});
