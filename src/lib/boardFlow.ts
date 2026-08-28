/**
 * ═══ เส้นทางงานบนหน้ากล่องงาน — **เส้นเดียวจบ** ═══
 *
 * เจ้าของสั่ง 27 ส.ค. 2569 (รอบสาม หลังเห็นของจริงแล้วบอกว่าเละ):
 * > *"ก็ทำเป็นเส้นบอกเลยไหม แบบ งานเข้ามาเท่าไหร่ คนก็ตรวจจากตรงนั้น
 * >  ตรวจเสร็จกดตามเส้นเลย แล้วไปจบที่ตรงไหน · ตอนนี้หน้ากล่องงานเยอะแยะเละเทะไปหมด
 * >  ไอ้กล่องก็ไม่ได้มารวมกับใบงาน ก็ไม่รู้จะแยกทำไม"*
 *
 * 🔴 **ของเดิม 4 ชั้นถูกยุบเหลือชั้นเดียว** — วัดจริงก่อนรื้อ: หน้านี้มีปุ่มกดได้ 91 ปุ่ม
 * และมีของที่ทำหน้าที่ "กรอง" ซ้อนกัน 4 ชุด (ตัวกรอง · เส้นทาง · กล่องสถานะ 6 ·
 * แถบหน้าสาธารณะ+ผู้สมัคร) โดยที่ **สองชุดหลังพูดเลขเดียวกัน**
 *
 * 🔴 **ความจริงที่ทำให้ยุบได้:** กล่องสถานะ 6 กล่องกับเส้นทางที่เคยทำไว้
 * **เป็นเส้นเดียวกัน** — กล่องแรก "กำลังสรรหา" (205 จาก 301 ใบ) คือก้อนใหญ่ที่ไม่เคย
 * ถูกแตะออก ทั้งที่ข้างในมีสี่สภาพต่างกันสิ้นเชิง (ยังไม่ตรวจ / รอปล่อย / รอคนสมัคร /
 * มีคนสมัครแล้ว) ⇒ **แตะกล่องแรกออกแล้ววางต่อท้ายด้วยกล่องที่เหลือ = ได้เส้นเดียว**
 *
 * ✅ **ทุกใบอยู่ได้ขั้นเดียวเท่านั้น** (ต่างจากรุ่นก่อนที่ใบหนึ่งอยู่ได้หลายขั้น)
 * ⇒ ผลรวมทุกขั้น = จำนวนใบทั้งหมดเป๊ะ · คนใหม่ไล่กดทีละขั้นแล้วเห็นครบไม่ซ้ำไม่ขาด
 * (มีเทสต์คุมข้อนี้ — เป็นหัวใจของการยุบครั้งนี้)
 */
import type { JobRequest } from '@/types';
import { openJobBoxOf } from '@/lib/jobBoxGroups';

/** ขั้นบนเส้น — เรียงตามการเดินทางจริงของใบขอ ซ้ายไปขวา */
export type BoardStageKey =
  // ── ช่วงที่เป็น "งานของเรา" (แตะออกมาจากกล่อง "กำลังสรรหา") ──
  | 'review'
  | 'toRelease'
  | 'waitApplicants'
  | 'hasApplicants'
  // ── ช่วงที่ ERP เป็นคนบอกสถานะ (กล่องเดิม) ──
  | 'selecting'
  | 'waiting'
  | 'started'
  // ── จบแล้ว (คนละ feed กับใบเปิด) ──
  | 'closed'
  | 'cancelled';

export type BoardStage = {
  key: BoardStageKey;
  label: string;
  /** อธิบายว่าขั้นนี้คือใบแบบไหน + ต้องทำอะไรต่อ — ขึ้นเป็น tooltip */
  hint: string;
  count: number;
  /** เลขรองที่ต้องเห็นคู่กัน เช่น "1 คน" — `null` = ไม่มี */
  sub?: string | null;
  /** ขั้นที่ **มีงานให้ลงมือ** — จอทำให้เด่นกว่าขั้นที่แค่รอ/จบแล้ว */
  actionable?: boolean;
  /** ขั้นนี้เป็นใบที่จบไปแล้ว (คนละ feed) — จอวางไว้ท้ายเส้นและทำให้จางลง */
  done?: boolean;
};

