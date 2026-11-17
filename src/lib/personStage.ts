/**
 * ═══ สถานะของผู้สมัครแต่ละคน ตาม Journey (เจ้าของ 17 พ.ย. 2569) ═══
 * > *"ใบที่มีชื่อปิดไม่ได้เพราะติดที่ไหน ติดที่ Ai ยังไม่โทร หรือ โทรแล้วแต่คนไม่เก็บไป หรือ เก็บแล้วแต่ไม่โทร
 * > หรือ โทรแล้วแต่ไม่นัด หรือ นัดแล้วไม่ลงผล"* · "17 สถานะ เยอะไปไหมอะ" → บนหน้า 8 ขั้นหลัก · รายชื่อบอก 17 สถานะ
 *
 * คนหนึ่งอยู่สถานะเดียว (ขั้นที่ไปไกลสุด) — ตัวตัดสินชุดเดียวกับ `buildPersonJourney`
 * (`aiBranchOf` · `staffResultOf` · `aiStage`) ห้ามคิดนิยามใหม่
 */
import type { RecruitAppFact } from './recruitOverviewTypes';
import { aiStage, staffResultOf } from './recruitJourney';
import { aiBranchOf } from './recruitPersonJourney';

export const PERSON_STAGES = [
  'noQueue',
  'queued',
  'aiNoPickup',
  'aiNo',
  'aiOutOfArea',
  'aiOther',
  'unclaimed',
  'claimedNotCalled',
  'unreachable',
  'notBooked',
  'undecided',
  'upcoming',
  'overdue',
  'noShow',
  'screening',
  'screened',
  'informed',
] as const;
export type PersonStageKey = (typeof PERSON_STAGES)[number];

export const PERSON_STAGE_LABEL: Record<PersonStageKey, string> = {
  noQueue: 'ยังไม่ส่ง AI',
  queued: 'รอ AI โทร',
  aiNoPickup: 'AI โทร ไม่รับสาย',
  aiNo: 'AI โทร ไม่สนใจ',
  aiOutOfArea: 'AI โทร คนละพื้นที่',
  aiOther: 'AI โทร ยังสรุปไม่ได้',
  unclaimed: 'สนใจ ยังไม่มีคนเก็บ',
  claimedNotCalled: 'เก็บแล้ว ยังไม่โทร',
  unreachable: 'โทรแล้ว ติดต่อไม่ได้',
  notBooked: 'ติดต่อได้ นัดไม่ได้',
  undecided: 'ติดต่อได้ ยังไม่ลงผลนัด',
  upcoming: 'นัดแล้ว ยังไม่ถึงวัน',
  overdue: 'นัดแล้ว เลยวัน ยังไม่ลงผล',
  noShow: 'ไม่มาตามนัด',
  screening: 'มาแล้ว ยังไม่ลงผลคัดเลือก',
  screened: 'มาแล้ว ลงผลคัดเลือกแล้ว',
  informed: 'แจ้งเข้า ERP แล้ว',
};

/** 8 ขั้นหลักบนหน้า (เรียงตามเส้นทาง) — แต่ละสถานะอยู่ขั้นเดียว รวมกันเท่าจำนวนคน */
export const PERSON_GROUPS = ['aiNotCalled', 'aiNoResult', 'unclaimed', 'claimedNotCalled', 'notBooked', 'booked', 'noShow', 'showed'] as const;
export type PersonGroupKey = (typeof PERSON_GROUPS)[number];
export const PERSON_GROUP_LABEL: Record<PersonGroupKey, string> = {
  aiNotCalled: 'AI ยังไม่โทร',
  aiNoResult: 'AI โทรไม่ได้ผล',
  unclaimed: 'สนใจ ยังไม่มีคนเก็บ',
  claimedNotCalled: 'เก็บแล้ว ยังไม่โทร',
  notBooked: 'โทรแล้ว ยังไม่ได้นัด',
  booked: 'นัดแล้ว รอผล',
  noShow: 'ไม่มาตามนัด',
  showed: 'มาแล้ว / ได้งาน',
};
export const PERSON_GROUP_OF: Record<PersonStageKey, PersonGroupKey> = {
  noQueue: 'aiNotCalled',
  queued: 'aiNotCalled',
  aiNoPickup: 'aiNoResult',
  aiNo: 'aiNoResult',
  aiOutOfArea: 'aiNoResult',
  aiOther: 'aiNoResult',
  unclaimed: 'unclaimed',
  claimedNotCalled: 'claimedNotCalled',
  unreachable: 'notBooked',
  notBooked: 'notBooked',
  undecided: 'notBooked',
  upcoming: 'booked',
  overdue: 'booked',
  noShow: 'noShow',
  screening: 'showed',
  screened: 'showed',
  informed: 'showed',
};

const reachedByStaff = (f: RecruitAppFact) => f.logOk === true || (f.contactBy === 'staff' && f.contact === 'success');

export function personStageOf(f: RecruitAppFact, now: Date = new Date()): PersonStageKey {
  if (f.informed === true) return 'informed';
  // มีวันนัด = ผ่านขั้นนัดแล้ว ไม่ว่ามาทางไหน (AI › คนโทรต่อ · คนโทรเอง · ทางอื่น)
  if (f.appointmentAt) {
    if (f.attendance === 'showed') return f.screening === 'passed' || f.screening === 'not_passed' ? 'screened' : 'screening';
    if (f.attendance === 'no_show') return 'noShow';
    return Date.parse(f.appointmentAt) > now.getTime() ? 'upcoming' : 'overdue';
  }
  const contacted = (): PersonStageKey =>
    f.appointmentFailed === true || f.staffAnswer === 'said_no' || f.staffAnswer === 'wrong_person' ? 'notBooked' : 'undecided';
  if (f.calledByAi) {
    const b = aiBranchOf(f);
    if (b === 'noPickup') return 'aiNoPickup';
    if (b === 'no') return 'aiNo';
    if (b === 'outOfArea') return 'aiOutOfArea';
    if (b === 'other') return 'aiOther';
    const sr = staffResultOf(f);
    if (sr === 'ok') return contacted();
    if (sr === 'fail') return 'unreachable';
    return f.claimedBy ? 'claimedNotCalled' : 'unclaimed';
  }
  if (f.calledByStaff) return reachedByStaff(f) ? contacted() : 'unreachable';
  return aiStage(f) === 'queued' ? 'queued' : 'noQueue';
}

/** id ต่อสถานะของรายชื่อชุดหนึ่ง (ใบขอหนึ่งใบ) — สถานะที่ไม่มีคนไม่ใส่ */
export function personStagesOf(list: readonly RecruitAppFact[], now: Date = new Date()): Partial<Record<PersonStageKey, string[]>> {
  const out: Partial<Record<PersonStageKey, string[]>> = {};
  for (const f of list) {
    if (!f.id) continue;
    const k = personStageOf(f, now);
    (out[k] ??= []).push(f.id);
  }
  return out;
}
