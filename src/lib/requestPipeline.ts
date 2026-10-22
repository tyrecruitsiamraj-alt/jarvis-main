/**
 * ═══ เส้นใบขอ 12 ขั้น · อายุใบขอ · ส่งคนแทน · ค่าปรับ (หน้าหลัก แท็บใบขอ · เจ้าของ 22 ต.ค. 2569) ═══
 *
 * > *"ลองนึกภาพว่ามันเป็นเส้นยาว 1. ใบขอเข้ามา 2. ไปหาทีมออนไลน์เพื่อประกาศ … 12. ปิดใบขอ ·
 * > ทุกใบต้องบอกได้ว่า ใบขอ ก ผ่านมาแล้วกี่วัน มีคนสนใจใบนี้กี่คน ติดตรงไหนปิดไม่ได้ · เคยส่งคนแทนไหม … ค่าปรับเท่าไหร่ ·
 * > เหลือใบขอกี่ใบ ค้างนานกว่า 60 วันกี่ใบ มากกว่า 30 วันกี่ใบ ต่ำกว่า 30 วันกี่ใบ"*
 *
 * Choice เจ้าของ:
 * - ผ่านมากี่วัน = ตัวเดียวกับเมนูใบขอ (`getJobRequestAgeDays` · ล่วงหน้ายังไม่ถึงวัน = "ล่วงหน้า") · วันทำงานของไซต์
 * - ส่งคนแทน = หน้าติดตามส่งคนแทน (ส่งไปไซต์ไหน วันไหน) · นับวันทำงานแบบเดียวกัน
 * - ค่าปรับ/ลดมูลค่า = ตามที่ใบนั้นมีใน ERP (บางใบมีอย่างเดียว บางใบมีทั้งคู่) × วันโดนปรับ
 *   วันโดนปรับ = ผ่านมา − วันที่ส่งคนแทนได้ (ตัวอย่างเจ้าของ: ผ่านมา 50 ส่งคนแทน 49 = ปรับ 1 วัน)
 * - คนแทนหลายคนวันเดียวกันที่ไซต์เดียวกัน = ครอบใบที่ค้างนานสุดก่อน ทีละใบ (ไม่นับซ้ำ)
 * 🔴 ตัวนับคนใช้ตัวเดียวกับภาพรวมงานสรรหา (`isAiSaidYes` · `isStaffFollowed` · `isFollowedReached`) · ตรรกะล้วน มีเทสต์
 */
import { effectiveRequestDateYmd, getJobRequestAgeDays, isBeforeRequiredForAge } from './jobUrgency';
import { countWorkingDays, parseWorkWeekdays } from './siteWorkdays';
import { isAiSaidYes, isFollowedReached, isStaffFollowed } from './recruitOverview';
import type { RecruitAppFact } from './recruitOverviewTypes';
import type { RequestPipelineResponse } from './requestPipelineTypes';
import type { JobRequest } from '../types';

export type PipelineStepKey =
  | 'request'
  | 'released'
  | 'apps'
  | 'ai'
  | 'staff'
  | 'interested'
  | 'appointment'
  | 'showed'
  | 'passed'
  | 'follow'
  | 'aftercare'
  | 'closed';

