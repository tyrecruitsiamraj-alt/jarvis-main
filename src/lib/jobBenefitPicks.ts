/**
 * ═══ สวัสดิการที่จะขึ้นประกาศ — ติ๊กเอา ไม่ต้องพิมพ์ ═══
 *
 * เจ้าของสั่ง 31 ส.ค. 2569:
 * > *"หน้าเลือกสวัสดิการ เอาจากใบขอขึ้นมาให้เป็น Checklist ได้ไหม จะได้ไม่ต้องพิมพ์เอง"*
 * > *"อยากได้แบบกดแล้วมีรายการให้เลือก"*
 *
 * ═══ รายการที่เอามาให้ติ๊ก = **ตารางอัตราตามใบขอ (ERP)** ═══
 *
 * เจ้าของชี้ตารางนี้มาเองตรง ๆ — ตารางเดียวกับที่โชว์อยู่บนหน้าใบขอ
 * (รายการ · อัตราจ่าย · อัตราเบิก) ⇒ ติ๊กบรรทัดไหน บรรทัดนั้นไปอยู่ในรายการที่จะขึ้นประกาศ
 *
 * 🔴 **โชว์เฉพาะอัตราจ่าย** — `draw_rate` (อัตราเบิก) ห้ามออกหน้าสาธารณะเด็ดขาด
 * สองคอลัมน์นี้ต่างกันมาก (ของจริง: เงินเดือน 16,304 กับ 23,861) — สลับคือบอกเลขผิดกับคนหางาน
 *
 * 🔴 **ค่าตั้งต้น = ไม่ติ๊กอะไรเลย** (เจ้าของเคาะ) — เพราะตารางอัตรามีทั้งค่าปรับ
 * (มาสาย · ค่าปรับขาดงาน) และกลไกจ่ายเงินตามกฎหมาย (เงินชดเชยลาป่วย ปกส) ปนอยู่
 * ถ้าติ๊กไว้ให้ล่วงหน้า มีทางที่ "ค่าปรับขาดงาน 851 บาท" หลุดขึ้นประกาศหาคนโดยไม่ตั้งใจ
 * ⇒ ไม่มีอะไรขึ้นประกาศจนกว่าคนจะติ๊กเอง และบรรทัดค่าปรับมีป้ายเตือนกำกับ
 */

/** บรรทัดอัตราจาก ERP เท่าที่ตัวเลือกต้องใช้ */
export type RateLineLike = {
  seq: number;
  fee_name: string | null;
  /** บรรทัดค่าจ้างหลัก — มีช่องรายได้ของตัวเองอยู่แล้ว ไม่ใช่สวัสดิการ */
  is_wage: boolean;
  /** 🔴 อัตราจ่ายเท่านั้น — `draw_rate` (อัตราเบิก) ห้ามโผล่หน้าสาธารณะเด็ดขาด */
  payment_rate: number | null;
  draw_rate?: number | null;
  remark?: string | null;
};

/**
 * ตัวเลือกหนึ่งอันใน checklist — สร้างจากบรรทัดอัตรา
 * `label` คือคำที่จะขึ้นประกาศจริงถ้าถูกติ๊ก
 */
export type BenefitChoice = {
  /** คีย์คงที่ของบรรทัดนั้นในใบนี้ */
  key: string;
  /** ชื่อรายการดิบจาก ERP — ใช้เป็น label ของรายการรายได้ */
  name: string;
  /** ชื่อ + อัตราจ่าย สำหรับโชว์บนปุ่มติ๊ก */
  label: string;
  /** อัตราจ่าย (บาท) — `null` = ไม่มีตัวเลข */
  amount: number | null;
  /** 🔴 บรรทัดนี้เป็นค่าปรับ/หักเงิน ไม่ใช่สิ่งจูงใจ — จอต้องเตือนก่อนติ๊ก */
  isPenalty: boolean;
  /** ค่าจ้างหลัก — มีช่องรายได้ของตัวเองแล้ว */
  isWage: boolean;
};

/**
 * คำที่บอกว่าบรรทัดนี้เป็น **ค่าปรับ/หักเงิน** ไม่ใช่สวัสดิการ
 * 🔴 ขึ้นประกาศหาคนแล้วคนอ่านตกใจ — เจ้าของเคาะว่ายังให้ติ๊กได้ แต่ต้องเตือนให้เห็นก่อน
 * (31 ส.ค. 2569 · ของจริงในตาราง: "มาสาย" · "ค่าปรับขาดงาน (ตามอัตรา)")
 */
const PENALTY_WORDS = ['ค่าปรับ', 'มาสาย', 'ขาดงาน', 'หัก'];

export function isPenaltyRate(feeName: string | null | undefined): boolean {
  const t = (feeName ?? '').trim();
  return t.length > 0 && PENALTY_WORDS.some((w) => t.includes(w));
}

/** ตัวเลือกทั้งหมดของใบนี้ — เรียงตามตารางอัตราเดิม ไม่จัดใหม่ */
export function rateLineChoices(lines: readonly RateLineLike[] | null | undefined): BenefitChoice[] {
  if (!lines) return [];
  const out: BenefitChoice[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    const name = (l.fee_name ?? '').trim();
    if (!name) continue;
    const amount = typeof l.payment_rate === 'number' ? l.payment_rate : null;
    // คีย์ผูกกับชื่อ+ลำดับ เพื่อให้บรรทัดชื่อซ้ำ (เช่น "เงินเดือน" สองบรรทัด) แยกกันได้
    const key = `${l.seq}|${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      name,
      label: amount != null && amount > 0 ? `${name} ${amount.toLocaleString('th-TH')} บาท` : name,
      amount,
      isPenalty: isPenaltyRate(name),
      isWage: Boolean(l.is_wage),
    });
  }
  return out;
}

/** ป้ายที่ติ๊กแล้ว → บรรทัดที่จะขึ้นประกาศ (ต่อท้ายของที่พิมพ์เอง ไม่ทับกัน) */
export function mergePickedIntoLines(
  typedLines: readonly string[],
  pickedLabels: readonly string[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of [...typedLines, ...pickedLabels]) {
    const t = (v ?? '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
