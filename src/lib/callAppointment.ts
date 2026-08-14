/**
 * ผลโทร "สนใจ" แตกเป็นสองทาง — เจ้าของสั่ง 14 ส.ค. 2569:
 * *"มันต้องมีให้เลือกอะว่าโทรแล้ว สนใจหรือไม่สนใจ แต่สนใจก็ยังมีสนใจแล้วนัดได้
 * กับยังนัดไม่ได้อะ"*
 *
 * แพตเทิร์นเดียวกับ "ไม่สนใจ" ที่แยก `job` / `all` อยู่แล้ว — ใช้คอลัมน์ `result_scope`
 * ตัวเดิม ไม่เพิ่ม outcome ใหม่ เพราะ **ศัพท์ outcome ต้องเป็นค่าที่ Lumos ส่งกลับได้จริง**
 * (funnel เอาผลของคนกับของ AI มานับรวมกันด้วยคีย์ชุดนี้ · ดู 09-editing-map)
 *
 * ทั้งไฟล์เป็นฟังก์ชันล้วน — ใช้ทั้ง `src/` (ฟอร์มกดผลโทร) และ `api/` (ด่านตรวจก่อนลงฐาน)
 */

/** "สนใจ" แบบไหน — scheduled = นัดวันสัมภาษณ์ได้แล้ว · unscheduled = สนใจแต่ยังนัดไม่ได้ */
export type ConfirmedScope = 'scheduled' | 'unscheduled';

/** "ไม่สนใจ" แบบไหน — job = ไม่เอางานนี้ (AI เสนองานอื่นต่อได้) · all = ไม่หางานแล้ว (พักเบอร์) */
export type DeclinedScope = 'job' | 'all';

/** ค่าที่ลงคอลัมน์ `result_scope` ได้ (ต้องตรงกับ CHECK ใน migration 085) */
export type CallResultScope = DeclinedScope | ConfirmedScope;

export const CONFIRMED_SCOPES: readonly ConfirmedScope[] = ['scheduled', 'unscheduled'];

export function isConfirmedScope(v: unknown): v is ConfirmedScope {
  return v === 'scheduled' || v === 'unscheduled';
}

export function isDeclinedScope(v: unknown): v is DeclinedScope {
  return v === 'job' || v === 'all';
}

/** ป้ายบนปุ่ม + คำอธิบายว่ากดแล้วเกิดอะไร (เจ้าหน้าที่ต้องเลือกจากสองอันนี้) */
export const CONFIRMED_SCOPE_LABEL: Record<ConfirmedScope, string> = {
  scheduled: 'นัดได้เลย',
  unscheduled: 'สนใจ แต่ยังนัดไม่ได้',
};

export const CONFIRMED_SCOPE_HINT: Record<ConfirmedScope, string> = {
  scheduled: 'ใส่วันนัดสัมภาษณ์ — จะขึ้นในแท็บติดตามนัดหมาย',
  unscheduled: 'เก็บไว้ว่าสนใจแล้ว รอเคาะวันทีหลัง',
};

/**
 * เพดานวันนัดล่วงหน้า — **กันปีพุทธศักราชหลุดเข้าฐาน**
 *
 * ⚠️ กับดักจริงของงานนี้: ทั้งระบบพูดเป็น พ.ศ. (2569) แต่ช่องวันที่คืนค่าเป็น ค.ศ.
 * ถ้ามีใครยิง `2569-08-20` เข้ามาทาง API มันเป็นวันที่ที่ถูกต้องตามรูปแบบทุกประการ
 * แต่อยู่ห่างออกไป **543 ปี** — ลงฐานได้เงียบ ๆ แล้วไม่มีใครเห็นในแท็บนัดหมายอีกเลย
 */
export const MAX_APPOINTMENT_YEARS_AHEAD = 2;

export type AppointmentInput = {
  outcome: string;
  scope?: unknown;
  /** วันนัดจากฟอร์ม (`YYYY-MM-DD`) หรือ ISO เต็ม — ว่าง/ไม่ส่ง = ไม่มีวันนัด */
  appointmentAt?: unknown;
  /** เวลาอ้างอิงตอนตรวจ (ISO) — ส่งเข้ามาเพื่อให้เทสต์คุมได้ ไม่ใช้ Date.now() ข้างใน */
  now: string;
};

/**
 * ⚠️ **object แบน ไม่ใช่ discriminated union โดยตั้งใจ** — `tsconfig.app.json` ตั้ง
 * `strict: false` ฝั่ง `src/` จึง narrow union ด้วย `ok` ไม่เข้า (`decided.reason`
 * จะฟ้องว่าไม่มีพร็อพนี้ทั้งที่เช็ค `!decided.ok` มาแล้ว) — กับดักเดียวกับ
 * `AcquireCallHoldResult` ใน candidateCallHolds.ts ที่แบนไว้ด้วยเหตุผลเดียวกัน
 *
 * กติกา: `ok === (reason === null)` เสมอ — ปิดทางไม่ผ่านต้องมีเหตุผลให้คนอ่านทุกครั้ง
 */