/** 12 ขั้นตามที่เจ้าของเล่า · `stuck` = ป้ายตอนใบติดอยู่ขั้นนี้ */
export const PIPELINE_STEPS: ReadonlyArray<{ key: PipelineStepKey; no: number; label: string; stuck: string }> = [
  { key: 'request', no: 1, label: 'ใบขอเข้ามา', stuck: 'ใบขอเข้ามา' },
  { key: 'released', no: 2, label: 'ประกาศ / โพสต์', stuck: 'ยังไม่ประกาศ' },
  { key: 'apps', no: 3, label: 'รายชื่อเข้ามา', stuck: 'ยังไม่มีคนกรอก' },
  { key: 'ai', no: 4, label: 'AI โทรคัดกรอง', stuck: 'ยังไม่มีใครโทร' },
  { key: 'staff', no: 5, label: 'คนโทรต่อกลุ่มสนใจ', stuck: 'ยังไม่มีคนสนใจ' },
  { key: 'interested', no: 6, label: 'ติดต่อได้ · สนใจ', stuck: 'ยังติดต่อไม่ได้' },
  { key: 'appointment', no: 7, label: 'นัดได้', stuck: 'ยังนัดไม่ได้' },
  { key: 'showed', no: 8, label: 'มาตามนัด', stuck: 'นัดแล้วยังไม่มา' },
  { key: 'passed', no: 9, label: 'ผ่าน', stuck: 'มาแล้วยังไม่ผ่าน' },
  { key: 'follow', no: 10, label: 'ติดตามเริ่มงาน / ส่งคนแทน', stuck: 'รอเริ่มงาน' },
  { key: 'aftercare', no: 11, label: 'ดูแลหลังเริ่มงาน', stuck: 'ดูแลหลังเริ่มงาน' },
  { key: 'closed', no: 12, label: 'ปิดใบขอ', stuck: 'ปิดใบขอ' },
];

export type AgeBucket = 'advance' | 'lt30' | 'd30to60' | 'gt60' | 'unknown';
export const AGE_BUCKETS: ReadonlyArray<{ key: AgeBucket; label: string }> = [
  { key: 'advance', label: 'ล่วงหน้า' },
  { key: 'lt30', label: 'ต่ำกว่า 30 วัน' },
  { key: 'd30to60', label: '30–60 วัน' },
  { key: 'gt60', label: 'เกิน 60 วัน' },
  { key: 'unknown', label: 'ไม่มีวันที่' },
];

export function ageBucketOf(advance: boolean, ageDays: number | null): AgeBucket {
  if (advance) return 'advance';
  if (ageDays === null || !Number.isFinite(ageDays)) return 'unknown';
  if (ageDays < 30) return 'lt30';
  if (ageDays <= 60) return 'd30to60';
  return 'gt60';
}

/** คนในแต่ละขั้นของใบหนึ่ง — ทุกก้อนย่อยรวมกันเท่าแม่ */
export type PipelineCounts = {
  apps: number;
  aiCalled: number;
  aiYes: number;
  aiNo: number;
  aiOutOfArea: number;
  aiNoPickup: number;
  aiOther: number;
  staffCalled: number;
  staffFollowed: number;
  staffReached: number;
  interested: number;
  notInterested: number;
  appointed: number;
  apptFailed: number;
  showed: number;
  noShow: number;
  passed: number;
  notPassed: number;
  followStarts: number;
  aftercare: number;
};

/** ผลของ AI แยกขาด (คนละพื้นที่ก่อน · แล้วสนใจ · ไม่สนใจ · ไม่รับสาย · ที่เหลือ = ยังสรุปไม่ได้) */
export function aiResultOf(f: RecruitAppFact): 'outOfArea' | 'yes' | 'no' | 'noPickup' | 'other' {
  if (f.aiOutOfArea) return 'outOfArea';
  if (isAiSaidYes(f)) return 'yes';
  if (f.aiAnswer === 'said_no' || f.aiAnswer === 'wrong_person') return 'no';
  if (f.aiAnswer === 'no_pickup' || f.aiAnswer === 'picked_silent') return 'noPickup';
  return 'other';
}

