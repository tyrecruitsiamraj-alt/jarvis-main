import { describe, it, expect } from 'vitest';
import { filterAndSortMatchingJobs, type MatchingListQuery } from '@/lib/matchingListFilter';
import type { JobRequest } from '@/types';

/** ใบขอขั้นต่ำสำหรับ pipeline — ฟิลด์ที่ตัวกรอง/เรียงใช้จริง */
function job(partial: Partial<JobRequest> & { id: string }): JobRequest {
  return {
    request_positions: 1,
    inform_qty: 0,
    cancel_qty: 0,
    job_type: 'permanent',
    job_category: 'office',
    total_income: 10000,
    location_address: 'กรุงเทพ',
    unit_name: 'หน่วยงาน ก',
    status: 'open',
    urgency: 'normal',
    request_date: '2026-07-01',
    required_date: '2026-07-15',
    ...partial,
  } as unknown as JobRequest;
}

const baseQuery: MatchingListQuery = {
  search: '',
  urgentOnly: false,
  unitFilter: '',
  workflowFilter: 'all',
};

const noCtx = {
  hasReserved: () => false,
  matchesFor: () => undefined,
};

describe('filterAndSortMatchingJobs', () => {
  const today = new Date('2026-07-22T09:00:00+07:00');

  it('urgentOnly + unit + search filters compose', () => {
    const jobs = [
      job({ id: 'a', urgency: 'urgent', unit_name: 'โตโยต้า', location_address: 'บางนา' }),
      job({ id: 'b', urgency: 'normal', unit_name: 'โตโยต้า' }),
      job({ id: 'c', urgency: 'urgent', unit_name: 'ฮอนด้า' }),
    ];
    expect(
      filterAndSortMatchingJobs(jobs, { ...baseQuery, urgentOnly: true }, { ...noCtx, today }).map((j) => j.id),
    ).toEqual(['a', 'c']);
    expect(
      filterAndSortMatchingJobs(jobs, { ...baseQuery, unitFilter: 'โตโยต้า' }, { ...noCtx, today }).map((j) => j.id),
    ).toEqual(['b', 'a'].sort((x, y) => (x === 'a' ? -1 : 1)) as string[]); // urgent ขึ้นก่อน
    expect(
      filterAndSortMatchingJobs(jobs, { ...baseQuery, search: 'บางนา' }, { ...noCtx, today }).map((j) => j.id),
    ).toEqual(['a']);
  });

  it('buFilter keeps only the selected BU และเทียบแบบไม่สนตัวพิมพ์/ช่องว่าง', () => {
    const jobs = [
      job({ id: 'lbd', department_code: 'LBD' }),
      job({ id: 'lba', department_code: 'LBA' }),
      job({ id: 'lbd-messy', department_code: ' lbd ' }),
      job({ id: 'no-bu', department_code: undefined }),
    ];
    expect(
      filterAndSortMatchingJobs(jobs, { ...baseQuery, buFilter: 'LBD' }, { ...noCtx, today }).map((j) => j.id),
    ).toEqual(['lbd', 'lbd-messy']);
    // ผู้ใช้พิมพ์/ลิงก์มาเป็นตัวเล็กก็ต้องได้ชุดเดียวกัน
    expect(
      filterAndSortMatchingJobs(jobs, { ...baseQuery, buFilter: 'lbd' }, { ...noCtx, today }).map((j) => j.id),
    ).toEqual(['lbd', 'lbd-messy']);
    // '' / ไม่ส่งมา = ทุก BU (ใบที่ไม่มีรหัสก็ยังเห็น)
    expect(
      filterAndSortMatchingJobs(jobs, { ...baseQuery, buFilter: '' }, { ...noCtx, today }).map((j) => j.id),
    ).toEqual(['lbd', 'lba', 'lbd-messy', 'no-bu']);
    expect(filterAndSortMatchingJobs(jobs, baseQuery, { ...noCtx, today })).toHaveLength(4);
  });

  it('buFilter composes with the other filters', () => {
    const jobs = [
      job({ id: 'lbd-urgent', department_code: 'LBD', urgency: 'urgent' }),
      job({ id: 'lbd-normal', department_code: 'LBD', urgency: 'normal' }),
      job({ id: 'lba-urgent', department_code: 'LBA', urgency: 'urgent' }),
    ];
    expect(
      filterAndSortMatchingJobs(
        jobs,
        { ...baseQuery, buFilter: 'LBD', urgentOnly: true },
        { ...noCtx, today },
      ).map((j) => j.id),
    ).toEqual(['lbd-urgent']);
  });

  it('workflow=reserved uses the reserved lookup', () => {
    const jobs = [job({ id: 'a' }), job({ id: 'b' })];
    const out = filterAndSortMatchingJobs(
      jobs,
      { ...baseQuery, workflowFilter: 'reserved' },
      { ...noCtx, hasReserved: (id) => id === 'b', today },
    );
    expect(out.map((j) => j.id)).toEqual(['b']);
  });

  it('workflow=green/yellow/none respects analyzed-only semantics', () => {
    const jobs = [job({ id: 'g' }), job({ id: 'y' }), job({ id: 'n' }), job({ id: 'unanalyzed' })];
    const matchesFor = (id: string) =>
      id === 'g'
        ? [{ tier: 'green' as const }, { tier: 'yellow' as const }]
        : id === 'y'
          ? [{ tier: 'yellow' as const }]
          : id === 'n'
            ? [{ tier: 'red' as const }]
            : undefined;
    const run = (wf: MatchingListQuery['workflowFilter']) =>
      filterAndSortMatchingJobs(jobs, { ...baseQuery, workflowFilter: wf }, { ...noCtx, matchesFor, today }).map(
        (j) => j.id,
      );
    expect(run('green')).toEqual(['g']);
    expect(run('yellow')).toEqual(['y']); // มี green แล้วไม่นับ yellow
    expect(run('none')).toEqual(['n']); // วิเคราะห์แล้วแต่ไม่มีแนะนำ — ใบที่ยังไม่วิเคราะห์ไม่โผล่
    // recommended = เขียว**หรือ**เหลือง — ลิงก์ "AI แนะนำคนแล้ว" จากหน้าแรกใช้
    // ต้องนับตรงกับ with_recommend ของ flow-summary (green ∪ yellow ไม่ใช่ green อย่างเดียว)
    expect(run('recommended')).toEqual(['g', 'y']);
  });

  it('sorts breached SLA first, then urgent, then earliest required date', () => {
    const jobs = [
      job({ id: 'normal-late', urgency: 'normal', request_date: '2026-07-20', required_date: '2026-08-30' }),
      job({ id: 'urgent-soon', urgency: 'urgent', request_date: '2026-07-20', required_date: '2026-07-25' }),
      // retroactive เก่ามาก → SLA breached (7 วันจากวันกรอก)
      job({ id: 'breached', urgency: 'normal', request_date: '2026-05-01', required_date: '2026-04-25' }),
    ];
    const out = filterAndSortMatchingJobs(jobs, baseQuery, { ...noCtx, today }).map((j) => j.id);
    expect(out[0]).toBe('breached');
    expect(out[1]).toBe('urgent-soon');
    expect(out[2]).toBe('normal-late');
  });
});

