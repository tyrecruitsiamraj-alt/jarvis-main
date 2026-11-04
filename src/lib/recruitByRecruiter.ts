/**
 * ═══ รายชื่อที่กรอกมา แยกตามเจ้าหน้าที่สรรหา → ใบขอ (เจ้าของ 4 พ.ย. 2569) ═══
 * > *"รายชื่อที่เข้ามาเนี่ย เป็นงานใครเท่าไหร่ แล้วเป็นงานไหนบ้าง เช่น แบงค์ เข้ามา 50 คน แบ่งเป็น งาน ก 5 ข 5 ค 40"*
 *
 * งานของใคร = เจ้าหน้าที่สรรหาของใบขอ (`siamraj_unit_assignments.recruiter_name` · ตัวเดียวกับ "ดูเป็นคน" แท็บผู้สมัคร)
 * 🔴 ลูกรวมกันเท่าแม่เสมอ (มีเทสต์) — ใบที่ยังไม่ได้ตั้งเจ้าหน้าที่ / ใบสมัครที่ไม่ผูกใบขอ เป็นแถวของมันเอง ไม่ทิ้ง
 * ตรรกะล้วน · ชุดรายชื่อเดียวกับการ์ด "รายชื่อที่กรอกมา" (รับ cohort ที่กรองแล้วมา)
 */
import type { RecruitAppFact, RecruitAppJob } from './recruitOverviewTypes';

export const NO_RECRUITER = 'ยังไม่ได้ตั้งเจ้าหน้าที่สรรหา';
export const NO_REQUEST = 'ไม่ได้สมัครผ่านใบขอ';

export type RecruiterJobRow = {
  key: string;
  requestNo: string | null;
  label: string;
  count: number;
  ids: string[];
};

export type RecruiterRow = {
  key: string;
  name: string;
  count: number;
  ids: string[];
  jobs: RecruiterJobRow[];
};

const PREFIXES = ['siamraj-sql:', 'siamraj-pre:'];
/** jobId ที่ไม่อยู่ในดัชนี — ใช้เลขที่ใบจากตัว id ไปก่อน (ไม่เดาชื่องาน) */
const requestNoOfId = (jobId: string) => {
  const p = PREFIXES.find((x) => jobId.startsWith(x));
  return p ? jobId.slice(p.length) : jobId;
};

/** ป้ายของใบขอ: เลขที่ใบ · ตำแหน่ง · หน่วยงาน (ช่องที่ว่างไม่ต่อ) */
export function recruiterJobLabel(jobId: string, job: RecruitAppJob | undefined): string {
  const no = job?.requestNo || requestNoOfId(jobId);
  return [no, job?.position, job?.unitName].map((x) => (x ?? '').trim()).filter(Boolean).join(' · ');
}

const byCount = <T extends { count: number; key: string }>(a: T, b: T) => b.count - a.count || a.key.localeCompare(b.key, 'th');

export function appsByRecruiter(apps: readonly RecruitAppFact[], jobs: Readonly<Record<string, RecruitAppJob>> | null | undefined): RecruiterRow[] {
  type JobAcc = { ids: string[]; count: number; requestNo: string | null; label: string };
  type Acc = { ids: string[]; count: number; jobs: Map<string, JobAcc> };
  const by = new Map<string, Acc>();
  for (const a of apps) {
    const job = a.jobId ? jobs?.[a.jobId] : undefined;
    const name = !a.jobId ? NO_REQUEST : (job?.recruiter ?? '').trim() || NO_RECRUITER;
    const acc: Acc = by.get(name) ?? { ids: [], count: 0, jobs: new Map() };
    acc.count += 1;
    if (a.id) acc.ids.push(a.id);
    const jk = a.jobId ?? '';
    const j: JobAcc = acc.jobs.get(jk) ?? {
      ids: [],
      count: 0,
      requestNo: a.jobId ? job?.requestNo || requestNoOfId(a.jobId) : null,
      label: a.jobId ? recruiterJobLabel(a.jobId, job) : NO_REQUEST,
    };
    j.count += 1;
    if (a.id) j.ids.push(a.id);
    acc.jobs.set(jk, j);
    by.set(name, acc);
  }
  const rows: RecruiterRow[] = [...by.entries()].map(([name, acc]) => ({
    key: name,
    name,
    count: acc.count,
    ids: acc.ids,
    jobs: [...acc.jobs.entries()].map(([key, j]) => ({ key, ...j })).sort(byCount),
  }));
  // คนจริงเรียงมากไปน้อย · สองแถวที่ไม่ใช่คนอยู่ท้าย
  const tail = (n: string) => (n === NO_RECRUITER ? 1 : n === NO_REQUEST ? 2 : 0);
  return rows.sort((a, b) => tail(a.name) - tail(b.name) || byCount(a, b));
}