export function countsOf(facts: readonly RecruitAppFact[], followStarts: number, aftercare: number): PipelineCounts {
  const c: PipelineCounts = {
    apps: facts.length,
    aiCalled: 0,
    aiYes: 0,
    aiNo: 0,
    aiOutOfArea: 0,
    aiNoPickup: 0,
    aiOther: 0,
    staffCalled: 0,
    staffFollowed: 0,
    staffReached: 0,
    interested: 0,
    notInterested: 0,
    appointed: 0,
    apptFailed: 0,
    showed: 0,
    noShow: 0,
    passed: 0,
    notPassed: 0,
    followStarts,
    aftercare,
  };
  for (const f of facts) {
    if (f.calledByStaff) c.staffCalled += 1;
    if (f.calledByAi) {
      c.aiCalled += 1;
      const r = aiResultOf(f);
      if (r === 'yes') c.aiYes += 1;
      else if (r === 'no') c.aiNo += 1;
      else if (r === 'outOfArea') c.aiOutOfArea += 1;
      else if (r === 'noPickup') c.aiNoPickup += 1;
      else c.aiOther += 1;
    }
    if (isStaffFollowed(f)) {
      c.staffFollowed += 1;
      if (isFollowedReached(f)) {
        c.staffReached += 1;
        if (f.staffAnswer === 'said_yes' || f.appointmentAt) c.interested += 1;
        else if (f.staffAnswer === 'said_no' || f.staffAnswer === 'wrong_person') c.notInterested += 1;
      }
    }
    if (f.appointmentAt) c.appointed += 1;
    else if (f.appointmentFailed) c.apptFailed += 1;
    if (f.attendance === 'showed') c.showed += 1;
    else if (f.attendance === 'no_show') c.noShow += 1;
    if (f.screening === 'passed') c.passed += 1;
    else if (f.screening === 'not_passed') c.notPassed += 1;
  }
  return c;
}

/**
 * ใบติดขั้นไหน + เหตุ — ขั้นแรกที่ยังไม่มีใครผ่าน (2–9) · ผ่านครบ = รอเริ่มงาน (10)
 * 22 ต.ค. 2569 เว็บจริง: LBM6903002 ขึ้น "ยังติดต่อไม่ได้" ทั้งที่ยังไม่มีคนโทรต่อสักสาย ⇒ แยกเหตุให้ตรงของจริง
 */
export function stuckOf(released: boolean, c: PipelineCounts): { step: PipelineStepKey; reason: string } {
  if (!released) return { step: 'released', reason: 'ยังไม่ประกาศ' };
  if (c.apps === 0) return { step: 'apps', reason: 'ยังไม่มีคนกรอก' };
  if (c.aiCalled === 0 && c.staffCalled === 0) return { step: 'ai', reason: 'ยังไม่มีใครโทร' };
  if (c.aiYes === 0 && c.interested === 0 && c.appointed === 0) return { step: 'ai', reason: 'โทรแล้วยังไม่มีคนสนใจ' };
  if (c.appointed === 0) {
    if (c.staffFollowed === 0 && c.interested === 0) return { step: 'staff', reason: 'คนยังไม่โทรต่อ' };
    if (c.interested === 0) {
      return { step: 'interested', reason: c.staffReached === 0 ? 'ยังติดต่อไม่ได้' : 'ติดต่อได้แต่ยังไม่สนใจ' };
    }
    return { step: 'appointment', reason: 'ยังนัดไม่ได้' };
  }
  if (c.showed === 0) return { step: 'showed', reason: 'นัดแล้วยังไม่มา' };
  if (c.passed === 0) return { step: 'passed', reason: 'มาแล้วยังไม่ผ่าน' };
  return { step: 'follow', reason: 'รอเริ่มงาน' };
}

/** ขั้นที่ใบติด (เหตุอยู่ `stuckOf`) */
export const stuckStepOf = (released: boolean, c: PipelineCounts): PipelineStepKey => stuckOf(released, c).step;

