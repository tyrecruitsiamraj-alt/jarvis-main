/**
 * ตัวกรอง+การเรียงของลิสต์ใบขอหน้า Matching — แยกเป็น pure function
 * เพื่อให้ "โค้ดชุดเดียวกัน" รันทั้งฝั่ง client (MatchingPage) และฝั่ง server
 * (/api/matching/list สำหรับ server-side pagination) — ผลลัพธ์ตรงกันโดยโครงสร้าง
 *
 * ห้ามใส่ dependency ที่ผูกกับ browser (window/localStorage) ในไฟล์นี้
 */
import type { JobRequest } from '@/types';
import { unitRequestSearchBlob } from '@/lib/unitRequestDisplay';
import { jobToRequestControlRecord } from '@/lib/requestControl';
import { recommendedCandidateCount, type CandidateMatchTier } from '@/lib/matchingProgress';
import { getJobRequestAgeDays } from '@/lib/jobUrgency';

/** `recommended` = มีคนแนะนำ (เขียว**หรือ**เหลือง) — คู่กับตัวเลข "AI แนะนำคนแล้ว" บนหน้าแรก */
export type MatchingWorkflowFilter =
  | 'all'
  | 'sla'
  | 'green'
  | 'yellow'
  | 'recommended'
  | 'none'
  | 'reserved';

/**
 * การเรียงลิสต์ใบขอ
 * default    = SLA เกิน/เสี่ยง แล้วงานด่วน แล้ววันที่ต้องการเร็วสุด (ของเดิม ห้ามเปลี่ยนพฤติกรรม)
 * age_desc   = ค้างนานสุดก่อน · age_asc = ใบใหม่สุดก่อน
 * recommend  = ใบที่ AI แนะนำคนได้แล้วขึ้นก่อน · no_recommend = ใบที่ยังไม่มีคนแนะนำขึ้นก่อน
 * green_desc = ใบที่มี "คนเขียว" มากสุดขึ้นก่อน (เจ้าของสั่ง 14 ส.ค. 2569 — ตัวกรอง "มีคนแนะนำ")
 */
export type MatchingListSort =
  | 'default'
  | 'age_desc'
  | 'age_asc'
  | 'recommend'
  | 'no_recommend'
  | 'green_desc';

export const MATCHING_LIST_SORTS: MatchingListSort[] = [
  'default',
  'age_desc',
  'age_asc',
  'recommend',
  'no_recommend',
  'green_desc',
];

/** จำนวน "คนเขียว" (tier=green) ต่อใบ — ใบที่ AI ยังไม่ประเมิน (undefined) = 0 */
export function greenCandidateCount(
  matches: ReadonlyArray<{ tier: CandidateMatchTier }> | undefined,
): number {
  if (!matches) return 0;
  let n = 0;
  for (const m of matches) if (m.tier === 'green') n += 1;
  return n;
}

export function normalizeMatchingListSort(v: unknown): MatchingListSort {
  return typeof v === 'string' && (MATCHING_LIST_SORTS as string[]).includes(v)
    ? (v as MatchingListSort)
    : 'default';
}

export type MatchingListQuery = {
  /** คำค้น (จะถูก trim/lowercase ในนี้) */
  search: string;
  urgentOnly: boolean;
  /** ชื่อหน่วยงานแบบตรงตัว — '' = ทั้งหมด */
  unitFilter: string;
  workflowFilter: MatchingWorkflowFilter;
  /** รหัส BU/แผนกของใบขอ (department_code เช่น 'LBD') — ''/undefined = ทุก BU */
  buFilter?: string;
  /** การเรียง — ไม่ส่ง = 'default' (ของเดิม) */
  sort?: MatchingListSort;
};

export type MatchingListContext = {
  /** ใบขอนี้มีการจองตัว (proposal status = reserved) แล้วหรือยัง */
  hasReserved: (jobId: string) => boolean;
  /** ผล AI แมทของใบขอ (undefined = ยังไม่เคยวิเคราะห์) */
  matchesFor: (jobId: string) => ReadonlyArray<{ tier: CandidateMatchTier }> | undefined;
  today?: Date;
};

