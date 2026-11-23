/**
 * Dashboard: ตัวกรองเลือกได้หลายอัน (เจ้าของ 23 พ.ย. 2569 "ฟิลเตอร์ทำให้เลือกได้หลายอันหน่อย")
 * แผนก · ลักษณะงานย่อย · หน่วยงาน · เจ้าหน้าที่สรรหา · คัดสรร · OPL · สถานะใบขอ — [] = ทั้งหมด
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { JobRequest } from '@/types';
import { UNIT_REQUEST_FILTER_DEFAULTS, filterUnitRequests, normalizeUnitRequestFilters } from '@/hooks/useSiamrajUnitRequestFilters';
import { filterThroughputByDepartment, type ThroughputRecord } from '@/lib/dashboard/throughput';

const job = (no: string, bu: string, recruiter: string | null) =>
  ({ id: `siamraj-sql:${no}`, request_no: no, department_code: bu, recruiter_name: recruiter, unit_name: 'หน่วยงานตัวอย่าง', status: 'open' }) as unknown as JobRequest;

const JOBS = [job('LBD6911001', 'LBD', 'คิว'), job('LBD6911002', 'LBD', 'กร'), job('LBA6911003', 'LBA', 'แบงค์'), job('LM6911004', 'LM', 'คิว')];

describe('กรองหลายค่า', () => {
  it('เลือกเจ้าหน้าที่สรรหา 2 คน = ใบของคนใดคนหนึ่ง · ไม่เลือก = ทั้งหมด', () => {
    const pick = (recruiterFilter: string[]) => filterUnitRequests(JOBS, true, { ...UNIT_REQUEST_FILTER_DEFAULTS, recruiterFilter }).map((j) => j.request_no);
    expect(pick(['คิว', 'แบงค์'])).toEqual(['LBD6911001', 'LBA6911003', 'LM6911004']);
    expect(pick([])).toHaveLength(4);
  });

  it('เลือก 2 แผนก + 1 คน = ต้องตรงทั้งสองช่อง', () => {
    const got = filterUnitRequests(JOBS, true, { ...UNIT_REQUEST_FILTER_DEFAULTS, departmentFilter: ['LBD', 'LM'], recruiterFilter: ['คิว'] });
    expect(got.map((j) => j.request_no)).toEqual(['LBD6911001', 'LM6911004']);
  });

  it('ยอดเข้า/ปิด/ยกเลิก (throughput) กรองหลายแผนก · แถวไม่รู้แผนกเก็บไว้เหมือนเดิม', () => {
    const r = (no: string, departmentCode: string | null) => ({ requestNo: no, requestDate: '2026-11-01', closureDate: null, positionUnits: 1, isOpen: true, kind: 'remaining', departmentCode }) as unknown as ThroughputRecord;
    const rows = [r('A', 'LBD'), r('B', 'LBA'), r('C', 'LM'), r('D', null)];
    expect(filterThroughputByDepartment(rows, ['LBD', 'LM']).map((x) => x.requestNo)).toEqual(['A', 'C', 'D']);
    expect(filterThroughputByDepartment(rows, [])).toHaveLength(4);
  });
});

describe('ค่าที่จำไว้รุ่นเก่า (ข้อความเดียว) ยังเปิดได้', () => {
  it("'all' → ทั้งหมด · 'คิว' → ['คิว'] · รายการคงเดิม · ช่องเลือกเดียว (หมายเหตุ/วันผ่านมา/สถานะ) คงเดิม", () => {
    const f = normalizeUnitRequestFilters({ recruiterFilter: 'คิว', departmentFilter: 'all', unitFilter: ['ฮอนด้า', 'all'], noteFilter: 'has' });
    expect(f.recruiterFilter).toEqual(['คิว']);
    expect(f.departmentFilter).toEqual([]);
    expect(f.unitFilter).toEqual(['ฮอนด้า']);
    expect(f.urgencyFilter).toEqual([]);
    expect(f.noteFilter).toBe('has');
    expect(normalizeUnitRequestFilters(null)).toEqual(UNIT_REQUEST_FILTER_DEFAULTS);
  });

  it('หน้า Dashboard ทั้งสองหน้าอ่านค่าผ่านตัวแปลงนี้', () => {
    for (const p of ['src/lib/supervisorDashboardPageState.ts', 'src/lib/jobDashboardPageState.ts']) {
      expect(readFileSync(p, 'utf8')).toContain('normalizeUnitRequestFilters(JSON.parse(raw))');
    }
  });
});

describe('หน้าจอ', () => {
  it('7 ช่องเป็น FilterMultiSelect (ตัวเดียวกับหน้าใบขอ) · หมายเหตุ/วันผ่านมา ยังเลือกช่องเดียว', () => {
    const src = readFileSync('src/components/jobs/UnitRequestFilterFields.tsx', 'utf8');
    for (const id of ['department', 'subtype', 'unit', 'recruiter', 'screener', 'opl', 'urgency']) {
      expect(src).toMatch(new RegExp(`<FilterMultiSelect\\s+id=\\{\`\\$\\{idPrefix\\}-${id}\`\\}`));
    }
    expect(src).toMatch(/<FilterSelect\s+id=\{`\$\{idPrefix\}-note`\}/);
    expect(src).toMatch(/<FilterSelect\s+id=\{`\$\{idPrefix\}-age`\}/);
  });
});