/** ของที่ต้องรู้ต่อใบ เพื่อบอกว่าใบนั้นอยู่ขั้นไหน */
export type BoardStageFacts = {
  /** ใบนี้มีลิงก์สมัครของตัวเองแล้วหรือยัง (`recruit_postings`) */
  hasLink: (job: JobRequest) => boolean;
  /** ปล่อยขึ้นหน้าสมัครสาธารณะแล้วหรือยัง (`job_public_releases`) */
  isReleased: (job: JobRequest) => boolean;
  /** มีคนกรอกใบสมัครเข้ามาแล้วกี่คน */
  applicants: (job: JobRequest) => number;
};

/**
 * ใบนี้ถูกเจ้าหน้าที่แก้ข้อมูลเองแล้วหรือยัง
 * (`field_overrides` = อายุ/เพศ/สาขา ที่แก้จากกล่องงานเพื่อให้ประกาศถูกต้อง)
 * ⚠️ **ไม่ใช่ขั้นบนเส้นแล้ว** — การแก้ข้อมูลเกิดได้ทุกขั้น ไม่ใช่ด่านที่ต้องผ่าน
 * เก็บไว้เป็นป้ายบนการ์ดแทน
 */
export function isEdited(job: JobRequest): boolean {
  const o = job.field_overrides;
  if (!o) return false;
  return Object.values(o).some(
    (v) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
  );
}

/** ใบนี้มีหมายเหตุที่คนเขียนไว้ไหม — ใช้เป็น "แจ้งว่าติดอะไร" ของขั้นรอตรวจ */
export function hasNote(job: JobRequest): boolean {
  return Boolean((job.list_note ?? '').trim());
}

/**
 * ใบเปิดหนึ่งใบอยู่ขั้นไหน — **ตอบได้ขั้นเดียวเสมอ**
 *
 * กล่อง ERP เป็นตัวตั้งก่อน (คัดเลือก/รอเริ่มงาน/เริ่มแล้ว = ใบเดินพ้นงานประกาศไปแล้ว)
 * เหลือแต่กล่อง "กำลังสรรหา" ที่เราแตะออกตามงานที่ **เรา** ต้องทำกับใบนั้น
 *
 * ลำดับในกล่องสรรหา = **ถอยหลังจากปลายทาง** เพื่อให้ใบที่เดินไกลกว่าไม่ถูกดึงกลับ:
 * มีคนสมัครแล้ว → ปล่อยแล้วรอคนสมัคร → มีลิงก์รอปล่อย → ยังไม่ได้ตรวจ
 */
export function openJobStage(job: JobRequest, facts: BoardStageFacts): BoardStageKey {
  const box = openJobBoxOf(job);
  if (box !== 'sourcing') return box;
  if (facts.applicants(job) > 0) return 'hasApplicants';
  if (facts.isReleased(job)) return 'waitApplicants';
  if (facts.hasLink(job)) return 'toRelease';
  return 'review';
}

/** ใบที่รอตรวจ **และยังไม่มีใครจดว่าติดอะไร** — ของที่ยังไม่มีใครแตะจริง ๆ */
export function isUntouchedReview(job: JobRequest, facts: BoardStageFacts): boolean {
  return openJobStage(job, facts) === 'review' && !hasNote(job);
}

