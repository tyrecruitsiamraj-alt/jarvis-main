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
  it('ยิงแต่เส้นอ่าน (ค่าปรับ · งานรายคน · ใบขอช่วงก่อน · งานของใบขอ) ไม่มีเส้นเขียน', () => {
    expect(panel).toContain("import { fetchHomeMoney } from '@/lib/homeMoneyApi';");
    expect(panel).toContain("import { fetchStaffActivity, fetchStaffPersonDay, fetchStaffRoster } from '@/lib/staffActivityApi';");
    expect(panel.match(/from '@\/lib\/\w+Api'/g)).toEqual(["from '@/lib/recruitStuckApi'", "from '@/lib/staffActivityApi'", "from '@/lib/homeMoneyApi'", "from '@/lib/requestTimelineApi'"]);
    expect(panel).not.toMatch(/apiFetch|method:\s*'(POST|PUT|PATCH|DELETE)'/);
    // ตัวเรียกของเส้นใหม่ก็เป็น GET ล้วน
    for (const f of ['src/lib/requestTimelineApi.ts', 'src/lib/staffActivityApi.ts']) expect(readFileSync(f, 'utf8')).not.toMatch(/method:\s*'(POST|PUT|PATCH|DELETE)'/);
  });

  it('อ่านไม่ได้ = บอกเหตุ ไม่ขึ้น 0 · ชั้นและกล่องอยู่ใน URL (กดย้อนกลับได้)', () => {
    expect(panel).toContain("friendlyErrorText(e, 'อ่านค่าปรับไม่ได้')");
    expect(panel).toContain('scaleLevelFromParams(params)');
    expect(panel).toContain("setParams((cur) => scaleLevelToParams(cur, next, nextBox, { month: view.month === undefined ? urlMonth : view.month, request: null }));");
  });

  it('ช่วงก่อนอ่านไม่ได้ = เทียบไม่ได้ (ไม่เทียบกับ 0) · ชั้นวันเทียบวันก่อน · เลือก "ทั้งหมด" ไม่เทียบ', () => {
    expect(panel).toContain('fetchStaffActivity({ ...q, bu }).catch(() => null)');
    expect(panel).toContain('const cmpOf = (key: ScaleBoxKey): Cmp => scaleCompareOf(key, cmpCtx);');
    expect(lib).toContain("return { state: t.comparable && c.have[src] ? 'ok' : 'na', sense: t.sense };");
    expect(panel).toContain('const prevDay = level.day ? scalePrevDay({ from, to, today }, level.day) : null;');
    expect(page).toContain('const scalePrev = React.useMemo(() => (win.all ? null : { from: win.prevFrom, to: win.prevTo, cohort: prevModel?.cohort ?? null })');
    expect(page).toContain('jobs={data.appJobs ?? null}');
    expect(page).toContain('prev={scalePrev}');
  });
});

describe('เลขของแท็บยืมตัวคิดกลาง', () => {
  it('รายชื่อ · คนหามา · ช่องทาง · ใบขอ · งาน · BU ของค่าปรับ มาจากตัวเดิมทั้งหมด', () => {
    for (const name of ['buildRecruitJourney', 'staffResultOf', 'bringerOf', 'funnelSubChannelOf', 'funnelSubOf', 'flowOf', 'recruiterLabelOf', 'isPostingStarted', 'staffWorkTotal', 'normalizeTrendBu', 'buOfFact', 'areaFitOf', 'ageFitOf', 'genderFitOf', 'NO_REASON', 'ledgerJobIdOf', 'comparableSince']) {
      expect([name, new RegExp(`import [^;]*\\b${name}\\b[^;]*;`).test(lib)]).toEqual([name, true]);
    }
    // ค่าปรับ = ยอดตามสัญญา (need) ตัวเดียวกับค่าเริ่มของหน้าหลัก
    expect(lib).toContain('const fineOf = (r: MoneyRequest) => r.amount.need.fine;');
    expect(lib).toContain('const deductOf = (r: MoneyRequest) => r.amount.need.deduct;');
  });
});

describe('ของก้อนสอง: เกณฑ์ใบขอมากับข้อมูลหน้า · เส้นใหม่อ่านอย่างเดียวและลงทะเบียนแล้ว', () => {
  const overview = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
  const registry = readFileSync('api/_handlers/registry.ts', 'utf8');
  const timeline = readFileSync('api/_handlers/request-timeline.ts', 'utf8');
  const activity = readFileSync('api/_handlers/staff-activity.ts', 'utf8');

  it('ใบขอของใบสมัครมีที่ตั้งงาน · ช่วงอายุ · เพศ (ตัวอ่านเดียวกับตัวจับคู่) + อำเภอบ้านของผู้สมัคร', () => {
    expect(overview).toContain("import { jobAreaOf, requiredGenderLabel } from '../../src/lib/matchProximity.js';");
    expect(overview).toContain('area: b.j ? jobAreaOf(b.j) : null,');
    expect(overview).toContain('gender: b.j ? requiredGenderLabel(b.j.gender_requirement) : null,');
    expect(overview).toContain("nullif(btrim(a.district), '') as home_district,");
  });

  it('เส้นงานของใบขอ: ลงทะเบียน · สิทธิ์เดียวกับภาพรวม · ใช้ SQL ชุดเดียวกับงานรายคน', () => {
    expect(registry).toContain("'/api/request-timeline': requestTimelineHandler as ApiHandler,");
    expect(timeline).toContain("export default withRbac(requestTimelineHandler, 'job-applications');");
    expect(timeline).toContain("import { CHANNEL_SQL, CONTACT_RESULT_SQL, LINK_OWNER, SCRAP_OUTCOME_LABEL, bkk } from './staff-activity.js';");
    expect(timeline).not.toMatch(/\b(insert into|update\s+\$|delete from)\b/i);
    expect(activity).toContain("if (String(one(req.query?.roster) ?? '') === '1') return res.status(200).json({ roster: await loadRoster(to, buSet) });");
  });
});
