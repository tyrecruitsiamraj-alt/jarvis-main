/**
 * ตัวโหลด "บทพูดฉบับแก้" จาก pg มาวางให้ lumosCallScript ใช้
 * (เจ้าของสั่ง 27 ส.ค. 2569: แก้บทจากหน้าตั้งค่าแล้วมีผลกับสายใหม่ทันที ไม่ต้อง deploy)
 *
 * การไหล: หน้าตั้งค่า → PUT /api/call-scripts → ตาราง `call_script_overrides`
 *          ↘ ทุกครั้งที่จะประกอบ payload ส่ง Lumos → `ensureCallScriptsFresh()` ที่นี่
 *            → โหลด (cache 30 วิ) → วางเข้า `setCallScriptOverrides()` ใน lumosCallScript
 *
 * 🔴 **โหลดล้มต้องไม่ทำให้การส่งคิวล้ม** — บทเป็นของเสริม สายต้องออกได้เสมอ
 * ล้มแล้วใช้ของที่วางไว้ครั้งก่อน (หรือบทมาตรฐาน) แล้ว log ไว้พอ
 *
 * ⚠️ กติกาเดียวกับบทในไฟล์ (มี validate ทั้งฝั่ง API และก่อนวางใช้):
 * - ห้ามเกิน MAX_QUESTIONS ข้อ · ห้ามว่างทั้งชุด (ว่าง = ลบแถวทิ้ง กลับบทมาตรฐาน)
 * - ห้ามมีตัวเลขติดคำว่า "บาท" ในบท (ตัวเลขรายได้ต้องมาจาก {รายได้ต่อเดือน} เท่านั้น)
 * - ตัวแปร {ชื่อ} ต้องเป็นตัวที่ระบบรู้จัก — พิมพ์ผิดแล้วทั้งบรรทัดจะหายตอนโทรจริง
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError } from './logger.js';
import {
  KNOWN_PLACEHOLDERS,
  MAX_QUESTIONS,
  setCallScriptOverrides,
  type EditableScriptKey,
} from './lumosCallScript.js';

const tbl = tableInAppSchema('call_script_overrides');

/**
 * ลำดับบทที่โชว์ในหน้าตั้งค่า — หน้าจอ render ตามลำดับนี้ตรง ๆ
 * ⚠️ เพิ่มคีย์ใน `EditableScriptKey` เมื่อไหร่ **ต้องเติมที่นี่ด้วย** ไม่งั้นบทใหม่
 * จะไม่โผล่ในหน้าตั้งค่าและบันทึกไม่ได้ (ตัวตรวจ `isEditableScriptKey` ใช้ลิสต์นี้)
 * — มีเทสต์คุมว่าลิสต์นี้ครบทุกคีย์
 */
export const EDITABLE_SCRIPT_KEYS: readonly EditableScriptKey[] = [
  'interview',
  'offer',
  'follow',
  'follow_repeat',
];

export function isEditableScriptKey(v: unknown): v is EditableScriptKey {
  return typeof v === 'string' && (EDITABLE_SCRIPT_KEYS as readonly string[]).includes(v);
}

/**
 * ตรวจบทหนึ่งชุดก่อนรับ — คืนข้อความผิดพลาดภาษาคน หรือ null เมื่อผ่าน
 * ใช้ทั้งฝั่ง API (กันบันทึกของเสีย) และตอนโหลดมาใช้ (กันของเสียที่หลุดเข้า DB ไปแล้ว)
 */
export function validateScriptLines(lines: unknown): string | null {
  if (!Array.isArray(lines)) return 'บทต้องเป็นรายการประโยค';
  if (lines.length === 0) return 'บทว่าง — ถ้าต้องการกลับไปใช้บทมาตรฐาน ให้กดปุ่มคืนค่าแทน';
  if (lines.length > MAX_QUESTIONS) {
    return `บทยาวเกิน ${MAX_QUESTIONS} ข้อ — Lumos รับได้จำกัด ข้อท้าย ๆ จะถูกตัดทิ้ง`;
  }
  for (const [i, raw] of lines.entries()) {
    if (typeof raw !== 'string') return `ข้อที่ ${i + 1} ไม่ใช่ข้อความ`;
    const line = raw.trim();
    if (!line) return `ข้อที่ ${i + 1} ว่างเปล่า — ลบทั้งข้อทิ้งแทน`;
    if (line.length > 500) return `ข้อที่ ${i + 1} ยาวเกิน 500 ตัวอักษร`;
    // 🔴 กติกาเดิมของบท: ตัวเลขเงินห้ามพิมพ์เอง (ค่าแรงมีทั้งรายวัน/รายเดือน ระบบเติมให้)
    if (/\d[\d,]*\s*บาท/.test(line)) {
      return `ข้อที่ ${i + 1} มีตัวเลขเงิน — ห้ามพิมพ์ตัวเลขรายได้เอง ให้ใช้ {รายได้ต่อเดือน} ระบบจะเติมเลขที่ถูกต้องให้ตอนโทร`;
    }
    // ตัวแปรที่ระบบไม่รู้จัก = ทั้งบรรทัดจะหายตอนโทรจริง — ฟ้องตั้งแต่ตอนบันทึก
    for (const m of line.matchAll(/\{([^}]*)\}/g)) {
      if (!KNOWN_PLACEHOLDERS.includes(m[1])) {
        return `ข้อที่ ${i + 1} มีตัวแปร {${m[1]}} ที่ระบบไม่รู้จัก — ทั้งข้อจะหายตอนโทรจริง (ดูรายชื่อตัวแปรใต้กล่องแก้ไข)`;
      }
    }
  }
  return null;
}

const CACHE_MS = 30_000;
let loadedAt = 0;
let inflight: Promise<void> | null = null;

async function load(): Promise<void> {
  const { rows } = await dbQuery<{ script_key: string; lines: unknown }>(
    `select script_key, lines from ${tbl}`,
  );
  const next: Partial<Record<EditableScriptKey, readonly string[]>> = {};
  for (const r of rows) {
    // ของเสียที่หลุดเข้า DB (แก้ตรงฐานเอง ฯลฯ) — ข้ามชุดนั้นไปใช้บทมาตรฐาน ไม่พังทั้งก้อน
    if (!isEditableScriptKey(r.script_key)) continue;
    if (validateScriptLines(r.lines) !== null) continue;
    next[r.script_key] = (r.lines as string[]).map((l) => l.trim());
  }
  setCallScriptOverrides(next);
  loadedAt = Date.now();
}

/**
 * เรียกก่อนประกอบ payload ส่ง Lumos ทุกครั้ง — โหลดฉบับแก้ถ้าของที่ถืออยู่เก่ากว่า 30 วิ
 * ล้ม = ใช้ของเดิมที่วางไว้ (หรือบทมาตรฐาน) · **ห้าม throw** สายต้องออกได้เสมอ
 */
export async function ensureCallScriptsFresh(): Promise<void> {
  if (Date.now() - loadedAt < CACHE_MS) return;
  inflight ??= load()
    .catch((e) => {
      logError('callScriptStore.load failed (ใช้บทเดิมไปก่อน)', e);
    })
    .finally(() => {
      inflight = null;
    });
  await inflight;
}

/** บังคับโหลดใหม่รอบหน้า — API เรียกหลังบันทึก/ลบ เพื่อให้เห็นผลทันทีไม่ต้องรอ 30 วิ */
export function invalidateCallScriptCache(): void {
  loadedAt = 0;
}
