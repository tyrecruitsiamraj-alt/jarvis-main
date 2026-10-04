/**
 * ═══ "พร้อมประกาศไหม" แทน "ติดขั้น" ทั้งกล่องงาน (เจ้าของเลือก B "ป๊อปหน้าเดียว ระบบร่างให้" 2 ต.ค. 2569) ═══
 * วัดจริงก่อนรื้อ: ใบเปิด 346 · ประกาศ 6 · "ติดขั้น 1" 193 · "ขั้น 2" 122 · มีลิงก์รอกด 21 · ไม่มีใครใส่อำเภอเอง 337/340
 * 🔴 ด่าน: หัวกล่องงานไม่มีแถว "ติดขั้น" · การ์ดไม่พูดคำว่า "ติดขั้น" / จุด 4 ขั้น แต่ใช้ชิปจาก `publishReadiness` ·
 *    หัวข้อกรองแรก = พร้อมประกาศไหม · นับจากตัวเดียวกับการ์ด · ลิงก์เก่า `?step=` ถูกล้างทิ้ง (ไม่ throw) ·
 *    ป๊อปเริ่มเป็นหน้าเดียว · ป๊อป 4 ขั้นเดิมยังเรียกได้ที่ `?popup=steps` (ทางถอย — ห้ามลบจนกว่าเจ้าของจะสั่ง)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BOARD_PRIMARY_FACETS } from '@/lib/boardFilters';

const ROOT = path.resolve(__dirname, '../..');
const code = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const HEADER = code('src/components/jobs/BoardReleaseHeader.tsx');
const BOARD = code('src/components/jobs/JobBoardView.tsx');
const JOB_CARD = code('src/components/jobs/BoardJobCard.tsx');
const SHEET = code('src/components/jobs/BoardPublishSheet.tsx');

describe('การ์ดกล่องงาน', () => {
  it('🔴 ไม่มี "ติดขั้น" / จุด 4 ขั้นแล้ว — ชิปจาก PublishReadinessChip · ปุ่มจาก readinessActionText', () => {
    expect(JOB_CARD).not.toContain('ติดขั้น');
    expect(JOB_CARD).not.toContain('RELEASE_STEP_ORDER');
    expect(JOB_CARD).toContain('<PublishReadinessChip readiness={readiness} />');
    expect(JOB_CARD).toContain('{readinessActionText(readiness)}');
  });

  it('หัวกล่องงานยังไม่มีแถว/ปุ่มขั้น (ของเดิม 30 ก.ย. 2569)', () => {
    expect(HEADER).not.toContain('ติดขั้น');
    expect(HEADER).not.toContain('onStepChange');
    expect(BOARD).not.toMatch(/onStepChange=/);
  });
});

describe('หัวข้อกรอง "พร้อมประกาศไหม"', () => {
  it('ขึ้นก่อนหัวข้ออื่น', () => {
    expect(BOARD_PRIMARY_FACETS[0]).toBe('ready');
  });

  it('🔴 นับด้วยตัวเดียวกับชิปบนการ์ด · ทะเบียนยังไม่พร้อม = ไม่มีหัวข้อ/ไม่มีชิป · ใบปิดไม่มีชิป', () => {
    expect(BOARD).toContain('readinessOf: ledgerReady ? (j) => publishReadinessOf(j, readinessFacts) : null');
    expect(BOARD).toContain('readiness={ledgerReady && !closedBox ? publishReadinessOf(job, readinessFacts) : null}');
  });

  it('🔴 ลิงก์เก่า ?step= ถูกล้างทิ้ง (replace) · ไม่กรองด้วยขั้นอีก', () => {
    expect(BOARD).toMatch(/params\.delete\('step'\);\s*return params;/);
    expect(BOARD).toMatch(/\{ replace: true \},\s*\);\s*\}, \[stepParam, setSearchParams\]\);/);
    expect(BOARD).not.toContain('filterByReleaseStep');
    expect(BOARD).not.toContain('releaseStepOf');
  });
});

describe('ป๊อปของการ์ด', () => {
  it('🔴 ค่าเริ่ม = ป๊อป 4 หน้า (4 ต.ค. 2569) · ?popup=sheet = ป๊อปหน้าเดียว (ทางถอยยังอยู่ครบ)', () => {
    expect(BOARD).toContain("searchParams.get('popup') !== 'sheet'");
    expect(BOARD).toContain('<BoardPublishSheet');
    expect(BOARD).toContain('<BoardPostingSteps');
    expect(fs.existsSync(path.join(ROOT, 'src/pages/jobs/BoardPostingPage.tsx'))).toBe(true);
  });

  it('หน้าเดียว: ไม่มีเลขขั้น/ปุ่มถัดไป · 5 แถว (สถานที่ รายได้ สวัสดิการ เพศ ให้เห็น) · ปุ่มประกาศปุ่มเดียว · ประกาศทีละใบ', () => {
    expect(SHEET).not.toContain('ถัดไป ขั้น');
    expect(SHEET).not.toContain('RELEASE_STEP_ORDER');
    for (const f of ['place', 'income', 'benefits', 'gender', 'visibility']) expect(SHEET).toContain(`id="${f}"`);
    expect(SHEET).toContain("'ประกาศ'");
    expect(SHEET).toContain('releaseJobsToPublic([job.id])');
    expect(SHEET).not.toMatch(/releaseJobsToPublic\((?!\[job\.id\])/);
  });
});

describe('feed กล่องงานรู้หน่วยรายได้เหมือนหน้าสาธารณะ', () => {
  it('🔴 แนบ monthly_income จากอัตรา ERP ในคำถามเดียวกับชิปสวัสดิการ · ไม่ทับ total_income · การ์ดใช้ publicIncomeOf ตัวเดียว', () => {
    const FEED = code('api/_handlers/siamraj-unit-requests.ts');
    expect(FEED).toContain('fetchJobBenefitChipsAndIncomesById(ids)');
    expect(FEED).toContain('it.monthly_income = income.total;');
    expect(FEED).not.toMatch(/it\.total_income\s*=\s*income/);
    expect(JOB_CARD).toContain('publicIncomeOf(job)');
    expect(JOB_CARD).not.toContain('incomeDisplay(');
  });
});
