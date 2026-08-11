/**
 * "ย่อใบขอให้ AI พูดทางโทรศัพท์" — ประกอบรายละเอียดงานเป็นข้อความสั้น ๆ
 *
 * ที่มา: เจ้าของสั่ง 11 ส.ค. 2569 ว่าอยากให้ Lumos บอกรายละเอียดงานได้มากขึ้น
 * (สถานที่ทำงาน · วันเวลาทำงาน ฯลฯ) เดิมข้อความบอกแค่ตำแหน่ง + หน่วยงาน + รายได้
 * ผู้สมัครจึงต้องรอเจ้าหน้าที่โทรกลับมาตอบเรื่องพื้นฐานที่สุด
 *
 * ⚠️ **schema ของ Lumos ไม่มีที่ใส่ข้อมูลงานแบบมีโครงสร้าง** (ดู docs/lumos-api.md)
 * reminder รับแค่ client_contact_id / recipient_name / recipient_phone / title /
 * language / tone / steps[] — ช่องเดียวที่ถึงหูผู้สมัครคือ `steps[].message`
 * จึงต้องประกอบเป็นประโยค ไม่ใช่เพิ่มฟิลด์ใหม่ (ฟิลด์แปลกปลอมเสี่ยง schema ไม่ผ่าน
 * และเราคุมฝั่ง Lumos ไม่ได้)
 *
 * ไฟล์นี้ pure ทั้งไฟล์ — ไม่แตะ DB/เวลาจริง เทสต์ที่ tests/api/lumosJobBrief.test.ts
 */

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * ค่าที่คน ERP กรอกไว้แทน "ไม่มีข้อมูล" — พูดออกไปแล้วผู้สมัครงงกว่าไม่พูด
 * (`cleanErpText()` ฝั่ง mapper ตัดขีดพวกนี้ไปแล้วบางส่วน แต่เส้น /api/jobs ไม่ผ่านตัวนั้น)
 */
const EMPTY_MARKS = new Set(['-', '--', '---', '.', 'ไม่ระบุ', 'n/a', 'na', 'ไม่มี']);

function usable(v: unknown): string {
  const s = str(v);
  if (!s) return '';
  return EMPTY_MARKS.has(s.toLowerCase()) ? '' : s;
}

/**
 * ⚠️ **เพดานความยาวของแต่ละท่อน** — นี่คือบทที่ AI จะ**พูด** ไม่ใช่ข้อความที่คนกวาดตาอ่าน
 * ข้อมูลจริงมี work_time ยาวเกิน 300 ตัวอักษร (ตารางกะ 4 กะพร้อมหมายเหตุภายใน)
 * ปล่อยไปทั้งก้อน = AI พูดรัวเป็นนาทีแล้วผู้สมัครวางสาย · ตัดแล้วเติม "…"
 * ให้รู้ว่ายังมีต่อ เจ้าหน้าที่ค่อยเล่ารายละเอียดตอนโทรกลับ
 */
const MAX_PART = 90;

function trimPart(v: string, max = MAX_PART): string {
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/**
 * `work_schedule` ที่ mapper ประกอบไว้คือ `work_date • work_time`
 * ⚠️ **ตัดรวมเป็นก้อนเดียวไม่ได้** — ท่อนแรก (วัน) เป็นข้อความบรรยายยาว ๆ ได้
 * ("ตามแผนการจดหน่วย และประสานงานหลังเสร็จสิ้น…") ตัดตรง ๆ แล้ว**เวลาจริงหายทั้งท่อน**
 * ซึ่งเป็นข้อมูลชิ้นที่ผู้สมัครอยากรู้ที่สุด · วัดกับข้อมูลจริงแล้วเจอเคสนี้ 2 ใน 3 ใบที่สุ่มดู
 *
 * จึงตัดทีละท่อนแล้วค่อยต่อกลับ — ได้ทั้ง "ทำวันไหน" และ "กี่โมงถึงกี่โมง" เสมอ
 */
const MAX_SCHEDULE_SIDE = 45;

function trimSchedule(v: string): string {
  if (!v) return '';
  const i = v.indexOf('•');
  if (i < 0) return trimPart(v);
  const days = trimPart(v.slice(0, i), MAX_SCHEDULE_SIDE);
  const hours = trimPart(v.slice(i + 1), MAX_SCHEDULE_SIDE);
  return [days, hours].filter(Boolean).join(' ');
}

/**
 * ตัดท่อนที่พูดซ้ำกับที่พูดไปแล้ว — `work_place` ของหลายใบคือชื่อลูกค้าเป๊ะ ๆ
 * (บางใบเป็นชื่อลูกค้า + ที่อยู่เต็มต่อท้าย) พูดสองรอบฟังเหมือนระบบพัง
 */
function isEcho(part: string, already: string): boolean {
  if (!part || !already) return false;
  const a = part.toLowerCase();
  const b = already.toLowerCase();
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * วันที่แบบที่ "พูดออกเสียงแล้วเข้าใจ" — เดิมส่ง `2026-08-01` ดิบเข้าไปในบท
 * AI จึงอ่านว่า "สองพันยี่สิบหกขีดศูนย์แปดขีดศูนย์หนึ่ง" ให้ผู้สมัครฟัง
 *
 * ⚠️ ประกาศระดับโมดูล ห้ามสร้างใน function (กติกาเดียวกับ businessDate.ts —
 * `new Intl.*` แพงมากเมื่อถูกเรียกต่อแถว และตรงนี้ถูกเรียกทุกคนที่เข้าคิว)
 */
const thaiDateFormat = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});

