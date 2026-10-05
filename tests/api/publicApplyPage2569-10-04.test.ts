/**
 * หน้าประกาศ (/apply) — เจ้าของ 4 ต.ค. 2569:
 *   · ตัวกรองเลือกได้หลายค่า + ค่าที่ไม่มีงานไม่โผล่ (เดิมจังหวัดครบ 77 เลือกแล้วว่าง = "แล้วไม่ไป")
 *   · งานขับรถ = "พนักงานขับรถ + ชนิด" (ส่วนกลาง · นายไทย · นายต่างชาติ · Valet) ป้ายชนิดงานแยกถอด
 *   · มีปุ่มสลับโหมดสว่าง/มืด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import {
  EMPTY_BOARD_FILTER_STATE,
  PUBLIC_FACET_KEYS,
  applyPublicFilters,
  buildPublicFacets,
  publicFilterState,
  type BoardFilterState,
} from '@/lib/boardFilters';
import { publicJobTitle } from '@/lib/publicJobTitle';

let seq = 0;
const job = (over: Partial<JobRequest>): JobRequest =>
  ({
    id: `siamraj-sql:P${(seq += 1)}`,
    request_no: `P${seq}`,
    unit_name: 'หน่วย',
    location_address: 'แขวงสีลม เขตบางรัก กรุงเทพมหานคร 10500',
    job_type: 'central',
    urgency: 'advance',
    job_description_code_1: 'ขับรถ',
    job_description_code_2: 'ส่วนกลาง',
    ...over,
  }) as JobRequest;

const state = (selection: BoardFilterState['selection']): BoardFilterState => ({ selection, dates: null });

describe('ชื่อตำแหน่งบนหน้าประกาศ', () => {
  it('งานขับรถ = พนักงานขับรถ + ชนิด · ชนิดอ่านไม่ออก = พนักงานขับรถ เฉย ๆ · ตำแหน่งอื่นชื่อเดิม', () => {
    expect(publicJobTitle(job({}))).toBe('พนักงานขับรถ ส่วนกลาง');
    expect(publicJobTitle(job({ job_description_code_2: 'รถผู้บริหาร', boss_nationality: 'คนไทย' }))).toBe('พนักงานขับรถ นายไทย');
    expect(publicJobTitle(job({ job_description_code_2: 'รถผู้บริหาร', boss_nationality: 'ญี่ปุ่น' }))).toBe('พนักงานขับรถ นายต่างชาติ');
    expect(publicJobTitle(job({ job_description_code_2: 'Valet Parking' }))).toBe('พนักงานขับรถ Valet parking'); // เจ้าของ 5 ต.ค. 2569: "valet ไม่มีมันต้อง Valet parking"
    expect(publicJobTitle(job({ job_description_code_2: 'ไม่ระบุ' }))).toBe('พนักงานขับรถ');
    expect(publicJobTitle(job({ job_description_code_1: 'คนสวน', job_description_code_2: 'ส่วนกลาง' }))).toBe('คนสวน');
  });

  it('การ์ดหน้าประกาศใช้ชื่อนี้ และไม่มีป้ายชนิดงานแยก (เคยขึ้น "ส่วนกลาง" บนการ์ดคนสวน)', () => {
    const src = readFileSync('src/components/jobs/JobBoardView.tsx', 'utf8');
    expect(src).toContain('{publicJobTitle(job)}');
    expect(src).not.toContain('JOB_TYPE_LABELS[job.job_type]');
  });
});

describe('ตัวกรองหน้าประกาศ', () => {
  const bkk = job({});
  const bkkBoss = job({ job_description_code_2: 'รถผู้บริหาร', boss_nationality: 'คนไทย' });
  const pathum = job({ location_address: 'ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี' });
  const garden = job({ job_description_code_1: 'คนสวน', job_description_code_2: '' });
  const rows = [bkk, bkkBoss, pathum, garden];

  it('เลือกได้หลายจังหวัด (OR ในหัวข้อ) · AND ข้ามหัวข้อ', () => {
    expect(applyPublicFilters(rows, state({ province: ['กรุงเทพมหานคร', 'ปทุมธานี'] }))).toHaveLength(4);
    expect(applyPublicFilters(rows, state({ province: ['ปทุมธานี'], position: ['ขับรถ'] }))).toEqual([pathum]);
  });

  it('จังหวัดที่โชว์ = มีงานจริงเท่านั้น (ไม่ใช่ครบ 77 จังหวัด)', () => {
    const province = buildPublicFacets(rows, EMPTY_BOARD_FILTER_STATE).find((f) => f.key === 'province')!;
    expect(province.options.map((o) => [o.value, o.count])).toEqual([
      ['กรุงเทพมหานคร', 3],
      ['ปทุมธานี', 1],
    ]);
  });

  it('ตำแหน่งขับรถเขียน "พนักงานขับรถ" · ชนิดงานขับรถซ้อนใต้ตำแหน่ง (นายไทย/ส่วนกลาง)', () => {
    const facets = buildPublicFacets(rows, state({ position: ['ขับรถ'] }));
    expect(facets.find((f) => f.key === 'position')!.options.find((o) => o.value === 'ขับรถ')!.label).toBe('พนักงานขับรถ');
    const sub = facets.find((f) => f.key === 'subtype')!;
    expect(sub.options.filter((o) => o.count > 0).map((o) => [o.label, o.count])).toEqual([
      ['ส่วนกลาง', 2],
      ['นายไทย', 1],
    ]);
  });

  it('🔴 หัวข้อภายในไม่หลุดหน้าสาธารณะ — ค่าในลิงก์ที่ไม่ใช่หัวข้อสาธารณะถูกทิ้ง', () => {
    expect([...PUBLIC_FACET_KEYS].sort()).toEqual(['district', 'position', 'province', 'subtype']);
    const s = publicFilterState(state({ province: ['ปทุมธานี'], recruiter: ['คิว'], ready: ['ready'] }));
    expect(s.selection).toEqual({ province: ['ปทุมธานี'] });
    expect(buildPublicFacets(rows, s).map((f) => f.key)).not.toContain('recruiter');
  });
});

describe('ปุ่มสลับโหมดสว่าง/มืดบนหน้าประกาศ', () => {
  it('หัวหน้าประกาศมีปุ่มสลับธีม', () => {
    const src = readFileSync('src/components/layout/PublicApplyLayout.tsx', 'utf8');
    expect(src).toContain('<ThemeToggleButton');
  });
});
