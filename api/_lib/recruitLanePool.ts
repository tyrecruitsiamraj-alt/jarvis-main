/**
 * เลนสรรหา — กองคนที่ "ยังไม่สมัคร" จาก 3 แหล่ง (R2b · เจ้าของเคาะ 16 ส.ค. 2569)
 *
 * นิยามถาวร: **สรรหา = จัดการคนที่ยังไม่สมัคร** (Lumos โทรก่อน แล้วคนตามเก็บใบสมัคร)
 * ต่างจากเลนคัดสรรที่ค้นเฉพาะฐาน iRecruit — เลนนี้รวม 3 กองเข้าด้วยกัน:
 *   1. `irecruit`   — ฐาน iRecruit เดิม (recruit_register บน SQL Server)
 *   2. `so_recruit` — ฐานใหม่ So Recruit = ใบ "สนใจ" (Lead) จากหน้าสาธารณะที่ยังไม่ขึ้นบอร์ด
 *   3. `checklist`  — ถัง Checklist บนบอร์ด ERP = คนที่เริ่มสมัครแต่เอกสารยังไม่ครบ
 *
 * ⚠️ **ต้องติดป้ายแหล่งทุกคน** (เจ้าของขอ) — สรรหาจะได้รู้ว่าต้องตามเอกสารแบบไหน
 * ป้ายมาจาก `RECRUIT_SOURCE_LABEL` ที่เดียว ทั้งในผลค้นและสรุปตอนส่ง
 *
 * ไฟล์นี้ **pure ล้วน** (ไม่มี I/O) — mapper + dedupe + ป้าย เพื่อเทสต์ได้ตรง ๆ
 */

/**
 * ต้นทางของคนในกอง — ค่าคงที่ ห้ามเปลี่ยนสตริง (ป้าย/สรุป/เทสต์ผูกอยู่)
 *
 * ⚠️ **สามตัวแรกเป็นของเลนสรรหา** (คนยังไม่สมัคร) · `declined` เป็นของ**เลนคัดสรร**
 * (คนสมัครแล้วแต่เคยปฏิเสธงานอื่น) — ใช้รูปข้อมูลร่วมกันเพื่อไม่ต้องเขียน prescore/
 * prompt สองชุด แต่ **matcher ของเลนสรรหาต้องไม่โหลด `declined` เด็ดขาด**
 * ไม่งั้นเส้นแบ่งสองเลนที่เจ้าของย้ำไว้จะพังทันที (มีเทสต์คุม)
 */
export type RecruitPoolSource = 'irecruit' | 'so_recruit' | 'checklist' | 'declined';

/** ป้ายบอกแหล่งบนจอ — ที่เดียวของทั้งระบบ (ผลค้น + สรุปตอนส่ง ต้องใช้ตัวเดียวกัน) */
export const RECRUIT_SOURCE_LABEL: Record<RecruitPoolSource, string> = {
  irecruit: 'จาก iRecruit',
  so_recruit: 'จากฐานใหม่',
  checklist: 'จาก Checklist',
  declined: 'เคยปฏิเสธงานอื่น',
};

/** แหล่งที่เป็นของเลนสรรหาเท่านั้น — matcher เลนสรรหาต้องใช้แค่ชุดนี้ */
export const RECRUIT_LANE_SOURCES: readonly RecruitPoolSource[] = [
  'irecruit',
  'so_recruit',
  'checklist',
];

/** คำอธิบายยาวสำหรับ tooltip/สรุป — บอกว่าต้องตามเอกสารแบบไหน */
export const RECRUIT_SOURCE_HINT: Record<RecruitPoolSource, string> = {
  irecruit: 'ฐาน iRecruit เดิม — ยังไม่มีใบสมัครกับเรา ต้องเก็บใบสมัครใหม่ทั้งชุด',
  so_recruit: 'ใบ "สนใจ" จากหน้าสาธารณะ — มีข้อมูลเบื้องต้นแล้ว เหลือเก็บใบสมัครจริง',
  checklist: 'อยู่ถัง Checklist บนบอร์ด — เริ่มสมัครแล้ว เหลือตามเอกสารให้ครบ',
  declined: 'สมัครกับเราแล้ว แต่เคยตอบว่าไม่สนใจงานอื่นที่เสนอไป — งานนี้คนละที่คนละค่าแรง',
};

/**
 * ลำดับความ "ใกล้ได้ใบสมัคร" — ใช้ตัดสินตอนคนซ้ำข้ามแหล่ง (เบอร์เดียวกัน)
 * Checklist ใกล้ที่สุด (อยู่บนบอร์ดแล้ว) → ฐานใหม่ (สนใจกับเราแล้ว) → iRecruit (ฐานเก่า)
 * เลขน้อย = ชนะ
 */
