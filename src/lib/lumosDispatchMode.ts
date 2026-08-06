/**
 * โหมดส่งงานให้ Lumos — นิยามกลางที่ทั้งหน้าเว็บและ API ใช้ร่วมกัน
 * (แพตเทิร์นเดียวกับ candidatePriority.ts / recruitPostings.ts ที่ถูก import จากสองฝั่ง)
 *
 * ดู migrations/069_lumos_dispatch_mode.sql ว่าทำไมต้องมีตารางนี้
 */

/** จุดที่ทำให้เกิดการส่งเข้าคิว Lumos — ตรงกับ 3 จุดที่เคย hardcode ไว้ */
export const LUMOS_DISPATCH_TRIGGERS = ['board_match', 'irecruit_search', 'follow_entry'] as const;
export type LumosDispatchTrigger = (typeof LUMOS_DISPATCH_TRIGGERS)[number];

/**
 * manual = คนติ๊กเลือกแล้วกดส่งเอง · auto = ส่งเองทันทีเมื่อถึงจุดนั้น
 *
 * ยังไม่มี 'assist' (ระบบจัดชุดให้ คนกดยืนยันทีเดียว) เพราะยังไม่มีชั้น
 * "ชุดส่ง + อนุมัติ" รองรับ — ใส่ไว้ตอนนี้จะเป็นค่าที่เลือกได้แต่ไม่มีผล
 */
export const LUMOS_DISPATCH_MODES = ['manual', 'auto'] as const;
export type LumosDispatchMode = (typeof LUMOS_DISPATCH_MODES)[number];

export type LumosDispatchModeConfig = Record<LumosDispatchTrigger, LumosDispatchMode>;

/**
 * ค่าเริ่มต้น = manual ทุกจุด (พฤติกรรมเดียวกับ production หลัง commit eb8c386)
 * **fail-safe ที่ตั้งใจ**: อ่านค่าไม่ได้ / ตารางยังไม่ migrate / ค่าเพี้ยน → manual
 * เพราะเดาผิดทาง auto = โทรหาผู้สมัครจริงโดยไม่มีใครสั่ง ซึ่งกู้คืนไม่ได้
 */
export const DEFAULT_LUMOS_DISPATCH_MODE: LumosDispatchModeConfig = {
  board_match: 'manual',
  irecruit_search: 'manual',
  follow_entry: 'manual',
};

export function isLumosDispatchTrigger(v: unknown): v is LumosDispatchTrigger {
  return typeof v === 'string' && (LUMOS_DISPATCH_TRIGGERS as readonly string[]).includes(v);
}

export function isLumosDispatchMode(v: unknown): v is LumosDispatchMode {
  return typeof v === 'string' && (LUMOS_DISPATCH_MODES as readonly string[]).includes(v);
}

/** กันค่าจาก DB/ผู้ใช้เพี้ยน — คีย์ที่ไม่รู้จักถูกทิ้ง ค่าที่ไม่รู้จักกลับเป็น manual */
export function normalizeLumosDispatchMode(raw: unknown): LumosDispatchModeConfig {
  const out: LumosDispatchModeConfig = { ...DEFAULT_LUMOS_DISPATCH_MODE };
  if (typeof raw !== 'object' || raw === null) return out;
  const src = raw as Record<string, unknown>;
  for (const trigger of LUMOS_DISPATCH_TRIGGERS) {
    const v = src[trigger];
    if (isLumosDispatchMode(v)) out[trigger] = v;
  }
  return out;
}

/** ป้ายภาษาไทยของแต่ละจุด — ใช้ที่หน้าตั้งค่า */
export const LUMOS_TRIGGER_LABEL: Record<LumosDispatchTrigger, string> = {
  board_match: 'AI แมท "คนของเรา" เสร็จ',
  irecruit_search: 'กดค้นหาผู้สมัครจาก iRecruit',
  follow_entry: 'สร้างรายการติดตามในหน้า Follow',
};

export const LUMOS_TRIGGER_DETAIL: Record<LumosDispatchTrigger, string> = {
  board_match:
    'ส่งคนที่ AI แนะนำ (เขียว/เหลือง) เข้าคิวให้ Lumos โทรทันทีที่แมทเสร็จ · ปิดอยู่ = ต้องติ๊กเลือกแล้วกดส่งเองที่หน้า Matching',
  irecruit_search:
    'ส่งผู้สมัครที่ค้นเจอเข้าคิวให้ Lumos โทรสัมภาษณ์ทันทีที่ค้นเสร็จ · ปิดอยู่ = ติ๊กเลือกแล้วกดส่งเอง',
  follow_entry:
    'พอกรอกรายชื่อในหน้า Follow แล้วส่งให้ Lumos โทรตามทันที · ปิดอยู่ = รายการถูกบันทึกไว้แต่ยังไม่มีใครโทร',
};

export const LUMOS_MODE_LABEL: Record<LumosDispatchMode, string> = {
  manual: 'คนกดส่งเอง',
  auto: 'ส่งอัตโนมัติ',
};
