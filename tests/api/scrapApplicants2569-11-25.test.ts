// @vitest-environment node
/**
 * แท็บ Scrap ทำงานแบบแท็บผู้สมัคร (เจ้าของ 25 พ.ย. 2569 "เลือกเพื่อส่ง Ai โทรได้แบบผู้สมัครเลย" · Choice "แยกยอดเป็น Scrap")
 * - รายชื่อ Scrap อ่านสด · ใบสร้างตอนกดส่ง AI / เก็บไปโทรเอง เท่านั้น · ชิปไม่ทับกัน รวมกัน = ทั้งหมด
 * - ใบจาก Scrap ไม่ขึ้นแท็บผู้สมัคร · บท AI "เห็นประวัติบนเว็บ …" ไม่ใช่ "เคยฝากใบสมัคร"
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildScrapWorkRows,
  countScrapViews,
  parseScrapVirtualId,
  scrapRowAsApplication,
  scrapVirtualId,
  SCRAP_LIST_VIEWS,
} from '../../src/lib/scrapApplicants';
import { isScrapApplication, scrapSplitName, scrapWebOfChannel, type ScrapCandidateRow } from '../../src/lib/scrapCandidates';
import { notSentReasonOf } from '../../src/lib/applicantAiAnswerText';
import { scrapVirtualStatus } from '../../src/lib/scrapApplicants';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';
import { EDITABLE_SCRIPT_DEFAULTS, KNOWN_PLACEHOLDERS, buildScrapQuestions } from '../../api/_lib/lumosCallScript';
import { EDITABLE_SCRIPT_KEYS } from '../../api/_lib/callScriptStore';
import { buildApplicationInterviewPayload } from '../../api/_lib/lumosDispatch';

const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

const scrap = (over: Partial<ScrapCandidateRow> = {}): ScrapCandidateRow => ({
  candidate_id: '0b7e1f2a-3c4d-4e5f-8a9b-1c2d3e4f5a6b',
  request_no: 'LBA6911012',
  full_name: 'สมชาย ใจดี',
  phone: '0812345678',
  age: 32,
  gender: 'male',
  province: 'ชลบุรี',
  platform: 'jobbkk',
  result: 'qualified',
  score: 80,
  reasons: [],
  found_at: '2026-11-24T03:00:00.000Z',
  in_jarvis: null,
  ...over,
});

const app = (over: Partial<PublicApplication> = {}): PublicApplication => ({
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  full_name: 'สมชาย ใจดี',
  phone: '0812345678',
  job_id: 'siamraj-sql:LBA6911012',
  channel_label: 'Scrap · JobBKK',
  created_by_name: 'So Scraping',
  status: 'new',
  created_at: '2026-11-25T02:00:00.000Z',
  ...over,
});

describe('ใบเสมือนจากรายชื่อ Scrap', () => {
  it('id อ่านกลับเป็นเลขใบขอ + คนได้ · ผูกใบขอ ERP · ช่องทางบอกเว็บ', () => {
    const s = scrap();
    const a = scrapRowAsApplication(s, { title: 'แม่บ้าน', unitName: 'อาคาร A', recruiterName: 'เจมส์' });
    expect(parseScrapVirtualId(a.id)).toEqual({ requestNo: 'LBA6911012', candidateId: s.candidate_id });
    expect(a.job_id).toBe('siamraj-sql:LBA6911012');
    expect(a.channel_label).toBe('Scrap · JobBKK');
    expect(a.created_at).toBe(s.found_at);
    expect(parseScrapVirtualId('a1b2c3d4-0000-4000-8000-000000000001')).toBeNull();
  });
});

describe('ชิปของแท็บ Scrap — ไม่ทับกัน รวมกัน = ทั้งหมด', () => {
  const rows = buildScrapWorkRows(
    [
      // ใบจาก Scrap ที่ AI โทรแล้วสนใจ
      app({ id: 'a1b2c3d4-0000-4000-8000-000000000001', last_call_outcome: 'confirmed', last_call_status: 'completed', last_call_at: '2026-11-25T03:00:00Z' }),
      // ใบจาก Scrap ที่ฉันเก็บไปโทรเองแล้ว
      app({ id: 'a1b2c3d4-0000-4000-8000-000000000002', phone: '0812345679', claimed: true, claimed_by_me: true }),
      // ผู้สมัครที่สมัครมาเองในใบขอเดียวกัน
      app({ id: 'a1b2c3d4-0000-4000-8000-000000000003', phone: '0812345670', channel_label: 'Facebook', created_by_name: undefined }),
      // ใบจาก Scrap ที่ So Scraping ไม่มีคนนั้นแล้ว
      app({ id: 'a1b2c3d4-0000-4000-8000-000000000004', phone: '0812345671' }),
    ],
    [
      scrap({ candidate_id: '00000000-0000-4000-8000-00000000000a', in_jarvis: { application_id: 'a1b2c3d4-0000-4000-8000-000000000001', is_lead: false, lead_by_name: null } }),
      scrap({ candidate_id: '00000000-0000-4000-8000-00000000000b', phone: '0812345679', in_jarvis: { application_id: 'a1b2c3d4-0000-4000-8000-000000000002', is_lead: false, lead_by_name: null, claimed: true } }),
      scrap({ candidate_id: '00000000-0000-4000-8000-00000000000c', phone: '0812345670', in_jarvis: { application_id: 'a1b2c3d4-0000-4000-8000-000000000003', is_lead: false, lead_by_name: null } }),
      // ยังไม่มีใครแตะ
      scrap({ candidate_id: '00000000-0000-4000-8000-00000000000d', phone: '0899999999' }),
      // เบอร์เดียวกันในใบขอเดียวกันอีกแถว = แถวเดียว
      scrap({ candidate_id: '00000000-0000-4000-8000-00000000000e', phone: '0899999999' }),
      // อยู่ในการติดต่อของคนอื่น (ใบมองไม่เห็น)
      scrap({ candidate_id: '00000000-0000-4000-8000-00000000000f', phone: '0877777777', in_jarvis: { application_id: 'a1b2c3d4-0000-4000-8000-0000000000ff', is_lead: true, lead_by_name: 'แบงค์' } }),
      // ไม่มีเบอร์
      scrap({ candidate_id: '00000000-0000-4000-8000-000000000010', phone: null, full_name: 'ผู้สมัครซ่อนชื่อ' }),
    ],
  );
  it('แต่ละคนอยู่ชิปที่ถูก', () => {
    const view = (id: string) => rows.find((r) => r.app.id === id)?.view;
    expect(view('a1b2c3d4-0000-4000-8000-000000000001')).toBe('interested');
    expect(view('a1b2c3d4-0000-4000-8000-000000000002')).toBe('scrap_contact');
    expect(view('a1b2c3d4-0000-4000-8000-000000000003')).toBe('scrap_applicant');
    expect(view('a1b2c3d4-0000-4000-8000-000000000004')).toBe('not_sent');
    expect(view(scrapVirtualId({ request_no: 'LBA6911012', candidate_id: '00000000-0000-4000-8000-00000000000d' }))).toBe('not_sent');
    expect(view(scrapVirtualId({ request_no: 'LBA6911012', candidate_id: '00000000-0000-4000-8000-00000000000f' }))).toBe('scrap_contact');
    expect(view(scrapVirtualId({ request_no: 'LBA6911012', candidate_id: '00000000-0000-4000-8000-000000000010' }))).toBe('scrap_no_phone');
    expect(rows.filter((r) => r.app.phone === '0899999999')).toHaveLength(1);
  });
  it('ใบเสมือนเท่านั้นที่ virtual · ใบจาก Scrap ที่ไม่มีคนในรายชื่อแล้วยังขึ้น (ผลประเมินไม่รู้)', () => {
    expect(rows.filter((r) => r.virtual)).toHaveLength(3);
    expect(rows.find((r) => r.app.id === 'a1b2c3d4-0000-4000-8000-000000000004')?.scrap).toBeNull();
  });
  it('เลขชิปรวมกัน = รายชื่อทั้งหมด', () => {
    const c = countScrapViews(rows);
    const sum = SCRAP_LIST_VIEWS.filter((v) => v !== 'all').reduce((n, v) => n + c[v], 0);
    expect(c.all).toBe(rows.length);
    expect(sum).toBe(c.all);
  });
});

describe('คำบนแถวของคนจาก Scrap (ตรวจบนเว็บจริง 25 พ.ย. 2569)', () => {
  it('ใบจาก Scrap ที่ยังไม่ส่ง = "Scrap ยังไม่กดส่ง AI" ไม่ใช่ "เพิ่มเอง/นำเข้า"', () => {
    expect(notSentReasonOf(app())).toBe('Scrap ยังไม่กดส่ง AI');
  });
  it('คนที่ยังไม่มีใบ บอกชิปของตัวเอง · ปุ่มเก็บ/ส่งกดไม่ได้เมื่อไม่ใช่ "ไม่ได้ส่ง AI"', () => {
    expect(scrapVirtualStatus({ view: 'scrap_no_phone', scrap: null }).title).toBe('ไม่มีเบอร์');
    expect(scrapVirtualStatus({ view: 'scrap_contact', scrap: scrap({ in_jarvis: { application_id: 'x', is_lead: true, lead_by_name: 'แบงค์' } }) }).detail).toBe('ของ แบงค์');
    expect(scrapVirtualStatus({ view: 'not_sent', scrap: null }).title).toBe('ไม่ได้ส่ง AI');
    const t = read('src/components/recruit-rm/RmTable.tsx');
    expect(t).toContain("if (sw?.virtual && sw.view !== 'not_sent' && a !== 'view') {");
  });
  it('คำนำหน้าที่แยกเป็นคำไม่ใช่ชื่อ · ติดกับชื่อไม่เดาตัด', () => {
    expect(scrapSplitName('นาย ณัฐพล เกตุอินทร์')).toEqual({ first: 'ณัฐพล', last: 'เกตุอินทร์' });
    expect(scrapSplitName('นายณัฐพล เกตุอินทร์')).toEqual({ first: 'นายณัฐพล', last: 'เกตุอินทร์' });
  });
});

describe('ใบจาก Scrap แยกจากผู้สมัคร', () => {
  it('ดูจากช่องทาง "Scrap · …" (คอมเมนต์ So Scraping ไม่ใช่)', () => {
    expect(scrapWebOfChannel('Scrap · JobThai')).toBe('JobThai');
    expect(scrapWebOfChannel('Facebook คอมเมนต์')).toBeNull();
    expect(isScrapApplication({ channel_label: 'Scrap · JobBKK' })).toBe(true);
    expect(isScrapApplication({ channel_label: null })).toBe(false);
  });
  it('แท็บผู้สมัครตัดใบจาก Scrap ออก · แท็บ Scrap บนกล่องงานใช้ตารางผู้สมัคร', () => {
    const ws = read('src/components/recruit-rm/RmWorkspace.tsx');
    expect(ws).toContain('rows.filter((r) => !isScrapApplication(r))');
    expect(ws).toContain('filterApplications(candidateRows, tab, rmFilters, keyword, everyoneContact, Boolean(jobAll))');
    expect(ws).toContain('resolveScrapApplicationIds(aiConfirmIds)');
    const page = read('src/pages/jobs/StaffJobBoardPage.tsx');
    expect(page).toContain('<RmWorkspace key="scrap" tab="candidates" scrap');
    expect(page).not.toContain('ScrapCandidatesPanel');
  });
  it('server: สร้างใบอย่างเดียว (apply) ไม่เก็บ Lead · ใบเดิมของใบขออื่น = ข้าม', () => {
    const h = read('api/_handlers/scrap-candidates.ts');
    expect(h).toContain("body.action !== 'to_contact' && body.action !== 'apply'");
    const lib = read('api/_lib/scrapCandidates.ts');
    expect(lib).toContain("if (appId && mode === 'lead') {");
    expect(lib).toContain("if (mode === 'apply' && rows[0] && rows[0].job_id !== job.id)");
  });
});

describe('บท AI ของคนจาก Scrap', () => {
  it('อยู่ในหน้าตั้งค่าบทโทร · ตัวแปรรู้จักครบ', () => {
    expect(EDITABLE_SCRIPT_KEYS).toContain('scrap');
    for (const line of EDITABLE_SCRIPT_DEFAULTS.scrap) {
      for (const m of line.matchAll(/\{([^{}]+)\}/g)) expect(KNOWN_PLACEHOLDERS).toContain(m[1]);
    }
  });
  it('ประโยคแรก "เห็นประวัติ…บนเว็บ …" ไม่มี "ฝากใบสมัคร" · ไม่มีชื่อก็ไม่มีคำค้าง', () => {
    const facts = { position: 'แม่บ้าน', unit: 'อาคาร A', monthlyIncome: 12000, web: 'JobBKK' };
    const q = buildScrapQuestions({ ...facts, candidateName: 'นายสมชาย ใจดี' });
    expect(q[0]).toContain('เห็นประวัติคุณสมชาย ใจดี บนเว็บ JobBKK ค่ะ');
    expect(q.join(' ')).not.toContain('ฝากใบสมัคร');
    expect(buildScrapQuestions({ ...facts, candidateName: '' })[0]).toMatch(/^เห็นประวัติบนเว็บ JobBKK ค่ะ/);
  });
  it('ตัวส่ง: มีเว็บ = บท Scrap · ไม่มี = บทผู้สมัครคีย์เองเหมือนเดิม', () => {
    const a = { id: 'a1b2c3d4-0000-4000-8000-000000000001', full_name: 'นายสมชาย ใจดี', phone: '0812345678', job_id: 'siamraj-sql:LBA6911012' };
    const facts = { loaded: true, found: true, positionTitle: 'แม่บ้าน', unitName: 'อาคาร A', monthlyIncome: 12000 };
    const withWeb = buildApplicationInterviewPayload(a, undefined, null, facts, 'JobThai');
    expect(withWeb?.questions[0]).toContain('บนเว็บ JobThai');
    const keyed = buildApplicationInterviewPayload(a, undefined, null, facts, null);
    expect(keyed?.questions[0]).toContain('เคยฝากใบสมัครไว้กับเรา');
  });
  it('ตัวส่งเลือกบทจากช่องทางบนใบทุกใบ · คนจาก Scrap ไม่มีชื่อ = ไม่ส่ง AI', () => {
    const d = read('api/_lib/lumosDispatch.ts');
    expect(d).toContain('scrapWeb = await scrapWebByApplicationId(applications.map((a) => a.id));');
    expect(d).toContain('SCRAP_NO_NAME_REASON');
  });
});
