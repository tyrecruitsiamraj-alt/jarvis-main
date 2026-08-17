/**
 * ชนิดข้อมูลของ master "เหตุผล" — ใช้ร่วมทั้ง `src/` และ `api/`
 * (แพตเทิร์นเดียวกับ `recruitPostings.ts`)
 */
import {
  RM_REASON_OUTCOMES,
  RM_REASON_PROCESSES,
  rmReasonOutcomeLabel,
  rmReasonProcessLabel,
} from '@/lib/recruitRmMasters';

export type RecruitReason = {
  id: string;
  /** '1' การติดต่อ · '2' นัดหมาย · '3' ติดตามการนัดหมาย */
  processCode: string;
  /** 'A' สำเร็จ · 'C' ไม่สำเร็จ */
  outcomeCode: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type RecruitReasonGroup = {
  processCode: string;
  processLabel: string;
  outcomeCode: string;
  outcomeLabel: string;
  reasons: RecruitReason[];
};

/**
 * จัดกลุ่มเป็น ขั้นตอน × ผล — เรียงตามลำดับที่ประกาศไว้ใน master ไม่ใช่ตามที่ฐานคืนมา
 * กลุ่มที่ไม่มีเหตุผลเลยก็คืนมาด้วย (กล่องว่างบอกว่า "ยังไม่มีเหตุผลของช่องนี้"
 * ต่างจากกล่องที่หายไปซึ่งอ่านไม่ออกว่าลืมทำหรือไม่มีจริง)
 */
export function groupRecruitReasons(rows: RecruitReason[]): RecruitReasonGroup[] {
  const out: RecruitReasonGroup[] = [];
  for (const p of RM_REASON_PROCESSES) {
    for (const o of RM_REASON_OUTCOMES) {
      out.push({
        processCode: p.code,
        processLabel: rmReasonProcessLabel(p.code),
        outcomeCode: o.code,
        outcomeLabel: rmReasonOutcomeLabel(o.code),
        reasons: rows.filter((r) => r.processCode === p.code && r.outcomeCode === o.code),
      });
    }
  }
  return out;
}
