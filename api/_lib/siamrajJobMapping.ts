export type SiamrajJobType = 'thai_executive' | 'foreign_executive' | 'central' | 'valet_parking';

export function parseAgeRange(age: string | null | undefined): { min?: number; max?: number } {
  if (!age?.trim()) return {};
  const s = age.replace(/ปี/g, '').trim();
  const range = s.match(/(\d+)\s*[-–—~至]\s*(\d+)/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
  }
  // เลขเดียวในใบขอคือขอบล่าง ("20", "20 ขึ้นไป") — เดิมตีเป็น 20–20 ทำให้ So Scraping คัดคนตกเกือบหมด (LAM6909001, 2 พ.ย. 2569)
  // เว้นแต่ใบขอบอกชัดว่าเป็นเพดาน ("ไม่เกิน 45", "ต่ำกว่า 45", "สูงสุด 45")
  const single = s.match(/(\d+)/);
  if (single) {
    const n = Number(single[1]);
    if (!Number.isFinite(n)) return {};
    if (/ไม่เกิน|ต่ำกว่า|สูงสุด|ไม่ถึง/.test(s)) return { max: n };
    return { min: n };
  }
  return {};
}

export function formatGenderRequirement(sex: string | null | undefined): string | undefined {
  if (!sex?.trim()) return undefined;
  const raw = sex.trim();
  const t = raw.toUpperCase();
  if (t === 'M' || t === 'MALE' || raw === 'ชาย') return 'ชาย';
  if (t === 'F' || t === 'FEMALE' || raw === 'หญิง') return 'หญิง';
  if (t === 'B' || t === 'BOTH' || raw === 'ไม่ระบุ' || t === 'ANY') return 'ไม่ระบุ';
  return raw;
}

export function inferJobTypeFromDescription(...names: (string | null | undefined)[]): SiamrajJobType {
  const blob = names.filter(Boolean).join(' ').toLowerCase();
  if (!blob) return 'central';
  if (/valet|แวลเล่|แวลเลต|valetparking/i.test(blob)) return 'valet_parking';
  if (/ต่างชาติ|foreign|expat/i.test(blob)) return 'foreign_executive';
  if (/คนไทย|thai/i.test(blob)) return 'thai_executive';
  if (/ส่วนกลาง|central/i.test(blob)) return 'central';
  return 'central';
}

/** ตำแหน่งใน ERP ที่ไม่ต้องบอก (เกือบทุกใบเป็น "พนักงาน") · เลขรหัสล้วนไม่ใช่ชื่อ */
const PLAIN_STAFF_TITLES = new Set(['พนักงาน', 'ไม่ระบุ']);

/**
 * ชื่อตำแหน่งของใบขอ = ประเภทงาน (`job_name1` / รหัสงาน) — ตำแหน่งใน ERP ที่ไม่ใช่ "พนักงาน" นำหน้า
 * 🔴 25 พ.ย. 2569 เจ้าของ "LMO6911017 เปิดมาเป็น หัวหน้าไซต์ แต่ในระบบเราเป็น คนสวน" · Choice "หัวหน้าไซด์ คนสวน"
 *   เดิมเอาช่องแรกที่มีค่า ⇒ ประเภทงานชนะเสมอ ตำแหน่งหาย (การ์ด · ประกาศ · บท AI พูด "คนสวน")
 *   วัดวันนั้น: ใบเปิด 313 ใบ ตำแหน่ง "พนักงาน" 302 · หัวหน้าไซด์ 4 · แรงงานสำรอง 3 · เจ้าหน้าที่ 3 · ผู้ช่วย 1
 * คำตามที่ ERP เขียน (ไม่แก้ "ไซด์") · ชื่องานมีคำตำแหน่งอยู่แล้ว = ไม่ซ้ำ
 */
export function primaryJobRoleLabel(
  jobName1: string | null | undefined,
  staffTitleName: string | null | undefined,
  code1: string | null | undefined,
): string | undefined {
  const named = (v: string | null | undefined) => {
    const s = v?.trim() || '';
    return s && !/^\d+$/.test(s) ? s : '';
  };
  const job = named(jobName1) || named(code1);
  const raw = named(staffTitleName);
  const title = raw && !PLAIN_STAFF_TITLES.has(raw) ? raw : '';
  if (job && title && !job.includes(title)) return `${title} ${job}`;
  // ไม่รู้ประเภทงาน = ใช้ตำแหน่ง (รวม "พนักงาน") แบบเดิม · ไม่มีชื่อเลย = รหัสเดิม
  return job || raw || code1?.trim() || undefined;
}
