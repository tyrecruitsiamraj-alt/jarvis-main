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

/**
 * ใครโทรล่าสุด (เจ้าของ 11 พ.ย. 2569 "บอกด้วยว่าล่าสุดคนหรือ Ai โทร") — เทียบเวลาสามทาง อันใหม่สุดชนะ:
 * ผลโทรล่าสุด (`last_call_by` บอกว่า AI/คน) · บันทึกผลติดต่อของเจ้าหน้าที่ · เจ้าหน้าที่กดโทร (ยังไม่ลงผลก็นับ)
 * ไม่มีร่องรอยเลย = null (ยังไม่มีใครโทร)
 */
export function unitMatchLastCaller(a: PublicApplication): 'ai' | 'staff' | null {
  const events: Array<{ at: string; by: 'ai' | 'staff' }> = [];
  if (a.last_call_at && a.last_call_by) events.push({ at: a.last_call_at, by: a.last_call_by });
  if (a.last_contact_at) events.push({ at: a.last_contact_at, by: 'staff' });
  if (a.dialed_last_at) events.push({ at: a.dialed_last_at, by: 'staff' });
  let best: { t: number; by: 'ai' | 'staff' } | null = null;
  for (const e of events) {
    const t = Date.parse(e.at);
    if (Number.isFinite(t) && (!best || t > best.t)) best = { t, by: e.by };
  }
  return best?.by ?? null;
}

export const UNIT_MATCH_CALLER_LABEL: Record<'ai' | 'staff', string> = { ai: 'ล่าสุด AI โทร', staff: 'ล่าสุดคนโทร' };

/**
 * แถบนับบนแท็บผู้สมัคร (เจ้าของ 11 พ.ย. 2569 "ทำให้กดแล้วดูได้ · ทำไมไม่แยก โทรแล้ว ไม่ตอบ ด้วยว่ามีเท่าไหร่")
 * นับด้วย `unitMatchStatus` ตัวเดียวกับป้ายท้ายการ์ด ⇒ ชิปรวมกัน = ผู้สมัครทั้งหมด ไม่ทับกัน
 * นัดแล้ว · สนใจ · รอโทร อยู่เสมอ (ว่าง = 0) · ผลโทรอื่น/เบอร์เสีย/มีคนเก็บไป ขึ้นเมื่อมีคน
 */
export function unitMatchStatusCounts(items: PublicApplication[]): Array<UnitMatchStatus & { count: number }> {
  const by = new Map<string, UnitMatchStatus & { count: number }>();
  for (const a of items) {
    const st = unitMatchStatus(a);
    const cur = by.get(st.text);
    if (cur) cur.count += 1;
    else by.set(st.text, { ...st, count: 1 });
  }
  const fixed = (text: string, tone: UnitMatchStatus['tone']) => by.get(text) ?? { text, tone, count: 0 };
  const called = [...by.values()].filter((s) => s.text.startsWith('โทรแล้ว · ')).sort((x, y) => y.count - x.count);
  const tail = ['เบอร์ใช้โทรไม่ได้', 'มีคนเก็บไปโทร'].flatMap((t) => (by.get(t) ? [by.get(t)!] : []));
  return [fixed('นัดแล้ว', 'success'), fixed('สนใจ', 'success'), ...called, ...tail, fixed('รอโทร', 'neutral')];
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
