// @vitest-environment node
/**
 * รายชื่อจาก Scrap (เจ้าของ 17 พ.ย. 2569) — อ่านสดจาก So Scraping · บอกผ่าน/ไม่ผ่าน · ติ๊กแล้วเก็บเข้าการติดต่อ · AI ไม่โทรเอง
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  countScrapResults,
  scrapAge,
  scrapChannelLabel,
  scrapGender,
  scrapInJarvisLabel,
  scrapPhone10,
  scrapReasonLabel,
  scrapResultOf,
  scrapSplitName,
  SCRAP_RESULT_LABEL,
} from '../../src/lib/scrapCandidates';
import { requestNoOfJobId, scrapJobIdOf } from '../../api/_lib/scrapCandidates';

describe('แปลงข้อมูลจาก So Scraping', () => {
  it('ผลประเมินเป็นคำ · ค่าที่ไม่รู้จัก = ยังไม่ประเมิน', () => {
    expect(SCRAP_RESULT_LABEL[scrapResultOf('qualified')]).toBe('ผ่านเกณฑ์');
    expect(SCRAP_RESULT_LABEL[scrapResultOf('needs_review')]).toBe('ต้องดูเพิ่ม');
    expect(SCRAP_RESULT_LABEL[scrapResultOf('rejected')]).toBe('ไม่ผ่าน');
    expect(scrapResultOf(null)).toBe('unscored');
    expect(scrapResultOf('weird')).toBe('unscored');
  });

  it('เหตุผลรหัส → คำคนอ่าน · รหัสใหม่ไม่ทิ้ง', () => {
    expect(scrapReasonLabel('wrong_job_family')).toBe('ประสบการณ์ยังไม่ตรงสายงานนี้');
    expect(scrapReasonLabel('age_out_of_range')).toBe('อายุอยู่นอกช่วงที่ใบขอระบุ');
    expect(scrapReasonLabel('insufficient_evidence:education')).toBe('เรซูเม่ยังไม่บอกเรื่องวุฒิ');
    expect(scrapReasonLabel('incomplete_attachments:attachments_missing')).toBe('ข้อมูลไฟล์แนบไม่ครบ');
    expect(scrapReasonLabel('brand_new_code')).toBe('brand new code');
  });

  it('เพศ · อายุ · เบอร์ · ชื่อ ในรูปแบบที่ So Scraping เก็บจริง', () => {
    expect(scrapGender('ชาย')).toBe('male');
    expect(scrapGender('หญิง')).toBe('female');
    expect(scrapGender('')).toBeNull();
    expect(scrapAge('32')).toBe(32);
    expect(scrapAge('32 ปี')).toBe(32);
    expect(scrapAge('5')).toBeNull();
    expect(scrapPhone10('097-334-2397')).toBe('0973342397');
    expect(scrapPhone10('+66973342397')).toBe('0973342397');
    expect(scrapPhone10('02123456')).toBeNull();
    expect(scrapPhone10(null)).toBeNull();
    expect(scrapSplitName('กมลชนก แดงประทุม')).toEqual({ first: 'กมลชนก', last: 'แดงประทุม' });
    expect(scrapSplitName('ไม่ใช้', 'วณิชชา', 'ลิมสุวรรณ')).toEqual({ first: 'วณิชชา', last: 'ลิมสุวรรณ' });
  });

  it('ใบสมัครที่เกิดจาก Scrap บอกว่ามาจาก Scrap + เว็บไหน', () => {
    expect(scrapChannelLabel('jobbkk')).toBe('Scrap · JobBKK');
    expect(scrapChannelLabel('jobthai')).toBe('Scrap · JobThai');
    expect(scrapChannelLabel(null)).toBe('Scrap · เว็บหางาน');
  });

  it('นับทุกกองรวมกัน = ทั้งหมด (ว่าง = 0 ไม่หาย)', () => {
    const c = countScrapResults([{ result: 'qualified' }, { result: 'qualified' }, { result: 'rejected' }, { result: 'needs_review' }]);
    expect(c).toEqual({ total: 4, qualified: 2, needs_review: 1, rejected: 1, unscored: 0 });
    expect(c.qualified + c.needs_review + c.rejected + c.unscored).toBe(c.total);
    expect(countScrapResults([])).toEqual({ total: 0, qualified: 0, needs_review: 0, rejected: 0, unscored: 0 });
  });

  it('สถานะในฝั่ง Jarvis เป็นคำ', () => {
    expect(scrapInJarvisLabel(null)).toBeNull();
    expect(scrapInJarvisLabel({ application_id: 'a', is_lead: true, lead_by_name: 'ต้น' })).toBe('อยู่ในการติดต่อของ ต้น');
    expect(scrapInJarvisLabel({ application_id: 'a', is_lead: false, lead_by_name: null })).toBe('มีใบสมัครแล้ว');
  });

  it('ผูกใบขอด้วยเลขใบขอจริงใน ERP เท่านั้น (ใบขอล่วงหน้าไม่นับ)', () => {
    expect(scrapJobIdOf('opl6911041')).toBe('siamraj-sql:OPL6911041');
    expect(requestNoOfJobId('siamraj-sql:LAO6911022')).toBe('LAO6911022');
    expect(requestNoOfJobId('siamraj-sql:SQ6911003')).toBe('SQ6911003');
    expect(requestNoOfJobId('siamraj-pre:OPL6911041')).toBeNull();
  });
});

describe('เส้น API + หน้าจอ', () => {
  const handler = readFileSync('api/_handlers/scrap-candidates.ts', 'utf8');
  const lib = readFileSync('api/_lib/scrapCandidates.ts', 'utf8');

  it('ลงทะเบียน · สิทธิ์เดียวกับผู้สมัคร · ล็อก BU ด้วยชุดใบขอที่เห็นได้', () => {
    expect(readFileSync('api/_handlers/registry.ts', 'utf8')).toContain("'/api/scrap-candidates': scrapCandidatesHandler");
    expect(handler).toContain("withRbac(handler, 'job-applications')");
    expect(handler).toContain('loadScopedJobIdSet');
  });

  it('AI ไม่โทรเอง: ใบสร้างในชื่อ So Scraping + เก็บเป็น Lead · กันซ้ำ 14 วันในธุรกรรมที่ล็อกเบอร์', () => {
    expect(lib).toContain('staffInsertParams(app.value, SO_SCRAPING_CREATED_BY');
    expect(lib).toContain('set is_lead = true');
    expect(lib).toContain('lockAndFindRepeat(client');
    expect(lib).not.toMatch(/enqueueLumos|insertQueueItems/);
    // อ่านฐาน So Scraping อย่างเดียว — ไม่มีคำสั่งเขียนลง schema ของ So Scraping
    expect(lib).not.toMatch(/(insert into|update|delete from)\s+\$\{CAND\}/i);
  });

  it('ใบขอมีแท็บ Scrap · หน้างานสรรหามี ผู้สมัคร ▾ Scrap · ทั้งสองที่มีปุ่มเก็บเข้าการติดต่อ', () => {
    expect(readFileSync('src/components/jobs/UnitRequestTabs.tsx', 'utf8')).toMatch(/UNIT_TAB_IDS = \['detail', 'applicants', 'scrap', 'actions'\]/);
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('<UnitRequestTabPage tab="scrap" />');
    expect(readFileSync('src/components/jobs/JobBoardView.tsx', 'utf8')).toContain("{ id: 'scrap', label: 'Scrap' }");
    expect(readFileSync('src/pages/jobs/StaffJobBoardPage.tsx', 'utf8')).toContain("view === 'scrap'");
    const panel = readFileSync('src/components/jobs/ScrapCandidatesPanel.tsx', 'utf8');
    expect(panel).toContain('เก็บเข้าการติดต่อ');
    expect(panel).toContain("navigate('/jobs/board?view=contact')");
    expect(readFileSync('src/pages/jobs/UnitRequestTabPage.tsx', 'utf8')).toContain('data-testid="applicants-to-contact"');
  });
});
