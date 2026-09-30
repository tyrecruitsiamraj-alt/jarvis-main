/**
 * ═══ แท็บฝั่งผู้สมัครตามแบบ iRecruit (เจ้าของสั่ง 30 ก.ย. 2569) ═══
 *
 * > *"ฉันแค่อยากเอาหน้ากล่องงานเป็นแท็บแรก แล้วที่เหลือก็ตาม irecruit ส่วนหน้าภาพรวมของ Irecruit
 * >  ก็คือ dashboard ของฉัน"* → เรียงเอง: กล่องงาน > ผู้สมัคร > การติดตาม > ติดตามนัดหมาย > ภาพรวม
 * > *"ศูนย์คุมงานสรรหา ย้ายไปหน้า dashboard · ยอดจากฐานของเรา… เอาออก · การ์ดพวกนี้เอาออก ดูยาก แล้วชวนรกมาก ·
 * >  Filter ทำแบบย่อ กางได้ · ตรงรายชื่อก็ขาดๆหายๆ · พอเก็บแล้วเข้าไปหน้าการโทรของฉัน"*
 * Choice: การ์ดล่าง "เอาออกทั้ง 3 ใบ" · ตัวกรอง "แถบซ้ายพับได้" · เก็บแล้ว "อยู่หน้าเดิม มีปุ่มพาไป" ·
 * ภาพรวม "ย้ายไปก่อน ส่วนอื่นค่อยทำ"
 *
 * (สแกนโค้ดหลังตัดคอมเมนต์ — ไฟล์พวกนี้เล่าประวัติด้วยคำเก่าโดยตั้งใจ)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RM_TAB_LABEL } from '@/lib/recruitRm';

const ROOT = path.resolve(__dirname, '../..');
const code = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const BOARD = code('src/components/jobs/JobBoardView.tsx');
const PANEL = code('src/components/recruit-rm/RecruitControlPanel.tsx');
const DASHBOARD = code('src/components/dashboard-trends/BoardDashboard.tsx');
const WS = code('src/components/recruit-rm/RmWorkspace.tsx');
const TABLE = code('src/components/recruit-rm/RmTable.tsx');
const PAGE = code('src/pages/jobs/StaffJobBoardPage.tsx');

describe('แท็บ: กล่องงาน > ผู้สมัคร > การติดตาม > ติดตามนัดหมาย > ภาพรวม', () => {
  it('🔴 ลำดับและชื่อตามที่เจ้าของเรียงเอง', () => {
    const tabs = [...BOARD.matchAll(/\{ id: '(\w+)', label: '([^']+)' \}/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(tabs).toEqual(['board:กล่องงาน', 'list:ผู้สมัคร', 'contact:การติดตาม', 'appointments:ติดตามนัดหมาย', 'dashboard:ภาพรวม']);
  });

  it('ชื่อสามแท็บกลางเป็นชุดเดียวกับ RM_TAB_LABEL (ปุ่ม/ข้อความในแท็บผู้สมัครใช้ชื่อเดียวกับแถบแท็บ)', () => {
    expect(RM_TAB_LABEL).toEqual({ candidates: 'ผู้สมัคร', contact: 'การติดตาม', appointments: 'ติดตามนัดหมาย' });
    expect(WS).not.toContain('RM_TAB_BOARD_LABEL');
  });
});

describe('ศูนย์คุมงานสรรหา ย้ายไปแท็บภาพรวม', () => {
  it('🔴 แท็บผู้สมัครไม่มีแผงนี้แล้ว · ภาพรวมวางไว้บนสุด (ก่อนแถบเลือกช่วงเวลา)', () => {
    expect(BOARD).not.toContain('RecruitControlPanel');
    const at = DASHBOARD.indexOf('<RecruitControlPanel />');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(DASHBOARD.indexOf('<TrendToolbar'));
  });

  it('🔴 ถอดบรรทัดอธิบาย + การ์ดแถวล่าง 3 ใบ (เวลารอโทร · ค้างยังไม่โทร · เก็บไปแล้วยังไม่โทร)', () => {
    for (const gone of ['ยอดจากฐานของเรา', 'กดซ้ำเพื่อล้าง', 'เวลารอโทร', 'ค้างยังไม่โทร', 'เก็บไปแล้วยังไม่โทร', 'showIdleUsers', 'รอเลือกวิธีโทร']) {
      expect(PANEL, gone).not.toContain(gone);
    }
    // กล่อง 4 ขั้นยังอยู่ครบ
    for (const stage of ['เข้ามา', 'โทร', 'ติดต่อ', 'เก็บใบสมัคร']) expect(PANEL).toContain(`label: '${stage}'`);
  });

  it('กดกล่อง = พาไปแท็บผู้สมัครที่กรองตามกล่อง (push — ย้อนกลับแล้วกลับมาภาพรวม)', () => {
    expect(PANEL).toMatch(/params\.set\('view', 'list'\);[\s\S]*?params\.set\('bucket', bucket\);\s*setSearchParams\(params\);/);
    expect(PANEL).not.toMatch(/setSearchParams\(params, \{ replace: true \}\)/);
  });

  it('ธงที่โชว์เหลือเฉพาะของกล่องที่ยังอยู่ (โทรแล้ว · เก็บใบสมัคร)', () => {
    expect(PANEL).toContain("f.metric === 'called' || f.metric === 'recruit'");
  });
});

describe('แท็บผู้สมัคร: ตัวกรองพับได้ · ดูเป็นคน · เก็บแล้วมีปุ่มพาไป · ชื่อไม่ขาด', () => {
  it('🔴 แถบซ้ายพับเป็นค่าตั้งต้น (จำต่อเครื่อง) · พับอยู่มีปุ่มกาง · กางอยู่มีปุ่มพับ', () => {
    expect(WS).toContain("const FILTER_OPEN_KEY = 'jarvis:applicant-filter-open'");
    expect(WS).toMatch(/getItem\(FILTER_OPEN_KEY\) === '1'/);
    expect(WS).toMatch(/useState<boolean>\(readFilterOpen\)/);
    expect(WS).toMatch(/!bucket && filterOpen \? \(\s*<FilterSidebar/);
    expect(WS).toContain('onCollapse={() => changeFilterOpen(false)}');
    expect(WS).toMatch(/!filterOpen \? <FilterSidebarToggle/);
  });

  it('หัวข้อเจ้าหน้าที่สรรหามาจากใบขอที่หน้ากล่องงานโหลดไว้ (เปิด + ปิดแล้ว) จับใบด้วย buildJobKeyIndex', () => {
    expect(PAGE).toContain('const allJobs = useMemo(() => [...jobs, ...closed.rows], [jobs, closed.rows]);');
    expect(PAGE).toContain('jobs={allJobs}');
    expect(WS).toMatch(/buildJobKeyIndex\(\s*jobs\.map\(\(j\) => \[j\.id, \(j\.recruiter_name/);
    expect(WS).toContain('{ ...applicantFacts, tab: t }');
  });

  it('🔴 กดเก็บไปโทรเองแล้วอยู่หน้าเดิม · ข้อความแจ้งมีปุ่ม "ไปการติดตาม"', () => {
    expect(WS).toContain("say(summarizeCallChoice(outcome), tab !== 'contact')");
    expect(WS).toMatch(/noticeGoContact \? \(\s*<Button[^>]*onClick=\{\(\) => goToTab\('contact'\)\}/);
    expect(WS).toContain('ไป{RM_TAB_LABEL.contact}');
    // ทุกข้อความแจ้งผ่านตัวเดียว (ปุ่มไม่โผล่ค้างกับข้อความอื่น)
    expect(WS.match(/setNotice\(/g)?.length).toBe(1);
  });

  it('🔴 ตารางเลิกตัดข้อความเป็น … บรรทัดเดียว (ชื่อ/ที่อยู่/หน่วยงานขึ้นได้ 2 บรรทัด)', () => {
    expect(TABLE).not.toMatch(/\btruncate\b/);
    expect(TABLE.match(/line-clamp-2/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('ช่องทางบนตารางอ่านแบบเดียวกับตัวกรอง (ตารางช่องทางของลิงก์ก่อน)', () => {
    expect(TABLE).toContain('r.channel_label?.trim() || (r.referral_source ? REFERRAL_SOURCE_LABEL[r.referral_source] : EM_DASH)');
  });
});