describe('การเรียงลิสต์ (sort)', () => {
  const today = new Date('2026-07-22T09:00:00+07:00');
  // request_date ต่างกัน → อายุใบขอต่างกัน (retroactive = นับจากวันที่กรอก)
  const oldJob = job({ id: 'old', request_date: '2026-05-01', required_date: '2026-04-25' });
  const midJob = job({ id: 'mid', request_date: '2026-07-01', required_date: '2026-06-28' });
  const newJob = job({ id: 'new', request_date: '2026-07-20', required_date: '2026-07-18' });
  const jobs = [midJob, newJob, oldJob];

  it('age_desc = ค้างนานสุดก่อน · age_asc = ใหม่สุดก่อน', () => {
    const desc = filterAndSortMatchingJobs(jobs, { ...baseQuery, sort: 'age_desc' }, { ...noCtx, today });
    const asc = filterAndSortMatchingJobs(jobs, { ...baseQuery, sort: 'age_asc' }, { ...noCtx, today });
    expect(desc.map((j) => j.id)).toEqual(['old', 'mid', 'new']);
    expect(asc.map((j) => j.id)).toEqual(['new', 'mid', 'old']);
  });

  it('recommend = ใบที่ AI แนะนำได้ขึ้นก่อน · no_recommend = สลับด้าน', () => {
    const withRec = [job({ id: 'has' }), job({ id: 'none' })];
    const ctx = {
      ...noCtx,
      today,
      matchesFor: (id: string) => (id === 'has' ? [{ tier: 'green' as const }] : [{ tier: 'red' as const }]),
    };
    expect(
      filterAndSortMatchingJobs(withRec, { ...baseQuery, sort: 'recommend' }, ctx).map((j) => j.id),
    ).toEqual(['has', 'none']);
    expect(
      filterAndSortMatchingJobs(withRec, { ...baseQuery, sort: 'no_recommend' }, ctx).map((j) => j.id),
    ).toEqual(['none', 'has']);
  });

  it('ไม่ส่ง sort = พฤติกรรมเดิม (SLA เกินขึ้นก่อน) ต้องไม่เปลี่ยน', () => {
    const out = filterAndSortMatchingJobs(jobs, baseQuery, { ...noCtx, today });
    expect(out[0].id).toBe('old'); // retroactive เก่ามาก → breached
  });
});
