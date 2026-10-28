/**
 * ═══ ติ๊ก "ต้องส่งคนแทน" = ไม่คิดค่าปรับ/ลดมูลค่าทั้งใบ (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"หมายเหตุมีคำว่า ex ประจำ 3 คน และบอกว่าต้องส่งคนแทน ก็ไม่น่าจะโดนค่าปรับสิ เพราะให้ผูกเงื่อนไขว่า
 * > ถ้าบอกว่าต้องส่งคนแทน จะไม่โดนค่าปรับ"* (เคส LBM6903001 สมิติเวช ขึ้น 2,750 บาท/วัน)
 * ช่องมาจากหน้าใบขอ (`siamraj_unit_notes.send_replacement` · Spare นับรวมเพราะเก็บเป็น true)
 * 🔴 ตัวตัดสินมีที่เดียว — สมุดค่าปรับ (`requestPenaltyLedger`) · แท็บใบขอ (`requestPipeline`) · เมนูใบขอ (`jobPenalty`) เรียกตัวนี้
 */
export function penaltyWaivedByReplacement(sendReplacement: boolean | null | undefined): boolean {
  return sendReplacement === true;
}
