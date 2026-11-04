/**
 * กลุ่ม Facebook แยก ราชการ / เอกชน ตอนเลือกกลุ่ม (เจ้าของ 4 พ.ย. 2569 "ตอนเลือกกลุ่มทำให้แยกไว้หน่อย")
 * กลุ่มที่มีอยู่ทั้งหมด = เอกชน ("ก็ไอกลุ่มที่มีอะเพื่อโพสต์ เอกชนไง แล้วเดี๋ยวจะเพิ่มกลุ่มที่เป็นราชการมา")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SO_GROUP_SECTOR_BEFORE_TAG,
  soGroupSectorOf,
  soSectorBlocks,
  withSoDepartments,
  type SoOptGroup,
  type SoOptions,
} from '../../src/lib/soScraping';
import { jobUnitSectorOf } from '../../src/lib/unitRequestDisplay';

const g = (id: string, sector: SoOptGroup['sector'], posted = 1): SoOptGroup => ({
  id,
  fbGroupId: id,
  name: `กลุ่ม ${id}`,
  url: null,
  accountIds: [],
  lastPostedAt: null,
  stats30d: { attempts: posted, posted, comments: 0, phoneLeads: 0 },
  department: 'LBD',
  sector,
  provinces: [],
  nationwide: false,
  blocked: null,
  repostWait: null,
});

describe('ค่าราชการ/เอกชนของกลุ่ม', () => {
  it('รับทั้งรหัสและคำไทย · ค่าอื่น/ว่าง = ยังไม่ระบุ · So Scraping ยังไม่มีช่อง = เอกชน', () => {
    expect(soGroupSectorOf('government')).toBe('government');
    expect(soGroupSectorOf(' ราชการ ')).toBe('government');
    expect(soGroupSectorOf('PRIVATE')).toBe('private');
    expect(soGroupSectorOf('เอกชน')).toBe('private');
    expect(soGroupSectorOf('')).toBeNull();
    expect(soGroupSectorOf('bank')).toBeNull();
    expect(soGroupSectorOf(null)).toBeNull();
    expect(SO_GROUP_SECTOR_BEFORE_TAG).toBe('private');
  });

  it('ราชการ/เอกชนของใบขอ: ใบ ERP ใช้ unit_sector (null = ยังไม่ระบุ ไม่เดา) · งานของเราใช้ job_category', () => {
    expect(jobUnitSectorOf({ unit_sector: 'government', job_category: 'private' })).toBe('government');
    expect(jobUnitSectorOf({ unit_sector: null, job_category: 'private' })).toBeNull();
    expect(jobUnitSectorOf({ job_category: 'government' })).toBe('government');
    expect(jobUnitSectorOf({ job_category: 'bank' })).toBeNull();
  });
});

describe('แบ่งหัวข้อย่อยในหมวดธุรกิจ', () => {
  const groups = [g('a', 'private'), g('b', 'government'), g('c', null), g('d', 'private')];
  it('ประเภทของใบขอขึ้นก่อน · ยังไม่ระบุท้ายสุด · หัวข้อว่างไม่ขึ้น', () => {
    expect(soSectorBlocks(groups, 'government').map((b) => [b.label, b.groups.map((x) => x.id)])).toEqual([
      ['ราชการ', ['b']],
      ['เอกชน', ['a', 'd']],
      ['ยังไม่ระบุ', ['c']],
    ]);
    expect(soSectorBlocks(groups, null).map((b) => b.label)).toEqual(['เอกชน', 'ราชการ', 'ยังไม่ระบุ']);
    expect(soSectorBlocks([g('a', 'private')], 'government').map((b) => b.label)).toEqual(['เอกชน']);
  });


  it('options API ยังไม่ส่งช่องนี้ — เติมจากรายชื่อกลุ่มในฐาน So Scraping', () => {
    const o = { source: 'api', accounts: [], groups: [g('a', null), g('b', 'government')], workers: [], scrapeAccounts: [] } as unknown as SoOptions;
    const out = withSoDepartments(o, { groups: [{ id: 'a', department: 'LBD', sector: 'private' }, { id: 'b', department: 'LBD', sector: 'private' }], accounts: [] });
    expect(out.groups.map((x) => x.sector)).toEqual(['private', 'government']);
  });
});

describe('จอและฐาน', () => {
  it('Autopost + Gen link ใช้ช่องเลือก เอกชน/ราชการ ชุดเดียว (4 พ.ย. 2569 แทนหัวข้อย่อยพับ) · ไม่ติ๊กกลุ่มให้ · ติ๊กทั้งรายการที่กรองแล้ว ไม่ใช่ทั้งธุรกิจ', () => {
    const picker = readFileSync('src/components/jobs/SoGroupPicker.tsx', 'utf8');
    expect(picker).toContain('testId={`${testPrefix}-filter-sector`}');
    expect(picker).toContain('aria-label="เลือกทุกกลุ่มในรายการนี้"');
    expect(picker).not.toContain('เลือกทุกกลุ่มของ ${section.label}');
    expect(readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8')).not.toContain('defaultSoGroupPick');
    expect(readFileSync('src/lib/soScraping.ts', 'utf8')).not.toContain('export function defaultSoGroupPick');
  });

  it('อ่านช่อง sector ของ So Scraping · ยังไม่มีช่อง (42703) อ่านแบบไม่มีช่องแล้วถือเป็นเอกชน', () => {
    const src = readFileSync('api/_lib/soScrapingGroups.ts', 'utf8');
    expect(src).toContain("${withSector ? ', g.sector::text as sector' : ''}");
    expect(src).toContain('sector: tagged ? soGroupSectorOf(r.sector) : SO_GROUP_SECTOR_BEFORE_TAG,');
  });



});
