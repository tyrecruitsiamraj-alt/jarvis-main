import {
  APPLICATION_ORIGIN_LABEL,
  isApplicationOrigin,
  type ApplicationOrigin,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import { isInterestedOutcome, isKnownOutcome } from '@/lib/applicantCallOutcome';
import { CALL_OUTCOME_LABEL } from '@/lib/callOutcomeTone';

/**
 * หน้า "คนที่จับคู่ได้" ของใบขอ (เจ้าของเคาะ 16 ส.ค. 2569 จากภาพเสนอ)
 *
 * แบ่งคนของใบขอเป็นกลุ่มตาม**ที่มา** เพราะแต่ละกลุ่มต้องทำต่างกัน:
 * คนสมัครเข้ามาเองรอเราโทร · คนที่ AI หามาให้ต้องดูว่า AI โทรถึงไหนแล้ว
 *
 * ⚠️ ตรรกะทั้งหมดอยู่ที่นี่ (pure) หน้าเว็บแค่ render — เลขบนแถบสรุปกับจำนวนแถว
 * ในแต่ละกลุ่มจึงมาจากที่เดียวกันเสมอ ไม่มีทางสวนกัน
 */

/** ลำดับกลุ่มบนหน้า — คนที่รอเราทำอะไรก่อน ขึ้นก่อน */
export const UNIT_MATCH_GROUPS: readonly ApplicationOrigin[] = [
  'self_apply',
  'ai_found',
  'staff_added',
];

export const UNIT_MATCH_GROUP_LABEL: Record<ApplicationOrigin, string> = {
  self_apply: 'สมัครเข้ามาเอง',
  ai_found: 'AI หามาให้',
  staff_added: 'เจ้าหน้าที่คีย์เข้ามา',
};

export const UNIT_MATCH_GROUP_HINT: Record<ApplicationOrigin, string> = {
  self_apply: 'เขายกมือมาเอง — ควรได้คุยกับคนจริงก่อน',
  ai_found: 'AI ไปตามมาให้ ดูว่าโทรถึงไหนแล้วค่อยตามต่อ',
  staff_added: 'เจ้าหน้าที่คีย์เข้าระบบเอง เช่น โทรเข้ามาสมัคร',
};

export type UnitMatchGroup = {
  origin: ApplicationOrigin | 'unknown';
  label: string;
  hint: string | null;
  items: PublicApplication[];
};

/**
 * แบ่งใบสมัครของใบขอเป็นกลุ่มตามที่มา
 * ⚠️ กลุ่มที่ **ไม่มีคน จะไม่ถูกสร้าง** (ต่างจากแถบตัวเลขที่ต้องโชว์ 0 เสมอ) —
 * หัวข้อว่างเปล่ากลางหน้ารายชื่อทำให้คนคิดว่าโหลดไม่ครบ
 * ⚠️ ใบที่ยังบอกที่มาไม่ได้ ไปกลุ่ม `unknown` ท้ายสุด **ห้ามยัดรวมกับ "สมัครเข้ามาเอง"**
 */
export function groupApplicationsByOrigin(items: PublicApplication[]): UnitMatchGroup[] {
  const groups: UnitMatchGroup[] = [];
  for (const origin of UNIT_MATCH_GROUPS) {
    const list = items.filter((a) => a.origin === origin);
    if (list.length > 0) {
      groups.push({
        origin,
        label: UNIT_MATCH_GROUP_LABEL[origin],
        hint: UNIT_MATCH_GROUP_HINT[origin],
        items: list,
      });
    }
  }
  const unknown = items.filter((a) => !isApplicationOrigin(a.origin));
  if (unknown.length > 0) {
    groups.push({
      origin: 'unknown',
      label: 'ยังบอกที่มาไม่ได้',
      hint: 'ใบเก่าที่ระบบยังสืบที่มาไม่ได้ — ไม่ได้แปลว่าสมัครเอง',
      items: unknown,
    });
  }
  return groups;
}

export type UnitMatchSummary = {
  total: number;
  /** ตอบว่าสนใจตอนโทรแล้ว */
  interested: number;
  /** มีผลโทรกลับมาแล้ว (ผลอะไรก็ตาม) */
  called: number;
  /** ยังไม่มีผลโทรเลย */
  waiting: number;
  byOrigin: Record<ApplicationOrigin, number>;
};

/** สรุปหัวหน้าจอ — ทุกช่องคืนเสมอ (0 คือคำตอบ ไม่ใช่ช่องว่าง) */
export function summarizeUnitMatches(items: PublicApplication[]): UnitMatchSummary {
  const byOrigin: Record<ApplicationOrigin, number> = {
    self_apply: 0,
    ai_found: 0,
    staff_added: 0,
  };
  let interested = 0;
  let called = 0;
  for (const a of items) {
    if (a.origin && isApplicationOrigin(a.origin)) byOrigin[a.origin] += 1;
    if (isKnownOutcome(a.last_call_outcome)) called += 1;
    if (isInterestedOutcome(a.last_call_outcome)) interested += 1;
  }
  return { total: items.length, interested, called, waiting: items.length - called, byOrigin };
}

export type UnitMatchStatus = { text: string; tone: 'success' | 'warn' | 'neutral' | 'danger' };

/**
 * สถานะท้ายแถวของคนหนึ่งคน — ตอบคำถามเดียว: "ตอนนี้เขาอยู่ขั้นไหน"
 * ลำดับสำคัญ: นัดแล้ว > ผลโทร > ถูกเก็บไปโทร > เบอร์เสีย > รอโทร
 */
export function unitMatchStatus(a: PublicApplication): UnitMatchStatus {
  if (a.appointment_at) return { text: 'นัดแล้ว', tone: 'success' };
  if (isInterestedOutcome(a.last_call_outcome)) return { text: 'สนใจ', tone: 'success' };
  if (isKnownOutcome(a.last_call_outcome)) {
    const label = CALL_OUTCOME_LABEL[a.last_call_outcome] ?? a.last_call_outcome;
    return { text: `โทรแล้ว · ${label}`, tone: a.last_call_outcome === 'declined' ? 'danger' : 'warn' };
  }
  // ⚠️ เบอร์ใช้ไม่ได้ต้องเด่นกว่า "รอโทร" — ไม่งั้นค้างในถังรอโทรตลอดกาลโดยไม่มีใครรู้
  if (a.phone_callable === false) return { text: 'เบอร์ใช้โทรไม่ได้', tone: 'danger' };
  if (a.claimed) return { text: 'มีคนเก็บไปโทร', tone: 'neutral' };
  return { text: 'รอโทร', tone: 'neutral' };
}

/** บรรทัดอธิบายใต้ชื่อ — ตำแหน่งที่สนใจ · พื้นที่ · อายุ (ตัดช่องว่างทิ้ง) */
export function unitMatchFactLine(a: PublicApplication): string {
  return [
    a.position_interest || a.job_title,
    [a.district, a.province].filter(Boolean).join(' '),
    a.age ? `${a.age} ปี` : '',
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' · ');
}

/** ป้ายที่มาไว้ติดหลังชื่อ — ไม่รู้ที่มา = ไม่ติดป้าย (ห้ามเดา) */
export function unitMatchOriginLabel(a: PublicApplication): string | null {
  return a.origin && isApplicationOrigin(a.origin) ? APPLICATION_ORIGIN_LABEL[a.origin] : null;
}