export type PipelineRequest = {
  job: JobRequest;
  jobId: string;
  requestNo: string;
  site: string | null;
  advance: boolean;
  ageDays: number | null;
  bucket: AgeBucket;
  /** วันเริ่มนับ (ย้อนหลัง = วันกรอก · อื่น ๆ = วันที่ต้องการ) */
  startYmd: string | null;
  released: boolean;
  counts: PipelineCounts;
  stuck: PipelineStepKey;
  /** เหตุที่ติด (คำบนตาราง) */
  stuckReason: string;
  /** วันทำงานที่ส่งคนแทนได้ (ในช่วงที่ผ่านมา) */
  replacedDays: number;
  /** วันโดนปรับ = ผ่านมา − ส่งคนแทนได้ · ล่วงหน้า/ไม่มีวันที่ = null */
  penaltyDays: number | null;
  finePerDay: number;
  deductPerDay: number;
  fine: number;
  deduct: number;
};

const dowOf = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

/**
 * วันที่แต่ละใบได้คนแทน — คนแทน n คนต่อวันที่ไซต์หนึ่ง ครอบใบที่เริ่มนับก่อนสุด n ใบแรก
 * (นับเฉพาะวันหลังวันเริ่มนับ ถึงวันนี้ · เป็นวันทำงานของใบนั้น)
 */
export function allocateReplacements(
  reqs: ReadonlyArray<{ jobId: string; site: string | null; startYmd: string | null; weekdays: ReadonlySet<number> | null }>,
  bySite: Record<string, Array<[string, number]>>,
  today: string,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const bySiteReqs = new Map<string, typeof reqs[number][]>();
  for (const r of reqs) {
    if (!r.site || !r.startYmd) continue;
    const list = bySiteReqs.get(r.site) ?? [];
    list.push(r);
    bySiteReqs.set(r.site, list);
  }
  for (const [site, list] of bySiteReqs) {
    const days = bySite[site];
    if (!days) continue;
    const sorted = [...list].sort((a, b) => (a.startYmd! < b.startYmd! ? -1 : a.startYmd! > b.startYmd! ? 1 : a.jobId.localeCompare(b.jobId)));
    for (const [ymd, n] of days) {
      if (ymd > today) continue;
      let left = n;
      for (const r of sorted) {
        if (left <= 0) break;
        if (!(ymd > r.startYmd!)) continue;
        if (r.weekdays && !r.weekdays.has(dowOf(ymd))) continue;
        const set = out.get(r.jobId) ?? new Set<string>();
        set.add(ymd);
        out.set(r.jobId, set);
        left -= 1;
      }
    }
  }
  return out;
}

const factsByJob = (facts: readonly RecruitAppFact[]) => {
  const m = new Map<string, RecruitAppFact[]>();
  for (const f of facts) {
    if (!f.jobId) continue;
    const list = m.get(f.jobId) ?? [];
    list.push(f);
    m.set(f.jobId, list);
  }
  return m;
};

const countSince = (list: readonly string[] | undefined, since: string | null) =>
  (list ?? []).filter((ymd) => !since || ymd >= since).length;

