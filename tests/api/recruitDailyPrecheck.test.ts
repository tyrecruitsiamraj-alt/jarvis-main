import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOARD_VIEW_TABS } from '@/components/jobs/JobBoardView';

/** เจ้าของสั่ง 15 ต.ค. 2569: Pre-check แทนแท็บภาพรวม · ตัวเลขรายวันบนแท็บผู้สมัครถอดแล้ว 10 พ.ย. 2569 (เจ้าของ "เอาออก") */
describe('แท็บงานสรรหา', () => {
  // 18 ต.ค. 2569 เจ้าของสั่งเพิ่ม "ภาพรวม" ต่อจาก Pre-Check (Journey ทั้งเส้น)
  it('โพสต์ประกาศ · ผู้สมัคร · การติดต่อ · ติดตามนัดหมาย · Pre-Check · ภาพรวม', () => {
    expect(BOARD_VIEW_TABS.map((t) => t.label)).toEqual(['โพสต์ประกาศ', 'ผู้สมัคร', 'การติดต่อ', 'ติดตามนัดหมาย', 'Pre-Check', 'ภาพรวม']);
  });
  it('🔴 ภาพรวมเดิมยังเปิดได้ที่ ?view=dashboard (ทางถอย) · Pre-Check ฝังแบบไม่มีหัวซ้อน', () => {
    const page = readFileSync('src/pages/jobs/StaffJobBoardPage.tsx', 'utf8');
    expect(page).toContain("const EXTRA_VIEWS = ['dashboard', 'precheck', 'match'] as const;");
    expect(page).toContain('<PreCheckPage embedded />');
    expect(page).toContain('<RecruitOverview published={boardPublished} />');
    expect(readFileSync('src/pages/matching/PreCheckPage.tsx', 'utf8')).toContain('{embedded ? null : (');
  });
  it('🔴 ตัวเลขรายวัน "วันนี้ กรอกมา …" ถอดออกจากแท็บผู้สมัครแล้ว (เจ้าของ 10 พ.ย. 2569 "เอาออก") — ห้ามกลับมา', () => {
    expect(readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8')).not.toContain('RecruitDailyPanel');
  });
});

describe('Pre-Check เห็นเฉพาะ BU ของบัญชี (เจ้าของ 15 ต.ค. 2569 "Bu ใคร Bu มัน")', () => {
  it('กรองใบขอด้วย department_code ของผู้ใช้ · ไม่มี BU = เห็นทุกใบ (แบบหน้าจับคู่งาน)', () => {
    const src = readFileSync('src/pages/matching/PreCheckPage.tsx', 'utf8');
    expect(src).toContain('const myBu = normalizeAppDepartmentCode(user?.department_code);');
    // 28 ต.ค. 2569: BU หลัก + ดูเพิ่ม (sirirat.j ไม่เห็น BU อื่น) · ไม่มี BU = เห็นทุกใบเหมือนเดิม
    expect(src).toContain('...(user?.extra_department_codes ?? [])');
    expect(src).toContain('if (myBus.length === 0) return feedJobs;');
  });
});

it('Pre-Check ไม่มีช่องละติจูด/ลองจิจูดบนจอ (เจ้าของ 15 ต.ค. 2569)', () => {
  const src = readFileSync('src/pages/matching/PreCheckPage.tsx', 'utf8');
  expect(src).not.toContain('ละติจูด (ไม่บังคับ)');
  expect(src).not.toContain('ลองจิจูด (ไม่บังคับ)');
});

it('การ์ดไม่โชว์ "ต้องการ (วันที่)" แล้ว และไม่มี checkbox วันที่ต้องการ (เจ้าของ 15 ต.ค. 2569)', () => {
  const facts = readFileSync('src/components/jobs/JobPublicFacts.tsx', 'utf8');
  expect(facts).not.toContain('ต้องการ {');
  expect(readFileSync('src/lib/publicFieldVisibility.ts', 'utf8')).not.toContain("required_date: 'วันที่ต้องการ'");
});