const STAGE_TEXT: Record<BoardStageKey, { label: string; hint: string }> = {
  review: {
    label: 'รอตรวจ',
    hint: 'ใบที่เข้ามาแล้วยังไม่มีใครทำอะไรต่อ — เปิดดูว่าข้อมูลครบไหม ครบแล้วสร้างลิงก์ได้เลย ติดอะไรให้จดในช่องหมายเหตุ',
  },
  toRelease: {
    label: 'รอปล่อยประกาศ',
    hint: 'ตรวจแล้วมีลิงก์สมัครแล้ว แต่ยังไม่ได้ปล่อยขึ้นหน้าสมัครงาน — คนนอกยังไม่เห็นใบนี้',
  },
  waitApplicants: {
    label: 'รอคนสมัคร',
    hint: 'ปล่อยขึ้นหน้าสมัครงานแล้ว แต่ยังไม่มีใครกรอกเข้ามา — ถ้าค้างนานควรดันประกาศหรือส่ง Scraping/Content ช่วย',
  },
  hasApplicants: {
    label: 'มีคนสมัครแล้ว',
    hint: 'มีคนกรอกใบสมัครเข้ามาแล้ว — ไปคัดคนต่อได้ (เลขในวงเล็บคือจำนวนคนที่กรอกทั้งหมด)',
  },
  selecting: {
    label: 'กำลังคัดเลือก',
    hint: 'ระบบงานหลักบอกว่าใบนี้อยู่ระหว่างประเมิน/สัมภาษณ์/รอผลสัมภาษณ์',
  },
  waiting: {
    label: 'รอแจ้งเข้า / รอเริ่มงาน',
    hint: 'ได้คนแล้ว รอแจ้งเข้าหน่วยงานหรือรอถึงวันเริ่มงาน',
  },
  started: {
    label: 'เริ่มงานแล้ว',
    hint: 'คนลงงานแล้ว (งานรายวัน / จ่ายรายวัน) — ใบนี้เดินครบเส้นแล้ว',
  },
  closed: {
    label: 'ปิดแล้ว',
    hint: 'ใบที่ปิดไปแล้ว (ไม่รวมยกเลิก) — ดูย้อนหลังได้ · แสดง 30 วันล่าสุด',
  },
  cancelled: {
    label: 'ยกเลิก',
    hint: 'ใบที่ถูกยกเลิก — ไม่นับเป็นงานที่ต้องหาคนแล้ว · แสดง 30 วันล่าสุด',
  },
};

/** ขั้นที่มีงานให้ลงมือจริง (จอทำให้เด่น) — ที่เหลือคือรอ/จบแล้ว */
const ACTIONABLE: ReadonlySet<BoardStageKey> = new Set(['review', 'toRelease', 'hasApplicants']);

/** ขั้นที่มาจาก feed ใบปิด (คนละชุดกับใบเปิด) */
export const CLOSED_STAGES: readonly BoardStageKey[] = ['closed', 'cancelled'];

/**
 * ขั้นที่ **ระบบงานหลักเป็นคนพา** — ใบพวกนี้เดินพ้นงานปล่อยประกาศไปแล้ว
 * 🔴 ใช้ที่หัวหน้ากล่องงานใต้เลน "ไม่ต้องปล่อย" (`boardRelease.ts`)
 * ⚠️ ต้องตรงกับกล่องที่ไม่ใช่ `sourcing` ใน `jobBoxGroups` เสมอ
 */
export const MOVED_ON_STAGE_KEYS: readonly BoardStageKey[] = ['selecting', 'waiting', 'started'];

export const BOARD_STAGE_ORDER: readonly BoardStageKey[] = [
  'review',
  'toRelease',
  'waitApplicants',
  'hasApplicants',
  'selecting',
  'waiting',
  'started',
  'closed',
  'cancelled',
];

/**
 * เส้นทางพร้อมตัวเลข
 *
 * @param openJobs ใบเปิด **หลังผ่านตัวกรองบนจอแล้ว** (เลขต้องตรงกับที่ตาเห็น)
 * @param closedCounts จำนวนใบปิด/ยกเลิก (มาคนละ feed — ส่งเป็นเลขมาตรง ๆ)
 */
export function buildBoardStages(
  openJobs: readonly JobRequest[],
  facts: BoardStageFacts,
  closedCounts: Record<'closed' | 'cancelled', number>,
): BoardStage[] {
  const count = {} as Record<BoardStageKey, number>;
  for (const k of BOARD_STAGE_ORDER) count[k] = 0;
  count.closed = closedCounts.closed;
  count.cancelled = closedCounts.cancelled;

  /** รวมหัวคนของขั้น "มีคนสมัครแล้ว" — เจ้าของขอเห็นตัวเลขที่กรอกเข้ามา */
  let applicantHeads = 0;
  for (const j of openJobs) {
    const stage = openJobStage(j, facts);
    count[stage] += 1;
    if (stage === 'hasApplicants') applicantHeads += facts.applicants(j);
  }

  return BOARD_STAGE_ORDER.map((key) => ({
    key,
    ...STAGE_TEXT[key],
    count: count[key],
    sub: key === 'hasApplicants' && applicantHeads > 0 ? `${applicantHeads.toLocaleString('th-TH')} คน` : null,
    actionable: ACTIONABLE.has(key),
    done: (CLOSED_STAGES as readonly string[]).includes(key),
  }));
}
