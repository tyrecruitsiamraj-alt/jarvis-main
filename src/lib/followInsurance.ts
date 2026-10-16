/**
 * ═══ บรรทัดประกันของหน่วยงาน — ขั้น 4 ฟอร์มเพิ่มคนติดตาม (เจ้าของ 16 ต.ค. 2569 "อยากได้รายละเอียด แบบตามรูป") ═══
 * รูปจากใบขอที่พิมพ์ (ส่วนประกัน): แต่ละแถว = ประเภท · ใครจ่าย · ยอด บาท/ครั้ง · หมายเหตุ
 * แล้วใต้ P/A มีช่องติ๊กความคุ้มครอง 1–4 + อื่น ๆ
 *
 * ERP (อ่านอย่างเดียว · `api/_lib/followUnitInfo.ts`):
 *   แถว = `st_request_p2_grantee` (grantee_type · who_pay_code1/2 → `st_ms_who_pay` · item_amount · remark)
 *   ติ๊ก P/A = `st_request_p2.is_pa1..is_pa4 / is_pa99` + `pa99_remark` (ข้อความ "อื่น ๆ")
 * 🔴 ข้อความของข้อ 1–4 **ไม่มีใน ERP** (พิมพ์อยู่บนแบบฟอร์ม) — คัดจากใบขอที่เจ้าของส่งรูปมา ·
 *    ข้อ 4 "เงินเอาประกันชีวิต 100,000 บาท" เจ้าของยืนยันเอง (รูปตัดขอบ) · แบบฟอร์มเปลี่ยนเมื่อไหร่ต้องแก้ที่นี่
 */

export const PA_OPTION_TEXT: Record<1 | 2 | 3 | 4, string> = {
  1: 'กรณีเสียชีวิตจากอุบัติเหตุ จำนวนเงินเอาประกันอุบัติเหตุ 100,000 บาท',
  2: 'กรณีเสียชีวิตจากอุบัติเหตุ จำนวนเงินเอาประกันอุบัติเหตุ 200,000 บาท',
  3: 'กรณีเสียชีวิตจากอุบัติเหตุ จำนวนเงินเอาประกันอุบัติเหตุ 200,000 บาท และมีค่ารักษาพยาบาลเนื่องจากอุบัติเหตุ 20,000 บาท/ครั้ง',
  4: 'กรณีเสียชีวิตจากอุบัติเหตุ จำนวนเงินเอาประกันอุบัติเหตุ 200,000 บาท กรณีเสียชีวิตอื่น ๆ ไม่ใช่เนื่องจากอุบัติเหตุ จำนวนเงินเอาประกันชีวิต 100,000 บาท และมีค่ารักษาพยาบาลเนื่องจากอุบัติเหตุ 20,000 บาท/ครั้ง',
};

export type GranteeRow = {
  name: string | null;
  /** ชื่อใครจ่าย (ลูกค้าจ่าย / SR. จ่าย / พนง.จ่าย / SO.จ่าย) — ช่อง 1 และ 2 */
  whoPay1?: string | null;
  whoPay2?: string | null;
  /** บาท/ครั้ง — 0/ว่าง = ไม่บอกยอด */
  amount?: number | string | null;
  remark?: string | null;
};

export type PaFlags = {
  is_pa1?: string | null;
  is_pa2?: string | null;
  is_pa3?: string | null;
  is_pa4?: string | null;
  is_pa99?: string | null;
  pa99_remark?: string | null;
};

const NUM = new Intl.NumberFormat('th-TH');
const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const yes = (v: unknown) => clean(v).toUpperCase() === 'Y';
/** "ไมมี" / "ไม่มี" / "-" = ไม่มีอะไรให้บอก */
const isNone = (s: string) => !s || s === '-' || /^ไม่?มี$/u.test(s);

/** ความคุ้มครอง P/A ที่ติ๊กไว้ (ตามลำดับบนแบบฟอร์ม) */
export function paCoverage(flags: PaFlags | null | undefined): string[] {
  if (!flags) return [];
  const out: string[] = [];
  for (const n of [1, 2, 3, 4] as const) if (yes(flags[`is_pa${n}`])) out.push(PA_OPTION_TEXT[n]);
  if (yes(flags.is_pa99)) {
    const r = clean(flags.pa99_remark);
    if (!isNone(r)) out.push(r);
  }
  return out;
}

/** บรรทัดประกันทั้งหมดของใบขอ — แถวละประเภท + บรรทัด "P/A คุ้มครอง" ต่อจากแถว P/A */
export function insuranceLines(rows: readonly GranteeRow[], flags?: PaFlags | null): string[] {
  const coverage = paCoverage(flags);
  const lines: string[] = [];
  let paShown = false;
  for (const r of rows) {
    const name = clean(r.name);
    const who = [clean(r.whoPay1), clean(r.whoPay2)].filter(Boolean).join(' + ');
    const amount = Number(r.amount);
    const remark = clean(r.remark);
    const line = [
      name,
      who,
      Number.isFinite(amount) && amount > 0 ? `${NUM.format(amount)} บาท/ครั้ง` : '',
      isNone(remark) ? '' : remark,
    ]
      .filter(Boolean)
      .join(' · ');
    if (line && !lines.includes(line)) lines.push(line);
    if (/^P\/?A\b/i.test(name) && !paShown && coverage.length > 0) {
      lines.push(...coverage.map((c) => `P/A คุ้มครอง: ${c}`));
      paShown = true;
    }
  }
  // ติ๊กความคุ้มครองไว้ แต่ไม่มีแถว P/A — ยังบอก (ไม่หายเงียบ)
  if (!paShown && coverage.length > 0) lines.push(...coverage.map((c) => `P/A คุ้มครอง: ${c}`));
  return lines;
}
