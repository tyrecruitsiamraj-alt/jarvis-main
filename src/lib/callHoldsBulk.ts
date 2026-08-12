/**
 * "เก็บไปโทรเอง" ทีละหลายคน — ตรรกะ pure ของการแบ่งกลุ่มเป้าหมายและสรุปผล
 *
 * ใช้ 2 ที่: แถบติ๊กเลือกหน้า Matching และแถวรายชื่อผู้สมัคร (มุมมอง list ของบอร์ด)
 * ตัวยิง API วนอยู่ที่หน้า — ที่นี่มีแต่ของที่เทสต์ได้โดยไม่ต้อง mock fetch
 *
 * ⚠️ ล็อกจริงผูกกับ **เบอร์ E.164 ฝั่ง server** — การแบ่งกลุ่มที่นี่เป็นแค่การกันยิง
 * request ที่รู้ล่วงหน้าว่าจะ 400 (ไม่มีเบอร์/ไม่มีใบขอ) ห้ามเอาไป dedupe แทน server
 */
import type { AcquireCallHoldResult, CallHoldSource } from '@/lib/callHoldsApi';

export type HoldTarget = {
  /** คีย์ฝั่งระบบต้นทาง (card_id / iRecruit id / application uuid) — ไว้ display ไม่ใช่ตัวล็อก */
  candidateRef: string;
  candidateName: string | null;
  phone: string | null;
  jobId: string | null;
  requestNo?: string | null;
  source: CallHoldSource;
};

export type HoldTargetPartition = {
  /** พร้อมยิง: มีทั้งเบอร์และใบขอ */
  ready: HoldTarget[];
  /** ไม่มีเบอร์ — server จะตอบ no_phone อยู่ดี ไม่ต้องเสีย request */
  noPhone: HoldTarget[];
  /**
   * ไม่มีใบขอ (ใบสมัครที่เจ้าหน้าที่คีย์เอง) — POST บังคับ jobId + เช็ค BU scope
   * ผ่อนไม่ได้ ไม่งั้นล็อกเบอร์ข้ามแผนกได้
   */
  noJob: HoldTarget[];
};

export function partitionHoldTargets(targets: HoldTarget[]): HoldTargetPartition {
  const out: HoldTargetPartition = { ready: [], noPhone: [], noJob: [] };
  for (const t of targets) {
    if (!t.phone?.trim()) out.noPhone.push(t);
    else if (!t.jobId?.trim()) out.noJob.push(t);
    else out.ready.push(t);
  }
  return out;
}

export type AcquireOutcomeSummaryInput = {
  /** ผลจาก acquireCallHold เรียงตามลำดับที่ยิง คู่กับ target ตัวเดียวกัน */
  results: Array<{ target: HoldTarget; result: AcquireCallHoldResult }>;
  /** ชื่อผู้ใช้ปัจจุบัน — 409 ที่คนถือคือเราเอง (เบอร์ซ้ำในชุดที่เลือก) ไม่ใช่ conflict */
  viewerName?: string | null;
  skippedNoPhone?: number;
  skippedNoJob?: number;
};

/**
 * สรุปผลเป็นข้อความเดียวให้แถบ notice — บอกครบว่าเก็บได้เท่าไหร่ ติดใครบ้าง ข้ามอะไร
 * ⚠️ 409 ที่ heldBy เป็นเราเอง (เพราะเลือกคนเดียวกันจากสองแหล่ง หรือถืออยู่ก่อนแล้ว)
 * นับเป็น "อยู่ในถังอยู่แล้ว" ไม่ใช่ "ติดคนอื่น" — ไม่งั้นข้อความหลอกว่ามีคนแย่ง
 */
export function summarizeAcquireResults(input: AcquireOutcomeSummaryInput): string {
  const acquired: string[] = [];
  const alreadyMine: string[] = [];
  const heldByOther: string[] = [];
  const failed: string[] = [];

  for (const { target, result } of input.results) {
    const name = target.candidateName?.trim() || target.candidateRef;
    if (result.ok) {
      acquired.push(name);
    } else if (result.heldBy?.heldByName) {
      // heldBy เป็น CallHold ทั้งก้อน (API ส่งกลับตอน 409) — ชื่อคนถืออยู่ใน heldByName
      // เทียบด้วยชื่อเพราะ API จงใจไม่ส่ง userId (กันข้อมูลรั่ว — กติกาเดิมของบอร์ดทีม)
      const holder = result.heldBy.heldByName.trim();
      if (input.viewerName && holder === input.viewerName.trim()) alreadyMine.push(name);
      else heldByOther.push(`${name} (${holder})`);
    } else {
      failed.push(name);
    }
  }

  const parts: string[] = [];
  if (acquired.length > 0) parts.push(`เก็บเข้าถังโทรแล้ว ${acquired.length} คน`);
  if (alreadyMine.length > 0) parts.push(`อยู่ในถังคุณอยู่แล้ว ${alreadyMine.length} คน`);
  if (heldByOther.length > 0) parts.push(`ติดคนอื่นถืออยู่ ${heldByOther.length}: ${heldByOther.join(' · ')}`);
  if (failed.length > 0) parts.push(`ไม่สำเร็จ ${failed.length}: ${failed.join(' · ')}`);
  if (input.skippedNoPhone) parts.push(`ไม่มีเบอร์ ${input.skippedNoPhone} คน`);
  if (input.skippedNoJob) parts.push(`ไม่ผูกใบขอ (คีย์เอง) ${input.skippedNoJob} คน`);

  if (parts.length === 0) return 'ไม่มีอะไรให้เก็บ';
  return parts.join(' · ');
}
