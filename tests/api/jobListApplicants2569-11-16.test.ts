import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { boardApplicantsPathOfJob, matchesApplicantPresenceFilter } from '../../src/lib/jobListApplicants';
import { buildJobListSearchParams, parseJobListSearchParams, JOB_LIST_DEFAULTS } from '../../src/lib/jobListPageState';
import { compareJobsByTableColumn, JOB_LIST_TABLE_COLUMN_LABEL } from '../../src/lib/jobListTableSort';
import type { JobRequest } from '@/types';

/** เจ้าของ 16 พ.ย. 2569: "มีรายชื่อคนกรอกเข้ามาเท่าไหร่บ้างของแต่ละใบ แล้วก็ให้มี Filter ดูได้ว่าใบไหนที่ยังไม่มีคน" */
const job = (id: string, request_no: string): JobRequest =>
  ({ id, request_no, unit_name: 'กฟภ.อยุธยา', location_address: '', status: 'open', urgency: 'advance', total_income: 0, job_type: 'driver', job_category: 'government', penalty_per_day: 0, days_without_worker: 0, total_penalty: 0, request_date: '2025-08-01', created_at: '2025-08-01T00:00:00.000Z' }) as JobRequest;

describe('หน้าใบขอ: คนกรอกต่อใบ + ตัวกรองยังไม่มีคน', () => {
  it('ตัวกรอง: ยังไม่มีคน = 0 · มีคนแล้ว = มากกว่า 0 · ไม่เลือก = ทุกใบ', () => {
    expect(matchesApplicantPresenceFilter(0, ['none'])).toBe(true);
    expect(matchesApplicantPresenceFilter(3, ['none'])).toBe(false);
    expect(matchesApplicantPresenceFilter(3, ['some'])).toBe(true);
    expect(matchesApplicantPresenceFilter(0, ['none', 'some'])).toBe(true);
    expect(matchesApplicantPresenceFilter(null, [])).toBe(true);
  });

  it('ยังโหลดยอดไม่ได้ (null) ห้ามนับว่ายังไม่มีคน', () => {
    expect(matchesApplicantPresenceFilter(null, ['none'])).toBe(false);
    expect(matchesApplicantPresenceFilter(null, ['some'])).toBe(false);
  });

  it('เก็บลง URL เป็น ap= และอ่านกลับได้ · ค่าแปลกถูกทิ้ง', () => {
    const p = buildJobListSearchParams({ ...JOB_LIST_DEFAULTS, applicantFilter: ['none'] });
    expect(p.get('ap')).toBe('none');
    expect(parseJobListSearchParams(p).applicantFilter).toEqual(['none']);
    expect(parseJobListSearchParams(new URLSearchParams('ap=none,xx')).applicantFilter).toEqual(['none']);
    expect(buildJobListSearchParams(JOB_LIST_DEFAULTS).has('ap')).toBe(false);
  });

  it('กดหัวคอลัมน์ "คนกรอก" เรียงตามยอดจริง · ยังไม่รู้ยอดตกท้าย', () => {
    expect(JOB_LIST_TABLE_COLUMN_LABEL.applicants).toBe('คนกรอก');
    const counts: Record<string, number | null> = { a: 2, b: 9, c: null, d: 0 };
    const ctx = { applicantCount: (j: JobRequest) => counts[j.id] ?? null };
    const jobs = [job('a', 'OPL6808001'), job('b', 'OPL6808002'), job('c', 'OPL6808003'), job('d', 'OPL6808004')];
    const desc = [...jobs].sort((x, y) => compareJobsByTableColumn(x, y, { column: 'applicants', dir: 'desc' }, undefined, ctx));
    expect(desc.map((j) => j.id)).toEqual(['b', 'a', 'd', 'c']);
    const asc = [...jobs].sort((x, y) => compareJobsByTableColumn(x, y, { column: 'applicants', dir: 'asc' }, undefined, ctx));
    expect(asc.map((j) => j.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('กดเลข = แท็บผู้สมัครของกล่องงาน กรองใบนั้น ขึ้นทุกคน (ชุดเดียวกับปุ่ม "ดูรายชื่อ" บนการ์ด)', () => {
    const path = boardApplicantsPathOfJob('siamraj-sql:OPL6808001');
    const q = new URLSearchParams(path.split('?')[1]);
    expect(path.startsWith('/jobs/board?')).toBe(true);
    expect(q.get('view')).toBe('list');
    expect(q.get('list')).toBe('all');
    expect(q.getAll('a.job')).toEqual(['siamraj-sql:OPL6808001']);
    expect(q.get('joball')).toBe('siamraj-sql:OPL6808001');
    const page = readFileSync('src/pages/jobs/JobListPage.tsx', 'utf8');
    expect(page).toContain('navigate(boardApplicantsPathOfJob(applicantKeyIdx.get(j.id)?.key ?? j.id), { state: { backTo: returnTo } })');
    // ← บนกล่องงานกลับหน้าใบขอเดิม (เจ้าของ 16 พ.ย. 2569 "ทำไมเวลากดย้อนกลับถึงไม่กลับหน้าเดิม")
    const board = readFileSync('src/components/jobs/JobBoardView.tsx', 'utf8');
    expect(board).toContain('backPath={backTo}');
    expect(board).toContain("sanitizeUnitReturnTo((location.state as { backTo?: unknown } | null)?.backTo) ?? '/'");
  });

  it('หน้าใบขอ: ยอดตัวเดียวกับกล่องงาน · มีตัวกรอง · โหลดไม่ได้บอกบนจอ', () => {
    const page = readFileSync('src/pages/jobs/JobListPage.tsx', 'utf8');
    expect(page).toContain('fetchJobApplicationCounts()');
    expect(page).toContain("['applicants', 'center']");
    expect(page).toContain('id="job-list-applicants"');
    expect(page).toContain('matchesApplicantPresenceFilter(applicantCountOf(j), applicantFilter)');
    expect(page).toContain('message="โหลดยอดคนกรอกไม่ได้"');
  });
});
