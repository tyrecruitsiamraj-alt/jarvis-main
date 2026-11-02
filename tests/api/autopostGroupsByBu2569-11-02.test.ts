/**
 * ป๊อปสั่งโพสต์ Autopost: กลุ่ม Facebook จัดหมวดตามธุรกิจของใบขอ (เจ้าของ 2 พ.ย. 2569)
 * So Scraping ติดป้ายธุรกิจให้ทุกกลุ่มแล้ว (groups.department = LBD/LBA/LM/DS/SN · ว่าง = ไม่ระบุ)
 * - หมวดธุรกิจเดียวกับใบขอ: ติ๊กครบตั้งแต่เปิด · ธุรกิจอื่น/ไม่ระบุ: พับ ไม่ติ๊ก
 * - ธุรกิจของใบขอไม่มีกลุ่มเลย = บอกว่าไปเพิ่มที่ไหน ไม่ใช่รายการว่าง
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { defaultSoGroupPick, jobBuOf, parseSoOptions, soBuEmptyText, soGroupSections, withSoGroupDepartments, type SoOptGroup, type SoOptions } from '@/lib/soScraping';

const group = (id: string, name: string, department: string | null): SoOptGroup => ({
  id,
  fbGroupId: null,
  name,
  url: null,
  accountIds: [],
  lastPostedAt: null,
  stats30d: null,
  department,
});
/** หน้าตาเหมือนของจริงใน so_autopost_apiscraper.groups (2 พ.ย. 2569) */
const GROUPS = [
  group('mvhmloovlppmpi5o6fg', 'กลุ่มคนขับรถผู้บริหาร', 'LBD'),
  group('mvhmlowwseq4bvkqq4', 'FIJOB หางาน คนขับรถผู้บริหาร by THREETREE STUDIO', 'LBD'),
  group('mvhmlotjormpp7jfim', 'ขับรถผู้บริหาร​ และส่วนกลาง', 'LBD'),
  group('grp_lm_0001', 'หางานดูแลสวน คนสวน ภูมิทัศน์', 'LM'),
  group('grp_none_0001', 'หางานทั่วไป สมุทรปราการ', null),
];

describe('กลุ่ม Facebook ตามธุรกิจของใบขอ', () => {
  it('ธุรกิจของใบขอ: ใบขอ ERP จากรหัสไซต์ · ใบขอชั่วคราวจากแผนก · ไม่มีทั้งคู่ = null', () => {
    expect(jobBuOf({ site_code: '01LBD0123', department_code: undefined })).toBe('LBD');
    expect(jobBuOf({ site_code: '02LML0007', department_code: 'LM' })).toBe('LM');
    expect(jobBuOf({ site_code: undefined, department_code: 'LBA' })).toBe('LBA');
    expect(jobBuOf({ site_code: undefined, department_code: undefined })).toBeNull();
  });

  it('ใบ LBD: หมวด LBD ขึ้นก่อนและติ๊กครบทุกกลุ่ม · LM และไม่ระบุธุรกิจตามหลัง ไม่ติ๊ก', () => {
    const sections = soGroupSections(GROUPS, 'LBD');
    expect(sections.map((s) => [s.label, s.forJob, s.groups.length])).toEqual([
      ['LBD', true, 3],
      ['LM', false, 1],
      ['ไม่ระบุธุรกิจ', false, 1],
    ]);
    expect(defaultSoGroupPick(GROUPS, 'LBD').sort()).toEqual(['mvhmloovlppmpi5o6fg', 'mvhmlowwseq4bvkqq4', 'mvhmlotjormpp7jfim'].sort());
  });

  it('ใบ LBA ที่ธุรกิจยังไม่มีกลุ่ม: ไม่มีหมวดของใบ · ไม่ติ๊กอะไร · ข้อความบอกที่เพิ่ม', () => {
    const sections = soGroupSections(GROUPS, 'LBA');
    expect(sections.some((s) => s.forJob)).toBe(false);
    expect(sections.map((s) => s.label)).toEqual(['LBD', 'LM', 'ไม่ระบุธุรกิจ']);
    expect(defaultSoGroupPick(GROUPS, 'LBA')).toEqual([]);
    expect(soBuEmptyText('LBA')).toBe('ยังไม่มีกลุ่มของธุรกิจ LBA ใน So Scraping — เพิ่มที่ ตั้งค่า → กลุ่มโพสต์ หรือเลือกจากธุรกิจอื่น');
  });

  it('ใบขอไม่ระบุธุรกิจ: ไม่ติ๊ก · หมวดเรียงรหัส ไม่ระบุท้ายสุด', () => {
    expect(defaultSoGroupPick(GROUPS, null)).toEqual([]);
    expect(soGroupSections(GROUPS, null).map((s) => s.label)).toEqual(['LBD', 'LM', 'ไม่ระบุธุรกิจ']);
  });

  it('options API ยังไม่ส่ง department — เติมจากฐานของ So Scraping · ถ้า API ส่งมาเองไม่ทับ · รหัส LML แปลงเป็น LM', () => {
    const raw = {
      accounts: [],
      workers: [],
      scrape_accounts: [],
      groups: [
        { id: 'mvhmloovlppmpi5o6fg', fb_group_id: '102927176763949', name: 'กลุ่มคนขับรถผู้บริหาร', account_ids: [] },
        { id: 'grp_api_dept', fb_group_id: '1', name: 'กลุ่ม API บอกธุรกิจเอง', account_ids: [], department: 'LML' },
      ],
    };
    const o = parseSoOptions(raw) as SoOptions;
    expect(o.groups.map((g) => g.department)).toEqual([null, 'LM']);
    const merged = withSoGroupDepartments(o, [
      { id: 'mvhmloovlppmpi5o6fg', department: 'LBD' },
      { id: 'grp_api_dept', department: 'SN' },
    ]);
    expect(merged.groups.map((g) => g.department)).toEqual(['LBD', 'LM']);
  });

  it('ป๊อปใช้หมวดตามธุรกิจ · server เติมธุรกิจตอนเรียก API · อ่านทุกกลุ่มไม่กรองตามบัญชีผูก', () => {
    const dialog = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(dialog).toContain('defaultSoGroupPick(soGroupsOfAccount(o, acc), jobBu)');
    expect(dialog).toContain('data-testid="autopost-bu-empty"');
    expect(dialog).toContain("checked={n === 0 ? false : n === ids.length ? true : 'indeterminate'}");
    expect(dialog).not.toContain('jobProvinceOf');
    const opts = readFileSync('api/_lib/soScrapingOptions.ts', 'utf8');
    expect(opts).toContain('withSoGroupDepartments(o, dbGroups)');
    const groups = readFileSync('api/_lib/soScrapingGroups.ts', 'utf8');
    expect(groups).not.toContain('unknownSoGroupIds');
    expect(groups).not.toMatch(/from \$\{SCHEMA\}\.groups g\s+where exists/);
  });
});