const SOURCE_PRIORITY: Record<RecruitPoolSource, number> = {
  declined: 0, // มีใบสมัครจริงอยู่แล้ว = ใกล้ที่สุด (ไม่ปนกองสรรหาอยู่แล้ว แต่ตั้งไว้ให้ครบ)
  checklist: 1,
  so_recruit: 2,
  irecruit: 3,
};

/**
 * คนหนึ่งคนในกองเลนสรรหา — รูปเดียวกันหมดไม่ว่ามาจากแหล่งไหน
 *
 * `ref` = `person_ref` ที่จะใช้ในคิว Lumos · **ต้องคง prefix เดิมของระบบ**
 * (`ir-` / `app-` / `card-`) เพราะ `splitPersonRef()` ใน callFollowup.ts แปลงกลับ
 * เป็น source ตอนคนกด "รับไปตามต่อ" — ตั้ง prefix ใหม่ = ปุ่มนั้นพังเงียบ
 */
export type RecruitPoolCandidate = {
  source: RecruitPoolSource;
  /** person_ref ในคิว Lumos — `ir-<id>` / `app-<uuid>` / `card-<card_id>` */
  ref: string;
  full_name: string;
  phone_number: string | null;
  /** ข้อความตำแหน่ง/สกิลที่ใช้เป็นสัญญาณแมท (รวมทุกฟิลด์ที่บอกงานได้) */
  position_text: string;
  location_label: string | null;
  sex: string | null;
  age: number | null;
  driving_licenses: string[];
  /** วันที่เข้ามาอยู่ในกอง (ISO) — ใช้เรียง "รอนานสุดก่อน" ตอนคะแนนเท่ากัน */
  since: string | null;
};

export function recruitSourceLabel(source: RecruitPoolSource): string {
  return RECRUIT_SOURCE_LABEL[source];
}

const trim = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

const joinText = (parts: Array<string | null | undefined>): string =>
  parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');

/** ข้อความที่ใช้ prescore/กรอง family — ต้องเป็นตำแหน่งล้วน ไม่ปนชื่อคน/ที่อยู่ */
export function poolCandidateText(c: RecruitPoolCandidate): string {
  return c.position_text.toLowerCase();
}

// ─── mapper ต่อแหล่ง (pure) ────────────────────────────────────────────────

/** iRecruit — `RecruitCandidateForMatch` จาก recruitRegisterSql */
export function fromIrecruitCandidate(c: {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  position_name: string | null;
  job_name_th: string | null;
  location_label: string | null;
  sex: string | null;
  age: number | null;
  driving_licenses: string[];
  created_at: string;
}): RecruitPoolCandidate {
  return {
    source: 'irecruit',
    ref: `ir-${c.id}`,
    full_name: joinText([c.first_name, c.last_name]) || '(ไม่ระบุชื่อ)',
    phone_number: trim(c.phone_number),
    position_text: joinText([c.position_name, c.job_name_th]),
    location_label: trim(c.location_label),
    sex: trim(c.sex),
    age: c.age,
    driving_licenses: c.driving_licenses ?? [],
    since: trim(c.created_at),
  };
}

/**
 * ฐานใหม่ So Recruit — ใบ "สนใจ" (Lead) จากหน้าสาธารณะ
 * ⚠️ ใบสนใจ **ไม่ใช่ใบสมัคร** — คนกลุ่มนี้ยังต้องตามเก็บใบสมัครอยู่ดี
 */
export function fromSoRecruitLead(a: {
  id: string;
  full_name: string | null;
  phone: string | null;
  phone_e164: string | null;
  position_interest: string | null;
  job_title: string | null;
  province: string | null;
  district: string | null;
  gender: string | null;
  age: number | null;
  license_types: string[] | null;
  created_at: string | null;
}): RecruitPoolCandidate {
  const district = trim(a.district);
  const province = trim(a.province);
  const location = district && province ? `${district}, ${province}` : district || province;
  // gender เก็บเป็น male/female/other — แปลงเป็นคำไทยให้ prompt อ่านรู้เรื่อง
  const sex = a.gender === 'male' ? 'ชาย' : a.gender === 'female' ? 'หญิง' : trim(a.gender);
  return {
    source: 'so_recruit',
    ref: `app-${a.id}`,
    full_name: trim(a.full_name) || '(ไม่ระบุชื่อ)',
    // ใช้เบอร์ดิบเสมอ — ให้ toE164Thai ที่ payload เป็นคนตัดสินความถูกต้องที่เดียว
    phone_number: trim(a.phone) || trim(a.phone_e164),
    position_text: joinText([a.position_interest, a.job_title]),
    location_label: location,
    sex,
    age: a.age,
    driving_licenses: a.license_types ?? [],
    since: trim(a.created_at),
  };
}

