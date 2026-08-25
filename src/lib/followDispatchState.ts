/**
 * สถานะ "งานติดตามนี้ถูกส่งให้ AI โทรหรือยัง" — คำที่คนอ่านออกทันที
 *
 * 🔴 ทำไมต้องมีไฟล์นี้ (เจ้าของสั่ง 25 ส.ค. 2569 หลังเจอของจริง):
 * รายการติดตามที่สร้างเมื่อ 24 ส.ค. **ไม่ถูกส่งให้ AI และไม่มีอะไรบอกใครเลย**
 * คนสร้างเห็นว่า "สร้างสำเร็จ" แล้วนั่งรอสายที่ไม่มีวันออก · ต้องไล่ฐานย้อนหลังกว่าจะรู้
 *
 * ระบบมีหลายทางที่จะ "ไม่ส่ง" โดยตั้งใจ (ปลอดภัยดีแล้ว) แต่**เงียบ** คือปัญหา
 * ไฟล์นี้แปลงเหตุผลดิบให้เป็นคำไทย + บอกว่า **แก้ได้เองไหม**
 */

/** ผลตอนพยายามส่งเข้าคิว — ตรงกับถังใน `insertQueueItems` */
export const FOLLOW_DISPATCH_STATES = [
  'queued',
  'held',
  'suppressed',
  'guarded',
  'no_phone',
  'off',
] as const;
export type FollowDispatchState = (typeof FOLLOW_DISPATCH_STATES)[number];

export function isFollowDispatchState(v: unknown): v is FollowDispatchState {
  return typeof v === 'string' && (FOLLOW_DISPATCH_STATES as readonly string[]).includes(v);
}

export type FollowDispatchMeta = {
  label: string;
  /** อธิบายให้คนที่ไม่รู้ระบบเข้าใจว่าเกิดอะไรขึ้น */
  hint: string;
  /**
   * ต้องมีคนลงมือต่อไหม — `true` = งานค้างอยู่ ไม่มีใครโทรแน่ ๆ
   * จอต้องทำให้เห็นชัด (สีเตือน) ไม่ใช่ปล่อยกลืนไปกับสถานะปกติ
   */
  needsAction: boolean;
  /** ลองส่งใหม่แล้วมีโอกาสผ่าน (ต่างจากที่ต้องรอคนอื่นปล่อย/แก้ข้อมูลก่อน) */
  retryable: boolean;
};

export const FOLLOW_DISPATCH_META: Record<FollowDispatchState, FollowDispatchMeta> = {
  queued: {
    label: 'ส่งให้ AI แล้ว',
    hint: 'อยู่ในคิว รอ AI โทรตามเวลาที่นัดไว้',
    needsAction: false,
    retryable: false,
  },
  held: {
    label: 'ไม่ได้ส่ง — มีคนรับไปโทรเอง',
    hint: 'เจ้าหน้าที่จองเบอร์นี้ไว้โทรเอง AI จึงไม่โทรทับ',
    needsAction: false,
    retryable: false,
  },
  suppressed: {
    label: 'ไม่ได้ส่ง — เบอร์อยู่ในบัญชีห้ามโทร',
    hint: 'เจ้าของเบอร์แจ้งว่าไม่หางานแล้ว หรือเบอร์ใช้ไม่ได้',
    needsAction: true,
    retryable: false,
  },
  /** 🔴 เคสที่ทำให้ต้องมีไฟล์นี้ — ตรวจไม่ได้ ไม่ใช่ติดเงื่อนไข */
  guarded: {
    label: 'ไม่ได้ส่ง — ระบบตรวจไม่ได้ตอนนั้น',
    hint: 'ตอนนั้นเปิดบัญชีห้ามโทรไม่ได้ ระบบจึงกันไว้ก่อนเพื่อความปลอดภัย · กดส่งใหม่ได้เลย',
    needsAction: true,
    retryable: true,
  },
  no_phone: {
    label: 'ไม่ได้ส่ง — ไม่มีเบอร์ที่โทรได้',
    hint: 'ต้องเป็นเบอร์มือถือ 10 หลัก · แก้เบอร์แล้วส่งใหม่ได้',
    needsAction: true,
    retryable: true,
  },
  off: {
    label: 'ไม่ได้ส่ง — ปิดส่งอัตโนมัติอยู่',
    hint: 'ตั้งค่าให้จุดนี้เป็น manual ⇒ ต้องกดส่งเอง (เปลี่ยนได้ที่หน้าตั้งค่า)',
    needsAction: true,
    retryable: true,
  },
};