export function buildPipelineRequests(jobs: readonly JobRequest[], data: RequestPipelineResponse, now: Date = new Date()): PipelineRequest[] {
  const facts = factsByJob(data.facts ?? []);
  const released = new Set(data.releasedJobIds ?? []);
  const base = jobs.map((job) => {
    const advance = isBeforeRequiredForAge(job, now);
    const ageDays = advance ? null : getJobRequestAgeDays(job, now);
    const startYmd = advance ? null : effectiveRequestDateYmd(job, now);
    const site = (job.site_code ?? '').trim() || null;
    return { job, jobId: String(job.id), site, advance, ageDays, startYmd, weekdays: parseWorkWeekdays(job.work_schedule) };
  });
  const covered = allocateReplacements(base, data.replacementBySite ?? {}, data.today);
  return base.map((b) => {
    const since = b.startYmd ?? (typeof b.job.submittedAt === 'string' ? b.job.submittedAt.slice(0, 10) : null);
    const counts = countsOf(
      facts.get(b.jobId) ?? [],
      b.site ? countSince(data.followStartsBySite?.[b.site], since) : 0,
      b.site ? countSince(data.aftercareBySite?.[b.site], since) : 0,
    );
    const isReleased = released.has(b.jobId);
    const st = stuckOf(isReleased, counts);
    const days = covered.get(b.jobId) ?? new Set<string>();
    let replacedDays = 0;
    if (b.startYmd && days.size > 0) {
      replacedDays = countWorkingDays(b.startYmd, data.today, b.weekdays) - countWorkingDays(b.startYmd, data.today, b.weekdays, days);
    }
    const penaltyDays = b.ageDays === null ? null : Math.max(0, b.ageDays - replacedDays);
    const finePerDay = Number(b.job.penalty_per_day) || 0;
    const deductPerDay = Number(b.job.deduct_per_day) || 0;
    return {
      job: b.job,
      jobId: b.jobId,
      requestNo: String(b.job.request_no ?? b.jobId),
      site: b.site,
      advance: b.advance,
      ageDays: b.ageDays,
      bucket: ageBucketOf(b.advance, b.ageDays),
      startYmd: b.startYmd,
      released: isReleased,
      counts,
      stuck: st.step,
      stuckReason: st.reason,
      replacedDays,
      penaltyDays,
      finePerDay,
      deductPerDay,
      fine: penaltyDays === null ? 0 : Math.round(penaltyDays * finePerDay * 100) / 100,
      deduct: penaltyDays === null ? 0 : Math.round(penaltyDays * deductPerDay * 100) / 100,
    };
  });
}

/**
 * ติดตามเริ่มงาน / ดูแลหลังเริ่มงาน ของภาพรวม — นับคนต่อไซต์ครั้งเดียว (ไซต์ที่มีหลายใบขอห้ามนับคนเดิมซ้ำ)
 * ตั้งแต่ใบที่เริ่มนับก่อนสุดของไซต์นั้น (เจอบนเว็บจริง 22 ต.ค. 2569: บวกรายใบได้ 801 คน)
 */
export function siteFollowTotals(rows: readonly PipelineRequest[], data: Pick<RequestPipelineResponse, 'followStartsBySite' | 'aftercareBySite'>) {
  const since = new Map<string, string | null>();
  for (const r of rows) {
    if (!r.site) continue;
    const s = r.startYmd ?? (typeof r.job.submittedAt === 'string' ? r.job.submittedAt.slice(0, 10) : null);
    const cur = since.get(r.site);
    if (cur === undefined || (s !== null && (cur === null || s < cur))) since.set(r.site, cur === null ? null : s);
  }
  let followStarts = 0;
  let aftercare = 0;
  for (const [site, s] of since) {
    followStarts += countSince(data.followStartsBySite?.[site], s);
    aftercare += countSince(data.aftercareBySite?.[site], s);
  }
  return { followStarts, aftercare };
}

/** สรุปทั้งชุด — ทุกก้อนรวมกันเท่าจำนวนใบ */
export function summarizePipeline(rows: readonly PipelineRequest[]) {
  const buckets = Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, 0])) as Record<AgeBucket, number>;
  const stuck = Object.fromEntries(PIPELINE_STEPS.map((s) => [s.key, 0])) as Record<PipelineStepKey, number>;
  let fine = 0;
  let deduct = 0;
  let penaltyDays = 0;
  let replacedDays = 0;
  /** วันผ่านมารวม (ไม่นับล่วงหน้า) — ผ่านมารวม − ส่งคนแทนรวม = โดนปรับรวม */
  let ageDays = 0;
  for (const r of rows) {
    ageDays += r.penaltyDays === null ? 0 : (r.ageDays ?? 0);
    buckets[r.bucket] += 1;
    stuck[r.stuck] += 1;
    fine += r.fine;
    deduct += r.deduct;
    penaltyDays += r.penaltyDays ?? 0;
    replacedDays += r.replacedDays;
  }
  return { total: rows.length, buckets, stuck, fine: Math.round(fine * 100) / 100, deduct: Math.round(deduct * 100) / 100, penaltyDays, replacedDays, ageDays };
}
