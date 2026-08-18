import { apiFetch } from '@/lib/apiFetch';

/**
 * รายชื่อจากบอร์ด ERP สำหรับ **ตั้งตารางโทรตาม** ในหน้า Follow (F5b · 16 ส.ค. 2569)
 *
 * ขอบเขตที่เจ้าของกำหนด: ทุกถัง **ยกเว้น Checklist** (คนยังสมัครไม่เสร็จ = งานเลนสรรหา)
 *
 * 🔴 18 ส.ค. 2569 (ค่ำ-2): **เอาคนที่แจ้งเข้าแล้วกลับเข้ากล่อง** (เจ้าของสั่ง) —
 * เดิม server ตัดทิ้งทำให้ถัง Done เหลือ 51 จาก 235 คน ซึ่งคนกลุ่มนั้นคือกลุ่มที่ต้องตาม
 * เรื่องเริ่มงาน/เรียนงาน/เบิกเบี้ยเลี้ยงพอดี · ตอนนี้มาครบแล้วและติดป้าย `is_informed`
 */
export type BoardPickerPerson = {
  card_id: number;
  first_name: string | null;
  last_name: string | null;
  nick_name: string | null;
  /** เพศจากใบสมัคร (M/F) — ใช้เดาคำนำหน้า เพราะบอร์ดไม่เก็บคำนำหน้าแยก */
  sex_code: string | null;
  mobile: string | null;
  skills: string | null;
  area: string | null;
  column_label: string | null;
  last_activity_at: string | null;
  /** แจ้งเข้าแล้ว = ได้งานแล้ว — ป้ายเตือนบนลิสต์ ไม่ใช่เงื่อนไขกรองออกอีกแล้ว */
  is_informed?: boolean;
};

export async function listBoardPickerPeople(): Promise<BoardPickerPerson[]> {
  const r = await apiFetch('/api/matching/board-candidates?picker=1');
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดรายชื่อไม่สำเร็จ (HTTP ${r.status})`);
  }
  const data = (await r.json()) as { people?: BoardPickerPerson[] };
  return data.people ?? [];
}

/**
 * ชื่อเต็มที่ใช้แสดง — ไม่มีชื่อจริงใช้ชื่อเล่น ไม่มีเลยใช้เลขการ์ด (ห้ามเป็นช่องว่าง)
 * มี**คำนำหน้า**นำเสมอ (เจ้าของทัก 18 ส.ค. 2569: *"เลือกจากบอร์ด มันไม่มีคำนำหน้าหรอ"*)
 * — ใช้ตัวเดียวกับที่เติมลงฟอร์ม (`splitPickerName`) ลิสต์กับฟอร์มจึงตรงกันเสมอ
 */
export function pickerDisplayName(p: BoardPickerPerson): string {
  const { prefix, first, last } = splitPickerName(p);
  const full = [prefix + first, last].filter(Boolean).join(' ').trim();
  return full || (p.nick_name || '').trim() || `การ์ด #${p.card_id}`;
}

/** ข้อความที่ใช้ค้นฝั่ง client — ชื่อ/ชื่อเล่น/สกิล/พื้นที่/เบอร์/ถัง (แพตเทิร์นเดียวกับหน้าผู้สมัคร) */
export function pickerSearchBlob(p: BoardPickerPerson): string {
  return [
    p.first_name,
    p.last_name,
    p.nick_name,
    p.skills,
    p.area,
    p.mobile,
    p.column_label,
    p.is_informed ? 'แจ้งเข้าแล้ว' : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * กรองรายชื่อด้วยคำค้น — ทุกคำต้องเจอ (AND) เหมือนหน้า "ผู้สมัคร"
 * คำค้นว่าง = คืนทั้งหมด · จำกัดผลไว้ที่ `limit` เพื่อไม่ให้ dialog เรนเดอร์เป็นพัน ๆ แถว
 */
export function filterPickerPeople(
  people: BoardPickerPerson[],
  query: string,
  limit = 100,
): BoardPickerPerson[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return people.slice(0, limit);
  const out: BoardPickerPerson[] = [];
  for (const p of people) {
    const blob = pickerSearchBlob(p);
    if (terms.every((t) => blob.includes(t))) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * แยกชื่อที่บอร์ดเก็บไว้ออกเป็น คำนำหน้า/ชื่อ/นามสกุล ให้ฟอร์ม Follow
 * บอร์ดเก็บคำนำหน้าติดมากับ `fname` บ้าง ("นายสมชาย") — ต้องถอดออกไม่งั้นได้ "นายนายสมชาย"
 *
 * 🔴 **iRecruit ไม่เก็บคำนำหน้าเป็นคอลัมน์** (วัดจริง 18 ส.ค. 2569: เจอติดใน fname
 * แค่ 17/49,524 คน) — ชื่อที่ไม่มีคำนำหน้าติดมาให้**เดาจากเพศ**: M→นาย · F→นางสาว
 * ผู้หญิงอาจเป็น "นาง" — ฟอร์มแก้ได้ ห้ามล็อก · ไม่รู้เพศ = เว้นว่างเหมือนเดิม
 */
export function splitPickerName(p: BoardPickerPerson): {
  prefix: string;
  first: string;
  last: string;
} {
  const PREFIXES = ['นางสาว', 'นาย', 'นาง'] as const; // เรียงยาว→สั้น ("นางสาว" ต้องชนะ "นาง")
  let first = (p.first_name || p.nick_name || '').trim();
  let prefix = '';
  for (const pre of PREFIXES) {
    if (first.startsWith(pre)) {
      prefix = pre;
      first = first.slice(pre.length).trim();
      break;
    }
  }
  if (!prefix) {
    const sex = (p.sex_code || '').trim().toUpperCase();
    if (sex === 'M') prefix = 'นาย';
    else if (sex === 'F') prefix = 'นางสาว';
  }
  return { prefix, first, last: (p.last_name || '').trim() };
}
