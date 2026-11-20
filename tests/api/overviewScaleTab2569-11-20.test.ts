/**
 * แท็บ "Scale ลง" ของหน้าภาพรวม (เจ้าของ 20 พ.ย. 2569 "แก้ทั้งหมดไว้อีกแท็บของหน้าภาพรวม แล้วเดี๋ยวฉันเปิดดูแล้วตัดสินใจเองว่าจะเอาอันไหนไว้")
 * 🔴 ด่าน: สองแท็บเดิมอยู่ครบ · แท็บใหม่เห็นเฉพาะ Admin จนกว่าเจ้าของเคาะ · อ่านอย่างเดียว · เลขยืมตัวคิดกลาง ไม่เขียนนิยามซ้ำ
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/components/dashboard-trends/v2/RecruitOverviewV2.tsx', 'utf8');
const panel = readFileSync('src/components/dashboard-trends/v2/ScalePanel.tsx', 'utf8');
const lib = readFileSync('src/lib/overviewScale.ts', 'utf8');

describe('การวางแท็บ', () => {
  it('ภาพรวม | งานรายคน | Scale ลง — สองแท็บเดิมไม่ถูกถอด', () => {
    expect(page).toContain('data-testid="ov-tab-overview"');
    expect(page).toContain('data-testid="ov-tab-staff"');
    expect(page).toContain('data-testid="ov-tab-scale"');
    expect(page).toContain('<TabsContent value="overview" forceMount className="mt-6 space-y-8 data-[state=inactive]:hidden">');
    expect(page).toContain('<StaffPersonPanel');
    expect(page).toContain('<ScalePanel');
  });

  it('เห็นเฉพาะ Admin — คนอื่นเปิดลิงก์ ov=scale ก็ได้แท็บภาพรวมเดิม', () => {
    expect(page).toContain("const canScale = user?.role === 'admin';");
    expect(page).toContain("ov === 'scale' && canScale ? 'scale' : 'overview'");
    expect(page.match(/\{canScale \? \(/g)?.length).toBe(2); // ปุ่มแท็บ + เนื้อหา
  });

  it('ออกจากแท็บ = ชั้นและกล่องที่เลือกไม่ค้างใน URL ของแท็บอื่น', () => {
    expect(page).toContain("return t === 'scale' ? next : scaleLevelToParams(next, SCALE_ROOT, null);");
  });
});

describe('แท็บ Scale ลง อ่านอย่างเดียว', () => {
  it('ยิงแค่ 2 เส้นอ่าน (ค่าปรับของหน้าหลัก · งานของคนในวันนั้น) ไม่มีเส้นเขียน', () => {
    expect(panel).toContain("import { fetchHomeMoney } from '@/lib/homeMoneyApi';");
    expect(panel).toContain("import { fetchStaffPersonDay } from '@/lib/staffActivityApi';");
    expect(panel.match(/from '@\/lib\/\w+Api'/g)).toEqual(["from '@/lib/staffActivityApi'", "from '@/lib/homeMoneyApi'"]);
    expect(panel).not.toMatch(/apiFetch|method:\s*'(POST|PUT|PATCH|DELETE)'/);
  });

  it('อ่านไม่ได้ = บอกเหตุ ไม่ขึ้น 0 · ชั้นและกล่องอยู่ใน URL (กดย้อนกลับได้)', () => {
    expect(panel).toContain("friendlyErrorText(e, 'อ่านค่าปรับไม่ได้')");
    expect(panel).toContain('scaleLevelFromParams(params)');
    expect(panel).toContain('setParams((prev) => scaleLevelToParams(prev, next, nextBox));');
  });
});

describe('เลขของแท็บยืมตัวคิดกลาง', () => {
  it('รายชื่อ · คนหามา · ช่องทาง · ใบขอ · งาน · BU ของค่าปรับ มาจากตัวเดิมทั้งหมด', () => {
    for (const name of ['buildRecruitJourney', 'staffResultOf', 'bringerOf', 'funnelSubChannelOf', 'funnelSubOf', 'flowOf', 'recruiterLabelOf', 'isPostingStarted', 'staffWorkTotal', 'normalizeTrendBu', 'buOfFact']) {
      expect([name, new RegExp(`import [^;]*\\b${name}\\b[^;]*;`).test(lib)]).toEqual([name, true]);
    }
    // ค่าปรับ = ยอดตามสัญญา (need) ตัวเดียวกับค่าเริ่มของหน้าหลัก
    expect(lib).toContain('const fineOf = (r: MoneyRequest) => r.amount.need.fine;');
    expect(lib).toContain('const deductOf = (r: MoneyRequest) => r.amount.need.deduct;');
  });
});