/**
 * สถานะที่โชว์บนลิสต์ — รวม "ผลตอนส่ง" กับ "สถานะคิวตอนนี้"
 *
 * 🔴 คิวเดินต่อได้หลังส่ง (pending → delivered → completed) ⇒ **ของสดชนะของเก่า**
 * แต่ถ้าไม่มีแถวในคิวเลย ให้ใช้เหตุผลตอนส่งที่จดไว้
 * ⚠️ แถวเก่าก่อนมีระบบจดเหตุผล (`state = null` + ไม่มีคิว) = **ไม่รู้ว่าทำไม**
 *    ต้องบอกตรง ๆ ว่าไม่รู้ ห้ามเดาว่า "ส่งแล้ว"
 */
export function followDispatchLabel(input: {
  state: string | null | undefined;
  callStatus: string | null | undefined;
}): FollowDispatchMeta {
  const status = String(input.callStatus ?? '').trim();
  if (status) {
    if (status === 'cancelled') {
      return {
        label: 'ถอนออกจากคิวแล้ว',
        hint: 'รายการถูกยกเลิก จึงดึงออกจากคิว AI',
        needsAction: false,
        retryable: false,
      };
    }
    if (status === 'completed') {
      return {
        label: 'AI โทรจบแล้ว',
        hint: 'มีผลกลับมาแล้ว — ดูผลได้ที่ช่องผลโทร',
        needsAction: false,
        retryable: false,
      };
    }
    if (status === 'delivered') {
      return {
        label: 'AI รับไปโทรแล้ว',
        hint: 'ส่งถึง Lumos แล้ว กำลังรอผลกลับ',
        needsAction: false,
        retryable: false,
      };
    }
    return FOLLOW_DISPATCH_META.queued;
  }

  if (isFollowDispatchState(input.state)) return FOLLOW_DISPATCH_META[input.state];

  return {
    label: 'ไม่ได้ส่งให้ AI โทร',
    hint: 'ไม่มีบันทึกว่าทำไม (รายการสร้างก่อนระบบจดเหตุผล) — ถ้าต้องการให้ AI โทร ให้สร้างรายการใหม่',
    needsAction: true,
    retryable: true,
  };
}

/**
 * สรุปข้อความหลังกด "เพิ่มรายชื่อ" — บอกทันทีว่าเข้าคิวกี่รายการ ไม่เข้ากี่รายการ เพราะอะไร
 *
 * 🔴 เดิมขึ้นแค่ "เพิ่มรายชื่อแล้ว" ทุกกรณี ⇒ คนไม่รู้เลยว่าไม่มีใครจะโทร
 * คืน `null` เมื่อเข้าคิวครบทุกรายการ (ไม่ต้องรบกวน — ข้อความเดิมพอแล้ว)
 */
export function summarizeDispatchResults(
  states: readonly (string | null | undefined)[],
): { text: string; retryable: boolean } | null {
  const bad = states.filter((s) => isFollowDispatchState(s) && FOLLOW_DISPATCH_META[s].needsAction);
  if (bad.length === 0) return null;
  // เหตุผลเดียวกันหลายรายการ ให้ยุบเป็นบรรทัดเดียว — ไม่ใช่พ่นซ้ำทุกแถว
  const reasons = [...new Set(bad.map((s) => FOLLOW_DISPATCH_META[s as FollowDispatchState].label))];
  const retryable = bad.every((s) => FOLLOW_DISPATCH_META[s as FollowDispatchState].retryable);
  const scope = bad.length === states.length ? 'ทั้งหมด' : `${bad.length} จาก ${states.length} รายการ`;
  return { text: `🔴 ${scope} ยังไม่ได้ส่งให้ AI โทร — ${reasons.join(' · ')}`, retryable };
}
