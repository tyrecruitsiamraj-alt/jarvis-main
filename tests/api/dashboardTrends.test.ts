/**
 * ═══ แท็บ Dashboard (กล่องงาน + ติดตาม) — กติกาที่ห้ามถอย (28 ก.ย. 2569) ═══
 *
 * เจ้าของสั่ง: *"สวมบทบาทเป็นผู้บริหาร … รายวัน สัปดาห์ เดือน ปี … หลายมิติ"* → Choice แท็บชื่อ "Dashboard" ในสองหน้า ·
 * ERP อ่านอย่างเดียว + สำเนาฝั่งเรา
 *
 * เทสต์สแกนโค้ด (ตัดคอมเมนต์ก่อน — ไฟล์เล่าประวัติด้วยคำพวกนี้โดยตั้งใจ)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buFromSiteCode } from '@/lib/homeBu';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('เส้น /api/dashboard-trends — อ่านอย่างเดียว · ไม่คืนข้อมูลบุคคล', () => {
  const h = code('api/_handlers/dashboard-trends.ts');

  it('รับแต่ GET และไม่มีคำสั่งเขียนฐาน', () => {
    expect(h).toMatch(/!== 'GET'/);
    expect(h).not.toMatch(/\b(insert|update|delete)\s+(into|from|\$\{)/i);
  });

  it('สิทธิ์ต่อ section = สิทธิ์ของเส้นเดิมที่ข้อมูลมาจาก', () => {
    expect(h).toContain("follow: 'follow'");
    expect(h).toContain("applicants: 'job-applications'");
    expect(h).toContain("requests: 'siamraj-unit-requests'");
    expect(h).toMatch(/checkApiAccess\(req\.user\.role, SECTION_RESOURCE\[section\], 'GET'\)/);
  });

  it('แถวที่ส่งออกไม่มีเบอร์/ชื่อผู้สมัคร (ใช้เบอร์แค่จับคู่ผลโทรฝั่งเซิร์ฟเวอร์)', () => {
    const types = code('src/lib/trends/types.ts');
    for (const t of ['FollowTrendRow', 'ApplicantTrendRow']) {
      const block = types.slice(types.indexOf(`export type ${t}`), types.indexOf('};', types.indexOf(`export type ${t}`)));
      expect(block, t).not.toMatch(/\b(phone|recipientPhone|fullName|recipientName)\b/);
    }
  });

  it('คิว Lumos ของใบสมัครจับด้วย person_ref ตรงตัว · คำพูดในสายจัดถังในเซิร์ฟเวอร์แล้วทิ้ง ไม่ส่งออก', () => {
    expect(h).toContain("q.person_ref = 'app-' || a.id::text");
    expect(h).toMatch(/classifyCallMicro\(/);
    // สถานะคิวคิดด้วยนิยามกลางเท่านั้น (ห้ามเขียน status/result เอง)
    for (const def of ['queueCancelled', 'queueHasResult', 'queueWaiting', 'queuePending', 'queueSentAt']) {
      expect(h).toContain(`\${${def}('q')}`);
    }
    const types = code('src/lib/trends/types.ts');
    const block = types.slice(types.indexOf('export type ApplicantLumos'), types.indexOf('};', types.indexOf('export type ApplicantLumos')));
    expect(block).not.toMatch(/\b(summary|reply|transcript)\b/);
    const toLumos = h.slice(h.indexOf('function toApplicantLumos'), h.indexOf('/** ════ ปล่อยประกาศ'));
    expect(toLumos.slice(toLumos.indexOf('return {'))).not.toMatch(/\b(summary|reply|transcript)\b/);
  });

  it('ใบขอ (ERP) อ่านผ่านสำเนาในฐาน ไม่ถามสดทุกครั้ง', () => {
    expect(h).toContain('readThroughSnapshot(');
    expect(read('migrations/122_dashboard_trend_snapshots.sql')).toMatch(/create table if not exists dashboard_trend_snapshots/);
  });

  it('BU ฝั่ง SQL แปลรหัสไซต์แบบเดียวกับ homeBu.ts แล้วแปลงเป็นรหัสแผนกชุดเดียว', () => {
    expect(h).toContain("~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(${col} from 3 for 3))");
    expect(h).toContain('normalizeTrendBu(');
    // ตัวอย่างเดียวกับที่ SQL จะได้
    expect(buFromSiteCode('66LML0011')).toBe('LML');
  });
});

describe('คิวรีใบแจ้งเข้า (ERP) — นิยามเดียวกับเส้นใบขอ', () => {
  const q = code('api/_lib/siamrajSqlServerInforms.ts');
  it('นับเฉพาะใบแจ้งเข้าที่ยังไม่ถูกยกเลิก · ขอบเขต BU/ไซต์ชุดเดียวกับ throughput', () => {
    expect(q).toContain("activeInformWhereSql('IH')");
    expect(q).toContain('getSqlFilters()');
    expect(q).toContain("excludeClsContractTypeWhere('SS')");
  });
  it('กรองวันที่แจ้งเข้าแบบไม่ห่อฟังก์ชันคอลัมน์ (ใช้ดัชนีได้)', () => {
    expect(q).toMatch(/IH\.inform_date >= @fromDate/);
    expect(q).not.toMatch(/WHERE[\s\S]*CONVERT\(date, IH\.inform_date\) >=/);
  });
});

describe('ส่วน รายชื่อ → Lumos → ผลโทร — หนึ่งเมตริกหนึ่งนิยาม', () => {
  const pipe = code('src/lib/trends/lumosPipeline.ts');
  it('นับมีคนรับ/ได้คุย/ตอบรับด้วยตัวรวมกลาง ไม่นับเอง · ป้ายจากพจนานุกรมเมตริก', () => {
    expect(pipe).toContain('addCallMicro(micro, l.micro)');
    expect(pipe).toContain('callMicroRates(p.micro)');
    expect(pipe).toContain('METRICS[key].label');
  });
  it('หน้า Dashboard ไม่มีเส้นทางผู้สมัครชุดเก่า (สนใจคนละนิยาม) และการ์ดภาพรวมใช้เส้นทางตัวเดียวกับส่วนล่าง', () => {
    const board = code('src/components/dashboard-trends/BoardDashboard.tsx');
    expect(board).not.toMatch(/applicantFunnel|fetchCallRateSeries/);
    expect(board).toContain('now={pipeNow}');
    expect(board).toMatch(/label="ส่งให้ Lumos"[\s\S]*?value=\{applicants\.data \? sentNow : null\}/);
  });
});

describe('แท็บ Dashboard อยู่ในสองหน้า และไม่พาออกไปหน้าอื่น', () => {
  it('กล่องงานมีแท็บชื่อ Dashboard และโหลดแบบ lazy (ไม่ถ่วงหน้าสมัครสาธารณะ)', () => {
    expect(code('src/components/jobs/JobBoardView.tsx')).toContain("{ id: 'dashboard', label: 'Dashboard' }");
    const page = code('src/pages/jobs/StaffJobBoardPage.tsx');
    expect(page).toContain("lazy(() => import('@/components/dashboard-trends/BoardDashboard'))");
    expect(code('src/components/jobs/JobBoardView.tsx')).not.toContain('dashboard-trends');
  });
  it('หน้าติดตามมีแท็บ Dashboard (?view=dashboard · กดเปลี่ยน = push)', () => {
    const f = code('src/pages/follow/FollowPage.tsx');
    expect(f).toContain('<TabsTrigger value="dashboard">Dashboard</TabsTrigger>');
    expect(f).toMatch(/params\.set\('view', 'dashboard'\);[\s\S]*setSearchParams\(params\);/);
  });
  it.each([
    'src/components/dashboard-trends/BoardDashboard.tsx',
    'src/components/dashboard-trends/FollowDashboard.tsx',
    'src/components/dashboard-trends/TrendParts.tsx',
    'src/components/dashboard-trends/LumosPipelineSection.tsx',
  ])('%s — ไม่มีลิงก์ไปหน้าใบขอ/จับคู่งาน', (f) => {
    const src = code(f);
    expect(src).not.toMatch(/navigateToUnitRequest\(|['"`]\/jobs\/siamraj\/|['"`]\/matching\//);
  });
  it('เหลือหาตอนนี้ใช้ยอดเดียวกับหัวกล่องงาน (sumJobPositionUnits ของ feed เดียวกัน)', () => {
    const page = code('src/pages/jobs/StaffJobBoardPage.tsx');
    expect(page).toContain('sumJobPositionUnits(jobs)');
    expect(page).toContain('<BoardDashboard boardOpen={boardOpen} />');
  });
});