export type AppointmentDecision = {
  ok: boolean;
  scope: CallResultScope | null;
  appointmentAt: string | null;
  reason: string | null;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** ฐานของคำตอบ "ไม่ผ่าน" — ไม่มี scope ไม่มีวันนัด เหลือแค่เหตุผล */
const FAIL = { ok: false, scope: null, appointmentAt: null } as const;

/**
 * แปลงค่าวันนัดเป็น ISO — รับทั้ง `YYYY-MM-DD` (จากช่อง date) และ ISO เต็ม
 * `YYYY-MM-DD` ถือเป็น **เที่ยงวันเวลาไทย** ไม่ใช่เที่ยงคืน UTC
 *
 * ⚠️ เที่ยงคืน UTC ของวันที่ไทยคือ **7 โมงเช้าของวันเดียวกัน** ก็จริง แต่พอแปลงกลับ
 * ไปโชว์ด้วยเขตเวลาอื่นจะเลื่อนเป็นวันก่อนหน้าได้ · ยึดเที่ยงวันแล้วเหลือระยะกันชน
 * 12 ชั่วโมงทั้งสองทาง วันที่ที่คนเห็นจึงไม่มีทางเพี้ยนไปวันข้าง ๆ
 */
function toIsoAppointment(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (YMD.test(s)) {
    const d = new Date(`${s}T12:00:00+07:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * ด่านเดียวที่ตัดสินว่าผลโทรนี้ลงฐานหน้าตาแบบไหน — เรียกทั้งฝั่งฟอร์มและฝั่ง API
 *
 * กติกา:
 * - `declined` ต้องมี scope เสมอ · ไม่ส่งมาถือเป็น `job` (ปลอดภัยกว่า ไม่ตัดคนออกเอง)
 * - `confirmed` + `scheduled` **ต้องมีวันนัด** — "นัดได้" ที่ไม่มีวันคือข้อมูลเสีย
 *   ไม่ใช่ค่าที่เดาแทนได้
 * - `confirmed` + `unscheduled` → ล้างวันนัดทิ้งเสมอ (กันวันที่ค้างจากที่กรอกไว้ก่อนเปลี่ยนใจ)
 * - `confirmed` ที่ไม่ส่ง scope มา → `null` **ไม่ใช่ `unscheduled`** — ผลจาก AI ไม่มีทางรู้
 *   ว่านัดได้ไหม การเดาให้จะไปโผล่ในรายงานว่า "โทรแล้วนัดไม่ได้" ทั้งที่ไม่มีใครถาม
 * - ผลแบบอื่น (ไม่รับสาย/เบอร์ผิด/ขอเลื่อน) ไม่มี scope และไม่มีวันนัด
 */
export function resolveAppointment(input: AppointmentInput): AppointmentDecision {
  const rawDate = typeof input.appointmentAt === 'string' ? input.appointmentAt : '';

  if (input.outcome === 'declined') {
    return {
      ok: true,
      scope: input.scope === 'all' ? 'all' : 'job',
      appointmentAt: null,
      reason: null,
    };
  }

  if (input.outcome !== 'confirmed') {
    return { ok: true, scope: null, appointmentAt: null, reason: null };
  }

  if (!isConfirmedScope(input.scope)) {
    return { ok: true, scope: null, appointmentAt: null, reason: null };
  }

  if (input.scope === 'unscheduled') {
    return { ok: true, scope: 'unscheduled', appointmentAt: null, reason: null };
  }

  const iso = toIsoAppointment(rawDate);
  if (!iso) {
    return { ...FAIL, reason: 'เลือก "นัดได้เลย" แล้วต้องใส่วันนัดสัมภาษณ์ด้วย' };
  }

  const at = new Date(iso).getTime();
  const now = new Date(input.now).getTime();
  if (Number.isNaN(now)) return { ...FAIL, reason: 'เวลาอ้างอิงไม่ถูกต้อง' };

  const limit = new Date(input.now);
  limit.setFullYear(limit.getFullYear() + MAX_APPOINTMENT_YEARS_AHEAD);
  if (at > limit.getTime()) {
    return {
      ...FAIL,
      reason: `วันนัดไกลเกิน ${MAX_APPOINTMENT_YEARS_AHEAD} ปี — ใส่เป็น ค.ศ. หรือเปล่า (ระบบเก็บเป็น ค.ศ.)`,
    };
  }

  return { ok: true, scope: 'scheduled', appointmentAt: iso, reason: null };
}
