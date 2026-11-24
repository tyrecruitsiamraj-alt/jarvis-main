import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicantAreaOf, postingAreaOf, sortByApplicantArea, APPLICANT_AREA_LABEL } from '../../src/lib/applicantArea';
import { applyApplicantFilters, buildApplicantFacets, EMPTY_APPLICANT_FILTER_STATE, RECRUIT_TAB_FACETS } from '../../src/lib/applicantFilters';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

/**
 * หน้าผู้สมัคร: ใกล้งานแค่ไหน + ตัวกรอง BU (เจ้าของ 24 พ.ย. 2569)
 * ตัวอย่างจากจอจริง: ประกาศ "รับสมัครพนักงานสวน" ทำงานที่หนองใหญ่ ชลบุรี — ผู้สมัครสนใจจากหนองใหญ่ · บ่อทอง · ปลวกแดง ระยอง · สวนหลวง กทม.
 */
const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');
const garden = { posting_province: 'ชลบุรี', posting_location: 'ตำบลท่าจาม อำเภอหนองใหญ่ จังหวัดชลบุรี' };

describe('ความใกล้ของผู้สมัครกล่องลอย (ที่ตั้งจากประกาศ)', () => {
  it('ประกาศสวนหนองใหญ่ ชลบุรี', () => {
    expect(postingAreaOf(garden)).toEqual({ province: 'ชลบุรี', district: 'หนองใหญ่' });
    expect(applicantAreaOf({ ...garden, province: 'ชลบุรี', district: 'หนองใหญ่' }, null)).toBe('district');
    expect(applicantAreaOf({ ...garden, province: 'ชลบุรี', district: 'บ่อทอง' }, null)).toBe('province');
    expect(applicantAreaOf({ ...garden, province: 'ระยอง', district: 'ปลวกแดง' }, null)).toBe('region');
    expect(applicantAreaOf({ ...garden, province: 'กรุงเทพมหานคร', district: 'สวนหลวง' }, null)).toBe('far');
  });
  it('เทียบไม่ได้มีช่องของตัวเอง ไม่ยุบเป็นใกล้/ไกล', () => {
    expect(applicantAreaOf({ ...garden, province: '' }, null)).toBe('noHome');
    expect(applicantAreaOf({ province: 'ชลบุรี' }, null)).toBe('noJobArea');
    expect(APPLICANT_AREA_LABEL.noHome).toBe('ไม่ได้กรอกที่อยู่');
  });
  it('ผูกใบขอ = ใช้ที่ตั้งของใบขอ (ค่าที่แก้เองก่อน)', () => {
    expect(applicantAreaOf({ province: 'ชลบุรี', district: 'ศรีราชา' }, { override_province: 'ชลบุรี', override_district: 'ศรีราชา', location_address: '' })).toBe('district');
  });
});

describe('คนใกล้ขึ้นก่อน ไม่ตัดใครทิ้ง', () => {
  it('เรียงตามระดับ · ระดับเดียวกันคงลำดับเดิม', () => {
    const rows = [
      { id: 'กทม', a: 'far' as const },
      { id: 'บ่อทอง', a: 'province' as const },
      { id: 'ไม่กรอก', a: 'noHome' as const },
      { id: 'หนองใหญ่', a: 'district' as const },
      { id: 'บ่อทอง2', a: 'province' as const },
    ];
    expect(sortByApplicantArea(rows, (r) => r.a).map((r) => r.id)).toEqual(['หนองใหญ่', 'บ่อทอง', 'บ่อทอง2', 'กทม', 'ไม่กรอก']);
  });
});

describe('ตัวกรอง BU + ใกล้งานแค่ไหน ในแถบกรองหน้าผู้สมัคร', () => {
  const app = (id: string, bu: string | undefined, province: string): PublicApplication =>
    ({ id, full_name: id, phone: '0800000000', status: 'new', created_at: '2026-11-22T03:00:00Z', department_code: bu, province, ...garden }) as PublicApplication;
  const rows = [app('a', 'LM', 'ชลบุรี'), app('b', 'LBD', 'กรุงเทพมหานคร'), app('c', undefined, 'ระยอง')];
  const facts = { tab: 'candidates' as const, now: new Date('2026-11-24T03:00:00Z'), areaOf: (r: PublicApplication) => applicantAreaOf(r, null) };
  it('BU อยู่บนสุดของแถบกรอง · ใกล้งานแค่ไหน ต่อจากจังหวัด', () => {
    expect(RECRUIT_TAB_FACETS[0]).toBe('bu');
    expect(RECRUIT_TAB_FACETS.indexOf('area')).toBe(RECRUIT_TAB_FACETS.indexOf('province') + 1);
  });
  it('กรอง BU = LM ได้เฉพาะใบ LM · ตัวเลือกครบ 5 BU (ว่าง = 0)', () => {
    const out = applyApplicantFilters(rows, { ...EMPTY_APPLICANT_FILTER_STATE, selection: { bu: ['LM'] } }, facts);
    expect(out.map((r) => r.id)).toEqual(['a']);
    const bu = buildApplicantFacets(rows, EMPTY_APPLICANT_FILTER_STATE, facts).find((f) => f.key === 'bu');
    expect(bu?.options.map((o) => [o.value, o.count]).filter(([v]) => v !== '__none__').slice(0, 5)).toEqual([
      ['SN', 0],
      ['DS', 0],
      ['LM', 1],
      ['LBA', 0],
      ['LBD', 1],
    ]);
  });
  it('ใบขอยังโหลดไม่ขึ้น = ไม่มีหัวข้อความใกล้', () => {
    const f = buildApplicantFacets(rows, EMPTY_APPLICANT_FILTER_STATE, { ...facts, areaOf: undefined });
    expect(f.find((x) => x.key === 'area')).toBeUndefined();
  });
});

describe('ต่อสายครบ', () => {
  it('API ส่ง BU + ที่ตั้งกล่องลอย · หน้ารายชื่อคนสนใจเรียงคนใกล้ก่อน · แถวมีป้าย', () => {
    expect(read('api/_handlers/job-applications.ts')).toContain('as posting_location');
    const ws = read('src/components/recruit-rm/RmWorkspace.tsx');
    expect(ws).toContain("listView === 'interested' && areaOf ? sortByApplicantArea(out, areaOf)");
    expect(read('src/components/recruit-rm/RmTable.tsx')).toContain('data-testid="applicant-area"');
  });
});
