/**
 * ส่งชื่อ/เบอร์ไปตั้งตารางโทรที่หน้า Follow (เจ้าของสั่ง 16 ส.ค. 2569 ข้อ 7:
 * *"กรณีลงแผนแจ้งเข้าพอกดแล้วไปหน้า Follow เอาชื่อคนคนนั้นตั้งแล้วให้เลือกแค่พวกวันที่ เวลา"*)
 *
 * ส่งผ่าน query string ไม่ใช่ state ของ router — คนจะได้ส่งลิงก์ให้กันได้ และกด
 * ปุ่มย้อนกลับแล้วค่ายังอยู่ (state ของ router หายตอน reload)
 *
 * ⚠️ **ห้ามใส่ข้อมูลอ่อนไหวเกินชื่อ/เบอร์/หัวข้อ** — query string ไปโผล่ใน log ของ
 * เบราว์เซอร์และ proxy ได้ · แค่นี้พอให้ฟอร์มกรอกให้เอง
 */
export const FOLLOW_PREFILL_KEYS = {
  name: 'pf_name',
  phone: 'pf_phone',
  topic: 'pf_topic',
  /**
   * ชื่อหน่วยงานที่เลือกไว้แล้วตอนตั้งขั้น (Phase 6.6/6.9) — ส่งต่อมาให้ฟอร์มไม่ต้องเลือกซ้ำ
   * ⚠️ ส่ง **ชื่อ** ไม่ส่ง site_code: ฟอร์ม Follow ให้คนยืนยันหน่วยงานจาก picker เองอยู่แล้ว
   * ค่านี้เป็นแค่ตัวช่วยกรอก (ชื่อหน่วยงานไม่ใช่ข้อมูลอ่อนไหว ต่างจากรหัสภายใน)
   */
  unitName: 'pf_unit',
  /**
   * ทางกลับหน้าเดิม (เจ้าของสั่ง 4 ต.ค. 2569: *"ต้องมีทางเข้า และทางเอากลับ"*) — มาตั้งรอบโทรจาก
   * หน้าอื่น (ดูแลหลังเริ่มงาน · บอร์ดคัดสรร) บันทึกเสร็จต้องมีปุ่มพากลับ ไม่ใช่ค้างอยู่หน้าติดตาม
   */
  back: 'pf_back',
  backLabel: 'pf_back_label',
} as const;

export type FollowPrefill = {
  name?: string;
  phone?: string;
  topic?: string;
  unitName?: string;
  /** path ในระบบที่จะพากลับ (ต้องขึ้นต้น "/" ตัวเดียว — กันลิงก์พาออกนอกระบบ) */
  back?: string;
  /** ชื่อหน้าที่จะกลับ เช่น "ดูแลหลังเริ่มงาน" — ปุ่มเขียนว่า "กลับหน้า…" */
  backLabel?: string;
};

/** รับเฉพาะ path ภายในระบบ — "/x" ได้ · "//evil" / "http:" / ว่าง ไม่ได้ */
export function safeFollowBackPath(v: string | undefined): string | undefined {
  const t = (v ?? '').trim();
  if (!t.startsWith('/') || t.startsWith('//') || t.length > 300) return undefined;
  if (/[\s\\]/.test(t)) return undefined;
  return t;
}

/** สร้าง path ไปหน้า Follow พร้อมค่าที่จะให้ฟอร์มกรอกให้ */
export function buildFollowPrefillPath(prefill: FollowPrefill): string {
  const params = new URLSearchParams();
  if (prefill.name?.trim()) params.set(FOLLOW_PREFILL_KEYS.name, prefill.name.trim().slice(0, 200));
  if (prefill.phone?.trim()) params.set(FOLLOW_PREFILL_KEYS.phone, prefill.phone.trim().slice(0, 20));
  if (prefill.topic?.trim()) params.set(FOLLOW_PREFILL_KEYS.topic, prefill.topic.trim().slice(0, 200));
  if (prefill.unitName?.trim()) {
    params.set(FOLLOW_PREFILL_KEYS.unitName, prefill.unitName.trim().slice(0, 200));
  }
  const back = safeFollowBackPath(prefill.back);
  if (back) {
    params.set(FOLLOW_PREFILL_KEYS.back, back);
    if (prefill.backLabel?.trim()) params.set(FOLLOW_PREFILL_KEYS.backLabel, prefill.backLabel.trim().slice(0, 40));
  }
  const qs = params.toString();
  return qs ? `/follow?${qs}` : '/follow';
}

/** อ่านค่าที่ส่งมา — ไม่มี = undefined (ฟอร์มใช้ค่าเดิมของตัวเอง) */
export function readFollowPrefill(search: string | URLSearchParams): FollowPrefill {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const pick = (k: string) => {
    const v = (p.get(k) ?? '').trim();
    return v ? v : undefined;
  };
  return {
    name: pick(FOLLOW_PREFILL_KEYS.name),
    phone: pick(FOLLOW_PREFILL_KEYS.phone),
    topic: pick(FOLLOW_PREFILL_KEYS.topic),
    unitName: pick(FOLLOW_PREFILL_KEYS.unitName),
    back: safeFollowBackPath(pick(FOLLOW_PREFILL_KEYS.back)),
    backLabel: pick(FOLLOW_PREFILL_KEYS.backLabel)?.slice(0, 40),
  };
}

/** มีค่าอะไรส่งมาบ้างไหม — ใช้ตัดสินว่าจะเปิดฟอร์มให้เองหรือเปล่า */
export function hasFollowPrefill(prefill: FollowPrefill): boolean {
  return Boolean(prefill.name || prefill.phone || prefill.topic || prefill.unitName);
}

/**
 * แยกชื่อเต็มเป็น คำนำหน้า/ชื่อ/นามสกุล ให้ฟอร์ม Follow
 * (ใช้ตรรกะเดียวกับ picker เลือกชื่อจากบอร์ด — คำนำหน้าติดมากับชื่อได้)
 */
export function splitPrefillName(full: string): { prefix: string; first: string; last: string } {
  const PREFIXES = ['นางสาว', 'นาย', 'นาง'] as const; // ยาวก่อนสั้น ("นางสาว" ต้องชนะ "นาง")
  let rest = (full || '').trim();
  let prefix = '';
  for (const pre of PREFIXES) {
    if (rest.startsWith(pre)) {
      prefix = pre;
      rest = rest.slice(pre.length).trim();
      break;
    }
  }
  const [first = '', ...others] = rest.split(/\s+/).filter(Boolean);
  return { prefix, first, last: others.join(' ') };
}