/** ตรรกะเดิมจาก rows useMemo ของ MatchingPage — ย้ายมาทั้งก้อน ห้ามแก้พฤติกรรม */
export function filterAndSortMatchingJobs(
  jobs: JobRequest[],
  query: MatchingListQuery,
  ctx: MatchingListContext,
): JobRequest[] {
  const q = query.search.trim().toLowerCase();
  const bu = (query.buFilter || '').trim().toUpperCase();
  const sort = query.sort ?? 'default';
  const today = ctx.today ?? new Date();
  return jobs
    .filter((j) => (query.urgentOnly ? j.urgency === 'urgent' : true))
    .filter((j) => (bu ? (j.department_code || '').trim().toUpperCase() === bu : true))
    .filter((j) => (query.unitFilter ? j.unit_name === query.unitFilter : true))
    .filter((j) => (q ? unitRequestSearchBlob(j).includes(q) : true))
    .filter((j) => {
      if (query.workflowFilter === 'all') return true;
      if (query.workflowFilter === 'sla') {
        const status = jobToRequestControlRecord(j, today).slaStatus;
        return status === 'at_risk' || status === 'breached';
      }
      if (query.workflowFilter === 'reserved') {
        return ctx.hasReserved(j.id);
      }
      const matches = ctx.matchesFor(j.id);
      if (!matches) return false;
      if (query.workflowFilter === 'green') return matches.some((match) => match.tier === 'green');
      if (query.workflowFilter === 'yellow') {
        return !matches.some((match) => match.tier === 'green') && matches.some((match) => match.tier === 'yellow');
      }
      // 'recommended' = เขียวหรือเหลือง — ต้องนับตรงกับ with_recommend ของ flow-summary
      // (นิยามเดียวกับ recommendedCandidateCount ที่ตัวเลขบนการ์ดใช้)
      if (query.workflowFilter === 'recommended') return recommendedCandidateCount(matches) > 0;
      return recommendedCandidateCount(matches) === 0;
    })
    .sort((a, b) => {
      // เรียงตามอายุใบขอ (จำนวนวันที่ค้าง) — ใบที่ไม่รู้อายุไปท้ายสุดทั้งสองทิศ ไม่ให้ปนกับของจริง
      if (sort === 'age_desc' || sort === 'age_asc') {
        const da = getJobRequestAgeDays(a, today);
        const db = getJobRequestAgeDays(b, today);
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        if (da !== db) return sort === 'age_desc' ? db - da : da - db;
        return (a.required_date || '').localeCompare(b.required_date || '');
      }

      // เรียงตาม "มี/ไม่มีคนแนะนำ" — ในกลุ่มเดียวกันยังเรียงด้วยตรรกะเดิม (SLA/ด่วน) ต่อ
      if (sort === 'recommend' || sort === 'no_recommend') {
        const hasRec = (job: JobRequest) => {
          const matches = ctx.matchesFor(job.id);
          return matches ? recommendedCandidateCount(matches) > 0 : false;
        };
        const ra = hasRec(a) ? 0 : 1;
        const rb = hasRec(b) ? 0 : 1;
        if (ra !== rb) return sort === 'recommend' ? ra - rb : rb - ra;
      }

      // เรียง "คนเขียวมากสุดก่อน" — ใบที่ตรงสเปคชัด (เขียวเยอะ) ควรได้ทำก่อน
      // จำนวนเท่ากันตกลงไปตรรกะเดิม (SLA/ด่วน) เหมือนทุก sort
      if (sort === 'green_desc') {
        const ga = greenCandidateCount(ctx.matchesFor(a.id));
        const gb = greenCandidateCount(ctx.matchesFor(b.id));
        if (ga !== gb) return gb - ga;
      }

      // SLA เกิน/เสี่ยงขึ้นก่อน ตามด้วยงานด่วนและวันที่ต้องการเร็วสุด
      const slaRank = (job: JobRequest) => {
        const status = jobToRequestControlRecord(job, today).slaStatus;
        return status === 'breached' ? 0 : status === 'at_risk' ? 1 : 2;
      };
      const sa = slaRank(a);
      const sb = slaRank(b);
      if (sa !== sb) return sa - sb;
      const ua = a.urgency === 'urgent' ? 0 : 1;
      const ub = b.urgency === 'urgent' ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return (a.required_date || '').localeCompare(b.required_date || '');
    });
}
