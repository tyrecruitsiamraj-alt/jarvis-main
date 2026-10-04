/**
 * **เพิ่มรอบโทรให้รายการที่ตั้งไว้แล้ว** (เจ้าของสั่ง 18 ส.ค. 2569:
 * *"ตรงแก้ไข เพิ่มรอบ ปรับเวลาอะไรต่างๆ ได้ด้วย เผื่อบางทีต้องโทร 2 รอบ
 * แต่ดันเผลอตั้งไปรอบเดียว"*)
 *
 * 🔴 **หนึ่งรายการ = หนึ่งสาย** — โครงเดิมผูกคิวโทรกับรายการ 1:1 (แต่ละรอบมีสถานะ/ผลของตัวเอง)
 * "เพิ่มรอบ" จึงเป็นการ **สร้างรายการใหม่** ที่ลอกคน/เรื่อง/หน่วยงานมา ไม่ใช่ยัดหลายเวลา
 * ลงรายการเดิม · ถ้าไปแก้ให้รายการเดียวถือหลายเวลา จะพังทั้งหน้าแผงรอบและการนับผลโทร
 *
 * 🔴 **กันเวลาซ้ำ** — ซ้ำกับรอบที่มีอยู่ หรือซ้ำกันเองในกล่องที่เพิ่ง keyed มา ต้องถูกตัดทิ้ง
 * ไม่งั้นได้สองสายเวลาเดียวกัน = โทรซ้อนหาคนเดิม (เคยโดนตอนกดเพิ่มรอบแล้วลืมแก้เวลา)
 *
 * 🔴 **เวลาที่ผ่านไปแล้วต้องเตือน ไม่ใช่ตัดทิ้งเงียบ** — Lumos ปัดสายที่ `scheduled_at`
 * เป็นอดีตทิ้งแบบเงียบ ฝั่งเราขึ้น delivered แต่เขาไม่เห็น (ดู lumos-integration-quirks)
 * คนตั้งต้องรู้ก่อนกดบันทึกว่ารอบไหนตกหล่นแน่ ๆ
 */

export type ExtraRoundsResult = {
  /** เวลาที่ใช้ได้จริง เรียงจากก่อนไปหลัง (ISO) — เอาไปสร้างรายการใหม่ */
  isoTimes: string[];
  /** ตัดทิ้งเพราะซ้ำ (กับรอบเดิมหรือซ้ำกันเอง) */
  duplicateCount: number;
  /** ตัดทิ้งเพราะรูปแบบเวลาไม่ถูก */
  invalidCount: number;
  /** อยู่ในอดีต — **ยังนับใช้ได้** แต่ต้องเตือน */
  pastCount: number;
};

/** ค่าจาก `<input type="datetime-local">` (YYYY-MM-DDTHH:mm ตามเวลาเครื่อง) → ISO
 * export ไว้ให้จอจับคู่ "ช่องที่ i → ISO ที่สร้างจริง" (เช่น เลือกใครโทรต่อรอบ · 3 ต.ค. 2569) */
export function localInputToIso(value: string): string | null {
  const t = (value || '').trim();
  if (!t) return null;
  // ต้องมีอย่างน้อย วันที่+เวลา — เบราว์เซอร์บางตัวใส่วินาทีมาด้วย
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(t)) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  // ตัดวินาที/มิลลิวินาทีทิ้ง — เทียบซ้ำระดับนาที (คนตั้งเป็นนาทีอยู่แล้ว)
  d.setSeconds(0, 0);
  return d.toISOString();
}

/** ISO → คีย์เทียบซ้ำระดับนาที (ตัดวินาทีทิ้ง) */
function minuteKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setSeconds(0, 0);
  return d.toISOString();
}

/**
 * แปลงช่องเวลาที่คนกรอกเป็นรอบที่สร้างได้จริง
 *
 * @param inputs   ค่าจากช่อง datetime-local (ช่องว่างถูกข้ามเงียบ ๆ ได้ ไม่นับเป็น invalid)
 * @param existing เวลาของรอบที่มีอยู่แล้วของคนนี้ (ISO) — รวมรอบที่กำลังแก้อยู่ด้วย
 * @param now      เวลาปัจจุบัน (ฉีดเข้ามาเพื่อให้เทสต์คุมได้)
 */
export function buildExtraRounds(
  inputs: string[],
  existing: string[],
  now: Date = new Date(),
): ExtraRoundsResult {
  const taken = new Set<string>();
  for (const iso of existing) {
    const k = minuteKey(iso);
    if (k) taken.add(k);
  }

  const isoTimes: string[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;
  let pastCount = 0;

  for (const raw of inputs) {
    // ช่องว่าง = คนยังไม่กรอก ไม่ใช่ความผิดพลาด
    if (!(raw || '').trim()) continue;
    const iso = localInputToIso(raw);
    if (!iso) {
      invalidCount += 1;
      continue;
    }
    if (taken.has(iso)) {
      duplicateCount += 1;
      continue;
    }
    taken.add(iso);
    if (new Date(iso).getTime() < now.getTime()) pastCount += 1;
    isoTimes.push(iso);
  }

  isoTimes.sort();
  return { isoTimes, duplicateCount, invalidCount, pastCount };
}

/**
 * ข้อความสรุปให้คนอ่านก่อนกดบันทึก — `null` = ไม่มีอะไรต้องบอก
 * รวมทุกเรื่องเป็นบรรทัดเดียว (เตือนหลายกล่องซ้อนกันคนไม่อ่าน)
 */
export function extraRoundsNote(r: ExtraRoundsResult): string | null {
  const parts: string[] = [];
  if (r.isoTimes.length > 0) parts.push(`เพิ่ม ${r.isoTimes.length} สาย`);
  if (r.duplicateCount > 0) parts.push(`ตัดเวลาซ้ำ ${r.duplicateCount}`);
  if (r.invalidCount > 0) parts.push(`เวลาไม่ถูกต้อง ${r.invalidCount}`);
  if (r.pastCount > 0) parts.push(`⚠️ ${r.pastCount} สายเป็นเวลาที่ผ่านมาแล้ว AI อาจไม่โทร`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** เพิ่มสายในป๊อปแก้ไขได้ครั้งละกี่สาย — เดิม 5 (เจ้าของ 4 ต.ค. 2569: *"ต้องลงได้แบบทั้งเดือน"*) ⇒ สองเดือน */
export const EXTRA_ROUNDS_MAX = 62;
/** ช่วงวันที่กางทีเดียวได้ (ตรงกับตารางหลายวันของฟอร์มเพิ่มคน) */
export const EXTRA_RANGE_MAX_DAYS = 31;

/**
 * ช่วงวัน → ช่องเวลาโทรวันละสาย (`YYYY-MM-DDTHH:MM` แบบที่ช่องวันเวลาใช้) — เติมทั้งเดือนได้ในกดเดียว
 * ช่วงผิด/เวลาผิด = [] · ยาวเกิน `EXTRA_RANGE_MAX_DAYS` ตัดที่วันที่ 31
 */
export function extraRangeInputs(from: string, to: string, time: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !/^\d{2}:\d{2}$/.test(time)) return [];
  const start = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const end = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const out: string[] = [];
  for (let t = start; t <= end && out.length < EXTRA_RANGE_MAX_DAYS; t += 86_400_000) {
    out.push(`${new Date(t).toISOString().slice(0, 10)}T${time}`);
  }
  return out;
}
