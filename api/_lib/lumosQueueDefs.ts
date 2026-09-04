/**
 * ═══ นิยามกลางของคิวโทร Lumos — "หนึ่งเมตริก หนึ่งนิยาม" ═══
 *
 * 🔴 **ทำไมต้องมีไฟล์นี้ (บั๊กที่วัดเจอจริง 26 ส.ค. 2569):**
 * หน้าแรกเคยขึ้นว่า *"สายที่ส่ง AI ไปแล้วเงียบ 37 ราย"* พร้อมกับบอร์ดทีมบนจอเดียวกัน
 * ที่บอก *"รอผลจาก Lumos 0 · เงียบเกิน 1 วัน 0"* — วัดฐานแล้วพบว่า **38 แถวนั้นมีผล
 * กลับมาครบแล้ว** เพียงแต่ผลอยู่ที่คอลัมน์ `last_outcome` ไม่ใช่ `result`
 *
 * ```
 * flow_delivered_waiting = 38   ← เขียน `result is null` ตรง ๆ  (ผิด)
 * floor_waiting_result   =  0   ← เขียน coalesce(...)            (ถูก)
 * has_outcome_but_no_result = 38
 * ```
 *
 * `result` เป็น payload ดิบที่ Lumos ส่งกลับ · **`last_outcome` คือผลจริง** เพราะ
 * (1) ผลที่เจ้าหน้าที่บันทึกเองเขียนแค่ `last_outcome` (2) ตอนตั้งโทรซ้ำระบบ
 * **ล้าง `result` ทิ้ง** แต่คง `last_outcome` ไว้ ⇒ ใครอ่าน `result` อย่างเดียว
 * จะเห็นสายที่จบไปแล้วเป็น "ยังเงียบ" ตลอดกาล
 *
 * 🔴 **กติกา: ห้ามเขียน `result is null` / `count(result)` ในเส้นไหนอีก**
 * ให้ import จากไฟล์นี้เท่านั้น — มีเทสต์คุมที่ `tests/api/lumosQueueDefs.test.ts`
 * (บทเรียนเดียวกับรอบสี่สิบแปด: จอที่ **บอกผิด** แย่กว่าจอที่เงียบ)
 */

/** ใส่ชื่อ alias นำหน้าคอลัมน์ให้ — `''` = ไม่มี alias (คิวรีที่ select จากตารางเดียว) */
function col(alias: string, name: string): string {
  return alias ? `${alias}.${name}` : name;
}

/**
 * ผลของสาย — **นิยามเดียวของทั้งระบบ**
 * (ใช้ตรงกับ `applicantOverviewSql` · `applicationRotationSql` · `lumos-call-funnel`
 * ซึ่งเขียน coalesce แบบนี้อยู่ก่อนแล้ว ไฟล์นี้แค่ยกมาไว้ที่เดียวให้ import ได้)
 */
export function queueOutcome(alias = 'q'): string {
  return `coalesce(${col(alias, 'last_outcome')}, ${col(alias, 'result')}->>'outcome')`;
}

/** มีผลกลับแล้ว (ไม่ว่าผลจะเป็นอะไรก็ตาม รวม "ไม่รับสาย") */
export function queueHasResult(alias = 'q'): string {
  return `(${queueOutcome(alias)} is not null)`;
}

/**
 * ยกเลิกแล้ว — 🔴 **ห้ามนับรวมใน "ส่งเข้าทั้งหมด"**
 * (กติกาแม่ของโปรเจกต์: ห้ามนับที่ถูกยกเลิกเป็นที่หาได้ · เลนที่มีแต่แถวยกเลิก
 * เคยขึ้นจอว่า "ส่งเข้าทั้งหมด 1 · รอโทร 0 · รอผลกลับ 0 · ได้ผลแล้ว 0" ซึ่งอ่านไม่รู้เรื่อง)
 */
export function queueCancelled(alias = 'q'): string {
  return `(${col(alias, 'status')} = 'cancelled' or ${queueOutcome(alias)} = 'cancelled')`;
}

/** แถวที่ยังอยู่ในเกม — ทุกตัวหารต้องใช้อันนี้ ไม่ใช่ `count(*)` เปล่า */
export function queueActive(alias = 'q'): string {
  return `(not ${queueCancelled(alias)})`;
}

/** Lumos รับไปแล้วแต่ยังไม่มีผลกลับ */
export function queueWaiting(alias = 'q'): string {
  return `(${col(alias, 'status')} = 'delivered' and ${queueOutcome(alias)} is null)`;
}

/** ยังไม่ถูกส่งออก (ยังไม่ถึงมือ Lumos) */
export function queuePending(alias = 'q'): string {
  return `(${col(alias, 'status')} = 'pending' and ${queueOutcome(alias)} is null)`;
}

/** เวลาที่ถูกส่งออก — แถวก่อน migration 088 ไม่มี `first_delivered_at` จึงถอยไป `updated_at` */
export function queueSentAt(alias = 'q'): string {
  return `coalesce(${col(alias, 'first_delivered_at')}, ${col(alias, 'updated_at')})`;
}

/** เวลาที่ผลกลับมา */
export function queueResultAt(alias = 'q'): string {
  return `coalesce(${col(alias, 'first_result_at')}, ${col(alias, 'updated_at')})`;
}

/**
 * ส่งไปแล้วเงียบเกินกำหนด — `interval` เป็นข้อความของ postgres เช่น `'1 day'`
 * ⚠️ เกณฑ์ไม่เท่ากันทุกจอโดยตั้งใจ (โต๊ะ AI ใช้ 1 วัน · คิวงานหน้าแรกใช้ 2 วัน)
 * แต่ **นิยาม "ยังไม่มีผล" ต้องตัวเดียวกัน** ซึ่งคือสิ่งที่ไฟล์นี้บังคับ
 */
export function queueStale(interval: string, alias = 'q'): string {
  return `(${queueWaiting(alias)} and ${queueSentAt(alias)} < now() - interval ${interval})`;
}

/** รอส่งออกนานเกินกำหนด (ค้างตั้งแต่ยังไม่ถึงมือ Lumos) */
export function queueStalePending(interval: string, alias = 'q'): string {
  return `(${queuePending(alias)} and coalesce(${col(alias, 'next_attempt_at')}, ${col(alias, 'created_at')}) < now() - interval ${interval})`;
}


/**
 * ชื่อ/เบอร์ในกล่อง payload ของคิว — **นิยามเดียวของทั้งระบบ**
 * (คิวเก็บ payload คนละคีย์ตามต้นทาง: งานติดตามใช้ `recipient_*` · บอร์ดใช้ `candidate_*`)
 * 🔴 ห้าม dump payload ทั้งก้อนออกหน้าจอ — ในนั้นมีบทพูดและเบอร์ฉุกเฉิน
 */
export function queuePayloadName(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  for (const key of ['recipient_name', 'candidate_name', 'full_name']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export function queuePayloadPhone(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  for (const key of ['recipient_phone', 'candidate_phone', 'phone']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}