/**
 * คนที่เคยปฏิเสธงานอื่น (เลนคัดสรร) — `DeclinedApplicantRow` จาก declinedApplicantsSql
 * `ref` = `app-<uuid>` เหมือนใบสมัครปกติ เพราะเขาคือใบสมัครใบเดิมนั่นแหละ
 */
export function fromDeclinedApplicant(a: {
  id: string;
  full_name: string | null;
  phone: string | null;
  phone_e164: string | null;
  position_interest: string | null;
  job_title: string | null;
  province: string | null;
  district: string | null;
  gender: string | null;
  age: number | null;
  license_types: string[] | null;
  created_at: string | null;
}): RecruitPoolCandidate {
  return { ...fromSoRecruitLead(a), source: 'declined' };
}

/** ถัง Checklist บนบอร์ด ERP — `BoardReadyCandidate` จาก boardCandidatesSql */
export function fromChecklistCard(c: {
  card_id: number;
  first_name: string | null;
  last_name: string | null;
  nick_name: string | null;
  mobile: string | null;
  job1_name: string | null;
  job2_name: string | null;
  province_name: string | null;
  amphur_name: string | null;
  sex_code: string | null;
  age: number | null;
  application_date: string | null;
}): RecruitPoolCandidate {
  const amphur = trim(c.amphur_name);
  const province = trim(c.province_name);
  const location = amphur && province ? `${amphur}, ${province}` : amphur || province;
  const sex = c.sex_code === 'M' ? 'ชาย' : c.sex_code === 'F' ? 'หญิง' : trim(c.sex_code);
  return {
    source: 'checklist',
    ref: `card-${c.card_id}`,
    full_name: joinText([c.first_name, c.last_name]) || trim(c.nick_name) || '(ไม่ระบุชื่อ)',
    phone_number: trim(c.mobile),
    position_text: joinText([c.job1_name, c.job2_name]),
    location_label: location,
    sex,
    age: c.age,
    driving_licenses: [],
    since: trim(c.application_date),
  };
}

// ─── รวมกอง + ตัดคนซ้ำ ────────────────────────────────────────────────────

export type PoolDedupeResult = {
  pool: RecruitPoolCandidate[];
  /** คนที่ถูกตัดเพราะซ้ำกับแหล่งที่ "ใกล้ได้ใบสมัคร" กว่า (ไว้บอกยอดบนจอ) */
  droppedDuplicates: Array<{ ref: string; source: RecruitPoolSource; keptRef: string }>;
};

/**
 * ตัดคนซ้ำข้ามแหล่งด้วย **เบอร์ที่ normalize แล้ว** — คนเดียวกันมักอยู่ทั้ง iRecruit
 * และบอร์ด ถ้าไม่ตัดจะโดนโทรสองสายเรื่องงานเดียวกัน (คิวกันซ้ำที่ person_ref ไม่ช่วย
 * เพราะคนละ ref) · เก็บแหล่งที่ priority ดีกว่าไว้ (checklist > so_recruit > irecruit)
 *
 * `normalizePhone` ฉีดเข้ามา (ปกติ = toE164Thai) เพื่อให้ไฟล์นี้ยัง pure
 * คนที่เบอร์แปลงไม่ได้ **ไม่ตัดทิ้งที่นี่** — ปล่อยไปโดนคัดตอนสร้าง payload ที่เดียว
 */
export function dedupePoolByPhone(
  candidates: RecruitPoolCandidate[],
  normalizePhone: (raw: string | null) => string | null,
): PoolDedupeResult {
  const bestByPhone = new Map<string, RecruitPoolCandidate>();
  const noPhone: RecruitPoolCandidate[] = [];
  const droppedDuplicates: PoolDedupeResult['droppedDuplicates'] = [];

  for (const c of candidates) {
    const key = normalizePhone(c.phone_number);
    if (!key) {
      noPhone.push(c);
      continue;
    }
    const current = bestByPhone.get(key);
    if (!current) {
      bestByPhone.set(key, c);
      continue;
    }
    const winner = SOURCE_PRIORITY[c.source] < SOURCE_PRIORITY[current.source] ? c : current;
    const loser = winner === c ? current : c;
    bestByPhone.set(key, winner);
    droppedDuplicates.push({ ref: loser.ref, source: loser.source, keptRef: winner.ref });
  }

  return { pool: [...bestByPhone.values(), ...noPhone], droppedDuplicates };
}

/** นับคนต่อแหล่ง — ใช้โชว์ "กองมาจากไหนบ้าง" บนจอ (คืนครบ 3 แหล่งเสมอ รวมแหล่งที่ 0) */
export function countBySource(candidates: RecruitPoolCandidate[]): Record<RecruitPoolSource, number> {
  const out: Record<RecruitPoolSource, number> = {
    irecruit: 0,
    so_recruit: 0,
    checklist: 0,
    declined: 0,
  };
  for (const c of candidates) out[c.source] += 1;
  return out;
}