/** คืนสตริงเดิมเมื่อแปลงไม่ได้ — ดีกว่าตัดวันเริ่มงานทิ้งเงียบ ๆ */
export function speakableDate(v: unknown): string {
  const s = str(v);
  if (!s) return '';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00+07:00` : s);
  return Number.isNaN(d.getTime()) ? s : thaiDateFormat.format(d);
}

export type JobBriefInput = Record<string, unknown>;

export type JobBrief = {
  /** ท่อนที่เอาไปต่อท้ายข้อความหลัก (ว่างได้ถ้าใบขอไม่มีข้อมูลอะไรเลย) */
  detail: string;
  /**
   * แต่ละหัวข้อแยกกัน — ใช้ตั้งคำถามฝั่ง interview
   * ⚠️ **ตัดความยาวมาแล้ว** เพราะทุกทางที่ใช้ค่าพวกนี้คือบทที่ AI จะพูดออกเสียงทั้งหมด
   * (เคยพลาดตอนแรก: เอา workSchedule ดิบ 300+ ตัวอักษรไปใส่คำถาม)
   */
  workPlace: string;
  workSchedule: string;
  needsOwnVehicle: boolean;
};

/**
 * "คน+รถ" = ผู้สมัครต้องเอารถของตัวเองมาทำงาน — เป็นเงื่อนไขที่ตัดสินใจได้ทันที
 * ไม่บอกตั้งแต่สายแรกคือเสียเวลาทั้งสองฝ่าย · ค่าจริงในฐานมีแค่ 2 แบบ
 * ("คนอย่างเดียว" กับ "คน+รถ") แต่เช็คแบบกว้างไว้เผื่อ ERP เพิ่มคำใหม่
 */
function requiresOwnVehicle(contractType: string): boolean {
  return /\+\s*รถ|มีรถ|พร้อมรถ/.test(contractType);
}

export function buildJobBrief(job: JobBriefInput): JobBrief {
  const unit = usable(job.unit_name);
  const workPlace = trimPart(usable(job.work_place));
  const workSchedule = trimSchedule(usable(job.work_schedule));
  const contractType = usable(job.contract_type_name);
  const needsOwnVehicle = requiresOwnVehicle(contractType);

  const parts: string[] = [];

  // สถานที่ทำงาน — ข้ามเมื่อซ้ำกับชื่อหน่วยงานที่พูดไปแล้วในประโยคหลัก
  if (workPlace && !isEcho(workPlace, unit)) {
    parts.push(`สถานที่ทำงาน ${workPlace}`);
  }
  if (workSchedule) {
    parts.push(`เวลาทำงาน ${workSchedule}`);
  }
  if (needsOwnVehicle) {
    // ไม่ตัดความยาว — ประโยคนี้สั้นและเป็นเงื่อนไขตัดสินใจ ห้ามหาย
    parts.push('งานนี้ต้องใช้รถของตัวเองในการทำงาน');
  }

  const ageMin = Number(job.age_range_min);
  const ageMax = Number(job.age_range_max);
  if (Number.isFinite(ageMin) && Number.isFinite(ageMax) && ageMin > 0 && ageMax >= ageMin) {
    parts.push(`รับอายุ ${ageMin}-${ageMax} ปี`);
  }

  return {
    detail: parts.join(' · '),
    workPlace,
    workSchedule,
    needsOwnVehicle,
  };
}
