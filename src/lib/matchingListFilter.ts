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

export type MatchingWorkflowFilter = 'all' | 'sla' | 'green' | 'yellow' | 'none' | 'reserved';

export type MatchingListQuery = {
  /** คำค้น (จะถูก trim/lowercase ในนี้) */
  search: string;
  urgentOnly: boolean;
  /** ชื่อหน่วยงานแบบตรงตัว — '' = ทั้งหมด */
  unitFilter: string;
  workflowFilter: MatchingWorkflowFilter;
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
  const today = ctx.today ?? new Date();
  return jobs
    .filter((j) => (query.urgentOnly ? j.urgency === 'urgent' : true))
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
      return recommendedCandidateCount(matches) === 0;
    })
    .sort((a, b) => {
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
