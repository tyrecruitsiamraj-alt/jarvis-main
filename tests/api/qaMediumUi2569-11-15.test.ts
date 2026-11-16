// @vitest-environment node
/**
 * QA 15 พ.ย. 2569 ข้อระดับกลาง (เจ้าของ "แก้ข้อระดับกลางที่เหลือต่อเลย") — คำบนจอ · มือถือ · สถานะจอ · ตัวเลขไล่กลับได้
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_CHIPS } from '@/lib/recruitRm';
import { FUNNEL_COLUMNS } from '@/lib/channelFunnel';
import { soPostCellLabel } from '@/components/dashboard-trends/stuck/SoPostGroupsCard';

const read = (p: string) => readFileSync(p, 'utf8');

describe('คำบนจอ', () => {
  it('ชิปการติดต่อ/คอลัมน์ช่องทางใช้ ติดต่อได้ · ติดต่อไม่ได้ (uiWords)', () => {
    expect(CONTACT_CHIPS.map((c) => c.label)).toContain('ติดต่อได้');
    expect(CONTACT_CHIPS.map((c) => c.label)).not.toContain('สำเร็จ');
    expect(FUNNEL_COLUMNS.find((c) => c.key === 'staffOk')?.label).toBe('คนโทรต่อ ติดต่อได้');
  });
  it('ไม่มีประโยคสอนวิธีกดบนภาพรวม/Pre-Check', () => {
    const src = ['src/components/dashboard-trends/stuck/RecruitStuckBody.tsx', 'src/components/dashboard-trends/stuck/StuckAreaTable.tsx', 'src/pages/matching/PreCheckPage.tsx']
      .map(read)
      .join('\n');
    for (const s of ['กดเลขดูใบ', 'ตัวแดง = ยังไม่ทำ', 'กดดูงานเพื่อค้นหาผู้สมัคร', 'เรียงงานด่วนขึ้นก่อน', 'เลือกงานจาก ERP ได้เลย', 'กดจังหวัดดูอำเภอ']) expect(src).not.toContain(s);
  });
  it('ไม่ได้โพสต์ 3 แบบขึ้นต้นคำว่าไม่ได้โพสต์ · ป้ายที่มีคำนี้แล้วไม่เติมซ้ำ', () => {
    expect(soPostCellLabel({ key: 'not_tried_machine', label: 'เครื่องมีปัญหา' })).toBe('ไม่ได้โพสต์ · เครื่องมีปัญหา');
    expect(soPostCellLabel({ key: 'not_tried_unknown', label: 'ไม่ได้โพสต์ ไม่ทราบสาเหตุ' })).toBe('ไม่ได้โพสต์ ไม่ทราบสาเหตุ');
    expect(soPostCellLabel({ key: 'failed', label: 'ไม่สำเร็จ' })).toBe('ไม่สำเร็จ');
  });
  it('หน้าใบขอ ค่าเริ่มเขียนว่า ยังเปิดอยู่ (ไม่ใช่ทั้งหมด) · หน้าหลักบอกว่านับสายดูแล', () => {
    expect(read('src/pages/jobs/JobListPage.tsx')).toContain('<option value="all">ยังเปิดอยู่</option>');
    expect(read('src/pages/HomeOverviewPage.tsx')).toContain("label: 'โทรดูแลหลังเริ่มงาน'");
  });
});

describe('มือถือ', () => {
  it('ปุ่มผู้ช่วยเล็กลง + หน้าเว้นท้าย · ปุ่มดูแลหลังเริ่มงานขึ้นบรรทัดได้ · แถวเช็กลิสต์สูงพอนิ้ว · ปุ่ม Active เป็น Button', () => {
    expect(read('src/components/ai/AiChat.tsx')).toContain('h-10 rounded-full px-4');
    expect(read('src/components/layout/AppLayout.tsx')).toContain('pb-24 lg:pb-20');
    expect(read('src/pages/aftercare/AftercarePage.tsx')).toContain('flex min-w-0 flex-wrap items-center gap-1.5 sm:shrink-0');
    expect(read('src/components/matching/ErpBoardCardDialog.tsx')).toContain('flex min-h-10 cursor-pointer items-center gap-2 text-sm');
    const admin = read('src/pages/settings/AdminSettings.tsx');
    expect(admin).not.toMatch(/<button\s+type="button"\s+disabled=\{savingUserId === u\.id\}\s+onClick=\{\(\) => void updateUser\(u\.id, \{ is_active/);
  });
  it('Dashboard ปิดทัน/ไม่ทัน บอกรวมกับ % ใต้ชื่อแถวบนมือถือ', () => {
    expect(read('src/components/dashboard/analytics/DashboardSlaByLeadKind.tsx')).toContain("ใบ · ปิดทัน {row.onTimeRatePercent === null ? '—'");
    // ช่องที่ไม่มีใบ = 0 ไม่ใช่ขีด
    expect(read('src/components/dashboard/analytics/DashboardSlaByLeadKind.tsx')).toContain('data-testid="sla-cell-zero">0</span>');
  });
});

describe('สถานะจอ / ตัวเลขไล่กลับได้', () => {
  it('ป๊อปรายใบเงิน มียอดในช่วงต่อใบ (สตางค์) · เสียวันละรวมจากเลขที่แถวโชว์', () => {
    const d = read('src/components/home-exec/ExecDrill.tsx');
    expect(d).toContain('data-testid="exec-drill-money"');
    expect(d).toContain('Math.round(perDayOf(r))');
  });
  it('ป๊อป Dashboard แถวที่กดได้มีปุ่มมีคำ', () => {
    expect(read('src/components/shared/DetailListDialog.tsx')).toContain("{item.openLabel ?? 'เปิดใบขอ'} ›");
  });
  it('ภาพรวมงานสรรหาเก็บช่วง/BU ใน URL · Dashboard ติดตามจับเจ้าหน้าที่จากอีเมล/ชื่อเต็ม', () => {
    expect(read('src/components/dashboard-trends/RecruitOverview.tsx')).toContain("if (pickedBu) p.set('bu', pickedBu);");
    const t = read('api/_handlers/dashboard-trends.ts');
    expect(t).toContain('left join ${USERS} u on u.id = coalesce(f.created_by, ue.id, un.id)');
    expect(t).toContain("${STAFF_NAME_SQL('u', 'f.created_by_name')} as staff_name");
  });
});

describe('ตาราง SLA: เกณฑ์ขึ้นตอนเอาเมาส์ชี้ (เจ้าของ 16 พ.ย. 2569)', () => {
  const f = read('src/components/dashboard/analytics/DashboardSlaByLeadKind.tsx');
  it('ไม่มีย่อหน้าเกณฑ์ท้ายตาราง · ชื่อชนิด + หัว ปิดทัน % มี Tooltip ของ shadcn · วันอ่านจากค่ากลาง', () => {
    expect(f).not.toContain('เกณฑ์ SLA ต่างกันตามชนิดใบขอ');
    expect(f).toContain("from '@/components/ui/tooltip'");
    expect(f).toContain('{SLA_RULE_OF[row.kind]}');
    expect(f).toContain('data-testid="sla-rate-head"');
    expect(f).toContain('DEFAULT_REQUEST_LEAD_RULES.slaDays.retroactive');
    expect(f).not.toMatch(/ใน 7 วัน|ใน 15 วัน/);
  });
});
