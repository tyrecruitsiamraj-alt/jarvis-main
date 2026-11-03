/**
 * ป๊อปสั่งโพสต์ Autopost: กลุ่ม Facebook จัดหมวดตามธุรกิจของใบขอ (เจ้าของ 2 พ.ย. 2569)
 * So Scraping ติดป้ายธุรกิจให้ทุกกลุ่มแล้ว (groups.department = LBD/LBA/LM/DS/SN · ว่าง = ไม่ระบุ)
 * - หมวดธุรกิจเดียวกับใบขอ: ติ๊กครบตั้งแต่เปิด · ธุรกิจอื่น/ไม่ระบุ: พับ ไม่ติ๊ก
 * - ธุรกิจของใบขอไม่มีกลุ่มเลย = บอกว่าไปเพิ่มที่ไหน ไม่ใช่รายการว่าง
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  defaultSoGroupPick,
  jobBuOf,
  parseSoOptions,
  soAccountsByBu,
  soAccountsForJob,
  soBuEmptyText,
  soBuNoAccountText,
  soGroupView,
  soSectionHeadText,
  soGroupSections,
  withSoDepartments,
  type SoOptGroup,
  type SoOptions,
} from '@/lib/soScraping';

const group = (id: string, name: string, department: string | null): SoOptGroup => ({
  id,
  fbGroupId: null,
  name,
  url: null,
  accountIds: [],
  lastPostedAt: null,
  stats30d: null,
  department,
  blocked: null,
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
    expect(soBuEmptyText('LBA')).toBe('ยังไม่มีกลุ่มของ LBA ใน So Scraping — เพิ่มที่ ตั้งค่า → กลุ่มโพสต์ หรือเลือกจากธุรกิจอื่น');
  });

  it('ใบขอไม่ระบุธุรกิจ: ไม่ติ๊ก · หมวดเรียงรหัส ไม่ระบุท้ายสุด', () => {
    expect(defaultSoGroupPick(GROUPS, null)).toEqual([]);
    expect(soGroupSections(GROUPS, null).map((s) => s.label)).toEqual(['LBD', 'LM', 'ไม่ระบุธุรกิจ']);
  });

  it('options API ยังไม่ส่ง department — เติมจากฐานของ So Scraping · ถ้า API ส่งมาเองไม่ทับ · รหัส LML แปลงเป็น LM', () => {
    const raw = {
      accounts: [
        { id: 'fb_01990af955014ec19e94965b', name: 'Rudge Marita', status: 'ready', group_ids: [] },
        { id: 'fb_api_dept', name: 'บัญชีบอกธุรกิจเอง', status: 'ready', group_ids: [], department: 'LBA' },
      ],
      workers: [],
      scrape_accounts: [],
      groups: [
        { id: 'mvhmloovlppmpi5o6fg', fb_group_id: '102927176763949', name: 'กลุ่มคนขับรถผู้บริหาร', account_ids: [] },
        { id: 'grp_api_dept', fb_group_id: '1', name: 'กลุ่ม API บอกธุรกิจเอง', account_ids: [], department: 'LML' },
      ],
    };
    const o = parseSoOptions(raw) as SoOptions;
    expect(o.groups.map((g) => g.department)).toEqual([null, 'LM']);
    expect(o.accounts.map((a) => a.department)).toEqual([null, 'LBA']);
    const merged = withSoDepartments(o, {
      groups: [
        { id: 'mvhmloovlppmpi5o6fg', department: 'LBD' },
        { id: 'grp_api_dept', department: 'SN' },
      ],
      accounts: [
        { id: 'fb_01990af955014ec19e94965b', department: 'LBD' },
        { id: 'fb_api_dept', department: 'LBD' },
      ],
    });
    expect(merged.groups.map((g) => g.department)).toEqual(['LBD', 'LM']);
    expect(merged.accounts.map((a) => a.department)).toEqual(['LBD', 'LBA']);
  });

  it('ป๊อปใช้หมวดตามธุรกิจ · server เติมธุรกิจตอนเรียก API · อ่านทุกกลุ่มไม่กรองตามบัญชีผูก', () => {
    const dialog = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(dialog).toContain('defaultSoGroupPick(soGroupsOfAccount(o, acc), jobBu, acc)');
    expect(dialog).toContain('data-testid="autopost-bu-empty"');
    expect(dialog).toContain("checked={n === 0 ? false : n === ids.length ? true : 'indeterminate'}");
    expect(dialog).not.toContain('jobProvinceOf');
    const opts = readFileSync('api/_lib/soScrapingOptions.ts', 'utf8');
    expect(opts).toContain('withSoDepartments(o, { groups, accounts })');
    // ธุรกิจของบัญชี: อ่านแค่ id + department จากตาราง users (มีรหัสผ่าน/token)
    const grp = readFileSync('api/_lib/soScrapingGroups.ts', 'utf8');
    expect(grp).toContain('select u.id::text as id, u.department::text as department from ${SCHEMA}.users u`');
    // 3 พ.ย. 2569: ข้ามบัญชีที่ยังไม่ได้ล็อกอิน Facebook บนเครื่องไหน (So Scraping แจ้ง)
    expect(dialog).toContain('firstAccount(soAccountsForJob(o.accounts, jobBu).filter((a) => soAccountHasSession(a, o.workers)))');
    expect(dialog).toContain('data-testid="autopost-bu-no-account"');
    const groups = readFileSync('api/_lib/soScrapingGroups.ts', 'utf8');
    expect(groups).not.toContain('unknownSoGroupIds');
    expect(groups).not.toMatch(/from \$\{SCHEMA\}\.groups g\s+where exists/);
  });

  it('บัญชี Facebook แยกตามธุรกิจ: ธุรกิจของใบขอขึ้นก่อนเป็นหัวแรก · ตั้งต้นเลือกเฉพาะบัญชีธุรกิจเดียวกัน · ธุรกิจไม่มีบัญชี = ไม่เลือกให้ + ข้อความ', () => {
    const accounts = [
      { id: 'fb_lm_01', name: 'บัญชีสวน', department: 'LM' },
      { id: 'fb_none_01', name: 'บัญชีเก่า', department: null },
      { id: 'fb_01990af955014ec19e94965b', name: 'Rudge Marita', department: 'LBD' },
      { id: 'fb_898d82093abe46eeab1980d8', name: 'Tyni Aiit', department: 'LBD' },
    ];
    expect(soAccountsByBu(accounts, 'LBD').map((x) => [x.group, x.account.name])).toEqual([
      ['LBD', 'Rudge Marita'],
      ['LBD', 'Tyni Aiit'],
      ['LM', 'บัญชีสวน'],
      ['ไม่ระบุธุรกิจ', 'บัญชีเก่า'],
    ]);
    expect(soAccountsForJob(accounts, 'LBD').map((a) => a.name)).toEqual(['Rudge Marita', 'Tyni Aiit']);
    expect(soAccountsForJob(accounts, 'LBA')).toEqual([]);
    expect(soAccountsForJob(accounts, null)).toHaveLength(4);
    expect(soBuNoAccountText('LBA')).toBe('ยังไม่มีบัญชี Facebook ของธุรกิจ LBA ใน So Scraping — เพิ่มที่ ตั้งค่า → บัญชีที่ใช้งาน หรือเลือกจากธุรกิจอื่น');
  });

  /* ── สถานะกลุ่มของบัญชีที่เลือก (So Scraping acc6821 · เจ้าของ 2 พ.ย. 2569 "เลือกมาก็เหมือนไม่มีไร") ── */
  /** หน้าตาเดียวกับ options API จริง 2 พ.ย. 2569 (ย่อ) */
  const RAW = {
    accounts: [
      {
        id: 'fb_2fa5a90951e240568b685097',
        name: 'Deanna Telcocci',
        status: 'ready',
        department: 'LBD',
        group_ids: ['mvhmlotjormpp7jfim', 'mvhmlov27vqejwuh96m', 'mvhmlox9aax3n5phpqj', 'mvhmloxpay78rydknrl', 'mvhmloovlppmpi5o6fg'],
        group_status: [
          { group_id: 'mvhmlov27vqejwuh96m', state: 'questions', label: 'ต้องเข้ากลุ่มเอง (มีคำถาม)', recommended: false, detail: null, url: 'https://www.facebook.com/groups/792186948245459', seen_at: '2026-11-02T03:38:42.081Z' },
          { group_id: 'mvhmlox9aax3n5phpqj', state: 'ok', label: 'โพสต์ได้', recommended: true, detail: null, url: 'https://www.facebook.com/groups/1671676653270065/posts/2604302640007457/', seen_at: '2026-11-02T03:34:49.776Z' },
          { group_id: 'mvhmlotjormpp7jfim', state: 'admin_paused', label: 'แอดมินพักกลุ่ม', recommended: false, detail: 'ผู้ดูแลพักกลุ่มนี้ชั่วคราวเมื่อ 17 สิงหาคม 2026', url: 'https://www.facebook.com/groups/299450851856799', seen_at: '2026-11-02T03:33:13.016Z' },
          { group_id: 'mvhmloxxbad', state: 'ok', label: 'โพสต์ได้', recommended: true, url: 'javascript:alert(1)' },
        ],
      },
      { id: 'fb_drost_mose', name: 'Drost Mose', status: 'ready', department: 'LBD', group_ids: [] },
    ],
    groups: [
      { id: 'mvhmlotjormpp7jfim', fb_group_id: '299450851856799', name: 'ขับรถผู้บริหาร\u200b และส่วนกลาง', department: 'LBD', blocked: { state: 'admin_paused', label: 'แอดมินพักกลุ่ม', detail: 'ผู้ดูแลพักกลุ่มนี้ชั่วคราวเมื่อ 17 สิงหาคม 2026', seen_at: '2026-11-02T03:33:13.016Z' } },
      { id: 'mvhmloxpay78rydknrl', fb_group_id: '1', name: 'กลุ่มคนขับรถผู้บริหารและคนขับรถให้นาย', department: 'LBD', blocked: { state: 'admin_paused', label: 'แอดมินพักกลุ่ม', detail: null, seen_at: null } },
      { id: 'mvhmlov27vqejwuh96m', fb_group_id: '792186948245459', name: 'หางานขับรถและรับสมัครงานขับรถ', department: 'LBD', blocked: null },
      { id: 'mvhmlox9aax3n5phpqj', fb_group_id: '1671676653270065', name: 'หางานขับรถ หาคนขับรถ กทม Bangkok', department: 'LBD', blocked: null },
      { id: 'mvhmloovlppmpi5o6fg', fb_group_id: '2', name: 'กลุ่มคนขับรถผู้บริหาร', department: 'LBD' },
    ],
    workers: [],
    scrape_accounts: [],
  };

  it('parseSoOptions อ่านสถานะกลุ่มของบัญชี + กลุ่มที่ติด · ไม่มีฟิลด์ = [] / null · ลิงก์ที่ไม่ใช่ https ทิ้ง', () => {
    const o = parseSoOptions(RAW) as SoOptions;
    const deanna = o.accounts[0];
    expect(deanna.department).toBe('LBD');
    expect(deanna.groupStatus).toHaveLength(4);
    expect(deanna.groupStatus[0]).toEqual({
      groupId: 'mvhmlov27vqejwuh96m',
      state: 'questions',
      label: 'ต้องเข้ากลุ่มเอง (มีคำถาม)',
      recommended: false,
      detail: null,
      url: 'https://www.facebook.com/groups/792186948245459',
      seenAt: '2026-11-02T03:38:42.081Z',
    });
    expect(deanna.groupStatus[3].url).toBeNull();
    expect(o.accounts[1].groupStatus).toEqual([]);
    expect(o.groups[0].blocked).toEqual({ state: 'admin_paused', label: 'แอดมินพักกลุ่ม', detail: 'ผู้ดูแลพักกลุ่มนี้ชั่วคราวเมื่อ 17 สิงหาคม 2026', seenAt: '2026-11-02T03:33:13.016Z' });
    expect(o.groups[4].blocked).toBeNull();
  });

  it('Deanna Telcocci: แอดมินพัก + ต้องเข้ากลุ่มเอง ไม่ติ๊ก มีลิงก์เปิดกลุ่ม · ที่เหลือติ๊ก · หัวหมวดบอกจำนวนติด', () => {
    const o = parseSoOptions(RAW) as SoOptions;
    const deanna = o.accounts[0];
    const g = (id: string) => o.groups.find((x) => x.id === id)!;
    expect(soGroupView(g('mvhmlotjormpp7jfim'), deanna)).toEqual({
      label: 'แอดมินพักกลุ่ม',
      recommended: false,
      detail: 'ผู้ดูแลพักกลุ่มนี้ชั่วคราวเมื่อ 17 สิงหาคม 2026',
      url: 'https://www.facebook.com/groups/299450851856799',
    });
    expect(soGroupView(g('mvhmlov27vqejwuh96m'), deanna)).toMatchObject({ label: 'ต้องเข้ากลุ่มเอง (มีคำถาม)', recommended: false, url: 'https://www.facebook.com/groups/792186948245459' });
    expect(soGroupView(g('mvhmlox9aax3n5phpqj'), deanna)).toMatchObject({ label: 'โพสต์ได้', recommended: true });
    expect(soGroupView(g('mvhmloovlppmpi5o6fg'), deanna)).toEqual({ label: 'ยังไม่เคยลอง', recommended: true, detail: null, url: null });
    const pick = defaultSoGroupPick(o.groups, 'LBD', deanna);
    expect(pick.sort()).toEqual(['mvhmlox9aax3n5phpqj', 'mvhmloovlppmpi5o6fg'].sort());
    const [sec] = soGroupSections(o.groups, 'LBD');
    expect(soSectionHeadText(sec, pick, deanna)).toBe('LBD · ติ๊กไว้ 2 จาก 5 · ติด 3');
  });

  it('สลับไปบัญชีที่ไม่เคยโพสต์: ทุกกลุ่ม "ยังไม่เคยลอง" ยกเว้น 2 กลุ่มที่แอดมินพัก · ค่าติ๊กคิดใหม่', () => {
    const o = parseSoOptions(RAW) as SoOptions;
    const drost = o.accounts[1];
    expect(o.groups.map((x) => soGroupView(x, drost).label)).toEqual(['แอดมินพักกลุ่ม', 'แอดมินพักกลุ่ม', 'ยังไม่เคยลอง', 'ยังไม่เคยลอง', 'ยังไม่เคยลอง']);
    expect(defaultSoGroupPick(o.groups, 'LBD', drost).sort()).toEqual(['mvhmlov27vqejwuh96m', 'mvhmlox9aax3n5phpqj', 'mvhmloovlppmpi5o6fg'].sort());
    // ไม่ส่งบัญชี (ทางถอยอ่านฐาน · ยังไม่เลือกบัญชี) = ติ๊กทุกกลุ่มธุรกิจเดียวกันที่ไม่โดนพัก
    expect(defaultSoGroupPick(o.groups, 'LBD').length).toBe(3);
    const [sec] = soGroupSections(o.groups, 'LBD');
    expect(soSectionHeadText(sec, [], drost)).toBe('LBD · ติ๊กไว้ 0 จาก 5 · ติด 2');
  });

  it('ป๊อป: สถานะเป็นคำ · ลิงก์เปิดกลุ่มเปิดแท็บใหม่ · ค่าติ๊กคิดใหม่ตอนสลับบัญชี · ทางถอยอ่านฐานไม่มีสถานะ', () => {
    const dialog = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(dialog).toContain('defaultSoGroupPick(soGroupsOfAccount(opts, a), jobBu, a)');
    expect(dialog).toContain('const view = soGroupView(g, account);');
    expect(dialog).toContain('target="_blank" rel="noopener noreferrer" data-testid="autopost-group-open"');
    const opts = readFileSync('api/_lib/soScrapingOptions.ts', 'utf8');
    expect(opts).toContain('groupStatus: [],');
    expect(opts).toContain('blocked: null })),');
  });
});
